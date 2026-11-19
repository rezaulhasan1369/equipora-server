import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { completeRentals, completionSchedule, simulationMailer } from "../src/rental-completion.js";
import { completionTemplate } from "../src/completion-email.js";

test("responsive completion templates escape HTML, include plain text and distinguish both recipients",()=>{
  for(const role of ["customer","owner"] as const){
    const template=completionTemplate("Jamie <script>","Camera & <img src=x>",role);
    assert.ok(template.html.includes('name="viewport"'));assert.ok(template.html.includes("@media"));assert.ok(template.html.includes('max-width:600px'));
    assert.ok(template.html.includes("&lt;script&gt;"));assert.ok(!template.html.includes("Jamie <script>"));assert.ok(template.html.includes("Camera &amp; &lt;img"));
    assert.ok(template.text.includes("Camera & <img src=x>"));assert.ok(template.text.includes(role==='owner'?'your equipment':'Your rental'));
  }
});

test("isolated scheduled completion: paid/end boundaries, both recipients, retries, concurrency and no financial writes", async () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = "test";
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = await new MongoClient(replica.getUri()).connect();
  try {
    const db = client.db("equipora_f62_completion"), customer = new ObjectId(), owner = new ObjectId();
    await db.collection("user").insertMany([{ _id: customer, email: "customer@example.test" }, { _id: owner, email: "owner@example.test" }]);
    const base = { customerId: String(customer), ownerId: String(owner), equipmentName: "Local Camera", bookingStatus: "confirmed", paymentStatus: "paid" };
    await db.collection("bookings").insertMany([
      { ...base, end: "2026-11-18" }, { ...base, end: "2026-11-19" },
      { ...base, end: "2026-11-20" }, { ...base, end: "2026-11-18", paymentStatus: "unpaid" },
      { ...base, end: "2026-11-18", bookingStatus: "cancelled" },
    ]);
    const messages: {to:string;text:string}[] = [], mailer = simulationMailer(m => messages.push(m));
    const now = new Date("2026-11-19T00:00:00Z");
    const beforeMidnight = await completeRentals(db, mailer, new Date("2026-11-18T23:59:59.999Z"));
    assert.equal(beforeMidnight.completed, 1);assert.equal(beforeMidnight.delivered, 2);
    const result = await completeRentals(db, mailer, now);
    assert.equal(result.completed, 1); assert.equal(result.delivered, 2);
    assert.equal(messages.filter(m => m.to === "customer@example.test").length, 2);
    assert.equal(messages.filter(m => m.to === "owner@example.test").length, 2);
    assert.ok(messages.every(m => m.text.includes("Local Camera")));
    assert.equal((await completeRentals(db, mailer, now)).completed, 0);
    assert.equal(messages.length, 4);
    await db.collection("bookings").insertOne({ ...base, end: "2026-11-18" });
    const failure = await completeRentals(db, {mode:"simulation",async deliver(){throw new Error("private failure never persisted");}}, now);
    assert.equal(failure.failed, 1);
    assert.equal(await db.collection("completion_notifications").countDocuments({status:"pending"}), 2);
    await Promise.all([completeRentals(db, mailer, now), completeRentals(db, mailer, now)]);
    assert.equal(messages.length, 6);
    assert.equal(await db.collection("completion_notifications").countDocuments({status:"simulated"}), 6);
    assert.equal(await db.collection("bookings").countDocuments({bookingStatus:"cancelled"}),1);
    assert.equal(await db.collection("bookings").countDocuments({paymentStatus:"unpaid",bookingStatus:"confirmed"}),1);
    await db.collection("bookings").insertOne({...base,end:"2026-11-17"});
    const parallel=await Promise.all([completeRentals(db,mailer,now),completeRentals(db,mailer,now)]);
    assert.equal(parallel.reduce((n,r)=>n+r.completed,0),1);assert.equal(messages.length,8);
    // Mock provider idempotency prevents duplicate dispatch on a retry after lost acknowledgement.
    await db.collection("completion_notifications").updateOne({status:"simulated"},{$set:{status:"pending"}});
    await completeRentals(db,mailer,now);assert.equal(messages.length,8);
    assert.equal(await db.collection("payments").countDocuments({}), 0);
    assert.equal(await db.collection("reservations").countDocuments({}), 0);
    assert.ok(!JSON.stringify(await db.collection("completion_notifications").find().toArray()).includes("private failure"));
    const task = completionSchedule(db, mailer);
    assert.equal(task.getStatus(), "stopped"); await task.execute(); await task.destroy();
    await assert.rejects(() => completeRentals(client.db("equipora"), mailer), /isolated local/);
    process.env.NODE_ENV = "production";
    await assert.rejects(() => completeRentals(db, mailer), /isolated local/);
  } finally { await client.close(); await replica.stop(); if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old; }
});
