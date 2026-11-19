import { ObjectId, type Db, type ClientSession } from "mongodb";
export async function initialAdminPlan(db: Db, userId: string, email: string) {
  if (db.databaseName !== "equipora" || !/^[a-f0-9]{24}$/i.test(userId))
    throw new Error("Bootstrap target rejected");
  const user = await db
    .collection("user")
    .findOne({
      _id: new ObjectId(userId),
      email: email.trim().toLowerCase(),
      role: "customer",
      disabled: { $ne: true },
    });
  const existing = await db
    .collection("user")
    .countDocuments({ role: "admin" });
  if (!user || existing)
    throw new Error("Initial administrator preconditions failed");
  return {
    userId: String(user._id),
    email: user.email,
    expiresAt: Date.now() + 300000,
  };
}
// No HTTP route or production CLI calls this function. Future execution requires
// owner approval of the exact existing account; no password is accepted/created.
export async function applyInitialAdmin(
  db: Db,
  session: ClientSession,
  plan: Awaited<ReturnType<typeof initialAdminPlan>>,
) {
  if (
    db.databaseName !== "equipora" ||
    plan.expiresAt < Date.now() ||
    plan.expiresAt > Date.now() + 300000
  )
    throw new Error("Bootstrap plan expired");
  await db
    .collection<{ _id: string; createdAt: Date }>("bootstrap")
    .insertOne({ _id: "initial-admin", createdAt: new Date() }, { session });
  if (
    await db.collection("user").countDocuments({ role: "admin" }, { session })
  )
    throw new Error("An administrator already exists");
  const result = await db
    .collection("user")
    .updateOne(
      {
        _id: new ObjectId(plan.userId),
        email: plan.email,
        role: "customer",
        disabled: { $ne: true },
      },
      { $set: { role: "admin", updatedAt: new Date() } },
      { session },
    );
  if (result.modifiedCount !== 1) throw new Error("Bootstrap account changed");
  await db
    .collection("session")
    .deleteMany({ userId: new ObjectId(plan.userId) }, { session });
}
