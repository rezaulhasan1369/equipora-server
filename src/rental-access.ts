import { ObjectId, type Db, type Document } from 'mongodb';
import { HttpError } from './auth.js';
export function participant(user:{id:string;role:string}) {
 if(user.role==='customer')return {customerId:user.id};
 if(user.role==='owner')return {ownerId:user.id};
 throw new HttpError(403,'This feature is available to customers and owners');
}
export async function ownedRental(db:Db,user:{id:string;role:string},bookingId:string):Promise<Document>{
 const scope=participant(user);if(!/^[a-f0-9]{24}$/i.test(bookingId))throw new HttpError(400,'Invalid identifier');
 const booking=await db.collection('bookings').findOne({_id:new ObjectId(bookingId),...scope});
 if(!booking)throw new HttpError(404,'Rental not found');return booking;
}
export async function paidPayment(db:Db,booking:Document){
 if(booking.paymentStatus!=='paid'||typeof booking.sessionId!=='string'||!booking.sessionId||typeof booking.reservationId!=='string'||!/^[a-f0-9]{24}$/i.test(booking.reservationId))return null;
 const payment=await db.collection('payments').findOne({sessionId:booking.sessionId,reservationId:booking.reservationId,customerId:booking.customerId,ownerId:booking.ownerId});
 if(!payment||!Number.isSafeInteger(payment.totalCents)||payment.totalCents<=0||payment.totalCents!==booking.totalCents||payment.currency!=='usd'||payment.refunded===true||payment.paid===false||payment.status!==undefined&&!['paid','succeeded'].includes(payment.status))return null;
 return payment;
}
