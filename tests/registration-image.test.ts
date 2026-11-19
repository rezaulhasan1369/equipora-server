import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { app } from "../src/app.js";

test("registration image upload is origin-gated, bounded, fixed-destination and quota-limited", async () => {
  const originalFetch = globalThis.fetch, oldKey=process.env.IMGBB_API_KEY, oldOrigin=process.env.FRONTEND_URL;
  process.env.FRONTEND_URL="http://localhost:3000"; process.env.IMGBB_API_KEY="synthetic-local-upload-key";
  let probes=0;
  globalThis.fetch=async (url, options)=>{
    if (typeof url === "string" && url.startsWith("https://api.imgbb.com/")) {
      probes++; const parsed=new URL(url);assert.equal(parsed.origin,"https://api.imgbb.com");assert.equal(parsed.pathname,"/1/upload");assert.equal(options?.redirect,"error");assert.ok(options?.signal);
      return Response.json({success:true,data:{url:"https://i.ibb.co/local/profile.png"}});
    }
    return originalFetch(url,options);
  };
  const server=app.listen(0,"127.0.0.1"); await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");
  const url=`http://127.0.0.1:${address.port}/api/registration-image`;
  const image=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString("base64");
  const call=(body:unknown,origin="http://localhost:3000",type="application/json")=>originalFetch(url,{method:"POST",headers:{origin,"content-type":type},body:JSON.stringify(body)});
  try {
    assert.equal((await call({image},"https://attacker.invalid")).status,403);
    assert.equal((await call({image},"http://localhost:3000","text/plain")).status,415);
    assert.equal((await call({image:"bm90LWltYWdl"})).status,400);assert.equal(probes,0);
    assert.equal((await call({image:"x".repeat(3200000)})).status,413);assert.equal(probes,0);
    const response=await call({image});assert.equal(response.status,200);assert.deepEqual(await response.json(),{url:"https://i.ibb.co/local/profile.png"});assert.equal(probes,1);
    let status=0;for(let i=0;i<12;i++){status=(await call({image})).status;if(status===429)break;}assert.equal(status,429);assert.ok(probes<=10);
  } finally {
    globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));
    if(oldKey===undefined)delete process.env.IMGBB_API_KEY;else process.env.IMGBB_API_KEY=oldKey;
    if(oldOrigin===undefined)delete process.env.FRONTEND_URL;else process.env.FRONTEND_URL=oldOrigin;
  }
});
