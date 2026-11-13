'use strict';
// Read-only public feeds; all upstream hosts and the Portland team are fixed.
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
const PREVIEW='https://portlandpilots.com/news/2026/11/12/mens-basketball-mens-hoops-hosts-east-texas-am-friday-night.aspx';
const NEWS='https://portlandpilots.com/sports/mens-basketball';
const FALLBACK_GAMES=[{"day":"2026-11-02","date":"2026-11-02T17:00:00-08:00","opponent":"Willamette","home":true,"venue":"Chiles Center"},{"day":"2026-11-06","date":"2026-11-06T18:30:00-08:00","opponent":"UT Arlington","home":false,"venue":"See official schedule"},{"day":"2026-11-08","date":"2026-11-08T16:30:00-08:00","opponent":"Bethesda","home":false,"venue":"See official schedule"},{"day":"2026-11-09","date":"2026-11-09T21:00:00-08:00","opponent":"Hawaii","home":false,"venue":"See official schedule"},{"day":"2026-11-13","date":"2026-11-13T19:00:00-08:00","opponent":"East Texas A&M","home":true,"venue":"Chiles Center"},{"day":"2026-11-18","date":"2026-11-18T18:00:00-08:00","opponent":"Colorado","home":false,"venue":"See official schedule"},{"day":"2026-11-21","date":"2026-11-21T11:00:00-08:00","opponent":"Fordham","home":false,"venue":"See official schedule"},{"day":"2026-11-22","date":"2026-11-22T16:00:00-08:00","opponent":"Cal Baptist","home":false,"venue":"See official schedule"},{"day":"2026-11-29","date":"2026-11-29T14:00:00-08:00","opponent":"Stanford","home":false,"venue":"See official schedule"},{"day":"2026-12-01","date":"2026-12-01T18:00:00-08:00","opponent":"UC Davis","home":false,"venue":"See official schedule"},{"day":"2026-12-10","date":"2026-12-10T11:00:00-08:00","opponent":"Lamar","home":true,"venue":"Chiles Center"},{"day":"2026-12-13","date":"2026-12-13T14:00:00-08:00","opponent":"Eastern Washington","home":true,"venue":"Chiles Center"},{"day":"2026-12-16","date":"2026-12-16T18:00:00-08:00","opponent":"Utah","home":false,"venue":"See official schedule"},{"day":"2026-12-19","date":"2026-12-19T17:00:00-08:00","opponent":"Wyoming","home":true,"venue":"Chiles Center"},{"day":"2026-12-22","date":"2026-12-22T14:00:00-08:00","opponent":"Long Beach State","home":false,"venue":"See official schedule"},{"day":"2026-12-28","date":"2026-12-28T14:00:00-08:00","opponent":"Evergreen State","home":true,"venue":"Chiles Center"},{"day":"2027-01-02","date":"2027-01-02T17:00:00-08:00","opponent":"Pepperdine","home":true,"venue":"Chiles Center"},{"day":"2027-01-06","date":"2027-01-06T19:00:00-08:00","opponent":"Pacific","home":true,"venue":"Chiles Center"},{"day":"2027-01-09","date":"2027-01-09T13:00:00-08:00","opponent":"San Diego","home":false,"venue":"See official schedule"},{"day":"2027-01-13","date":"2027-01-13T19:00:00-08:00","opponent":"Saint Mary\u2019s","home":false,"venue":"See official schedule"},{"day":"2027-01-16","date":"2027-01-16T17:00:00-08:00","opponent":"San Francisco","home":true,"venue":"Chiles Center"},{"day":"2027-01-20","date":"2027-01-20T18:00:00-08:00","opponent":"Denver","home":false,"venue":"See official schedule"},{"day":"2027-01-23","date":"2027-01-23T19:00:00-08:00","opponent":"Seattle U","home":false,"venue":"See official schedule"},{"day":"2027-01-27","date":"2027-01-27T19:00:00-08:00","opponent":"Santa Clara","home":true,"venue":"Chiles Center"},{"day":"2027-02-03","date":"2027-02-03T20:00:00-08:00","opponent":"Saint Mary\u2019s","home":true,"venue":"Chiles Center"},{"day":"2027-02-06","date":"2027-02-06T17:00:00-08:00","opponent":"LMU","home":true,"venue":"Chiles Center"},{"day":"2027-02-10","date":"2027-02-10T19:00:00-08:00","opponent":"Pacific","home":false,"venue":"See official schedule"},{"day":"2027-02-13","date":"2027-02-13T16:00:00-08:00","opponent":"San Francisco","home":false,"venue":"See official schedule"},{"day":"2027-02-17","date":"2027-02-17T19:00:00-08:00","opponent":"Denver","home":true,"venue":"Chiles Center"},{"day":"2027-02-20","date":"2027-02-20T17:00:00-08:00","opponent":"San Diego","home":true,"venue":"Chiles Center"},{"day":"2027-02-24","date":"2027-02-24T18:30:00-08:00","opponent":"Pepperdine","home":false,"venue":"See official schedule"},{"day":"2027-02-27","date":"2027-02-27T18:00:00-08:00","opponent":"LMU","home":false,"venue":"See official schedule"},{"day":"2027-03-05","date":"2027-03-05T19:00:00-08:00","opponent":"WCC Championship","home":false,"venue":"See official schedule"}];
const pacificDay=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
async function getJSON(url){const r=await fetch(url,{signal:AbortSignal.timeout(2500),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Feed unavailable');return r.json();}
function chooseEvent(events,now=new Date()){
 const today=pacificDay(now);
 return events.filter(e=>e.date&&pacificDay(new Date(e.date))>=today&&e.competitions?.[0]?.competitors?.some(c=>String(c.id||c.team?.id)==='2501')).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0]||null;
}
async function getGame(now=new Date()){
 let schedule;
 try{schedule=await getJSON(BASE+'/teams/2501/schedule?season='+((now.getUTCMonth()>=6?now.getUTCFullYear()+1:now.getUTCFullYear())));}catch(e){}
 const selected=chooseEvent(schedule?.events||[],now);
 if(selected)return selected;
 const today=pacificDay(now),fallback=FALLBACK_GAMES.find(g=>g.day>=today);
 if(!fallback)return null;
 try{const board=await getJSON(BASE+'/scoreboard?dates='+fallback.day.replaceAll('-','')+'&limit=1000&groups=50');const found=chooseEvent(board.events||[],now);if(found)return found;}catch(e){}
 const opp={id:fallback.day==='2026-11-13'?'2837':'',displayName:fallback.opponent,abbreviation:fallback.day==='2026-11-13'?'ETAM':fallback.opponent};
 return {id:fallback.day==='2026-11-13'?'401917527':null,date:fallback.date,name:'Portland vs. '+opp.displayName,fallback:true,competitions:[{date:fallback.date,venue:{fullName:fallback.venue},status:{type:{state:'pre',description:'Scheduled'}},competitors:[{id:'2501',homeAway:fallback.home?'home':'away',team:{id:'2501',displayName:'Portland Pilots'}},{id:opp.id,homeAway:fallback.home?'away':'home',team:opp}]}]};
}
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
function findPreview(xml,opponent,gameDate){
 const parts=String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi)||[];
 const name=opponent.toLowerCase().replace(/\b(university|college|pilots|buffaloes|lions)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 for(const item of parts){const title=decode(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),url=decode(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]),published=Date.parse(item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]);const clean=title.toLowerCase().replace(/[^a-z0-9]+/g,' ');const age=Date.parse(gameDate)-published;
  if(name&&clean.includes(name)&&/\b(hosts?|preview|opens?|visits?|faces?|set to|takes? on|travels?|meet|matchup|heads?)\b/i.test(title)&&age>=-86400000&&age<=7*86400000&&url.startsWith('https://portlandpilots.com/'))return {url,title,available:true};
 }
 return null;
}
module.exports=async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
 try{
 const game=await getGame();
 if(!game){res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(200).json({noGame:true,fetchedAt:new Date().toISOString(),preview:{url:NEWS,title:'Latest Portland basketball news',available:false},roster:[]});}
 const comp=game.competitions[0],opponent=comp.competitors.find(c=>String(c.id||c.team?.id)!=='2501'),team=opponent.team;
 const [rosterResult,rssResult]=await Promise.allSettled([team.id?getJSON(BASE+'/teams/'+encodeURIComponent(team.id)+'/roster'):Promise.resolve(null),fetch('https://portlandpilots.com/rss.aspx?path=mbball',{signal:AbortSignal.timeout(2500)}).then(r=>{if(!r.ok)throw Error();return r.text();})]);
 const sourceRoster=rosterResult.status==='fulfilled'?rosterResult.value:null;
 const athletes=(sourceRoster?.athletes||[]).flatMap(g=>g.items||g.athletes||[g]);
 const roster=athletes.filter(a=>a.displayName).map(a=>({id:a.id,n:a.jersey??'',name:a.displayName,pos:a.position?.abbreviation||'',ht:a.displayHeight||'',year:a.experience?.displayValue||'',home:[a.birthPlace?.city,a.birthPlace?.state||a.birthPlace?.country].filter(Boolean).join(', '),img:a.headshot?.href||'',url:a.links?.find(l=>l.rel?.includes('playercard'))?.href||'https://www.espn.com/mens-college-basketball/player/_/id/'+a.id}));
 const preview=(rssResult.status==='fulfilled'?findPreview(rssResult.value,team.location||team.displayName,game.date):null)||(pacificDay(new Date(game.date))==='2026-11-13'?{url:PREVIEW,title:'Men’s Hoops Hosts East Texas A&M Friday Night',available:true}:{url:NEWS,title:'Official preview not published or not yet matched — latest team news',available:false});
 const data={eventId:game.id,date:game.date,day:pacificDay(new Date(game.date)),fetchedAt:new Date().toISOString(),source:game.fallback?'Published season schedule fallback':'ESPN Portland schedule',opponent:{id:String(team.id||''),name:team.displayName||team.name,shortName:team.location||team.shortDisplayName||team.displayName,abbreviation:team.abbreviation||'',logo:team.logo||team.logos?.[0]?.href||'',color:team.color||'003865',record:opponent.records?.find(r=>r.type==='total')?.summary||''},venue:comp.venue?.fullName||'',phase:comp.status?.type?.state||'pre',detail:comp.status?.type?.shortDetail||comp.status?.type?.description||'Scheduled',preview,roster};
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(200).json(data);
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'Matchup refresh unavailable. Check the official schedule.'});}
};
module.exports.chooseEvent=chooseEvent;
module.exports.findPreview=findPreview;
module.exports.getGame=getGame;
module.exports.pacificDay=pacificDay;
