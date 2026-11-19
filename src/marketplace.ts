import express from "express";
import {
  ObjectId,
  type Db,
  type ClientSession,
  type Document,
  type Sort,
} from "mongodb";
import { z } from "zod";
import Stripe from "stripe";
import { isStripeTestSecret } from "./local-provider-config.js";
import { getClient } from "./db.js";
import {
  HttpError,
  verifyToken,
  verifyAdmin,
  verifyOwner,
  verifyRenter,
  frontendOrigin,
} from "./auth.js";
import {
  bookingSchema,
  catalogQuery,
  equipmentSchema,
  profileSchema,
  rentalPrice,
  roles,
} from "./domain.js";
const router = express.Router();
const oid = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value))
    throw new HttpError(400, "Invalid identifier");
  return new ObjectId(value);
};
const database = async () => (await getClient()).db("equipora");
const dto = (d: Document) => {
  const { _id, ...rest } = d;
  return { id: String(_id), ...rest };
};
const safeUser = (d: Document) => ({
  id: String(d._id),
  name: d.name,
  email: d.email,
  image: d.image ?? "",
  phone: d.phone ?? "",
  address: d.address ?? "",
  role: d.role,
  disabled: d.disabled ?? false,
  createdAt: d.createdAt,
});
async function managementPage(
  db: Db,
  collection: string,
  filter: Document,
  pageInput: unknown,
  mapper: (d: Document) => unknown = dto,
) {
  const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(pageInput ?? 1),
    limit = 25;
  const [items, total] = await Promise.all([
    db
      .collection(collection)
      .find(filter)
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection(collection).countDocuments(filter),
  ]);
  return { items: items.map(mapper), total, page, limit };
}
const scope = (user: NonNullable<express.Request["principal"]>) =>
  user.role === "admin"
    ? {}
    : user.role === "owner"
      ? { ownerId: user.id }
      : { customerId: user.id };
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!isStripeTestSecret(key))
    throw new HttpError(503, "Stripe test payments are not configured");
  return new Stripe(key, { timeout: 10000, maxNetworkRetries: 1 });
}
export async function ensureMarketplaceIndexes(db: Db) {
  await Promise.all([
    db.collection("equipment").createIndex({ status: 1, createdAt: -1 }),
    db.collection("equipment").createIndex({ ownerId: 1 }),
    db
      .collection("favorites")
      .createIndex({ userId: 1, equipmentId: 1 }, { unique: true }),
    db
      .collection("reservations")
      .createIndex({ equipmentId: 1, start: 1, end: 1, status: 1 }),
    db
      .collection("bookings")
      .createIndex({ reservationId: 1 }, { unique: true }),
    db.collection("payments").createIndex({ sessionId: 1 }, { unique: true }),
    db.collection("payments").createIndex({ ownerId: 1, createdAt: 1 }),
  ]);
}
let indexed: Promise<void> | undefined;
async function ensure() {
  if (!indexed)
    indexed = database()
      .then(ensureMarketplaceIndexes)
      .catch((e) => {
        indexed = undefined;
        throw e;
      });
  await indexed;
}
router.get("/equipment", async (req, res) => {
  let q;
  try {
    q = catalogQuery(req.query);
  } catch {
    throw new HttpError(400, "Invalid equipment filters");
  }
  const db = await database();
  const [items, total] = await Promise.all([
    db
      .collection("equipment")
      .find(q.filter)
      .sort(q.sort as Sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .toArray(),
    db.collection("equipment").countDocuments(q.filter),
  ]);
  res.json({ items: items.map(dto), total, page: q.page, limit: q.limit });
});
router.get("/equipment/:id", verifyToken, async (req, res) => {
  const item = await (
    await database()
  )
    .collection("equipment")
    .findOne({ _id: oid(req.params.id), deleted: { $ne: true } });
  if (
    !item ||
    (item.status !== "approved" &&
      req.principal!.role !== "admin" &&
      item.ownerId !== req.principal!.id)
  )
    throw new HttpError(404, "Equipment not found");
  res.json(dto(item));
});
router.get("/me", verifyToken, async (req, res) => {
  const user = await (
    await database()
  )
    .collection("user")
    .findOne({ _id: oid(req.principal!.id) });
  res.json(safeUser(user!));
});
router.patch("/me", verifyToken, async (req, res) => {
  const data = profileSchema.parse(req.body);
  const db = await database();
  await db
    .collection("user")
    .updateOne(
      { _id: oid(req.principal!.id) },
      { $set: { ...data, updatedAt: new Date() } },
    );
  res.json(
    safeUser(
      (await db.collection("user").findOne({ _id: oid(req.principal!.id) }))!,
    ),
  );
});
router.get("/favorites", verifyToken, verifyRenter, async (req, res) => {
  const db = await database();
  const rows = await db
    .collection("favorites")
    .aggregate([
      { $match: { userId: req.principal!.id } },
      {
        $lookup: {
          from: "equipment",
          let: { equipmentId: "$equipmentId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$equipmentId"] },
                deleted: { $ne: true },
                status: "approved",
              },
            },
          ],
          as: "equipment",
        },
      },
      { $unwind: "$equipment" },
      { $replaceRoot: { newRoot: "$equipment" } },
    ])
    .toArray();
  res.json({ items: rows.map(dto) });
});
router.put("/favorites/:id", verifyToken, verifyRenter, async (req, res) => {
  await ensure();
  const db = await database();
  const id = String(oid(req.params.id));
  if (
    !(await db
      .collection("equipment")
      .findOne({ _id: oid(id), status: "approved", deleted: { $ne: true } }))
  )
    throw new HttpError(404, "Equipment not found");
  await db
    .collection("favorites")
    .updateOne(
      { userId: req.principal!.id, equipmentId: id },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  res.json({ ok: true });
});
router.delete("/favorites/:id", verifyToken, verifyRenter, async (req, res) => {
  await (await database()).collection("favorites").deleteOne({
    userId: req.principal!.id,
    equipmentId: String(oid(req.params.id)),
  });
  res.json({ ok: true });
});
router.get("/owner/equipment", verifyToken, verifyOwner, async (req, res) => {
  res.json(
    await managementPage(
      await database(),
      "equipment",
      { ownerId: req.principal!.id, deleted: { $ne: true } },
      req.query.page,
    ),
  );
});
router.post("/equipment", verifyToken, verifyOwner, async (req, res) => {
  const data = equipmentSchema.parse(req.body);
  const item = {
    ...data,
    ownerId: req.principal!.id,
    ownerName: req.principal!.name,
    ownerImage: req.principal!.image ?? "",
    status: "pending",
    revision: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const r = await (await database()).collection("equipment").insertOne(item);
  res.status(201).json({ id: String(r.insertedId), ...item });
});
router.patch("/equipment/:id", verifyToken, async (req, res) => {
  if (!["owner", "admin"].includes(req.principal!.role))
    throw new HttpError(403, "Not permitted");
  const data = equipmentSchema.parse(req.body),
    db = await database(),
    client = await getClient();
  await client.withSession(async (session) =>
    session.withTransaction(async () => {
      const item = await db
        .collection("equipment")
        .findOne(
          { _id: oid(req.params.id), deleted: { $ne: true } },
          { session },
        );
      if (
        !item ||
        (req.principal!.role !== "admin" && item.ownerId !== req.principal!.id)
      )
        throw new HttpError(404, "Equipment not found");
      if (
        await db.collection("reservations").countDocuments(
          {
            equipmentId: String(item._id),
            status: { $in: ["held", "paid"] },
            end: { $gt: new Date().toISOString().slice(0, 10) },
          },
          { session },
        )
      )
        throw new HttpError(
          409,
          "Equipment with active reservations cannot be edited",
        );
      await db.collection("equipment").updateOne(
        { _id: item._id },
        {
          $set: {
            ...data,
            status: req.principal!.role === "admin" ? item.status : "pending",
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { session },
      );
    }),
  );
  res.json({ ok: true });
});
router.delete("/equipment/:id", verifyToken, async (req, res) => {
  if (!["owner", "admin"].includes(req.principal!.role))
    throw new HttpError(403, "Not permitted");
  const db = await database(),
    client = await getClient();
  await client.withSession(async (session) =>
    session.withTransaction(async () => {
      const item = await db
        .collection("equipment")
        .findOne(
          { _id: oid(req.params.id), deleted: { $ne: true } },
          { session },
        );
      if (
        !item ||
        (req.principal!.role !== "admin" && item.ownerId !== req.principal!.id)
      )
        throw new HttpError(404, "Equipment not found");
      if (
        await db.collection("reservations").countDocuments(
          {
            equipmentId: String(item._id),
            status: { $in: ["held", "paid"] },
            end: { $gt: new Date().toISOString().slice(0, 10) },
          },
          { session },
        )
      )
        throw new HttpError(409, "Equipment has active reservations");
      await db
        .collection("equipment")
        .updateOne(
          { _id: item._id },
          { $set: { deleted: true }, $inc: { revision: 1 } },
          { session },
        );
    }),
  );
  res.json({ ok: true });
});
export async function reserve(
  db: Db,
  session: ClientSession,
  input: z.infer<typeof bookingSchema>,
  user: NonNullable<express.Request["principal"]>,
) {
  // Serialize a customer's simultaneous holds as well as each equipment's stock.
  await db
    .collection("user")
    .updateOne(
      { _id: oid(user.id) },
      { $inc: { checkoutRevision: 1 } },
      { session },
    );
  const item = await db.collection("equipment").findOne(
    {
      _id: oid(input.equipmentId),
      status: "approved",
      deleted: { $ne: true },
    },
    { session },
  );
  if (!item) throw new HttpError(404, "Equipment is not available");
  if (
    (await db
      .collection("reservations")
      .countDocuments({ customerId: user.id, status: "held" }, { session })) >=
    3
  )
    throw new HttpError(
      429,
      "Complete or cancel your existing checkouts first",
    );
  const overlapping = await db
    .collection("reservations")
    .find(
      {
        equipmentId: input.equipmentId,
        status: { $in: ["held", "paid"] },
        start: { $lt: input.end },
        end: { $gt: input.start },
      },
      { session },
    )
    .toArray();
  // Check every boundary instead of summing non-simultaneous bookings across the whole range.
  const points = [
    input.start,
    ...overlapping
      .flatMap((x) => [x.start, x.end])
      .filter((x) => x >= input.start && x < input.end),
  ];
  const peak = Math.max(
    0,
    ...points.map((point) =>
      overlapping
        .filter((x) => x.start <= point && x.end > point)
        .reduce((sum, x) => sum + x.quantity, 0),
    ),
  );
  if (peak + input.quantity > item.quantity)
    throw new HttpError(
      409,
      "Requested quantity is unavailable for those dates",
    );
  const price = rentalPrice(
    item.price,
    item.rentalType,
    input.start,
    input.end,
    input.quantity,
  );
  await db
    .collection("equipment")
    .updateOne({ _id: item._id }, { $inc: { revision: 1 } }, { session });
  const reservation = {
    ...input,
    ...price,
    equipmentName: item.name,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    customerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    status: "held",
    createdAt: new Date(),
  };
  const r = await db
    .collection("reservations")
    .insertOne(reservation, { session });
  return { ...reservation, _id: r.insertedId };
}
router.post("/checkout", verifyToken, verifyRenter, async (req, res) => {
  await ensure();
  const input = bookingSchema.parse(req.body),
    gateway = stripe(),
    front = frontendOrigin(),
    client = await getClient(),
    db = client.db("equipora");
  const reservation = await client.withSession((session) =>
    session.withTransaction(() => reserve(db, session, input, req.principal!)),
  );
  if (!reservation) throw new HttpError(503, "Booking could not be reserved");
  let checkoutId: string | undefined;
  try {
    const checkout = await gateway.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        customer_email: req.principal!.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: reservation.totalCents,
              product_data: {
                name: reservation.equipmentName,
                description: `${input.start} to ${input.end} · ${input.quantity} item(s)`,
              },
            },
          },
        ],
        metadata: { reservationId: String(reservation._id) },
        success_url:
          front + "/payment/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          front +
          "/dashboard/rentals?payment=cancelled&reservation_id=" +
          String(reservation._id),
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      },
      { idempotencyKey: "reservation-" + String(reservation._id) },
    );
    checkoutId = checkout.id;
    await db
      .collection("reservations")
      .updateOne(
        { _id: reservation._id },
        { $set: { sessionId: checkout.id } },
      );
    res.json({ url: checkout.url, totalCents: reservation.totalCents });
  } catch (e) {
    // A provider/network timeout can be ambiguous. Keep the hold unless Checkout
    // is confirmed expired or creation definitely did not reach Stripe.
    if (checkoutId) {
      await gateway.checkout.sessions.expire(checkoutId);
      await db
        .collection("reservations")
        .updateOne(
          { _id: reservation._id, status: "held" },
          { $set: { status: "cancelled" } },
        );
    } else if (e instanceof Stripe.errors.StripeInvalidRequestError) {
      await db
        .collection("reservations")
        .updateOne(
          { _id: reservation._id, status: "held" },
          { $set: { status: "cancelled" } },
        );
    }
    throw e;
  }
});
router.get("/checkout/holds", verifyToken, verifyRenter, async (req, res) => {
  const rows = await (
    await database()
  )
    .collection("reservations")
    .find({ customerId: req.principal!.id, status: "held" })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();
  res.json({
    items: rows.map((r) => ({
      id: String(r._id),
      equipmentName: r.equipmentName,
      start: r.start,
      end: r.end,
      totalCents: r.totalCents,
    })),
  });
});
router.post(
  "/checkout/:id/cancel",
  verifyToken,
  verifyRenter,
  async (req, res) => {
    const db = await database(),
      reservation = await db.collection("reservations").findOne({
        _id: oid(req.params.id),
        customerId: req.principal!.id,
        status: "held",
      });
    if (!reservation) throw new HttpError(404, "Pending checkout not found");
    if (!reservation.sessionId)
      throw new HttpError(
        409,
        "Checkout status needs reconciliation before this hold can be released",
      );
    {
      const gateway = stripe(),
        checkout = await gateway.checkout.sessions.retrieve(
          reservation.sessionId,
        );
      if (checkout.status === "complete")
        throw new HttpError(
          409,
          "Payment is completing; check your rental confirmation",
        );
      if (checkout.status === "open")
        await gateway.checkout.sessions.expire(reservation.sessionId);
    }
    await db
      .collection("reservations")
      .updateOne(
        { _id: reservation._id, status: "held" },
        { $set: { status: "cancelled" } },
      );
    res.json({ ok: true });
  },
);
export async function fulfill(
  db: Db,
  session: ClientSession,
  checkout: Stripe.Checkout.Session,
) {
  if (
    checkout.payment_status !== "paid" ||
    checkout.currency !== "usd" ||
    !checkout.metadata?.reservationId
  )
    return;
  const id = oid(checkout.metadata.reservationId),
    reservation = await db
      .collection("reservations")
      .findOne({ _id: id }, { session });
  if (
    !reservation ||
    (reservation.sessionId && reservation.sessionId !== checkout.id) ||
    checkout.amount_total !== reservation.totalCents ||
    reservation.customerEmail !== checkout.customer_email
  )
    throw new HttpError(409, "Payment does not match reservation");
  if (
    await db
      .collection("payments")
      .findOne({ sessionId: checkout.id }, { session })
  )
    return;
  if (reservation.status !== "held")
    throw new HttpError(409, "Reservation needs payment reconciliation");
  await db
    .collection("reservations")
    .updateOne(
      { _id: id, status: "held" },
      { $set: { status: "paid", sessionId: checkout.id } },
      { session },
    );
  const { _id, status, ...booking } = reservation;
  await db.collection("bookings").insertOne(
    {
      ...booking,
      reservationId: String(_id),
      sessionId: checkout.id,
      paymentStatus: "paid",
      bookingStatus: "confirmed",
      bookingDate: new Date(),
    },
    { session },
  );
  await db.collection("payments").insertOne(
    {
      sessionId: checkout.id,
      reservationId: String(_id),
      transactionId:
        typeof checkout.payment_intent === "string"
          ? checkout.payment_intent
          : checkout.payment_intent?.id,
      customerId: reservation.customerId,
      ownerId: reservation.ownerId,
      totalCents: reservation.totalCents,
      currency: "usd",
      createdAt: new Date(),
    },
    { session },
  );
}
export async function stripeWebhook(
  req: express.Request,
  res: express.Response,
) {
  const gateway = stripe(),
    secret = process.env.STRIPE_WEBHOOK_SECRET,
    signature = req.get("stripe-signature");
  if (!secret || !signature || !Buffer.isBuffer(req.body))
    throw new HttpError(400, "Invalid webhook");
  let event: Stripe.Event;
  try {
    event = gateway.webhooks.constructEvent(req.body, signature, secret);
  } catch {
    throw new HttpError(400, "Invalid webhook signature");
  }
  if (event.livemode)
    throw new HttpError(400, "Only test payments are enabled");
  const client = await getClient(),
    db = client.db("equipora");
  await ensureMarketplaceIndexes(db);
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  ) {
    await client.withSession((session) =>
      session.withTransaction(() =>
        fulfill(db, session, event.data.object as Stripe.Checkout.Session),
      ),
    );
  }
  if (event.type === "checkout.session.expired") {
    const checkout = event.data.object as Stripe.Checkout.Session;
    if (checkout.metadata?.reservationId)
      await db
        .collection("reservations")
        .updateOne(
          { _id: oid(checkout.metadata.reservationId), status: "held" },
          { $set: { status: "expired" } },
        );
  }
  res.json({ received: true });
}
router.get("/rentals", verifyToken, async (req, res) => {
  const db = await database();
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .parse(req.query.page ?? 1);
  const filter = scope(req.principal!);
  const [items, total] = await Promise.all([
    db
      .collection("bookings")
      .find(filter)
      .sort({ bookingDate: -1 })
      .skip((page - 1) * 15)
      .limit(15)
      .toArray(),
    db.collection("bookings").countDocuments(filter),
  ]);
  res.json({ items: items.map(dto), total, page, limit: 15 });
});
router.get(
  "/payments/:sessionId",
  verifyToken,
  verifyRenter,
  async (req, res) => {
    const payment = await (await database()).collection("payments").findOne({
      sessionId: String(req.params.sessionId),
      customerId: req.principal!.id,
    });
    res.json({
      paid: !!payment,
      transactionId: payment?.transactionId ?? null,
    });
  },
);
router.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  res.json(
    await managementPage(
      await database(),
      "user",
      {},
      req.query.page,
      safeUser,
    ),
  );
});
router.patch("/admin/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  const data = z
    .object({ role: z.enum(roles), disabled: z.boolean() })
    .strict()
    .parse(req.body);
  if (String(req.params.id) === req.principal!.id)
    throw new HttpError(
      409,
      "You cannot change your own administrative access",
    );
  const db = await database();
  const result = await db
    .collection("user")
    .updateOne(
      { _id: oid(req.params.id) },
      { $set: { ...data, updatedAt: new Date() } },
    );
  if (!result.matchedCount) throw new HttpError(404, "User not found");
  await db.collection("session").deleteMany({ userId: oid(req.params.id) });
  res.json({ ok: true });
});
router.get("/admin/equipment", verifyToken, verifyAdmin, async (req, res) => {
  res.json(
    await managementPage(
      await database(),
      "equipment",
      { deleted: { $ne: true } },
      req.query.page,
    ),
  );
});
router.patch(
  "/admin/equipment/:id/status",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const data = z
      .object({ status: z.enum(["pending", "approved", "rejected"]) })
      .strict()
      .parse(req.body);
    const r = await (
      await database()
    )
      .collection("equipment")
      .updateOne(
        { _id: oid(req.params.id), deleted: { $ne: true } },
        { $set: { ...data, updatedAt: new Date() }, $inc: { revision: 1 } },
      );
    if (!r.matchedCount) throw new HttpError(404, "Equipment not found");
    res.json({ ok: true });
  },
);
router.patch(
  "/admin/rentals/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["ongoing", "completed"]) })
      .strict()
      .parse(req.body);
    const db = await database();
    const booking = await db
      .collection("bookings")
      .findOne({ _id: oid(req.params.id) });
    if (!booking) throw new HttpError(404, "Rental not found");
    const today = new Date().toISOString().slice(0, 10);
    if (status === "completed" && booking.end > today)
      throw new HttpError(409, "Rental period has not ended");
    if (status === "ongoing" && (booking.start > today || booking.end <= today))
      throw new HttpError(409, "Rental is outside its active period");
    await db
      .collection("bookings")
      .updateOne({ _id: booking._id }, { $set: { bookingStatus: status } });
    res.json({ ok: true });
  },
);
router.get("/analytics", verifyToken, async (req, res) => {
  if (!["owner", "admin"].includes(req.principal!.role))
    throw new HttpError(403, "Not permitted");
  const db = await database(),
    scope =
      req.principal!.role === "owner" ? { ownerId: req.principal!.id } : {};
  const [equipment, bookings, payments, users] = await Promise.all([
    db
      .collection("equipment")
      .aggregate([
        { $match: { ...scope, deleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
          },
        },
      ])
      .toArray(),
    db
      .collection("bookings")
      .aggregate([
        { $match: scope },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  completed: {
                    $sum: {
                      $cond: [{ $eq: ["$bookingStatus", "completed"] }, 1, 0],
                    },
                  },
                },
              },
            ],
            monthly: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m", date: "$bookingDate" },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ])
      .toArray(),
    db
      .collection("payments")
      .aggregate([
        { $match: scope },
        {
          $facet: {
            totals: [
              { $group: { _id: null, totalCents: { $sum: "$totalCents" } } },
            ],
            monthly: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m", date: "$createdAt" },
                  },
                  totalCents: { $sum: "$totalCents" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ])
      .toArray(),
    req.principal!.role === "admin"
      ? db.collection("user").countDocuments({})
      : 0,
  ]);
  res.json({
    users,
    equipment: equipment[0]?.total ?? 0,
    pending: equipment[0]?.pending ?? 0,
    bookings: bookings[0]?.totals[0]?.total ?? 0,
    completed: bookings[0]?.totals[0]?.completed ?? 0,
    revenueCents: payments[0]?.totals[0]?.totalCents ?? 0,
    monthly: (payments[0]?.monthly ?? []).map((m: Document) => ({
      month: m._id,
      totalCents: m.totalCents,
      count: m.count,
    })),
    monthlyBookings: (bookings[0]?.monthly ?? []).map((m: Document) => ({
      month: m._id,
      count: m.count,
    })),
  });
});
export async function uploadImage(req: express.Request, res: express.Response) {
  const { image } = z
    .object({
      image: z
        .string()
        .min(4)
        .max(2800000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    })
    .strict()
    .parse(req.body);
  if (!process.env.IMGBB_API_KEY)
    throw new HttpError(503, "Image upload is not configured");
  const decoded = Buffer.from(image, "base64");
  const validImage =
    (decoded[0] === 255 && decoded[1] === 216 && decoded[2] === 255) ||
    decoded
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (decoded.toString("ascii", 0, 4) === "RIFF" &&
      decoded.toString("ascii", 8, 12) === "WEBP");
  if (decoded.length > 2000000 || !validImage)
    throw new HttpError(400, "Use a JPG, PNG, or WebP image smaller than 2 MB");
  const r = await fetch(
    "https://api.imgbb.com/1/upload?key=" +
      encodeURIComponent(process.env.IMGBB_API_KEY),
    {
      method: "POST",
      body: new URLSearchParams({ image }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!r.ok) throw new HttpError(502, "Image upload failed");
  const reader = r.body?.getReader();
  if (!reader) throw new HttpError(502, "Image upload failed");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 32768) {
      await reader.cancel();
      throw new HttpError(502, "Image upload failed");
    }
    chunks.push(value);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (
    !body.success ||
    typeof body.data?.url !== "string" ||
    !body.data.url.startsWith("https://")
  )
    throw new HttpError(502, "Image upload failed");
  res.json({ url: body.data.url });
}
export { router as marketplaceRouter };
