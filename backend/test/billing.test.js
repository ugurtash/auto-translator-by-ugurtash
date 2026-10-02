import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionAccess,hmac,bindingValue} from '../lib/billing.js';
import webhook from '../api/webhooks/lemonsqueezy.js';
import checkout from '../api/checkout.js';
process.env.SUPABASE_URL='https://project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
process.env.OWNER_USER_ID='owner';
process.env.LEMON_SQUEEZY_API_KEY='test-api';
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET='test-secret';
process.env.LEMON_SQUEEZY_STORE_ID='1';
process.env.LEMON_SQUEEZY_VARIANT_ID='2';
const uid='11111111-1111-4111-8111-111111111111';
function res(){return {code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body}}}
const config={store:'1',variant:'2',test:false};
async function delivery(event='subscription_created',custom=true){
 const body={meta:{event_name:event,...(custom?{custom_data:{user_id:uid,user_signature:await hmac(bindingValue(uid,config),'test-secret')}}:{})},data:{id:'3',attributes:{subscription_id:3}}};
 const rawBody=JSON.stringify(body);return {method:'POST',rawBody,headers:{'x-signature':await hmac(rawBody,'test-secret')}};
}
const paidInvoice={subscription_id:3,store_id:1,test_mode:false,status:'paid',updated_at:'2026-10-02'};
const attributes={store_id:1,variant_id:2,customer_id:4,test_mode:false,status:'active',renews_at:'2030-01-01',updated_at:'2026-10-02'};
test('paid access ends on expiration and rejects paused, refunded and test-independent invalid state',()=>{
 for(const status of ['active','cancelled','on_trial']) assert.equal(subscriptionAccess({status,access_until:'2030-01-01'},Date.parse('2026-01-01')),true);
 for(const row of [{status:'active',access_until:'2025-01-01'},{status:'paused',access_until:'2030-01-01'},{status:'active',access_until:'2030-01-01',revoked:true},{status:'active'}]) assert.equal(subscriptionAccess(row,Date.parse('2026-01-01')),false);
});
test('tampered webhook signature never calls upstream services',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Must not fetch')});const req=await delivery();req.rawBody+=' ';const output=res();await webhook(req,output);assert.equal(output.code,401);
});
test('latest provider state is used even for delayed created event',async t=>{
 let snapshot;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
 if(String(url).includes('subscription-invoices')) return Response.json({data:[{attributes:paidInvoice}]});
 if(String(url).includes('api.lemonsqueezy')) return Response.json({data:{attributes:{...attributes,status:'expired',ends_at:'2026-01-01'}}});
 if(String(url).includes('/rpc/')){snapshot=JSON.parse(options.body).snapshot;return new Response(null,{status:204})}
 return Response.json([]);
 });const output=res();await webhook(await delivery(),output);assert.equal(output.code,200);assert.equal(snapshot.status,'expired');assert.equal(snapshot.user_id,uid);
});
test('test purchase never changes production billing state',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({data:{attributes:{...attributes,test_mode:true}}})});
 const output=res();await webhook(await delivery(),output);assert.equal(output.code,200);assert.equal(output.body.ignored,true);assert.equal(calls,1);
});
test('unsigned account binding is refused before writing',async t=>{
 t.mock.method(globalThis,'fetch',async url=>String(url).includes('api.lemonsqueezy')?Response.json({data:{attributes}}):Response.json([]));const output=res();await webhook(await delivery('subscription_created',false),output);assert.equal(output.code,400);
});
test('database failure returns retryable error instead of acknowledging payment',async t=>{
 t.mock.method(globalThis,'fetch',async url=>String(url).includes('subscription-invoices')?Response.json({data:[{attributes:paidInvoice}]}):String(url).includes('api.lemonsqueezy')?Response.json({data:{attributes}}):String(url).includes('/rpc/')?Response.json({}, {status:500}):Response.json([]));const output=res();await webhook(await delivery(),output);assert.equal(output.code,503);
});
test('checkout binds confirmed account and cannot be redirected to another host',async t=>{
 let posted;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
 if(String(url).includes('/auth/')) return Response.json({id:uid,email:'customer@example.com',email_confirmed_at:'2026-01-01'});
 if(String(url).includes('api.lemonsqueezy')){posted=JSON.parse(options.body);return Response.json({data:{attributes:{url:'https://example.com/phishing'}}})}
 return Response.json([]);
 });const output=res();await checkout({method:'POST',headers:{authorization:'Bearer test'}},output);assert.equal(output.code,503);assert.equal(posted.data.attributes.checkout_data.custom.user_id,uid);assert.equal(posted.data.attributes.checkout_data.custom.user_signature,await hmac(bindingValue(uid,config),'test-secret'));
});
test('unverified user cannot begin checkout',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({id:uid,email:'customer@example.com'})});const output=res();await checkout({method:'POST',headers:{authorization:'Bearer test'}},output);assert.equal(output.code,401);assert.equal(calls,1);
});

test('old refund event does not revoke the newest paid renewal',async t=>{
 let snapshot;t.mock.method(globalThis,'fetch',async(url,options)=>{
 if(String(url).includes('subscription-invoices'))return Response.json({data:[{attributes:paidInvoice}]});
 if(String(url).includes('api.lemonsqueezy'))return Response.json({data:{attributes}});
 if(String(url).includes('/rpc/')){snapshot=JSON.parse(options.body).snapshot;return new Response(null,{status:204})}return Response.json([{user_id:uid}]);
 });const req=await delivery('subscription_payment_refunded');const output=res();await webhook(req,output);assert.equal(output.code,200);assert.equal(snapshot.revoked,false);
});
test('latest fully refunded invoice revokes access despite active subscription',async t=>{
 let snapshot;t.mock.method(globalThis,'fetch',async(url,options)=>{
 if(String(url).includes('subscription-invoices'))return Response.json({data:[{attributes:{...paidInvoice,status:'refunded'}}]});
 if(String(url).includes('api.lemonsqueezy'))return Response.json({data:{attributes}});
 if(String(url).includes('/rpc/')){snapshot=JSON.parse(options.body).snapshot;return new Response(null,{status:204})}return Response.json([{user_id:uid}]);
 });const output=res();await webhook(await delivery(),output);assert.equal(output.code,200);assert.equal(snapshot.revoked,true);
});
