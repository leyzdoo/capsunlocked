'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {plan}=require('../assets/sports-refresh');
const start=Date.parse('2026-11-20T20:00:00Z'),date=new Date(start).toISOString(),match={date,phase:'pre'};
const decide=x=>plan({now:start-72*3600000,dates:[date],match,...x});
test('sleeps until the 48-hour boundary without network activity',()=>{assert.deepEqual(decide({}),{action:'none',wake:start-48*3600000});});
test('one pregame update within 48 hours, not recurring polling',()=>{const now=start-47*3600000;assert.equal(decide({now}).action,'pregame');assert.equal(decide({now,checked:{[date]:now}}).action,'none');});
test('missed boundary is caught on the next open, including after a time change',()=>{const now=start-3600000;assert.equal(decide({now,checked:{[date]:start-49*3600000}}).action,'pregame');});
test('live game cannot refresh automatically without the switch',()=>{assert.equal(decide({now:start+60000,match:{date,phase:'in'}}).action,'none');});
test('opted-in live game refreshes at 30 seconds, not faster',()=>{const now=start+60000;assert.equal(decide({now,enabled:true,lastLive:now-30000}).action,'live');assert.equal(decide({now,enabled:true,lastLive:now-1000}).wake,now+29000);});
test('hidden tab never refreshes, even with its live switch on',()=>{assert.deepEqual(decide({now:start+60000,enabled:true,visible:false}),{action:'none',wake:null});});
test('armed pregame waits until kickoff rather than polling',()=>{const now=start-60000;assert.deepEqual(decide({now,enabled:true,checked:{[date]:now}}),{action:'none',wake:start});});
test('completed game stops live polling and waits for next pregame window',()=>{const next=start+7*24*3600000;const p=decide({now:start+60000,enabled:true,match:{date,phase:'post'},dates:[date,new Date(next).toISOString()]});assert.equal(p.action,'none');assert.equal(p.wake,next-48*3600000);});
test('switch can discover a game already underway when the pregame update was missed',()=>{assert.equal(decide({now:start+60000,match:{},enabled:true}).action,'live');assert.equal(decide({now:start+60000,match:{},enabled:false}).action,'none');});
test('empty schedule has no repeating timer',()=>{assert.deepEqual(plan({now:start,dates:[]}),{action:'none',wake:null});});
test('controller loads snapshots, switch starts off, and turning it on/off controls live network calls',async()=>{
 let refreshes=0;const listeners={},pageListeners={},timers=new Map();let serial=0;const store=new Map();const control={checked:true,addEventListener(n,cb){listeners[n]=cb;}},status={textContent:''};const seed={example:{dates:[date],data:{live:{date,phase:'in',fetchedAt:new Date(start).toISOString()}}}};let loaded;
 const sandbox={window:{addEventListener(n,cb){pageListeners[n]=cb;}},document:{hidden:false,getElementById(id){return id==='sportsLiveSwitch'?control:status;},addEventListener(n,cb){pageListeners[n]=cb;}},localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}},fetch:async url=>{assert.equal(url,'/assets/sports-snapshots.json');return {ok:true,json:async()=>seed}},setTimeout(cb,ms){timers.set(++serial,{cb,ms});return serial},clearTimeout(id){timers.delete(id)},Date:class extends Date{static now(){return start+60000}},console};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/sports-refresh'),'utf8'),sandbox);
 const policy=sandbox.window.SportsRefresh.create({id:'example',match:()=>loaded,restore:(n,d)=>loaded=d,refresh:async()=>{refreshes++}});await policy.start();assert.equal(control.checked,false);assert.equal(refreshes,0);
 control.checked=true;listeners.change();await new Promise(setImmediate);assert.equal(refreshes,1);control.checked=false;listeners.change();assert.equal(timers.size,1); // only the long game-boundary wake remains
 sandbox.document.hidden=true;pageListeners.visibilitychange();assert.equal(timers.size,0);assert.equal(refreshes,1);
});
