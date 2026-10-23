/* Creator portfolios use the current discovery set, never an inferred full account. */
(function(root){
  'use strict';
  const DAY=86400000,MAX_GAP=18*3600000;
  function identity(value){
    const match=String(value||'').trim().match(/^(?:By\s+)?@([^\s]+)$/i);
    return match?{key:match[1].toLowerCase(),name:'@'+match[1]}:null;
  }
  function prepare(history){
    const snapshots=history.snapshots.map(s=>({...s,t:Date.parse(s.at),map:new Map(s.rows.map(r=>[r.id,r]))}));
    return {snapshots,last:snapshots.at(-1)};
  }
  function windowFor(data,period){
    const s=data.snapshots,end=s.at(-1)?.t;if(s.length<2)return null;
    let index=-1;
    if(period==='update')index=s.length-2;
    else if(period==='all')index=0;
    else if(period==='1'){
      let distance=6*3600000;for(let i=0;i<s.length-1;i++){const d=Math.abs(s[i].t-(end-DAY));if(d<=distance){distance=d;index=i;}}
    }else{
      const target=end-Number(period)*DAY;
      for(let i=0;i<s.length-1;i++)if(s[i].t<=target&&target-s[i].t<=MAX_GAP)index=i;
    }
    if(index<0||end<=s[index].t)return null;
    return {index,start:s[index].t,end,days:(end-s[index].t)/DAY};
  }
  function growth(data,row,window,key,creator){
    if(!window)return null;
    const points=data.snapshots.slice(window.index);let previous=null;
    for(const s of points){
      const r=s.map.get(row.id),owner=identity(r?.creator);
      if(!r||!Number.isFinite(r[key])||(owner&&owner.key!==creator))return null;
      if(previous&&(s.t<=previous.t||s.t-previous.t>MAX_GAP||r[key]<previous.value))return null;
      previous={t:s.t,value:r[key]};
    }
    return row[key]-points[0].map.get(row.id)[key];
  }
  function aggregate(data,period='7'){
    const window=windowFor(data,period),groups=new Map();let unattributed=0;
    for(const row of data.last?.rows||[]){
      const owner=identity(row.creator);if(!owner){unattributed++;continue;}
      if(!groups.has(owner.key))groups.set(owner.key,{...owner,rows:[],interactions:null,creations:null,visibleI:0,visibleC:0,igain:null,cgain:null,iCovered:0,cCovered:0,top100:0,bestRank:Infinity});
      const group=groups.get(owner.key),igain=growth(data,row,window,'interactions',owner.key),cgain=growth(data,row,window,'creations',owner.key);
      group.rows.push({...row,igain,cgain});
      for(const [field,count] of [['interactions','visibleI'],['creations','visibleC']])if(Number.isFinite(row[field])){group[field]=(group[field]??0)+row[field];group[count]++;}
      if(igain!==null){group.igain=(group.igain??0)+igain;group.iCovered++;}
      if(cgain!==null){group.cgain=(group.cgain??0)+cgain;group.cCovered++;}
      if(row.rank<=100)group.top100++;
      group.bestRank=Math.min(group.bestRank,row.rank);
    }
    const creators=[...groups.values()].map(g=>{
      const ratioRows=g.rows.filter(r=>Number.isFinite(r.interactions)&&Number.isFinite(r.creations));
      const denominator=ratioRows.reduce((n,r)=>n+r.creations,0);
      const leader=g.rows.filter(r=>Number.isFinite(r.interactions)).sort((a,b)=>b.interactions-a.interactions)[0];
      return {...g,kins:g.rows.length,iday:g.igain===null?null:g.igain/window.days,cday:g.cgain===null?null:g.cgain/window.days,
        average:g.visibleI?g.interactions/g.visibleI:null,ratio:denominator?ratioRows.reduce((n,r)=>n+r.interactions,0)/denominator:null,
        leader,concentration:g.interactions>0?leader.interactions/g.interactions*100:null};
    });
    return {creators,window,unattributed,attributed:(data.last?.rows.length||0)-unattributed};
  }
  function coverage(group,metric){return ['igain','iday'].includes(metric)?group.iCovered:['cgain','cday'].includes(metric)?group.cCovered:null;}
  function ranked(creators,metric,completeOnly=false){
    const values=creators.filter(g=>!completeOnly||coverage(g,metric)===null||coverage(g,metric)===g.kins)
      .slice().sort((a,b)=>{const av=a[metric],bv=b[metric];if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;return (bv??0)-(av??0)||a.key.localeCompare(b.key);});
    let rank=0,prior;return values.map((g,i)=>{if(i===0||g[metric]!==prior)rank=i+1;prior=g[metric];return {...g,position:g[metric]===null?null:rank};});
  }
  const api={identity,prepare,windowFor,aggregate,ranked,coverage};
  if(typeof module!=='undefined')module.exports=api;else root.CreatorMetrics=api;
})(globalThis);
