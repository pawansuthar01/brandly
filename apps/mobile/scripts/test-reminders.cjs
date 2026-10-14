
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const ts = require(require.resolve('typescript', {paths:[path.join(root,'apps/mobile')]}));
let clock = Date.UTC(2026,9,3,15);
class Clock extends Date { constructor(...args) { super(...(args.length?args:[clock])); } static now(){return clock;} }
const storage = new Map(), scheduled = new Map(), displayed = new Map();
let exact = true, permission = 'granted', calls = 0, blocked = false, cancelMissingThrows = false;
let failNotificationSetup = false, failTokenCache = false, failExpoToken = false, lastPushProjectId;
const N = {
 registerTaskAsync:async()=>{}, setNotificationHandler:()=>{}, setNotificationCategoryAsync:async()=>{if(failNotificationSetup)throw new Error('optional setup failed')},
 PermissionStatus:{GRANTED:'granted'}, IosAuthorizationStatus:{PROVISIONAL:3},
 AndroidImportance:{HIGH:4,DEFAULT:3,NONE:0}, AndroidNotificationVisibility:{PUBLIC:1},
 getPermissionsAsync:async()=>({status:permission}), requestPermissionsAsync:async()=>({status:permission}),
 getExpoPushTokenAsync:async options=>{lastPushProjectId=options?.projectId;if(failExpoToken)throw new Error('Expo token unavailable');return {data:'ExpoPushToken[test-device]'}},
 setNotificationChannelAsync:async()=>{}, getNotificationChannelAsync:async()=>({importance:blocked?0:4}),
 getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],
 getPresentedNotificationsAsync:async()=>[...displayed.values()],
 cancelScheduledNotificationAsync:async id=>{if(cancelMissingThrows&&!scheduled.has(id))throw new Error('notification is already displayed');scheduled.delete(id)},
 dismissNotificationAsync:async id=>displayed.delete(id),
 getNextTriggerDateAsync:async trigger=>Number(trigger.date),
 scheduleNotificationAsync:async request=>{calls++;const id=request.identifier||'generated-'+calls;scheduled.set(id,{identifier:id,content:request.content,trigger:request.trigger});return id;}
};
function load(file, mocks = {}, cache = new Map()) {
 file = path.resolve(file); if(cache.has(file)) return cache.get(file);
 const mod = {exports:{}};cache.set(file,mod.exports);
 const js = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
 const req = name=>{
   if(name in mocks) return mocks[name];
   if(name==='react-native') return {Platform:{OS:'android'}};
   if(name==='@react-native-async-storage/async-storage') return {getItem:async k=>storage.get(k)||null,setItem:async(k,v)=>{if(failTokenCache&&k==='brandly.remote-push-token')throw new Error('cache unavailable');storage.set(k,v)},removeItem:async k=>storage.delete(k)};
   if(name==='expo-constants') return {expoConfig:{android:{package:'com.brandly.marketplace'},extra:{eas:{projectId:'brandly-test-project'}}}};
   if(name==='expo') return {requireOptionalNativeModule:()=>({canScheduleExactAlarms:async()=>exact})};
   if(name==='expo-notifications') return N;
   if(name==='expo-intent-launcher') return {ActivityAction:{REQUEST_SCHEDULE_EXACT_ALARM:'exact'},startActivityAsync:async()=>{}};
   if(name.endsWith('.wav')) return 1;
   if(name.startsWith('.')) {
     let target=path.resolve(path.dirname(file),name);
     if(target.endsWith('.js'))target=target.slice(0,-3)+'.ts';else target+='.ts';
     return load(target,mocks,cache);
   }
   return require(require.resolve(name,{paths:[path.dirname(file)]}));
 };
 vm.runInNewContext(js,{require:req,module:mod,exports:mod.exports,Date:Clock,Intl,console,setTimeout,clearTimeout,Promise,Map,Set},{filename:file});
 return mod.exports;
}
const tests=[];
async function test(name, fn){try{await fn();tests.push({name,pass:true});}catch(e){tests.push({name,pass:false,error:e.message});}}
(async()=>{
 let S=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'));
 await test('Remote push token still registers when optional reminder setup fails',async()=>{
   failNotificationSetup=true;lastPushProjectId=undefined;
   const Push=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'),{},new Map());
   assert.equal(await Push.registerForRemotePushToken(),'ExpoPushToken[test-device]');
   assert.equal(lastPushProjectId,'brandly-test-project');
   failNotificationSetup=false;
 });
 await test('A cache write failure does not discard a freshly generated push token',async()=>{
   failTokenCache=true;
   const Push=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'),{},new Map());
   assert.equal(await Push.registerForRemotePushToken(),'ExpoPushToken[test-device]');
   failTokenCache=false;
 });
 await test('A first-run Expo token failure is surfaced instead of silently returning no device',async()=>{
   storage.delete('brandly.remote-push-token');failExpoToken=true;
   const Push=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'),{},new Map());
   await assert.rejects(Push.registerForRemotePushToken(),/Expo token unavailable/);
   failExpoToken=false;
 });
 await test('Missing EAS project ID is reported before calling the Expo token API',async()=>{
   let tokenApiCalled=false;
   const Push=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'),{
     'expo-constants':{expoConfig:{android:{package:'com.brandly.marketplace'},extra:{eas:{}}}},
     'expo-notifications':{...N,getExpoPushTokenAsync:async()=>{tokenApiCalled=true;return {data:'ExpoPushToken[test-device]'}}},
   },new Map());
   await assert.rejects(Push.registerForRemotePushToken(),/Expo project ID is missing/);
   assert.equal(tokenApiCalled,false);
 });
 const streakLib=load(path.join(root,'apps/mobile/src/lib/streak.ts'));
 const settings={soundEnabled:true,vibrationEnabled:true,soundTone:'default'};
 const reminder={id:'task-reminder-one',taskId:'one',title:'Task',deliveryDate:'2026-10-03',deliveryTime:'9 PM',dueAt:clock+60_000,enabled:true,soundTone:'default',soundEnabled:true};
 await S.setReminderOwner('user-a');
 await test('Daily streak counts completed local days, preserves an at-risk streak, and ends after a missed day',async()=>{
   const at=(day,hour=12)=>new Date(2026,9,day,hour).toISOString();
   const tasks=[{id:'a',history:[{action:'COMPLETED',createdAt:at(1)},{action:'COMPLETED',createdAt:at(2)}]}];
   assert.equal(streakLib.getDailyStreak(tasks,new Date(2026,9,2,18)).current,2);
   assert.equal(streakLib.getDailyStreak(tasks,new Date(2026,9,3,18)).current,2);
   assert.equal(streakLib.getDailyStreak(tasks,new Date(2026,9,4,0)).current,0);
   assert.equal(streakLib.getDailyStreak([{id:'a',history:[{action:'COMPLETED',createdAt:at(3,10)},{action:'REOPENED',createdAt:at(3,11)}]}],new Date(2026,9,3,18)).current,0);
 });
 await test('Create for 1 minute: one OS schedule at requested instant',async()=>{
   await S.scheduleTaskReminderSeries(reminder,settings);
   assert.equal(scheduled.size,1);assert.equal([...scheduled.values()][0].trigger.date,clock+60_000);
   assert.equal([...scheduled.values()][0].content.categoryIdentifier,'delivery_reminder');
 });
 await test('Concurrent refresh/rehydration: no duplicate schedules',async()=>{
   const before=calls;
   await Promise.all(Array.from({length:20},()=>S.scheduleDeliveryReminder(reminder,settings)));
   assert.equal(scheduled.size,1);assert.equal(calls,before);
 });
 await test('Process restart: preserves existing OS schedule',async()=>{
   S=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'));
   const before=calls;await S.scheduleDeliveryReminder(reminder,settings);
   assert.equal(scheduled.size,1);assert.equal(calls,before);
 });
 let delivered;
 await test('Snooze cancels displayed notification, schedules exactly one alarm offline',async()=>{
   const item=[...scheduled.values()][0];scheduled.delete(item.identifier);
   delivered={request:item};displayed.set(item.identifier,delivered);
   clock+=60_000;
   cancelMissingThrows=true;
   const action=await S.snoozeReminderFromNotification(delivered);
   cancelMissingThrows=false;
   assert.equal(displayed.size,0);assert.equal(scheduled.size,1);
   assert.equal(action.dueAt,clock+300_000);
 });
 await test('Duplicate action delivery: Snooze idempotent',async()=>{
   const before=calls;await S.snoozeReminderFromNotification(delivered);
   assert.equal(calls,before);assert.equal(scheduled.size,1);
 });
 await test('Stale API snapshot after Snooze: original alarm cannot return',async()=>{
   await S.scheduleDeliveryReminder(reminder,settings);
   assert.equal(scheduled.size,1);assert.equal([...scheduled.values()][0].trigger.date,clock+300_000);
 });
 await test('Stop survives process restart and stale API refresh',async()=>{
   const item=[...scheduled.values()][0];
   await S.stopReminderFromNotification({request:item});
   S=load(path.join(root,'apps/mobile/src/services/reminders.service.ts'));
   await S.scheduleDeliveryReminder({...reminder,dueAt:clock+60_000},settings);
   assert.equal(scheduled.size,0);
 });
 await test('Explicit edit cancels old schedule, keeps only updated instant',async()=>{
   await S.clearReminderAction(reminder.id);
   await S.scheduleDeliveryReminder({...reminder,dueAt:clock+60_000},settings);
   await S.scheduleDeliveryReminder({...reminder,dueAt:clock+120_000},settings);
   assert.equal(scheduled.size,1);assert.equal([...scheduled.values()][0].trigger.date,clock+120_000);
 });
 await test('Delete cancellation finds native ID without in-memory ID',async()=>{
   await S.cancelReminderSeries('one');assert.equal(scheduled.size,0);
 });
 await test('Denied permission gives actionable failure and no schedule',async()=>{
   permission='denied';
   await assert.rejects(S.scheduleDeliveryReminder({...reminder,dueAt:clock+60_000},settings),/Notifications are disabled/);
   assert.equal(scheduled.size,0);permission='granted';
 });
 await test('Denied exact-alarm permission prevents silent inexact fallback',async()=>{
   exact=false;
   await assert.rejects(S.scheduleDeliveryReminder({...reminder,dueAt:clock+60_000},settings),/Alarms & reminders/);
   assert.equal(scheduled.size,0);exact=true;
 });
 await test('Blocked notification channel surfaces error',async()=>{
   blocked=true;
   await assert.rejects(S.scheduleDeliveryReminder({...reminder,dueAt:clock+60_000},settings),/channel is blocked/);
   blocked=false;
 });
 await test('Multiple reminders keep independent single schedules',async()=>{
   await Promise.all(Array.from({length:10},(_,i)=>S.scheduleDeliveryReminder({...reminder,id:'r-'+i,taskId:'t-'+i,dueAt:clock+60_000+i*1000},settings)));
   assert.equal(scheduled.size,10);
 });
 await test('Logout cancels all account alarms',async()=>{
   await S.setReminderOwner(null);assert.equal(scheduled.size,0);
 });
 const dates=load(path.join(root,'apps/mobile/src/lib/reminders.ts'));
 await test('Date parser: leap year, invalid date, 12 AM/PM, numeric month, past yearless date',()=>{
   const now=new Date(2026,0,1).getTime();
   assert.equal(dates.parseReminderDateTime('2026-02-29','10 AM',now),null);
   assert.equal(dates.parseReminderDateTime('2026-04-31','10 AM',now),null);
   assert.equal(new Date(dates.parseReminderDateTime('2026-10-03','12 AM',now)).getHours(),0);
   assert.equal(new Date(dates.parseReminderDateTime('2026-10-03','12 PM',now)).getHours(),12);
   assert.equal(new Date(dates.parseReminderDateTime('03/10/2026','9 PM',now)).getMonth(),9);
   assert.equal(dates.parseReminderDateTime('1 Jan','10 AM',new Date(2026,0,2).getTime()),null);
 });
 await test('Timezone change preserves the scheduled UTC instant',async()=>{
   const oldTZ=process.env.TZ;
   process.env.TZ='Asia/Kolkata';
   await S.setReminderOwner('user-a');
   const instant=clock+3600000;
   await S.scheduleDeliveryReminder({...reminder,dueAt:instant},settings);
   process.env.TZ='America/New_York';
   await S.scheduleDeliveryReminder({...reminder,dueAt:instant},settings);
   assert.equal(scheduled.size,1);assert.equal([...scheduled.values()][0].trigger.date,instant);
   process.env.TZ=oldTZ;await S.cancelReminderSeries('one');
 });
 await test('DST gap is rejected rather than rolled forward',()=>{
   const oldTZ=process.env.TZ;process.env.TZ='America/New_York';
   assert.equal(dates.parseReminderDateTime('2027-03-14','2:30 AM',new Date(2027,0,1).getTime()),null);
   process.env.TZ=oldTZ;
 });
 await test('Configured ten-minute Snooze is used by the notification action',async()=>{
   await S.scheduleDeliveryReminder({...reminder,dueAt:clock+60000},{...settings,snoozeMinutes:10});
   const action=await S.snoozeReminderFromNotification({request:[...scheduled.values()][0]});
   assert.equal(action.dueAt,clock+600000);
   await S.clearReminderAction(reminder.id);await S.cancelReminderSeries('one');
 });
 // Regression probes intentionally verify remaining audit findings.
 await test('Completed task must cancel a still-future snoozed alarm',async()=>{
   await S.setReminderOwner('user-a');
   const r={...reminder,dueAt:clock+60_000};await S.scheduleDeliveryReminder(r,settings);
   const item=[...scheduled.values()][0];
   const action=await S.snoozeReminderFromNotification({request:item});
   await S.clearObsoleteTaskReminderNotifications([{id:'one',title:'Task',reminderEnabled:false,completed:true,dueTime:'9 PM',dueDate:'2026-10-03',reminderAt:new Date(action.dueAt).toISOString(),reminderTone:'default'}],true);
   assert.equal(scheduled.size,0);
 });
 await S.setReminderOwner(null);
 await test('Late scheduling work after logout must not create ownerless task alarm',async()=>{
   await S.scheduleDeliveryReminder({...reminder,dueAt:clock+60_000},settings);
   assert.equal(scheduled.size,0);
 });
 await S.setReminderOwner('user-a');
 await test('Streak reminder is set for 11 PM local time; completing today moves it to tomorrow once',async()=>{
   const today=new Date(2026,9,3,20,30), dayKey='2026-10-03', id=`brandly:daily-streak:user-a:${dayKey}`;
   await S.syncDailyStreakReminder('user-a',[],today);
   assert.ok(scheduled.has(id)); assert.equal(new Date(scheduled.get(id).trigger.date).getHours(),23);
   const count=calls; await S.syncDailyStreakReminder('user-a',[],today); assert.equal(calls,count);
   const completed=[{id:'task',history:[{action:'COMPLETED',createdAt:new Date(2026,9,3,19).toISOString()}]}];
   await S.syncDailyStreakReminder('user-a',completed,today);
   assert.ok(!scheduled.has(id)); assert.ok(scheduled.has('brandly:daily-streak:user-a:2026-10-04'));
 });
 process.exitCode = tests.some(t=>!t.pass) ? 1 : 0;
 console.log(JSON.stringify({passed:tests.filter(t=>t.pass).length,failed:tests.filter(t=>!t.pass).length,tests},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});

