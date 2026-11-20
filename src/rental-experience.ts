import express from "express";
import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { getClient } from "./db.js";
import { HttpError, verifyToken } from "./auth.js";
import { rentalTimeline, notificationCollection, eventTitles } from "./rental-events.js";
import { paymentReceipt } from './rental-receipt.js';
import { ownedRental, participant } from './rental-access.js';
export { ownedRental } from './rental-access.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
const id = (v: unknown) => {
  if (typeof v !== "string" || !/^[a-f0-9]{24}$/i.test(v)) throw new HttpError(400,"Invalid identifier");
  return new ObjectId(v);
};
export const availabilityQuery = z.object({start:date,end:date,quantity:z.coerce.number().int().min(1).max(10000)}).strict().refine(v => {
  const today=new Date().toISOString().slice(0,10), days=(Date.parse(v.end)-Date.parse(v.start))/86400000;
  return v.start>=today && days>0 && days<=62;
},"Choose a future availability window of at most 62 days");
export async function availability(db:Db, equipmentId:string, query:z.infer<typeof availabilityQuery>) {
  const equipment=await db.collection("equipment").findOne({_id:id(equipmentId),status:"approved",deleted:{$ne:true}});
  if(!equipment)throw new HttpError(404,"Equipment is not available");
  // Identical occupancy states and end-exclusive boundaries to reserve(). Never infer hold expiry.
  const rows=await db.collection("reservations").find({equipmentId:String(equipment._id),status:{$in:["held","paid"]},start:{$lt:query.end},end:{$gt:query.start}}).limit(5001).toArray();
  if(rows.length>5000)throw new HttpError(503,"Availability cannot be confirmed right now");
  if(!Number.isSafeInteger(equipment.quantity)||equipment.quantity<0||rows.some(r=>!Number.isSafeInteger(r.quantity)||r.quantity<1||!date.safeParse(r.start).success||!date.safeParse(r.end).success||r.end<=r.start))throw new HttpError(503,"Availability cannot be confirmed right now");
  const days=[];
  for(let t=Date.parse(query.start);t<Date.parse(query.end);t+=86400000){
    const day=new Date(t).toISOString().slice(0,10);
    const used=rows.filter(r=>r.start<=day&&r.end>day).reduce((n,r)=>n+r.quantity,0);
    const remaining=Math.max(0,equipment.quantity-used);
    days.push({date:day,remaining,available:remaining>=query.quantity});
  }
  return {equipmentId:String(equipment._id),quantity:query.quantity,days,snapshot:true,endExclusive:true};
}
export const rentalExperienceRouter=express.Router();
rentalExperienceRouter.get("/equipment/:id/availability",verifyToken,async(req,res)=>{
  const query=availabilityQuery.parse(req.query);
  res.set("Cache-Control","no-store").json(await availability((await getClient()).db("equipora"),String(req.params.id),query));
});
rentalExperienceRouter.get('/rentals/:id/activity',verifyToken,async(req,res)=>{
 const db=(await getClient()).db('equipora'),booking=await ownedRental(db,req.principal!,String(req.params.id));
 res.set('Cache-Control','no-store').json({id:String(booking._id),equipmentName:booking.equipmentName,start:booking.start,end:booking.end,quantity:booking.quantity,bookingStatus:booking.bookingStatus,paymentStatus:booking.paymentStatus,events:await rentalTimeline(db,booking)});
});
const notificationQuery=z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict();
export async function notificationsPage(db:Db,user:{id:string;role:string},query:unknown){
 participant(user);const {page}=notificationQuery.parse(query),filter={userId:user.id},limit=15;
 const [items,total,unread]=await Promise.all([notificationCollection(db).find(filter).sort({createdAt:-1,_id:-1}).skip((page-1)*limit).limit(limit).toArray(),notificationCollection(db).countDocuments(filter),notificationCollection(db).countDocuments({...filter,readAt:null})]);
 return {page,limit,total,unread,items:items.map(n=>({id:n._id,bookingId:n.bookingId,title:eventTitles[n.kind],equipmentName:n.equipmentName,createdAt:n.createdAt,readAt:n.readAt}))};
}
export async function readNotification(db:Db,user:{id:string;role:string},notificationId:string){
 participant(user);if(!/^[a-f0-9]{64}$/.test(notificationId))throw new HttpError(400,'Invalid notification');
 const result=await notificationCollection(db).findOneAndUpdate({_id:notificationId,userId:user.id},[{$set:{readAt:{$ifNull:['$readAt',new Date()]}}}],{returnDocument:'after'});
 if(!result)throw new HttpError(404,'Notification not found');return {ok:true};
}
rentalExperienceRouter.get('/notifications',verifyToken,async(req,res)=>res.set('Cache-Control','no-store').json(await notificationsPage((await getClient()).db('equipora'),req.principal!,req.query)));
rentalExperienceRouter.patch('/notifications/:id/read',verifyToken,async(req,res)=>{z.object({}).strict().parse(req.body??{});res.set('Cache-Control','no-store').json(await readNotification((await getClient()).db('equipora'),req.principal!,String(req.params.id)))});
rentalExperienceRouter.get('/rentals/:id/receipt',verifyToken,async(req,res)=>{z.object({}).strict().parse(req.query);res.set('Cache-Control','no-store').json(await paymentReceipt((await getClient()).db('equipora'),req.principal!,String(req.params.id)))});
