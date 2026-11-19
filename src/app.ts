import { registrationImageGuard } from "./registration-image.js";
import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import { getClient } from "./db.js";
import { classifyDatabaseFailure } from "./db-diagnostics.js";
import {
  compareConfigProof,
  createConfigProof,
  runNetworkDiagnostics,
  validConfigProof,
} from "./db-network-diagnostics.js";
import { observeDriverConnection } from "./db-driver-diagnostics.js";
import { authHandler, HttpError, verifyToken } from "./auth.js";
import {
  marketplaceRouter,
  stripeWebhook,
  uploadImage,
} from "./marketplace.js";
import { ZodError } from "zod";

export const app = express();
app.disable("x-powered-by");
// Stream-based authentication and signed Stripe payloads precede JSON parsing.
app.post("/api/registration-image", registrationImageGuard, express.json({limit:"3mb",inflate:false}), uploadImage);
app.all("/api/auth/*splat", authHandler);
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "256kb" }),
  stripeWebhook,
);
app.post(
  "/api/uploads",
  verifyToken,
  express.json({ limit: "3mb" }),
  uploadImage,
);

// Run before the ordinary JSON middleware. serverless-http supplies a Buffer
// on an already-finished request, which express.json() deliberately skips.
const diagnosticBodyLimit = 2048;
const readDiagnosticBody = express.raw({
  type: () => true,
  limit: diagnosticBodyLimit,
  inflate: false,
});
app.all(
  "/api/health/db/diagnostics",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const key = process.env.DIAGNOSTIC_KEY;
    if (!key || req.get("x-diagnostic-key") !== key || req.method !== "POST") {
      res.status(404).json({ ok: false });
      return;
    }
    if (
      !/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/i.test(
        req.get("content-type") ?? "",
      ) ||
      !["identity", undefined].includes(req.get("content-encoding"))
    ) {
      res.status(415).json({ ok: false });
      return;
    }
    const length = req.get("content-length");
    if (
      length !== undefined &&
      (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))
    ) {
      res.status(400).json({ ok: false });
      return;
    }
    if (length !== undefined && Number(length) > diagnosticBodyLimit) {
      res.status(413).json({ ok: false });
      return;
    }
    if (Buffer.isBuffer(req.body)) next();
    else readDiagnosticBody(req, res, next);
  },
  (req, res, next) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ ok: false });
      return;
    }
    if (req.body.length > diagnosticBodyLimit) {
      res.status(413).json({ ok: false });
      return;
    }
    const length = req.get("content-length");
    if (length !== undefined && Number(length) !== req.body.length) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      req.body = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(req.body),
      );
    } catch {
      res.status(400).json({ ok: false });
      return;
    }
    next();
  },
);

app.use(express.json({ limit: "32kb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = process.env.CORS_ORIGIN;
      if (!origin || (allowed && origin === allowed))
        return callback(null, true);
      return callback(new HttpError(403, "Origin not allowed"));
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "equipora-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/db", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const key = process.env.DIAGNOSTIC_KEY;
  if (!key || req.get("x-diagnostic-key") !== key) {
    res.status(404).json({ ok: false });
    return;
  }
  let stage: "connect" | "ping" = "connect";
  try {
    const client = await getClient();
    stage = "ping";
    await client.db("equipora").command({ ping: 1 });
    res.json({ ok: true, database: "reachable" });
  } catch (error: unknown) {
    console.error(
      JSON.stringify({
        event: "database_health_failure",
        stage,
        category: classifyDatabaseFailure(error),
      }),
    );
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

let diagnosticRunning = false;
let lastDiagnosticStart = -Infinity;
app.post("/api/health/db/diagnostics", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const key = process.env.DIAGNOSTIC_KEY;
  if (!key || req.get("x-diagnostic-key") !== key) {
    res.status(404).json({ ok: false });
    return;
  }
  // Fingerprints are the only input; no caller-supplied URI, host, IP, or port.
  if (
    Object.keys(req.query).length ||
    !req.body ||
    Object.keys(req.body).length !== 1 ||
    !validConfigProof(req.body.expected)
  ) {
    res.status(400).json({ ok: false });
    return;
  }
  if (diagnosticRunning || Date.now() - lastDiagnosticStart < 30_000) {
    res.status(429).json({ ok: false });
    return;
  }
  diagnosticRunning = true;
  lastDiagnosticStart = Date.now();
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      res.status(503).json({ ok: false, category: "missing_configuration" });
      return;
    }
    const configuration = compareConfigProof(
      createConfigProof(uri, key),
      req.body.expected,
    );
    const network = await runNetworkDiagnostics(uri);
    // Do not let a driver attempt bypass the probe's existing target validation.
    const driverAllowed =
      network.supported &&
      network.targetsAccepted === true &&
      !network.truncated &&
      network.servers.length > 0 &&
      network.servers.every(
        (server) =>
          [server.ipv4, server.ipv6].some((family) => family.dns === "ok") &&
          [server.ipv4, server.ipv6].every(
            (family) => family.dns === "ok" || family.dns === "no_records",
          ),
      );
    const driver = driverAllowed
      ? await observeDriverConnection()
      : { stage: "skipped" };
    console.error(
      JSON.stringify({ event: "database_driver_diagnostic", ...driver }),
    );
    res.json({ ok: true, configuration, network, driver });
  } catch (error: unknown) {
    res
      .status(503)
      .json({ ok: false, category: classifyDatabaseFailure(error) });
  } finally {
    diagnosticRunning = false;
  }
});

// Also sanitize parser/CORS errors that occur before the protected route runs.
const diagnosticInputError: ErrorRequestHandler = (_error, req, res, _next) => {
  res.set("Cache-Control", "no-store");
  const key = process.env.DIAGNOSTIC_KEY;
  const status = (_error as { status?: unknown } | null)?.status;
  res
    .status(
      !key || req.get("x-diagnostic-key") !== key
        ? 404
        : status === 413
          ? 413
          : 400,
    )
    .json({ ok: false });
};
app.use("/api/health/db/diagnostics", diagnosticInputError);

app.use("/api", marketplaceRouter);
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
const safeErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ ok: false, error: error.safeMessage });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: "Please check the submitted fields",
      fields: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ ok: false, error: "Request is too large" });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ ok: false, error: "Malformed JSON" });
    return;
  }
  console.error(
    JSON.stringify({ event: "api_request_failure", category: "internal" }),
  );
  res
    .status(500)
    .json({ ok: false, error: "The request could not be completed" });
};
app.use(safeErrors);
