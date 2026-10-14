
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=process.argv[2] || path.resolve(__dirname, '../../..');
const ts=require(require.resolve('typescript',{paths:[path.join(root,'apps/api')]}));
const decorator=()=>()=>{};
class HttpError extends Error{}
const mocks={
 '@nestjs/common':{Inject:decorator,Injectable:decorator,BadRequestException:HttpError,NotFoundException:HttpError,Logger:class{warn(){}}},
 '@prisma/client':{Prisma:{PrismaClientKnownRequestError:class extends Error{}},TaskReminderStatus:{PENDING:'PENDING',NONE:'NONE',STOPPED:'STOPPED'}},
 '../../common/database/prisma.service.js':{PrismaService:class{}},
 '../../common/events/outbox.service.js':{OutboxService:class{}},
 '../notifications/notifications.service.js':{NotificationsService:class{}},
 '../../common/auth/whatsapp-otp.service.js':{WhatsAppOtpService:class{}},
 '../../common/auth/smtp-otp.service.js':{SmtpOtpService:class{}}
};
function load(file){const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;vm.runInNewContext(js,{exports:m.exports,module:m,require:n=>{if(!(n in mocks))throw Error('Unexpected dependency '+n);return mocks[n];},Date,console,Promise});return m.exports;}
const {TasksService}=load(path.join(root,'apps/api/src/modules/tasks/tasks.service.ts'));
const {NotificationsService}=load(path.join(root,'apps/api/src/modules/notifications/notifications.service.ts'));
const id='11111111-1111-4111-8111-111111111111',user={userId:'owner',role:'BRAND'};
let records=[],transactionCount=0;
let current={id,title:'Task',notes:'',dueDate:'2026-10-04',dueTime:'9 PM',dueAt:new Date(Date.now()+3600_000),reminderEnabled:true,completedAt:null,reminderStatus:'PENDING',reminderGeneration:1,createdById:'owner',recipients:[],activities:[],createdBy:{profile:null},createdAt:new Date(),updatedAt:new Date()};
const db={
 $queryRaw:async()=>[], $executeRaw:async()=>0,
 task:{findUnique:async q=>records.find(t=>t.id===q.where.id)||null,findFirst:async q=>q.where.OR.some(x=>x.createdById==='owner'||x.brandId==='owner'||x.creatorId==='owner')?{...current}:null,
 create:async({data})=>{const t={id:'new-'+records.length,...data};records.push(t);return t;},
 update:async({data})=>{current={...current,...data};return current;},delete:async()=>{current=null;}},
 taskActivity:{create:async()=>{}},outboxEvent:{deleteMany:async()=>{}},
 $transaction:async f=>{transactionCount++;return f(db);}
};
const service=new TasksService(db,{create:async()=>{}},{enqueueTaskReminderEvents:async()=>{}});
service.get=async()=>current;
const results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
(async()=>{
 await test('Unauthenticated ownership filter rejects unrelated user',async()=>{await assert.rejects(service.update({userId:'stranger',role:'CREATOR'},id,{reminderEnabled:false}),/Task not found/);});
 await test('Reject timezone-free reminder timestamp',async()=>{await assert.rejects(service.create(user,{title:'t',dueDate:'2026-10-04',dueTime:'9 PM',reminderEnabled:true,reminderAt:'2026-10-04T21:00:00'}),/timezone offset/);});
 await test('Reject past reminder creation',async()=>{await assert.rejects(service.create(user,{title:'t',dueDate:'2020-01-01',dueTime:'9 PM',reminderEnabled:true,reminderAt:'2020-01-01T21:00:00Z'}),/future reminder/);});
 await test('Date edit must include replacement reminder instant',async()=>{await assert.rejects(service.update(user,id,{dueDate:'2026-10-05'}),/Provide reminderAt/);});
 await test('Stop persists disabled/null alarm state',async()=>{await service.update(user,id,{reminderEnabled:false,reminderAt:null});assert.equal(current.reminderEnabled,false);assert.equal(current.dueAt,null);assert.equal(current.reminderStatus,'STOPPED');});
 await test('Anytime cannot retain an enabled alarm',async()=>{current={...current,dueTime:'Anytime'};await service.update(user,id,{reminderEnabled:true,reminderAt:new Date(Date.now()+60000).toISOString()});assert.equal(current.reminderEnabled,false);});
 await test('Repeated creation request must not create duplicate task records',async()=>{
   records=[];const dto={clientId:'22222222-2222-4222-8222-222222222222',title:'Task',dueDate:'2026-10-04',dueTime:'9 PM',reminderEnabled:true,reminderAt:new Date(Date.now()+3600000).toISOString()};
   await service.create(user,dto);await service.create(user,dto);assert.equal(records.length,1);
 });
 await test('Completed task cannot be rearmed by a stale reminder PATCH',async()=>{
   current={...current,completedAt:new Date(),reminderEnabled:false,dueAt:null};
   await service.update(user,id,{reminderEnabled:true,reminderAt:new Date(Date.now()+60000).toISOString()});
   assert.equal(current.reminderEnabled,false);assert.equal(current.dueAt,null);
 });
 await test('Offline Snooze with old expected time cannot overwrite a newer edit',async()=>{
   const updated=new Date(Date.now()+7200000);
   current={...current,completedAt:null,reminderEnabled:true,dueAt:updated};
   await service.update(user,id,{expectedReminderAt:new Date(Date.now()-60000).toISOString(),reminderEnabled:true,reminderAt:new Date(Date.now()+300000).toISOString()});
   assert.equal(current.dueAt.getTime(),updated.getTime());
 });
 await test('Reject invalid ISO calendar date instead of rolling it into March',async()=>{
   await assert.rejects(service.create(user,{title:'t',dueDate:'2027-02-29',dueTime:'9 PM',reminderEnabled:true,reminderAt:'2027-02-29T21:00:00Z'}),/Reminder date is invalid/);
 });
 let emails=0,whatsapp=0,push=0;
 const notificationDb={notification:{findUnique:async()=>null,create:async({data})=>({id:'inbox',...data})},deviceToken:{findMany:async()=>[]}};
 const notifications=new NotificationsService(notificationDb,{sendMessage:async()=>whatsapp++},{sendNotification:async()=>emails++});
 notifications.deliverExpoPush=async()=>push++;
 await test('Logged-out task reminder sends no push/email/WhatsApp fallback',async()=>{
   await notifications.createReliable('owner',{type:'TASK_REMINDER',title:'Due',body:'Task',channels:['PUSH','EMAIL','WHATSAPP'],allowExternalFallback:true});
   assert.equal(emails+whatsapp+push,0);
 });
 await test('Reminder inbox metadata is persisted without claiming delivery',async()=>{
   const [record]=await notifications.createReliable('owner',{type:'TASK_REMINDER',title:'Due',body:'Task'});
   assert.equal(record.preferLocalDelivery,true);assert.equal(record.deliveredAt,undefined);
 });
 process.exitCode = results.some(r=>!r.pass) ? 1 : 0;
 console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,tests:results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});

