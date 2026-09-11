(function(root){
 const DAY=86400000;
 function series(data,id){return data.snapshots.map((s,i)=>({t:Date.parse(s.at),i,row:s.rows.find(r=>r.id===id)}));}
 function intervalGain(a,b,key){return a?.row&&b?.row&&Number.isFinite(a.row[key])&&Number.isFinite(b.row[key])&&b.t>a.t&&b.t-a.t<=18*3600000&&b.row[key]>=a.row[key]?b.row[key]-a.row[key]:null;}
 function windowStats(data,id,days){
  const seq=series(data,id),last=seq.at(-1);if(!last?.row)return null;
  const target=days==='all'?-Infinity:last.t-Number(days)*DAY;
  let start;
  if(days==='all')start=seq.find(p=>p.row);
  else {start=seq.filter(p=>p.row&&p.t<=target).at(-1);if(!start||target-start.t>18*3600000)return null;}
  if(!start||start.t>=last.t)return null;
  const points=seq.slice(start.i);let area=0,hasInteractions=points.every(p=>Number.isFinite(p.row?.interactions));
  for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j];if(!a.row||!b.row||b.t-a.t>18*3600000)return null;if((Number.isFinite(a.row.interactions)&&Number.isFinite(b.row.interactions)&&b.row.interactions<a.row.interactions)||b.row.creations<a.row.creations)return null;area+=(a.row.creations+b.row.creations)/2*(b.t-a.t);}
  const elapsed=(last.t-start.t)/DAY,di=hasInteractions?last.row.interactions-start.row.interactions:null,dc=last.row.creations-start.row.creations,avg=area/(last.t-start.t);
  return {days:elapsed,interactions:di,creations:dc,perDay:di==null?null:di/elapsed,perCreationDay:di!=null&&avg>0?di/elapsed/avg:null,interactionPct:di!=null&&start.row.interactions>0?di/start.row.interactions*100:null,creationPct:start.row.creations>0?dc/start.row.creations*100:null,rankGain:start.row.rank-last.row.rank};
 }
 function metric(row,stats,key){switch(key){case'rank':return row.rank;case'interactions':return row.interactions;case'creations':return row.creations;case'ratio':return row.creations&&Number.isFinite(row.interactions)?row.interactions/row.creations:null;case'igain':return stats?.interactions??null;case'cgain':return stats?.creations??null;case'iday':return stats?.perDay??null;case'icday':return stats?.perCreationDay??null;case'ipct':return stats?.interactionPct??null;case'cpct':return stats?.creationPct??null;case'rankGain':return stats?.rankGain??null;}}
 const api={series,windowStats,metric,intervalGain};if(typeof module!=='undefined')module.exports=api;else root.KinMetrics=api;
})(typeof globalThis==='undefined'?this:globalThis);
