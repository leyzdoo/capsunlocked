'use strict';
const BASE='https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1';
const TEAM='9723';
const PLAYOFF_SOURCE='https://www.timbers.com/news/timbers-set-to-host-fc-dallas-in-game-2-of-best-of-3-series-at-providence-park-on-nov-28';
// Official announced playoffs fill gaps in ESPN's regular-season-only schedule.
function officialGames(now=new Date()){return [['2026-11-21T21:00:00Z',false,'Toyota Stadium'],['2026-11-29T03:30:00Z',true,'Providence Park']].filter(([date])=>Date.parse(date)>now.getTime()).map(([date,home,venue])=>({id:'official-'+date.slice(0,10),official:true,date,name:home?'FC Dallas at Portland Timbers':'Portland Timbers at FC Dallas',competitions:[{venue:{fullName:venue},status:{type:{state:'pre',description:'MLS Cup Playoffs · official schedule'}},competitors:[{team:{id:TEAM,displayName:'Portland Timbers'},homeAway:home?'home':'away'},{team:{id:'185',displayName:'FC Dallas'},homeAway:home?'away':'home'}]}]}));}
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(8500)});if(!r.ok)throw Error('Feed unavailable');return r.json();}
function choose(events,now=new Date()){
 const a=events.filter(e=>e.competitions?.[0]?.competitors?.some(c=>String(c.team?.id||c.id)===TEAM)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 return a.find(e=>e.competitions[0].status?.type?.state==='in')||a.find(e=>Date.parse(e.date)>=now.getTime()-3*3600000&&e.competitions[0].status?.type?.state!=='post')||a[a.length-1];
}
function normalizeEvent(e){const c=e.competitions[0];return {id:String(e.id),official:e.official===true,date:e.date,name:e.name,venue:c.venue?.fullName||'',phase:c.status?.type?.state||'pre',detail:c.status?.type?.shortDetail||c.status?.type?.description||'',teams:c.competitors.map(t=>({id:String(t.team.id),name:t.team.displayName,homeAway:t.homeAway,score:t.score?.displayValue??(typeof t.score==='object'?t.score?.value:t.score)??null,logo:t.team.logo||t.team.logos?.[0]?.href||''}))};}
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
 try{
  const season=new Date().getFullYear();const s=await json(BASE+'/teams/'+TEAM+'/schedule?season='+season);const events=s.events||[];for(const g of officialGames()){if(!events.some(e=>Math.abs(Date.parse(e.date)-Date.parse(g.date))<3*3600000))events.push(g);}const e=choose(events);let detail=null,opponent=[];
  if(e){const opp=e.competitions[0].competitors.find(t=>String(t.team.id)!==TEAM);
   const out=await Promise.allSettled([e.official?Promise.resolve(null):json(BASE+'/summary?event='+encodeURIComponent(e.id)),opp?json(BASE+'/teams/'+encodeURIComponent(opp.team.id)+'/roster'):Promise.resolve({})]);
   if(out[0].status==='fulfilled'&&out[0].value){const d=out[0].value;detail={statistics:(d.boxscore?.players||[]).map(t=>({name:t.team?.displayName||'',groups:t.statistics||[]})),teamStats:d.boxscore?.teams||[],plays:(d.plays||d.commentary||[]).slice(-20).reverse().map(p=>({text:p.text||p.play?.text||'',clock:p.clock?.displayValue||p.time?.displayValue||''}))};}
   if(out[1].status==='fulfilled'){opponent=(out[1].value.athletes||[]).flatMap(g=>g.items||[g]).filter(p=>p.displayName).map(p=>({n:p.jersey||'',name:p.displayName,pos:p.position?.displayName||'',img:p.headshot?.href||'',home:[p.birthPlace?.city,p.birthPlace?.country].filter(Boolean).join(', ')}));}
  }
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30');res.status(200).json({fetchedAt:new Date().toISOString(),source:'ESPN + official Timbers playoff announcement',events:events.map(normalizeEvent),game:e?normalizeEvent(e):null,detail,opponent});
 }catch(e){res.setHeader('Cache-Control','no-store');res.status(502).json({error:'Match feed unavailable. Use the official Timbers schedule and match center.'});}
};
module.exports.choose=choose;module.exports.normalizeEvent=normalizeEvent;
