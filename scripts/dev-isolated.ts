// Local fixtures only: never loads .env and never accepts a database URI.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { equipmentSchema } from "../src/domain.js";
import {
  providerText,
  providerJSON,
  providerNames,
} from "../src/local-provider-config.js";
const frontend = process.env.LOCAL_FRONTEND_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(frontend))
  throw new Error("Only local frontend origins are accepted");
// Consume transient credentials before spawning the local MongoDB binary.
const transient = process.env.EQUIPORA_LOCAL_PROVIDERS;
delete process.env.EQUIPORA_LOCAL_PROVIDERS;
for (const key of [
  ...providerNames,
  "MONGODB_URI",
  "DIAGNOSTIC_KEY",
  "BETTER_AUTH_SECRET",
])
  delete process.env[key];
const providerIndex = process.argv.indexOf("--provider-config");
if (transient && providerIndex >= 0)
  throw new Error("Choose one private provider configuration source");
let providers: Record<string, string> = {};
if (transient) {
  if (Buffer.byteLength(transient) > 24576)
    throw new Error("Provider configuration is too large");
  providers = providerJSON(transient);
}
if (providerIndex >= 0) {
  const file = process.argv[providerIndex + 1];
  if (!file || !path.isAbsolute(file))
    throw new Error("Provide an absolute private provider configuration path");
  providers = providerText(fs.readFileSync(file, "utf8"));
}
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: { version: "8.2.1" },
});
process.env.MONGODB_URI = replica.getUri("equipora");
process.env.FRONTEND_URL = frontend;
process.env.AUTH_PUBLIC_URL = frontend;
process.env.CORS_ORIGIN = frontend;
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
process.env.NODE_ENV = "test";
for (const [key, value] of Object.entries(providers)) process.env[key] = value;
const { getAuth } = await import("../src/auth.js"),
  { getClient } = await import("../src/db.js"),
  { app } = await import("../src/app.js");
const auth = await getAuth(),
  client = await getClient(),
  db = client.db("equipora");
const credentials = {
  password: "LocalDemo123",
  customer: "customer@example.test",
  owner: "owner@example.test",
  admin: "admin@example.test",
};
let ownerId = "";
for (const role of ["customer", "owner", "admin"] as const) {
  const { user } = await auth.api.signUpEmail({
    body: {
      name:
        role === "owner"
          ? "Alex Morgan"
          : role === "admin"
            ? "Sam Rivera"
            : "Jamie Park",
      email: credentials[role],
      password: credentials.password,
      image: "https://example.test/profile.png",
    },
  });
  await db
    .collection("user")
    .updateOne({ _id: new ObjectId(user.id) }, { $set: { role, image:"" } });
  if (role === "owner") ownerId = user.id;
}
const photos = [
  "photo-1580901368919-7738efb0f87e",
  "photo-1516035069371-29a1b244cc32",
  "photo-1503376780353-7e6692767b70",
  "photo-1530267981375-f0de937f5f13",
  "photo-1496181133206-80ce9b88a853",
  "photo-1492684223066-81342ee5ff30",
];
const names = [
  "Compact Excavator",
  "Mirrorless Camera Kit",
  "Weekend Utility Vehicle",
  "Field Tractor",
  "Creative Laptop",
  "Outdoor Event Sound System",
];
const categories = [
  "Construction Equipment",
  "Photography Equipment",
  "Vehicles & Transportation",
  "Agriculture Equipment",
  "Electronics",
  "Event Equipment",
];
const baselineEquipment = names.map((name, i) => ({
    name,
    description:
      "Local demonstration equipment for isolated integration testing. Professional equipment ready for your next project.",
    category: categories[i],
    location: i % 2 ? "Chattogram" : "Dhaka",
    price: [120, 35, 80, 95, 25, 60][i],
    rentalType: "daily",
    quantity: 3,
    condition: "Excellent",
    brand: "Demo Brand",
    model: "Series " + (i + 1),
    image:
      "https://images.unsplash.com/" +
      photos[i] +
      "?auto=format&fit=crop&w=800&q=80",
    terms:
      "Inspect equipment together on pickup. Return clean and on time. Rental end dates are exclusive.",
    ownerId,
    ownerName: "Alex Morgan",
    ownerImage: "",
    status: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
    revision: 0,
  }));
let equipment: Record<string, unknown>[] = baselineEquipment;
if (process.argv.includes("--catalog=f5")) {
  const records = JSON.parse(fs.readFileSync(new URL("./f5-demo-catalog.json", import.meta.url), "utf8"));
  if (!Array.isArray(records) || records.length !== 30 || new Set(records.map(r => r.demoId)).size !== 30)
    throw new Error("Invalid fixed demonstration catalog");
  for (const category of categories)
    if (records.filter(r => r.category === category).length !== 5) throw new Error("Invalid demonstration category count");
  equipment = records.map(({ demoId, demoOnly, sourceCurrency, ...record }, index) => {
    if (!/^EQD-\d{3}$/.test(demoId) || demoOnly !== true) throw new Error("Demonstration scope required");
    // Stagger fixture-only dates so the normal newest-first limit returns one
    // demonstration item per category, without changing the production query.
    return { ...equipmentSchema.parse(record), demoId, demoOnly, demoImageSource:record.image, sourceCurrency, ownerId, ownerName:"Alex Morgan", ownerImage:"", status:"approved", createdAt:new Date(Date.now()-(index%5===0?index:100+index)*1000), updatedAt:new Date(), revision:0 };
  });
}
await db.collection("equipment").insertMany(equipment);
if(process.argv.includes('--experience=f74')){
  const { seedF74Rentals } = await import('./f74-demo-rentals.js');
  await seedF74Rentals(db);
}
const server = app.listen(5090, "127.0.0.1", () =>
  console.log(
    JSON.stringify({
      event: "isolated_dev_ready",
      apiPort: 5090,
      fixtureOnly: true,
      users: credentials,
    }),
  ),
);
async function shutdown() {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await client.close();
  await replica.stop();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
