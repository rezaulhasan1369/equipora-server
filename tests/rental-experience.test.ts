import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { availability, availabilityQuery } from "../src/rental-experience.js";
import { recordRentalEvent, rentalTimeline, notificationCollection } from "../src/rental-events.js";
import { completeRentals, simulationMailer } from '../src/rental-completion.js';
import { ownedRental, notificationsPage, readNotification } from "../src/rental-experience.js";
import { paymentReceipt } from '../src/rental-receipt.js';

test("availability uses actual occupancy, quantities, end boundaries and privacy-safe output",async()=>{
 const replica=await MongoMemoryReplSet.create({replSet:{count:1}}),client=await new MongoClient(replica.getUri()).connect();
 try{const db=client.db("equipora_f74"),_id=new ObjectId();await db.collection("equipment").insertOne({_id,quantity:3,status:"approved"});
 await db.collection("reservations").insertMany([
 {equipmentId:String(_id),status:"paid",start:"2030-01-01",end:"2030-01-03",quantity:2,customerEmail:"private@example.test"},
 {equipmentId:String(_id),status:"held",start:"2030-01-02",end:"2030-01-04",quantity:1},
 {equipmentId:String(_id),status:"cancelled",start:"2030-01-01",end:"2030-01-05",quantity:99},
 {equipmentId:String(_id),status:"expired",start:"2030-01-01",end:"2030-01-05",quantity:99}]);
 const result=await availability(db,String(_id),{start:"2030-01-01",end:"2030-01-05",quantity:2});
 assert.deepEqual(result.days.map(d=>d.remaining),[1,0,2,3]);assert.deepEqual(result.days.map(d=>d.available),[false,false,true,true]);assert.ok(!JSON.stringify(result).includes('private'));assert.deepEqual(Object.keys(result.days[0]).sort(),['available','date','remaining']);
 await db.collection('equipment').updateOne({_id},{$set:{status:'pending'}});await assert.rejects(availability(db,String(_id),{start:'2030-01-01',end:'2030-01-02',quantity:1}));
 for(const q of [{start:'2000-01-01',end:'2000-01-02',quantity:1},{start:'2030-02-30',end:'2030-03-01',quantity:1},{start:'2030-01-01',end:'2030-01-02',quantity:0},{start:'2030-01-01',end:'2030-01-02',quantity:1,host:'bad'}])assert.equal(availabilityQuery.safeParse(q).success,false);
 }finally{await client.close();await replica.stop()}
});
test('receipts require matching successful payment and participant ownership; HTML is escaped and test-labelled',async()=>{
 const replica=await MongoMemoryReplSet.create({replSet:{count:1}}),client=await new MongoClient(replica.getUri()).connect();
 try{const db=client.db('equipora_f74'),customer={id:String(new ObjectId()),role:'customer'},owner={id:String(new ObjectId()),role:'owner'},booking={_id:new ObjectId(),customerId:customer.id,ownerId:owner.id,customerName:'<script>customer</script>',ownerName:'Owner & Co',equipmentName:'<img src=x onerror=alert(1)>',paymentStatus:'paid',sessionId:'fixture_session',reservationId:String(new ObjectId()),start:'2030-01-01',end:'2030-01-03',quantity:2,units:2,unitPriceCents:2500,rentalType:'daily',totalCents:10000};await db.collection('bookings').insertOne(booking);
 await assert.rejects(paymentReceipt(db,customer,String(booking._id)));
 await db.collection('payments').insertOne({sessionId:booking.sessionId,reservationId:booking.reservationId,customerId:customer.id,ownerId:owner.id,totalCents:10000,currency:'usd',createdAt:new Date(),livemode:false,transactionId:'fixture_transaction'});
 const receipt=await paymentReceipt(db,customer,String(booking._id));assert.ok(receipt.html.includes('TEST PAYMENT'));assert.ok(receipt.html.includes('$100.00'));assert.ok(receipt.html.includes('$25.00'));assert.ok(receipt.html.includes('&lt;script&gt;'));assert.ok(receipt.html.includes('&lt;img'));assert.ok(!receipt.html.includes('<script>'));assert.ok(!receipt.html.includes('onerror="'));assert.ok(receipt.filename.endsWith('.html'));assert.ok((await paymentReceipt(db,owner,String(booking._id))).html);
 await assert.rejects(paymentReceipt(db,{id:String(new ObjectId()),role:'customer'},String(booking._id)));await assert.rejects(paymentReceipt(db,{...customer,role:'admin'},String(booking._id)));
 await db.collection('payments').updateOne({sessionId:booking.sessionId},{$set:{totalCents:1}});await assert.rejects(paymentReceipt(db,customer,String(booking._id)));
 await db.collection('payments').updateOne({sessionId:booking.sessionId},{$set:{totalCents:10000,status:'failed'}});await assert.rejects(paymentReceipt(db,customer,String(booking._id)));
 await db.collection('payments').updateOne({sessionId:booking.sessionId},{$unset:{status:''}});await db.collection('bookings').updateOne({_id:booking._id},{$set:{paymentStatus:'pending'}});await assert.rejects(paymentReceipt(db,customer,String(booking._id)));
 }finally{await client.close();await replica.stop()}
});
test('notifications are persisted once per transition and recipient, paginated and ownership-protected',async()=>{
 const replica=await MongoMemoryReplSet.create({replSet:{count:1}}),client=await new MongoClient(replica.getUri()).connect();
 try{const db=client.db('equipora_f74'),customer={id:String(new ObjectId()),role:'customer'},owner={id:String(new ObjectId()),role:'owner'},booking={_id:new ObjectId(),customerId:customer.id,ownerId:owner.id,equipmentName:'Fixture camera'};
 await Promise.all([1,2,3].map(()=>client.withSession(s=>s.withTransaction(()=>recordRentalEvent(db,booking,'payment_confirmed',new Date(),s)))));
 assert.equal(await db.collection('rental_notifications').countDocuments(),2);
 const own=await notificationsPage(db,customer,{});assert.equal(own.unread,1);assert.equal(own.items[0].title,'Payment confirmed');assert.equal(own.items[0].bookingId,String(booking._id));assert.equal('userId' in own.items[0],false);
 const notificationId=own.items[0].id;await assert.rejects(readNotification(db,owner,notificationId));await readNotification(db,customer,notificationId);const first=(await notificationCollection(db).findOne({_id:notificationId}))!.readAt;assert.ok(first instanceof Date);
 await readNotification(db,customer,notificationId);assert.equal((await notificationsPage(db,customer,{})).unread,0);assert.deepEqual((await notificationCollection(db).findOne({_id:notificationId}))!.readAt,first);
 await assert.rejects(notificationsPage(db,customer,{userId:owner.id}));await assert.rejects(notificationsPage(db,{id:customer.id,role:'admin'},{}));
 for(let n=0;n<16;n++)await recordRentalEvent(db,{...booking,_id:new ObjectId()},'completed',new Date());assert.equal((await notificationsPage(db,customer,{page:1})).items.length,15);assert.equal((await notificationsPage(db,customer,{page:2})).items.length,2);
 }finally{await client.close();await replica.stop()}
});
test('rental history is scoped, idempotent and never infers missing historical dates',async()=>{
 const replica=await MongoMemoryReplSet.create({replSet:{count:1}}),client=await new MongoClient(replica.getUri()).connect();
 try{const db=client.db('equipora_f74'),booking={_id:new ObjectId(),customerId:String(new ObjectId()),ownerId:String(new ObjectId()),bookingStatus:'completed',paymentStatus:'paid',sessionId:'fixture_checkout',reservationId:String(new ObjectId()),totalCents:1000};await db.collection('bookings').insertOne(booking);
 assert.deepEqual(await rentalTimeline(db,booking),[]);
 for(const role of ['customer','owner'])assert.ok(await ownedRental(db,{id:role==='customer'?booking.customerId:booking.ownerId,role},String(booking._id)));
 await assert.rejects(ownedRental(db,{id:String(new ObjectId()),role:'customer'},String(booking._id)));await assert.rejects(ownedRental(db,{id:booking.customerId,role:'admin'},String(booking._id)));
 const at=new Date();await Promise.all([1,2].map(()=>client.withSession(s=>s.withTransaction(()=>recordRentalEvent(db,booking,'completed',at,s)))));
 assert.equal(await db.collection('rental_events').countDocuments(),1);assert.equal((await rentalTimeline(db,booking))[0].at,at.toISOString());
 }finally{await client.close();await replica.stop()}
});
test('completion retries do not invent history for already-completed legacy bookings',async()=>{
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='test';
 const replica=await MongoMemoryReplSet.create({replSet:{count:1}}),client=await new MongoClient(replica.getUri()).connect();
 try{const db=client.db('equipora_f62_f74'),_id=new ObjectId();await db.collection('bookings').insertOne({_id,customerId:String(new ObjectId()),ownerId:String(new ObjectId()),equipmentName:'Legacy fixture',paymentStatus:'paid',bookingStatus:'completed',end:'2020-01-01'});await completeRentals(db,simulationMailer());const record=(await db.collection('bookings').findOne({_id}))!;assert.equal(record.completedAt,undefined);assert.equal((await rentalTimeline(db,record)).length,0);assert.equal(await db.collection('rental_notifications').countDocuments(),0);
 }finally{await client.close();await replica.stop();if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous}
});
