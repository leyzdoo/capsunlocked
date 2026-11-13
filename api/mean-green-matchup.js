'use strict';
// Read-only public feeds; all upstream hosts and the North Texas team are fixed.
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
const PREVIEW="https://meangreensports.com/news/2026/11/10/mens-basketball-unt-looks-to-build-on-strong-opening-week-with-matchups-against-santa-clara-south-alabama";
const NEWS='https://meangreensports.com/sports/mens-basketball';
const FALLBACK_GAMES=[{"day":"2026-11-02","date":"2026-11-02T19:30:00-06:00","opponent":"Southwestern Christian","home":true,"venue":"The Super Pit"},{"day":"2026-11-05","date":"2026-11-05T16:00:00-06:00","opponent":"McNeese","home":true,"venue":"The Super Pit"},{"day":"2026-11-11","date":"2026-11-11T19:00:00-06:00","opponent":"Santa Clara","home":true,"venue":"The Super Pit"},{"day":"2026-11-14","date":"2026-11-14T17:00:00-06:00","opponent":"South Alabama","home":true,"venue":"The Super Pit"},{"day":"2026-11-20","date":"2026-11-20T17:30:00-06:00","opponent":"App State","home":false,"venue":"See official schedule"},{"day":"2026-11-27","date":"2026-11-27T19:00:00-06:00","opponent":"North Dakota State","home":false,"venue":"See official schedule"},{"day":"2026-11-28","date":"2026-11-28T14:30:00-06:00","opponent":"Boise State","home":false,"venue":"See official schedule"},{"day":"2026-11-29","date":"2026-11-29T17:30:00-06:00","opponent":"Drake","home":false,"venue":"See official schedule"},{"day":"2026-12-04","date":"2026-12-04T19:00:00-06:00","opponent":"Bradley","home":true,"venue":"The Super Pit"},{"day":"2026-12-06","date":"2026-12-06T15:00:00-06:00","opponent":"Mississippi Valley State","home":true,"venue":"The Super Pit"},{"day":"2026-12-13","date":"2026-12-13T16:30:00-06:00","opponent":"Texas State","home":false,"venue":"See official schedule"},{"day":"2026-12-16","date":"2026-12-16T19:00:00-06:00","opponent":"Winthrop","home":true,"venue":"The Super Pit"},{"day":"2026-12-20","date":"2026-12-20T15:00:00-06:00","opponent":"Bethune-Cookman","home":true,"venue":"The Super Pit"},{"day":"2026-12-22","date":"2026-12-22T13:00:00-06:00","opponent":"Southwest (N.M.)","home":true,"venue":"The Super Pit"},{"day":"2026-12-31","date":"2026-12-31T20:00:00-06:00","opponent":"Wichita State","home":false,"venue":"See official schedule"},{"day":"2027-01-06","date":"2027-01-06T19:00:00-06:00","opponent":"Florida Atlantic","home":true,"venue":"The Super Pit"},{"day":"2027-01-10","date":"2027-01-10T17:00:00-06:00","opponent":"Rice","home":false,"venue":"See official schedule"},{"day":"2027-01-14","date":"2027-01-14T19:00:00-06:00","opponent":"Tulane","home":true,"venue":"The Super Pit"},{"day":"2027-01-17","date":"2027-01-17T15:00:00-06:00","opponent":"Charlotte","home":true,"venue":"The Super Pit"},{"day":"2027-01-20","date":"2027-01-20T19:00:00-06:00","opponent":"Wichita State","home":true,"venue":"The Super Pit"},{"day":"2027-01-23","date":"2027-01-23T14:00:00-06:00","opponent":"Memphis","home":false,"venue":"See official schedule"},{"day":"2027-01-28","date":"2027-01-28T20:00:00-06:00","opponent":"UTSA","home":false,"venue":"See official schedule"},{"day":"2027-01-31","date":"2027-01-31T15:00:00-06:00","opponent":"Tulsa","home":true,"venue":"The Super Pit"},{"day":"2027-02-03","date":"2027-02-03T19:00:00-06:00","opponent":"Temple","home":true,"venue":"The Super Pit"},{"day":"2027-02-11","date":"2027-02-11T19:30:00-06:00","opponent":"UAB","home":false,"venue":"See official schedule"},{"day":"2027-02-14","date":"2027-02-14T14:00:00-06:00","opponent":"Tulsa","home":false,"venue":"See official schedule"},{"day":"2027-02-17","date":"2027-02-17T19:00:00-06:00","opponent":"Memphis","home":true,"venue":"The Super Pit"},{"day":"2027-02-21","date":"2027-02-21T14:00:00-06:00","opponent":"Florida Atlantic","home":false,"venue":"See official schedule"},{"day":"2027-02-24","date":"2027-02-24T19:00:00-06:00","opponent":"South Florida","home":false,"venue":"See official schedule"},{"day":"2027-02-27","date":"2027-02-27T17:00:00-06:00","opponent":"UTSA","home":true,"venue":"The Super Pit"},{"day":"2027-03-02","date":"2027-03-02T19:00:00-06:00","opponent":"East Carolina","home":false,"venue":"See official schedule"},{"day":"2027-03-07","date":"2027-03-07T15:00:00-06:00","opponent":"Rice","home":true,"venue":"The Super Pit"}];
const centralDay=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
async function getJSON(url){const r=await fetch(url,{signal:AbortSignal.timeout(2500),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Feed unavailable');return r.json();}
function chooseEvent(events,now=new Date()){
 const today=centralDay(now);
 return events.filter(e=>e.date&&centralDay(new Date(e.date))>=today&&e.competitions?.[0]?.competitors?.some(c=>String(c.id||c.team?.id)==='249')).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0]||null;
}
async function getGame(now=new Date()){
 let schedule;
 try{schedule=await getJSON(BASE+'/teams/249/schedule?season='+((now.getUTCMonth()>=6?now.getUTCFullYear()+1:now.getUTCFullYear())));}catch(e){}
 const selected=chooseEvent(schedule?.events||[],now);
 if(selected)return selected;
 const today=centralDay(now),fallback=FALLBACK_GAMES.find(g=>g.day>=today);
 if(!fallback)return null;
 try{const board=await getJSON(BASE+'/scoreboard?dates='+fallback.day.replaceAll('-','')+'&limit=1000&groups=50');const found=chooseEvent(board.events||[],now);if(found)return found;}catch(e){}
 const opp={id:fallback.day==='2026-11-14'?'6':'',displayName:fallback.opponent,abbreviation:fallback.day==='2026-11-14'?'USA':fallback.opponent};
 return {id:null,date:fallback.date,name:'North Texas vs. '+opp.displayName,fallback:true,competitions:[{date:fallback.date,venue:{fullName:fallback.venue},status:{type:{state:'pre',description:'Scheduled'}},competitors:[{id:'249',homeAway:fallback.home?'home':'away',team:{id:'249',displayName:'North Texas Mean Green'}},{id:opp.id,homeAway:fallback.home?'away':'home',team:opp}]}]};
}
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
function findPreview(xml,opponent,gameDate){
 const parts=String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi)||[];
 const name=opponent.toLowerCase().replace(/\b(university|college|pilots|buffaloes|lions)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 for(const item of parts){const title=decode(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),url=decode(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]),published=Date.parse(item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]);const clean=title.toLowerCase().replace(/[^a-z0-9]+/g,' ');const age=Date.parse(gameDate)-published;
  if(name&&clean.includes(name)&&/\b(hosts?|preview|opens?|visits?|faces?|set to|takes? on|travels?|meet|matchup|heads?)\b/i.test(title)&&age>=-86400000&&age<=7*86400000&&url.startsWith('https://meangreensports.com/'))return {url,title,available:true};
 }
 return null;
}
module.exports=async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
 try{
 const game=await getGame();
 if(!game){res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(200).json({noGame:true,fetchedAt:new Date().toISOString(),preview:{url:NEWS,title:'Latest Mean Green basketball news',available:false},roster:[]});}
 const comp=game.competitions[0],opponent=comp.competitors.find(c=>String(c.id||c.team?.id)!=='249'),team=opponent.team;
 const [rosterResult,rssResult]=await Promise.allSettled([team.id?getJSON(BASE+'/teams/'+encodeURIComponent(team.id)+'/roster'):Promise.resolve(null),fetch('https://meangreensports.com/rss.aspx?path=mbball',{signal:AbortSignal.timeout(2500)}).then(r=>{if(!r.ok)throw Error();return r.text();})]);
 const sourceRoster=rosterResult.status==='fulfilled'?rosterResult.value:null;
 const athletes=(sourceRoster?.athletes||[]).flatMap(g=>g.items||g.athletes||[g]);
 const roster=athletes.filter(a=>a.displayName).map(a=>({id:a.id,n:a.jersey??'',name:a.displayName,pos:a.position?.abbreviation||'',ht:a.displayHeight||'',year:a.experience?.displayValue||'',home:[a.birthPlace?.city,a.birthPlace?.state||a.birthPlace?.country].filter(Boolean).join(', '),img:a.headshot?.href||'',url:a.links?.find(l=>l.rel?.includes('playercard'))?.href||'https://www.espn.com/mens-college-basketball/player/_/id/'+a.id}));
 const preview=(rssResult.status==='fulfilled'?findPreview(rssResult.value,team.location||team.displayName,game.date):null)||(centralDay(new Date(game.date))==='2026-11-14'?{url:PREVIEW,title:'UNT vs. South Alabama · official two-game preview',available:true}:{url:NEWS,title:'Official preview not published or not yet matched — latest team news',available:false});
 const data={eventId:game.id,date:game.date,day:centralDay(new Date(game.date)),fetchedAt:new Date().toISOString(),source:game.fallback?'Published season schedule fallback':'ESPN North Texas schedule',opponent:{id:String(team.id||''),name:team.displayName||team.name,shortName:team.location||team.shortDisplayName||team.displayName,abbreviation:team.abbreviation||'',logo:team.logo||team.logos?.[0]?.href||'',color:team.color||'003865',record:opponent.records?.find(r=>r.type==='total')?.summary||''},venue:comp.venue?.fullName||'',phase:comp.status?.type?.state||'pre',detail:comp.status?.type?.shortDetail||comp.status?.type?.description||'Scheduled',preview,roster};
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(200).json(data);
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'Matchup refresh unavailable. Check the official schedule.'});}
};
module.exports.chooseEvent=chooseEvent;
module.exports.findPreview=findPreview;
module.exports.getGame=getGame;
module.exports.centralDay=centralDay;
