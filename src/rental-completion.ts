// Disconnected local simulator. Never imported by app.ts, Passenger or Netlify.
import { ObjectId, type Db, type Document } from "mongodb";
import cron from "node-cron";
import { randomUUID } from "node:crypto";
import { completionTemplate, type CompletionEmailService } from "./completion-email.js";
export { simulationMailer } from "./completion-email.js";
import { z } from "zod";
import { recordRentalEvent } from "./rental-events.js";

export type SimulationMailer = CompletionEmailService;
type Notice = Document & { _id: string; userId: string; equipmentName: string; status: string; attempts: number };

function localOnly(db: Db) {
  if (process.env.NODE_ENV !== "test" || !/^equipora_f62_[a-z0-9_]+$/.test(db.databaseName) ||
    db.client.options.srvHost || !db.client.options.hosts?.every(h => ["127.0.0.1", "localhost", "::1"].includes(h.host ?? ""))) {
    throw new Error("Completion simulation requires an isolated local test database");
  }
}
export async function completeRentals(db: Db, mailer: SimulationMailer, now = new Date()) {
  localOnly(db);
  if (mailer.mode !== "simulation" || !Number.isFinite(now.getTime())) throw new Error("Invalid completion simulation");
  const today = now.toISOString().slice(0, 10), notices = db.collection<Notice>("completion_notifications");
  let completed = 0, delivered = 0, failed = 0;
  const candidates = await db.collection("bookings").find({ paymentStatus: "paid", end: { $lte: today },
    bookingStatus: { $in: ["confirmed", "ongoing", "completed"] }, completionQueued: { $ne: true } }).limit(100).toArray();
  for (const booking of candidates) {
    const changed = await db.client.withSession(session => session.withTransaction(async () => {
      const result = await db.collection("bookings").updateOne({ _id: booking._id, paymentStatus: "paid",
        completionQueued: { $ne: true }, bookingStatus: { $in: ["confirmed", "ongoing", "completed"] } },
      { $set: { bookingStatus: "completed", completionQueued: true, ...(booking.bookingStatus !== 'completed' ? {completedAt: now} : {}) } }, { session });
      if (!result.modifiedCount) return false;
      if(booking.bookingStatus !== 'completed')await recordRentalEvent(db, booking, 'completed', now, session);
      for (const role of ["customer", "owner"] as const) {
        await notices.updateOne({ _id: `${booking._id}:${role}` }, { $setOnInsert: {
          userId: String(booking[`${role}Id`]), equipmentName: String(booking.equipmentName).slice(0, 120),
          status: "pending", attempts: 0, createdAt: now,
        } }, { upsert: true, session });
      }
      return true;
    }));
    if (changed) completed++;
  }
  for (let i = 0; i < 200; i++) {
    const claimToken = randomUUID();
    const notice = await notices.findOneAndUpdate({ attempts: { $lt: 5 }, $or: [
      { status: "pending" }, { status: "sending", leaseUntil: { $lte: now } },
    ] }, { $set: { status: "sending", claimToken, leaseUntil: new Date(now.getTime() + 300000) }, $inc: { attempts: 1 } }, { returnDocument: "after" });
    if (!notice) break;
    try {
      if (!ObjectId.isValid(notice.userId)) throw new Error("Invalid notification recipient");
      const user = await db.collection("user").findOne({ _id: new ObjectId(notice.userId), disabled: { $ne: true } });
      const to = z.string().email().max(254).parse(user?.email);
      const role = notice._id.endsWith(":owner") ? "owner" : "customer";
      const message = { to, ...completionTemplate(String(user!.name ?? role), notice.equipmentName, role), messageId: `<${notice._id.replace(':', '.')}@equipora.invalid>` };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([mailer.deliver(message, {idempotencyKey:notice._id,signal:AbortSignal.timeout(10000)}), new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error("Notification timed out")),10000)})]); }
      finally { clearTimeout(timeout); }
      await notices.updateOne({ _id: notice._id, status:"sending", claimToken }, { $set: { status: "simulated", deliveredAt: now }, $unset: { leaseUntil: "", claimToken: "" } });
      delivered++;
    } catch {
      // A fixed category only; never persist exceptions, message contents or recipient addresses.
      await notices.updateOne({ _id: notice._id, status:"sending", claimToken }, { $set: { status: "pending", category: "notification_failed" }, $unset: { leaseUntil: "", claimToken: "" } });
      failed++;
      break; // Retry on the next scheduled execution, not a tight loop.
    }
  }
  return { completed, delivered, failed, simulation: true as const };
}

export function completionSchedule(db: Db, mailer: SimulationMailer) {
  localOnly(db);
  // Created STOPPED. Only a local operator/test can explicitly start or execute it.
  return cron.createTask("* * * * *", () => completeRentals(db, mailer).then(() => undefined),
    { timezone: "UTC", noOverlap: true, name: "equipora-local-completion" });
}
