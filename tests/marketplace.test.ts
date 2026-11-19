import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ObjectId } from "mongodb";
import { once } from "node:events";
import { app } from "../src/app.js";
import { getClient } from "../src/db.js";
import { rentalPrice, catalogQuery } from "../src/domain.js";
import {
  fulfill,
  ensureMarketplaceIndexes,
  reserve,
} from "../src/marketplace.js";
import Stripe from "stripe";
test("rental pricing uses explicit end-exclusive periods and whole billing units", () => {
  assert.equal(
    rentalPrice(10, "daily", "2030-01-01", "2030-01-03", 2).totalCents,
    4000,
  );
  assert.equal(
    rentalPrice(70, "weekly", "2030-01-01", "2030-01-09", 1).totalCents,
    14000,
  );
  assert.throws(() => rentalPrice(10, "daily", "2030-01-01", "2030-01-01", 1));
  assert.equal(catalogQuery({ featured: "true", limit: "24" }).limit, 6);
  assert.throws(() => catalogQuery({ min: "20", max: "10" }));
});
test("isolated full API: auth, revocation, roles, moderation, favorites, filtering and signed payment fulfillment", async () => {
  const replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.2.1" },
  });
  process.env.MONGODB_URI = replica.getUri("equipora");
  process.env.FRONTEND_URL = "http://localhost:3000";
  process.env.AUTH_PUBLIC_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET =
    "synthetic-local-test-secret-32-characters-long";
  process.env.NODE_ENV = "test";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  delete process.env.STRIPE_SECRET_KEY;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
    cookie?: string,
  ) {
    return fetch(base + path, {
      method,
      headers: {
        origin: "http://localhost:3000",
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: "Bearer " + token } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  let client: Awaited<ReturnType<typeof getClient>> | undefined;
  try {
    assert.equal(
      (
        await request("/api/auth/sign-up/email", "POST", {
          name: "Weak",
          email: "weak@example.com",
          password: "abcdef",
        })
      ).status,
      400,
    );
    for(const image of [undefined,"","not-a-url","http://example.test/image.png","https://user:password@example.test/x.png"]){
      const r=await request("/api/auth/sign-up/email","POST",{name:"Missing Photo",email:"missing-photo@example.test",password:"Valid123",...(image!==undefined?{image}:{})});assert.equal(r.status,400);
    }
    async function signup(name: string) {
      const response = await request("/api/auth/sign-up/email", "POST", {
        name,
        email: name + "@example.com",
        password: "Strong123",
        image: "https://example.test/profile.png",
        role: "admin",
      });
      assert.equal(response.status, 200);
      const data = await response.json();
      const cookie = response.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; ");
      const r = await request(
        "/api/auth/token",
        "GET",
        undefined,
        undefined,
        cookie,
      );
      assert.equal(r.status, 200);
      return { id: data.user.id, token: (await r.json()).token, cookie };
    }
    const customer = await signup("Customer"),
      owner = await signup("Owner"),
      admin = await signup("Admin");
    client = await getClient();
    const db = client.db("equipora");
    await ensureMarketplaceIndexes(db);
    assert.equal(
      (await db.collection("user").findOne({ _id: new ObjectId(customer.id) }))!
        .role,
      "customer",
    );
    await db
      .collection("user")
      .updateOne({ _id: new ObjectId(owner.id) }, { $set: { role: "owner" } });
    await db
      .collection("user")
      .updateOne({ _id: new ObjectId(admin.id) }, { $set: { role: "admin" } });
    for(const principal of [customer,owner,admin]){
      assert.equal((await request('/api/me','PATCH',{name:'Photo Profile',image:'https://example.test/profile.png',phone:'0123456789',address:'Local profile address'},principal.token)).status,200);
      const profile=await(await request('/api/me','GET',undefined,principal.token)).json();assert.equal(profile.name,'Photo Profile');assert.equal(profile.image,'https://example.test/profile.png');assert.equal(profile.phone,'0123456789');assert.equal(profile.address,'Local profile address');
      assert.equal((await request('/api/me','PATCH',{name:'Photo Profile',image:'',phone:'0123456789',address:'Local',email:'changed@example.test'},principal.token)).status,400);
    }
    assert.equal((await request('/api/auth/change-email','POST',{newEmail:'changed@example.test'},undefined,customer.cookie)).status,400);
    assert.equal((await db.collection('user').findOne({_id:new ObjectId(customer.id)}))!.email,'customer@example.com');
    const managedUsers = await (
      await request("/api/admin/users?page=1", "GET", undefined, admin.token)
    ).json();
    assert.equal(managedUsers.total, 3);
    assert.equal(managedUsers.limit, 25);
    assert.equal(managedUsers.items.length, 3);
    assert.equal(
      (await request("/api/admin/users?page=0", "GET", undefined, admin.token))
        .status,
      400,
    );
    const item = {
      name: "Compact Excavator",
      description:
        "Reliable compact excavator for local construction projects.",
      category: "Construction Equipment",
      location: "Dhaka",
      price: 120,
      rentalType: "daily",
      quantity: 2,
      condition: "Excellent",
      brand: "Test",
      model: "E20",
      image: "https://example.com/equipment.jpg",
      terms: "Return clean and inspect together.",
    };
    assert.equal(
      (await request("/api/equipment", "POST", item, customer.token)).status,
      403,
    );
    assert.equal(
      (await request("/api/admin/users", "GET", undefined, customer.token))
        .status,
      403,
    );
    assert.equal(
      (await request("/api/me", "GET", undefined, "invalid.jwt.token")).status,
      401,
    );
    const created = await request("/api/equipment", "POST", item, owner.token);
    assert.equal(created.status, 201);
    const equipment = await created.json();
    assert.equal(equipment.status, "pending");
    assert.equal((await (await request("/api/equipment")).json()).total, 0);
    assert.equal(
      (
        await request(
          "/api/equipment/" + equipment.id,
          "GET",
          undefined,
          customer.token,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/api/admin/equipment/" + equipment.id + "/status",
          "PATCH",
          { status: "approved" },
          admin.token,
        )
      ).status,
      200,
    );
    const catalog = await (
      await request(
        "/api/equipment?search=Dhaka&category=Construction%20Equipment&sort=price-asc",
      )
    ).json();
    assert.equal(catalog.total, 1);
    assert.equal((await request("/api/equipment?sort=invalid")).status, 400);
    assert.equal(
      (
        await request(
          "/api/favorites/" + equipment.id,
          "PUT",
          undefined,
          customer.token,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await (
          await request("/api/favorites", "GET", undefined, customer.token)
        ).json()
      ).items.length,
      1,
    );
    assert.equal(
      (
        await request(
          "/api/me",
          "PATCH",
          {
            name: "Customer",
            image: "",
            phone: "0123456789",
            address: "Dhaka",
            role: "admin",
          },
          customer.token,
        )
      ).status,
      400,
    );
    assert.equal(
      (await request("/api/checkout", "POST", {}, customer.token)).status,
      400,
    );
    const reservationId = new ObjectId();
    await db.collection("reservations").insertOne({
      _id: reservationId,
      status: "held",
      equipmentId: equipment.id,
      equipmentName: item.name,
      ownerId: owner.id,
      customerId: customer.id,
      customerEmail: "Customer@example.com",
      totalCents: 24000,
      start: "2030-01-01",
      end: "2030-01-03",
      quantity: 1,
    });
    const checkout = {
      id: "cs_test_synthetic",
      payment_status: "paid",
      currency: "usd",
      metadata: { reservationId: String(reservationId) },
      amount_total: 24000,
      customer_email: "Customer@example.com",
      payment_intent: "pi_test_synthetic",
    } as unknown as Stripe.Checkout.Session;
    await client.withSession((s) =>
      s.withTransaction(() => fulfill(db, s, checkout)),
    );
    await client.withSession((s) =>
      s.withTransaction(() => fulfill(db, s, checkout)),
    );
    assert.equal(await db.collection("bookings").countDocuments({}), 1);
    assert.equal(await db.collection("payments").countDocuments({}), 1);
    const reserveOnce = () =>
      client!.withSession((session) =>
        session.withTransaction(() =>
          reserve(
            db,
            session,
            {
              equipmentId: equipment.id,
              start: "2030-02-01",
              end: "2030-02-03",
              quantity: 1,
              phone: "0123456789",
              address: "Local test address",
              notes: "",
            },
            {
              id: customer.id,
              role: "customer",
              name: "Customer",
              email: "Customer@example.com",
            },
          ),
        ),
      );
    const reservations = await Promise.allSettled([
      reserveOnce(),
      reserveOnce(),
      reserveOnce(),
    ]);
    assert.equal(
      reservations.filter((x) => x.status === "fulfilled").length,
      2,
    );
    assert.equal(reservations.filter((x) => x.status === "rejected").length, 1);
    process.env.STRIPE_SECRET_KEY = "sk_test_synthetic";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_synthetic";
    const gateway = new Stripe(process.env.STRIPE_SECRET_KEY),
      event = JSON.stringify({
        id: "evt_synthetic",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: checkout },
      });
    const signature = gateway.webhooks.generateTestHeaderString({
      payload: event,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    assert.equal(
      (
        await fetch(base + "/api/payments/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": signature,
          },
          body: event,
        })
      ).status,
      200,
    );
    assert.equal(await db.collection("payments").countDocuments({}), 1);
    assert.equal(
      (
        await fetch(base + "/api/payments/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": "invalid",
          },
          body: event,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await (
          await request("/api/rentals", "GET", undefined, customer.token)
        ).json()
      ).total,
      1,
    );
    assert.equal(
      (
        await (
          await request("/api/analytics", "GET", undefined, owner.token)
        ).json()
      ).revenueCents,
      24000,
    );
    assert.equal(
      (
        await request(
          "/api/equipment/" + equipment.id,
          "DELETE",
          undefined,
          owner.token,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          "/api/admin/users/" + owner.id,
          "PATCH",
          { role: "customer", disabled: false },
          customer.token,
        )
      ).status,
      403,
    );
    for (const principal of [customer, owner, admin]) {
      assert.equal((await request("/api/me", "PATCH", {
        name: "Updated local profile", image: "", phone: "0123456789", address: "Local test address",
      }, principal.token)).status, 200);
    }
    const rental = await db.collection("bookings").findOne({});
    assert.ok(rental);
    assert.equal((await request("/api/admin/rentals/" + rental._id, "PATCH", {status:"completed"}, customer.token)).status, 403);
    assert.equal((await request("/api/admin/rentals/" + rental._id, "PATCH", {status:"completed"}, admin.token)).status, 409);
    // Move only this disposable fixture's period to exercise both legal transitions.
    const date = (offset: number) => new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
    await db.collection("bookings").updateOne({_id:rental._id}, {$set:{start:date(-2),end:date(1)}});
    assert.equal((await request("/api/admin/rentals/" + rental._id, "PATCH", {status:"ongoing"}, admin.token)).status, 200);
    await db.collection("bookings").updateOne({_id:rental._id}, {$set:{end:date(-1)}});
    assert.equal((await request("/api/admin/rentals/" + rental._id, "PATCH", {status:"completed"}, admin.token)).status, 200);
    for (const principal of [owner, admin]) {
      const analytics = await (await request("/api/analytics", "GET", undefined, principal.token)).json();
      assert.equal(analytics.users, principal === admin ? 3 : 0);
      assert.equal(analytics.equipment, 1);
      assert.equal(analytics.pending, 0);
      assert.equal(analytics.monthly[0].totalCents, 24000);
      assert.equal(analytics.monthlyBookings[0].count, 1);
      assert.equal(analytics.completed, 1);
      assert.equal(analytics.bookings, 1);
      assert.equal(analytics.revenueCents, 24000);
      assert.ok(analytics.monthly.length > 0);
      assert.ok(analytics.monthlyBookings.length > 0);
      assert.equal((await (await request("/api/rentals", "GET", undefined, principal.token)).json()).total, 1);
    }
    assert.equal(
      (
        await request(
          "/api/admin/users/" + owner.id,
          "PATCH",
          { role: "customer", disabled: false },
          admin.token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("/api/owner/equipment", "GET", undefined, owner.token))
        .status,
      401,
    );
    // F6.2 strict filters, featured count and isolated multi-page histories.
    for (const status of ["rejected", "pending", "approved"]) {
      assert.equal((await request('/api/admin/equipment/'+equipment.id+'/status','PATCH',{status},admin.token)).status,200);
      assert.equal((await(await request('/api/equipment')).json()).total,status==='approved'?1:0);
    }
    await db.collection('equipment').insertMany(Array.from({length:7},(_,i)=>({...item,_id:new ObjectId(),ownerId:owner.id,status:'approved',price:10+i,rentalType:i%2?'weekly':'daily',quantity:i===0?0:3,createdAt:new Date(Date.UTC(2026,0,i+1))})));
    const featured=await(await request('/api/equipment?featured=true')).json();assert.equal(featured.items.length,6);assert.equal(featured.total,8);assert.ok(featured.items.every((x:any)=>x.status==='approved'));
    for(const [query,check] of [
      ['rentalType=weekly',(x:any)=>x.rentalType==='weekly'],['min=12&max=15',(x:any)=>x.price>=12&&x.price<=15],['available=false',(x:any)=>x.quantity===0],['available=true',(x:any)=>x.quantity>0],['search=construction',(x:any)=>x.category==='Construction Equipment'],
    ] as const){const response=await(await request('/api/equipment?'+query)).json();assert.ok(response.items.length>0);assert.ok(response.items.every(check));}
    for(const [sort,sign]of[['price-asc',1],['price-desc',-1]] as const){const response=await(await request('/api/equipment?sort='+sort)).json();assert.ok(response.items.every((x:any,i:number,a:any[])=>i===0||(x.price-a[i-1].price)*sign>=0));}
    const p1=await(await request('/api/equipment?limit=4&page=1')).json(),p2=await(await request('/api/equipment?limit=4&page=2')).json();assert.equal(p1.items.length,4);assert.equal(p2.items.length,4);assert.equal(new Set([...p1.items,...p2.items].map(x=>x.id)).size,8);
    const rentalFields={equipmentId:equipment.id,equipmentName:item.name,ownerId:owner.id,ownerName:'Owner',customerId:customer.id,customerName:'Customer',customerEmail:'customer@example.test',phone:'0123456789',address:'Local fixture address',start:'2026-01-01',end:'2026-01-03',quantity:1,totalCents:24000,paymentStatus:'paid',bookingStatus:'completed',bookingDate:new Date()};
    await db.collection('bookings').insertMany(Array.from({length:17},()=>({...rentalFields,_id:new ObjectId(),reservationId:String(new ObjectId())})));
    await db.collection('bookings').insertOne({...rentalFields,reservationId:String(new ObjectId()),customerId:String(new ObjectId()),ownerId:String(new ObjectId())});
    const a=await(await request('/api/rentals?page=1','GET',undefined,customer.token)).json(),b=await(await request('/api/rentals?page=2','GET',undefined,customer.token)).json();assert.equal(a.total,18);assert.equal(a.items.length,15);assert.equal(b.items.length,3);assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,18);
    for(const field of Object.keys(rentalFields))assert.ok(field in a.items[0]);
    assert.equal((await(await request('/api/rentals','GET',undefined,admin.token)).json()).total,19);
    assert.equal((await request('/api/rentals?page=0','GET',undefined,customer.token)).status,400);

    const adminListing=await db.collection('equipment').findOne({price:10});assert.ok(adminListing);
    assert.equal((await request('/api/equipment/'+adminListing._id,'PATCH',{...item,name:'Admin revised local fixture'},admin.token)).status,200);
    assert.equal((await request('/api/equipment/'+adminListing._id,'DELETE',undefined,admin.token)).status,200);
    assert.equal((await request('/api/equipment/'+adminListing._id,'GET',undefined,admin.token)).status,404);
    for(const role of ['owner','admin','customer']){
      assert.equal((await request('/api/admin/users/'+customer.id,'PATCH',{role,disabled:false},admin.token)).status,200);
      assert.equal((await db.collection('user').findOne({_id:new ObjectId(customer.id)}))!.role,role);
    }
    assert.equal((await request('/api/admin/users/'+customer.id,'PATCH',{role:'customer',disabled:true},admin.token)).status,200);
    assert.equal((await request('/api/me','GET',undefined,customer.token)).status,401);
    assert.equal((await request("/api/not-a-route")).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (client ?? (await getClient())).close();
    await replica.stop();
  }
});
