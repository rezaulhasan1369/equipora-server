import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { TLSSocket } from 'node:tls';
import type { MongoClient } from 'mongodb';
import { getClient } from './db.js';
import { classifyDatabaseFailure, classifyTransportFailure } from './db-diagnostics.js';
import type { DatabaseFailureCategory, TransportFailureCategory } from './db-diagnostics.js';

const scope = new AsyncLocalStorage<object>();
const socketsChannel = channel('net.client.socket');
type Observation = { tcp: boolean; secure: boolean; failure?: TransportFailureCategory };

// Observes only sockets created by this explicitly authenticated connect attempt.
// No TLS monkey-patching, connection options, extra pools, or retry loops.
export async function observeDriverConnection(
  connect: (attach: (client: MongoClient) => void) => Promise<MongoClient> = attach => getClient(attach),
) {
  const token = {};
  const observations: Observation[] = [];
  const cleanup: Array<() => void> = [];
  let truncated = false;
  let handshakeCompleted = false;
  let connectionReady = false;
  let client: MongoClient | undefined;
  let category: DatabaseFailureCategory | 'ok' = 'ok';
  let connected = false;
  const onSocket = (message: unknown) => {
    if (scope.getStore() !== token) return;
    const socket = (message as { socket?: unknown })?.socket;
    if (!(socket instanceof TLSSocket)) return;
    if (observations.length >= 16) { truncated = true; return; }
    const observation: Observation = { tcp: false, secure: false };
    observations.push(observation);
    const tcp = () => { observation.tcp = true; };
    const secure = () => { observation.secure = true; };
    const failure = (error: unknown) => { observation.failure ??= classifyTransportFailure(error); };
    const closed = () => { if (!observation.secure) observation.failure ??= 'premature_close'; };
    const timeout = () => { observation.failure ??= 'handshake_timeout'; };
    socket.on('connect', tcp);
    socket.on('secureConnect', secure);
    socket.on('error', failure);
    socket.on('end', closed);
    socket.on('close', closed);
    socket.on('timeout', timeout);
    cleanup.push(() => {
      socket.off('connect', tcp); socket.off('secureConnect', secure);
      socket.off('error', failure); socket.off('end', closed); socket.off('close', closed); socket.off('timeout', timeout);
    });
  };
  // Driver public events confirm completed protocol work, without copying their payloads.
  const hello = () => { handshakeCompleted = true; };
  const ready = () => { connectionReady = true; };
  // The connect callback may attach these listeners before initiating a fresh connection.
  const attach = (mongo: MongoClient) => {
    client = mongo;
    mongo.on('serverHeartbeatSucceeded', hello);
    mongo.on('connectionReady', ready);
  };
  socketsChannel.subscribe(onSocket);
  try {
    await scope.run(token, async () => {
      client = await connect(attach);
      connected = true;
    });
  } catch (error: unknown) {
    category = classifyDatabaseFailure(error);
  } finally {
    socketsChannel.unsubscribe(onSocket);
    for (const remove of cleanup) remove();
    client?.off('serverHeartbeatSucceeded', hello);
    client?.off('connectionReady', ready);
  }
  const tlsEstablished = observations.some(item => item.secure);
  const failureStages = [...new Set(observations.filter(item => item.failure).map(item =>
    item.secure ? 'after_tls' : item.tcp ? 'tls' : 'tcp'))];
  const failureCategories = [...new Set(observations.flatMap(item => item.failure ? [item.failure] : []))];
  return {
    connected, category,
    stage: connected ? 'connected' : handshakeCompleted ? 'after_mongodb_handshake' :
      tlsEstablished ? 'after_tls' : observations.some(item => item.tcp) ? 'tls' :
        observations.length ? 'tcp' : 'unobserved',
    tls: tlsEstablished ? 'established' : observations.some(item => item.tcp && item.failure) ?
      'failed_before_secure' : observations.length ? 'incomplete' : 'not_observed',
    mongodbHandshake: handshakeCompleted || connectionReady ? 'completed' : 'not_observed',
    failureStages, failureCategories, truncated,
  };
}
