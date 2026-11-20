import type { ClientSession, Db, Document } from "mongodb";
import { createHash } from 'node:crypto';
import { paidPayment } from './rental-access.js';
export type RentalEventKind="payment_confirmed"|"ongoing"|"completed";
type RentalEvent={_id:string;bookingId:string;kind:RentalEventKind;at:Date};
const events=(db:Db)=>db.collection<RentalEvent>('rental_events');
export const eventTitles={payment_confirmed:"Payment confirmed",ongoing:"Rental in progress",completed:"Rental completed"} as const;
export function recordedTime(value:unknown):string|null {
 if(!(value instanceof Date)&&!(typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)))return null;
 const time=value instanceof Date?value:new Date(value);return Number.isFinite(time.getTime())?time.toISOString():null;
}
export type RentalNotification={_id:string;userId:string;bookingId:string;kind:RentalEventKind;equipmentName:string;createdAt:Date;readAt:Date|null};
export const notificationCollection=(db:Db)=>db.collection<RentalNotification>('rental_notifications');
export async function ensureRentalEventIndexes(db:Db){await Promise.all([db.collection('rental_events').createIndex({bookingId:1,at:1}),notificationCollection(db).createIndex({userId:1,createdAt:-1,_id:-1})])}
export async function recordRentalEvent(db:Db, booking:Document, kind:RentalEventKind, at:Date, session?:ClientSession){
 if(!recordedTime(at))throw Error('Invalid event timestamp');
 await events(db).updateOne({_id:`${booking._id}:${kind}`},{$setOnInsert:{bookingId:String(booking._id),kind,at}}, {upsert:true,session});
 for(const role of ['customer','owner']){
  const userId=booking[role+'Id'];if(typeof userId!=='string'||!/^[a-f0-9]{24}$/i.test(userId))continue;
  const _id=createHash('sha256').update(`${booking._id}:${kind}:${role}:${userId}`).digest('hex');
  await notificationCollection(db).updateOne({_id},{$setOnInsert:{userId,bookingId:String(booking._id),kind,equipmentName:String(booking.equipmentName??'Equipment').slice(0,120),createdAt:at,readAt:null}},{upsert:true,session});
 }
}
export async function rentalTimeline(db:Db,booking:Document){
 const records=await db.collection('rental_events').find({bookingId:String(booking._id)}).sort({at:1}).limit(30).toArray();
 const events=records.filter(r=>Object.hasOwn(eventTitles,r.kind)&&recordedTime(r.at)).map(r=>({kind:String(r.kind),at:recordedTime(r.at)!,source:'recorded'}));
 const add=(kind:string,value:unknown)=>{const at=recordedTime(value);if(at&&!events.some(e=>e.kind===kind))events.push({kind,at,source:'existing_timestamp'})};
 add('initiated',booking.createdAt);
 if(booking.paymentStatus==='paid'){
  const payment=await paidPayment(db,booking);
  if(payment)add('payment_confirmed',payment.createdAt);
 }
 if(booking.bookingStatus==='completed')add('completed',booking.completedAt);
 if(booking.bookingStatus==='cancelled')add('cancelled',booking.cancelledAt);
 return events.sort((a,b)=>a.at.localeCompare(b.at));
}
