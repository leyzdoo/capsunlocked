'use strict';
// Read-only public feeds; all upstream hosts and the Portland team are fixed.
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball';
const PREVIEW="https://portlandpilots.com/news/2026/11/13/update-on-portland-womens-basketball-game-against-long-beach-state.aspx";
const NEWS='https://portlandpilots.com/sports/womens-basketball';
const FALLBACK_GAMES=[{"day": "2026-11-02", "date": "2026-11-03T03:30Z", "opponent": "Willamette", "home": true, "venue": "Chiles Center", "eventId": "401917683", "opponentId": "2930"}, {"day": "2026-11-05", "date": "2026-11-06T02:00Z", "opponent": "BYU", "home": false, "venue": "Marriott Center", "eventId": "401916150", "opponentId": "252"}, {"day": "2026-11-08", "date": "2026-11-08T21:00Z", "opponent": "Montana State", "home": false, "venue": "Worthington Arena", "eventId": "401917691", "opponentId": "147"}, {"day": "2026-11-11", "date": "2026-11-12T01:00Z", "opponent": "Warner Pacific", "home": true, "venue": "Chiles Center", "eventId": "401917699", "opponentId": "106392"}, {"day": "2026-11-14", "date": "2026-11-15T01:00Z", "opponent": "Long Beach State", "home": true, "venue": "Chiles Center", "eventId": "401917703", "opponentId": "299"}, {"day": "2026-11-18", "date": "2026-11-19T02:00Z", "opponent": "Portland State", "home": true, "venue": "Chiles Center", "eventId": "401917709", "opponentId": "2502"}, {"day": "2026-11-22", "date": "2026-11-22T22:00Z", "opponent": "Stanford", "home": true, "venue": "Chiles Center", "eventId": "401915983", "opponentId": "24"}, {"day": "2026-11-25", "date": "2026-11-25T22:00Z", "opponent": "UC Santa Barbara", "home": true, "venue": "Chiles Center", "eventId": "401917724", "opponentId": "2540"}, {"day": "2026-12-02", "date": "2026-12-03T02:00Z", "opponent": "South Carolina State", "home": true, "venue": "Chiles Center", "eventId": "401917735", "opponentId": "2569"}, {"day": "2026-12-05", "date": "2026-12-05T22:00Z", "opponent": "Washington State", "home": false, "venue": "Beasley Coliseum", "eventId": "401903561", "opponentId": "265"}, {"day": "2026-12-13", "date": "2026-12-13T18:00Z", "opponent": "Princeton", "home": false, "venue": "Jadwin Gymnasium", "eventId": "401915330", "opponentId": "163"}, {"day": "2026-12-16", "date": "2026-12-16T23:00Z", "opponent": "Oregon", "home": false, "venue": "Matthew Knight Arena", "eventId": "401917756", "opponentId": "2483"}, {"day": "2026-12-19", "date": "2026-12-19T22:00Z", "opponent": "Wyoming", "home": true, "venue": "Chiles Center", "eventId": "401917762", "opponentId": "2751"}, {"day": "2026-12-21", "date": "2026-12-21T19:00Z", "opponent": "New Mexico", "home": false, "venue": "The Pit", "eventId": "401917766", "opponentId": "167"}, {"day": "2026-12-31", "date": "2026-12-31T22:00Z", "opponent": "Pacific", "home": false, "venue": "Alex G. Spanos Center", "eventId": "401917775", "opponentId": "279"}, {"day": "2027-01-02", "date": "2027-01-02T21:00Z", "opponent": "Santa Clara", "home": false, "venue": "Leavey Center", "eventId": "401917780", "opponentId": "2541"}, {"day": "2027-01-07", "date": "2027-01-08T02:00Z", "opponent": "San Diego", "home": true, "venue": "Chiles Center", "eventId": "401917787", "opponentId": "301"}, {"day": "2027-01-09", "date": "2027-01-10T01:00Z", "opponent": "Denver", "home": true, "venue": "Chiles Center", "eventId": "401917791", "opponentId": "2172"}, {"day": "2027-01-14", "date": "2027-01-15T02:00Z", "opponent": "Loyola Marymount", "home": false, "venue": "Gersten Pavilion", "eventId": "401917796", "opponentId": "2351"}, {"day": "2027-01-16", "date": "2027-01-17T03:00Z", "opponent": "Pepperdine", "home": false, "venue": "Firestone Fieldhouse", "eventId": "401917798", "opponentId": "2492"}, {"day": "2027-01-21", "date": "2027-01-22T02:00Z", "opponent": "San Diego", "home": false, "venue": "Jenny Craig Pavilion", "eventId": "401917802", "opponentId": "301"}, {"day": "2027-01-23", "date": "2027-01-24T01:00Z", "opponent": "San Francisco", "home": true, "venue": "Chiles Center", "eventId": "401917811", "opponentId": "2539"}, {"day": "2027-01-28", "date": "2027-01-29T02:00Z", "opponent": "Saint Mary's", "home": true, "venue": "Chiles Center", "eventId": "401917816", "opponentId": "2608"}, {"day": "2027-01-30", "date": "2027-01-30T19:00Z", "opponent": "Denver", "home": false, "venue": "Hamilton Gymnasium", "eventId": "401917819", "opponentId": "2172"}, {"day": "2027-02-04", "date": "2027-02-05T02:00Z", "opponent": "Seattle U", "home": true, "venue": "Chiles Center", "eventId": "401917825", "opponentId": "2547"}, {"day": "2027-02-06", "date": "2027-02-06T22:00Z", "opponent": "San Francisco", "home": false, "venue": "The Sobrato Center", "eventId": "401917829", "opponentId": "2539"}, {"day": "2027-02-11", "date": "2027-02-12T02:00Z", "opponent": "Loyola Marymount", "home": true, "venue": "Chiles Center", "eventId": "401917833", "opponentId": "2351"}, {"day": "2027-02-13", "date": "2027-02-14T01:00Z", "opponent": "Santa Clara", "home": true, "venue": "Chiles Center", "eventId": "401917841", "opponentId": "2541"}, {"day": "2027-02-18", "date": "2027-02-19T03:00Z", "opponent": "Saint Mary's", "home": false, "venue": "University Credit Union Pavilion", "eventId": "401917843", "opponentId": "2608"}, {"day": "2027-02-20", "date": "2027-02-20T21:00Z", "opponent": "Seattle U", "home": false, "venue": "Redhawk Center", "eventId": "401917846", "opponentId": "2547"}, {"day": "2027-02-25", "date": "2027-02-26T02:00Z", "opponent": "Pacific", "home": true, "venue": "Chiles Center", "eventId": "401917854", "opponentId": "279"}, {"day": "2027-02-27", "date": "2027-02-28T01:00Z", "opponent": "Pepperdine", "home": true, "venue": "Chiles Center", "eventId": "401917860", "opponentId": "2492"}];
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
 const opp={id:fallback.opponentId,displayName:fallback.opponent,abbreviation:fallback.opponent};
 return {id:fallback.eventId,date:fallback.date,name:'Portland vs. '+opp.displayName,fallback:true,competitions:[{date:fallback.date,venue:{fullName:fallback.venue},status:{type:{state:'pre',description:'Scheduled'}},competitors:[{id:'2501',homeAway:fallback.home?'home':'away',team:{id:'2501',displayName:'Portland Pilots'}},{id:opp.id,homeAway:fallback.home?'away':'home',team:opp}]}]};
}
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
function findPreview(xml,opponent,gameDate){
 const parts=String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi)||[];
 const name=opponent.toLowerCase().replace(/\b(university|college|pilots|buffaloes|lions)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 for(const item of parts){const title=decode(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),url=decode(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]),published=Date.parse(item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]);const clean=title.toLowerCase().replace(/[^a-z0-9]+/g,' ');const age=Date.parse(gameDate)-published;
  if(name&&clean.includes(name)&&/\b(hosts?|preview|opens?|visits?|faces?|set to|takes? on|travels?|meet|matchup|heads?|update)\b/i.test(title)&&age>=-86400000&&age<=7*86400000&&url.startsWith('https://portlandpilots.com/'))return {url,title,available:true};
 }
 return null;
}
module.exports=async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
 try{
 const game=await getGame();
 if(!game){res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(200).json({noGame:true,fetchedAt:new Date().toISOString(),preview:{url:NEWS,title:'Latest Portland women’s basketball news',available:false},roster:[]});}
 const comp=game.competitions[0],opponent=comp.competitors.find(c=>String(c.id||c.team?.id)!=='2501'),team=opponent.team;
 const [rosterResult,rssResult]=await Promise.allSettled([team.id?getJSON(BASE+'/teams/'+encodeURIComponent(team.id)+'/roster'):Promise.resolve(null),fetch('https://portlandpilots.com/rss.aspx?path=wbball',{signal:AbortSignal.timeout(2500)}).then(r=>{if(!r.ok)throw Error();return r.text();})]);
 const sourceRoster=rosterResult.status==='fulfilled'?rosterResult.value:null;
 const athletes=(sourceRoster?.athletes||[]).flatMap(g=>g.items||g.athletes||[g]);
 const roster=athletes.filter(a=>a.displayName).map(a=>({id:a.id,n:a.jersey??'',name:a.displayName,pos:a.position?.abbreviation||'',ht:a.displayHeight||'',year:a.experience?.displayValue||'',home:[a.birthPlace?.city,a.birthPlace?.state||a.birthPlace?.country].filter(Boolean).join(', '),img:a.headshot?.href||'',url:a.links?.find(l=>l.rel?.includes('playercard'))?.href||'https://www.espn.com/womens-college-basketball/player/_/id/'+a.id}));
 let preview=rssResult.status==='fulfilled'?findPreview(rssResult.value,team.location||team.displayName,game.date):null;
 if(!preview){
  try{
   const response=await fetch(NEWS,{signal:AbortSignal.timeout(2500)});
   if(response.ok){const page=await response.text();const urls=[...new Set((page.match(/\/news\/\d{4}\/\d{1,2}\/\d{1,2}\/[^"'<>\s]+\.aspx/g)||[]))];
    const items=urls.map(url=>{const parts=url.match(/\/news\/(\d{4})\/(\d{1,2})\/(\d{1,2})\/(.*)\.aspx/);return {url:'https://portlandpilots.com'+url,title:parts[4].replaceAll('-',' '),date:new Date(Date.UTC(+parts[1],+parts[2]-1,+parts[3],12)).toUTCString()};});
    preview=findPreview('<rss>'+items.map(x=>'<item><title>'+x.title+'</title><link>'+x.url+'</link><pubDate>'+x.date+'</pubDate></item>').join('')+'</rss>',team.location||team.displayName,game.date);
   }
  }catch(e){}
 }
 if(pacificDay(new Date(game.date))==='2026-11-14'&&String(team.id)==='299')preview={url:PREVIEW,title:'Official update: Long Beach State game · scheduled 5 p.m.',kind:'update',available:true};
 if(!preview)preview={url:NEWS,title:'Official preview not published or not yet matched — latest women’s team news',available:false};
 const data={eventId:game.id,date:game.date,day:pacificDay(new Date(game.date)),fetchedAt:new Date().toISOString(),source:game.fallback?'Published season schedule fallback':'ESPN Portland schedule',opponent:{id:String(team.id||''),name:team.displayName||team.name,shortName:team.location||team.shortDisplayName||team.displayName,abbreviation:team.abbreviation||'',logo:team.logo||team.logos?.[0]?.href||'',color:team.color||'003865',record:opponent.records?.find(r=>r.type==='total')?.summary||''},venue:comp.venue?.fullName||'',phase:comp.status?.type?.state||'pre',detail:comp.status?.type?.shortDetail||comp.status?.type?.description||'Scheduled',preview,roster};
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');return res.status(200).json(data);
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'Matchup refresh unavailable. Check the official schedule.'});}
};
module.exports.chooseEvent=chooseEvent;
module.exports.findPreview=findPreview;
module.exports.getGame=getGame;
module.exports.pacificDay=pacificDay;

