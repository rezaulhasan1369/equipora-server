// Local artwork preparation only. No MongoDB/provider credentials are read.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('D:/Equipora/client/package.json');
const sharp = require('sharp');
const root = 'D:/Equipora/client/public/assets/equipment';
await fs.mkdir(root,{recursive:true});
const source = JSON.parse(await fs.readFile('D:/Equipora/assets-source/catalog/equipora-demo-inventory-30.json','utf8'));
const queries = ['Caterpillar 320 excavator','mini excavator','wheel loader','backhoe loader','concrete mixer machine','Sony mirrorless camera','cinema camera','DJI camera drone','camera gimbal','LED photography light','cargo pickup truck','box truck','passenger minibus','warehouse forklift','electric cargo tricycle','compact tractor','walking tractor','irrigation pump','agricultural sprayer','rice thresher','diesel generator','portable generator','video projector','workstation laptop','laser distance meter','LED video wall','concert stage','PA loudspeaker','moving head stage light','marquee tent'];
const prices = [185,72,145,98,25,45,120,65,22,35,60,95,85,90,32,75,35,18,15,42,65,28,38,40,12,160,140,95,65,110];
let credits=[];try{credits=JSON.parse(await fs.readFile(root+'/credits.json','utf8'))}catch{}
const normalized=[];
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'EquiporaLocalDemo/1.0 educational portfolio asset preparation'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('asset_http_'+r.status);return r;}
for(let i=0;i<source.items.length;i++){
 const item=source.items[i]; const file=item.id.toLowerCase()+'.webp';
 try{
  if(credits.some(c=>c.id===item.id)) throw Error('already_prepared');
  const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:(i===19?'threshing machine':queries[i])+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'5',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'900'}).toString();
  const data=await(await get(url)).json();const pages=Object.values(data.query?.pages??{}).sort((a,b)=>(a.index??0)-(b.index??0));
  const chosen=pages.find(p=>p.imageinfo?.[0]?.thumburl&&/CC|public domain/i.test(p.imageinfo[0].extmetadata?.LicenseShortName?.value??''));if(!chosen)throw Error('licensed_photo_unavailable');
  const info=chosen.imageinfo[0];const imageURL=new URL(info.thumburl);if(imageURL.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(imageURL.hostname))throw Error('image_target_rejected');
  const buffer=Buffer.from(await(await get(imageURL)).arrayBuffer());if(buffer.length>12000000)throw Error('image_size');await sharp(buffer).rotate().resize(900,660,{fit:'contain',background:'#eef2f5'}).webp({quality:83}).toFile(root+'/'+file);
  const plain=s=>(s??'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();credits.push({id:item.id,file:'/assets/equipment/'+file,imageUrl:info.thumburl,title:chosen.title,source:info.descriptionurl,author:plain(info.extmetadata?.Artist?.value),license:plain(info.extmetadata?.LicenseShortName?.value),licenseUrl:info.extmetadata?.LicenseUrl?.value??'',modified:'Resized, padded and converted to WebP. Illustrative equipment photo; exact specification is fictional.'});
  console.log(JSON.stringify({id:item.id,imagePrepared:true}));
 }catch(e){console.log(JSON.stringify({id:item.id,imagePrepared:false,category:e.message}));}
 const credit=credits.find(c=>c.id===item.id);
 normalized.push({demoId:item.id,name:item.title,description:item.description+'. Synthetic portfolio listing; specifications and availability are illustrative.',category:item.category,location:item.location,price:prices[i],rentalType:i===23?'weekly':i===24?'monthly':'daily',quantity:item.availableQuantity,condition:item.condition,brand:'Demonstration equipment',model:item.id,image:credit?(credit.imageUrl??'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(credit.title.replace(/^File:/,''))):'',terms:item.rentalTerms+' Rates are independently authored USD demo rates, not a currency conversion.',demoOnly:true,sourceCurrency:source.currency});
 await new Promise(r=>setTimeout(r,2200));
}
await fs.writeFile('D:/Equipora/server/scripts/f5-demo-catalog.json',JSON.stringify(normalized,null,2)+'\n');
await fs.writeFile('D:/Equipora/client/public/assets/equipment/credits.json',JSON.stringify(credits,null,2)+'\n');
console.log(JSON.stringify({catalogRecords:normalized.length,imagesPrepared:credits.length}));
