// Imported only by the opt-in, ephemeral local preview runner. No provider requests.
import { ObjectId, type Db } from 'mongodb';
import type Stripe from 'stripe';
import { fulfill, ensureMarketplaceIndexes } from '../src/marketplace.js';
import { rentalPrice } from '../src/domain.js';
import { recordRentalEvent } from '../src/rental-events.js';
export async function seedF74Rentals(db:Db){
 if(process.env.NODE_ENV!=='test'||db.databaseName!=='equipora'||db.client.options.srvHost||!db.client.options.hosts?.every(h=>['localhost','127.0.0.1','::1'].includes(h.host??'')))throw Error('Isolated fixture database required');
 const customer=await db.collection('user').findOne({email:'customer@example.test'}),owner=await db.collection('user').findOne({email:'owner@example.test'}),equipment=await db.collection('equipment').findOne({demoId:'EQD-001',demoOnly:true});
 if(!customer||!owner||!equipment)throw Error('Synthetic preview fixtures required');await ensureMarketplaceIndexes(db);
 const day=(offset:number)=>new Date(Date.parse(new Date().toISOString().slice(0,10))+offset*86400000).toISOString().slice(0,10);
 for(const past of [false,true]){
  const reservation={_id:new ObjectId(),equipmentId:String(equipment._id),equipmentName:'SYNTHETIC QA — '+equipment.name,ownerId:String(owner._id),ownerName:owner.name,customerId:String(customer._id),customerName:customer.name,customerEmail:customer.email,start:day(past?-7:1),end:day(past?-5:3),quantity:past?1:equipment.quantity,unitPriceCents:Math.round(equipment.price*100),rentalType:equipment.rentalType,currency:'usd',status:'held',createdAt:new Date(),fixtureOnly:true};
  const held={...reservation,...rentalPrice(equipment.price,equipment.rentalType,reservation.start,reservation.end,reservation.quantity)};
  await db.client.withSession(session=>session.withTransaction(async()=>{
   await db.collection('reservations').insertOne(held,{session});
   await fulfill(db,session,{id:'cs_test_fixture_f74_'+reservation._id,payment_status:'paid',currency:'usd',livemode:false,metadata:{reservationId:String(reservation._id)},amount_total:held.totalCents,customer_email:customer.email,payment_intent:'fixture_transaction_'+reservation._id} as unknown as Stripe.Checkout.Session);
   await db.collection('payments').updateOne({reservationId:String(reservation._id)},{$set:{fixtureOnly:true}},{session});
   if(past){const booking=(await db.collection('bookings').findOne({reservationId:String(reservation._id)},{session}))!,now=new Date();await db.collection('bookings').updateOne({_id:booking._id},{$set:{bookingStatus:'completed',completedAt:now}},{session});await recordRentalEvent(db,booking,'completed',now,session)}
  }));
 }
}
