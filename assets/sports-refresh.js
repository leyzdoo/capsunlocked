/* Shared, browser-only sports refresh policy. No background jobs or minute polling. */
(function(root){
 'use strict';
 const HOUR=3600000,WINDOW=48*HOUR,LIVE=30000,MAX_GAME=6*HOUR;
 function plan({now,dates=[],match={},checked={},enabled=false,visible=true,lastLive=0}){
  if(!visible)return {action:'none',wake:null};
  const start=Date.parse(match.date),finished=match.completed||match.phase==='post';
  const scheduledCurrent=dates.map(Date.parse).filter(t=>Number.isFinite(t)&&now>=t&&now<t+MAX_GAME&&!(finished&&t===start)).sort((a,b)=>b-a)[0];
  const currentStart=Number.isFinite(start)&&now>=start&&now<start+MAX_GAME&&!finished?start:scheduledCurrent;
  if(currentStart!==undefined){
   if(enabled)return now-lastLive>=LIVE?{action:'live',wake:null}:{action:'none',wake:lastLive+LIVE};
   return {action:'none',wake:currentStart+MAX_GAME};
  }
  const future=[...dates,match.date].map(Date.parse).filter(t=>Number.isFinite(t)&&t>now&&!(finished&&t===start)).sort((a,b)=>a-b)[0];
  if(!future)return {action:'none',wake:null};
  const boundary=future-WINDOW,key=new Date(future).toISOString();
  if(now<boundary)return {action:'none',wake:boundary};
  if((checked[key]||0)<boundary)return {action:'pregame',wake:null,key};
  return {action:'none',wake:future+(enabled?0:MAX_GAME)};
 }
 function create(config){
  const key='sports-refresh-v2:'+config.id;let data={},dates=[],checked={},enabled=false,timer=null,running=false,lastLive=0,started=false;
  const switchEl=document.getElementById('sportsLiveSwitch'),status=document.getElementById('sportsRefreshStatus');
  const read=()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const write=()=>{try{localStorage.setItem(key,JSON.stringify({data,dates,checked}));}catch{}};
  const match=()=>config.match()||{};
  function label(){if(!status)return;const m=match();status.textContent=document.hidden?'Updates paused while this tab is hidden.':enabled?'Live updates armed for game time; pauses when this tab is hidden.':'Live updates off. Pregame data updates once in the 48-hour window. You can refresh manually anytime.';if(m.completed||m.phase==='post')status.textContent+=' Last selected game is final.';}
  function setEnabled(value){enabled=value;if(switchEl)switchEl.checked=value;label();}
  function remember(name,value){data[name]=value;const m=value.game||value;if(m.date&&!dates.includes(m.date))dates.push(m.date);if(Array.isArray(value.events))dates=[...new Set([...dates,...value.events.map(e=>e.date)])];const at=Date.parse(value.fetchedAt);if(Number.isFinite(at)){
    // A restored or manual update inside the pregame window already satisfies it.
    const t=Date.parse(m.date);if(Number.isFinite(t)&&at>=t-WINDOW&&at<t)checked[new Date(t).toISOString()]=at;
   }write();}
  async function run(kind){if(running||document.hidden)return;running=true;
   try{await config.refresh(kind);}finally{running=false;if(kind==='live')lastLive=Date.now();const m=match();if(enabled&&(m.completed||m.phase==='post'))setEnabled(false);write();schedule();}
  }
  function schedule(){clearTimeout(timer);const shared=read()?.checked||{};for(const [date,at]of Object.entries(shared))checked[date]=Math.max(checked[date]||0,at);label();if(!started||running)return;const p=plan({now:Date.now(),dates,match:match(),checked,enabled,visible:!document.hidden,lastLive});
   if(p.action==='pregame'){checked[p.key]=Date.now();write();void run('pregame');return;}
   if(p.action==='live'){void run('live');return;}
   if(p.wake!==null)timer=setTimeout(schedule,Math.min(2147483647,Math.max(1,p.wake-Date.now())));
  }
  if(switchEl)switchEl.addEventListener('change',()=>{setEnabled(switchEl.checked);lastLive=0;schedule();});
  document.addEventListener('visibilitychange',schedule);
  // Stop immediately when the page leaves; the switch is never persisted.
  window.addEventListener('pagehide',()=>{clearTimeout(timer);setEnabled(false);});
  async function start(){let seed;const cached=read();
   if(cached?.data&&typeof cached.data==='object'){data=cached.data;dates=Array.isArray(cached.dates)?cached.dates:[];checked=cached.checked||{};}
   try{const r=await fetch('/assets/sports-snapshots.json');if(!r.ok)throw Error();seed=(await r.json())[config.id];}catch{}
   if(seed){dates=[...new Set([...dates,...seed.dates])];for(const [name,value]of Object.entries(seed.data)){if(!data[name]||Date.parse(value.fetchedAt)>Date.parse(data[name].fetchedAt))data[name]=value;}}
   for(const [name,value]of Object.entries(data)){try{config.restore(name,value);remember(name,value);}catch{delete data[name];}}
   started=true;setEnabled(false);
   if(!Object.keys(data).length){status.textContent='Saved match data unavailable. Use Refresh now to check manually.';return;}
   schedule();
  }
  return {start,remember,changed:schedule};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={plan};
 else root.SportsRefresh={create};
})(typeof window!=='undefined'?window:globalThis);
