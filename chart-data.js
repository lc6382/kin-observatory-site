(function(root){
  'use strict';
  const M=typeof module!=='undefined'?require('./metrics.js'):root.KinMetrics;
  const HOUR=3600000,DAY=24*HOUR,cache=new WeakMap();
  const regular=(a,b)=>b-a>=6*HOUR&&b-a<=18*HOUR;
  function analyze(data){
    if(cache.has(data))return cache.get(data);
    const times=data.snapshots.map(s=>Date.parse(s.at));
    const maps=data.snapshots.map(s=>new Map(s.rows.map(r=>[r.id,r])));
    const result={times,maps};
    for(const key of ['interactions','creations']){
      const flags=Array(times.length).fill(null),events=[];
      for(let i=1;i<times.length;i++){
        if(!regular(times[i-1],times[i]))continue;
        let compared=0,flat=0,active=0;const ids=new Set();
        for(const [id,row] of maps[i]){
          const before=maps[i-1].get(id)?.[key],now=row[key];
          if(!Number.isFinite(before)||!Number.isFinite(now))continue;
          compared++;if(now===before)flat++;
          let recentlyActive=false;
          for(let j=i-1;j>=Math.max(1,i-3);j--){
            if(!regular(times[j-1],times[j]))break;
            const a=maps[j-1].get(id)?.[key],b=maps[j].get(id)?.[key];
            if(Number.isFinite(a)&&Number.isFinite(b)&&b>a)recentlyActive=true;
          }
          if(recentlyActive){active++;if(now===before)ids.add(id);}
        }
        // Require a large, shared stall, including kins with recent activity.
        if(compared>=100&&active>=100&&flat/compared>=.65&&ids.size/active>=.65)
          flags[i]={ids,flatFraction:flat/compared};
      }
      for(let i=1;i<times.length;i++){
        if(!flags[i])continue;
        const first=i;while(i+1<times.length&&flags[i+1])i++;
        const last=i,start=first-1,end=last+1;
        if(last-first>=3)continue;
        if(end>=times.length){events.push({start,first,last,end:null,ids:new Set(),pending:true,flatFraction:flags[first].flatFraction});continue;}
        if(!regular(times[last],times[end]))continue;
        let eligible=0;const ids=new Set();
        for(const id of flags[first].ids){
          const before=maps[start].get(id)?.[key],after=maps[end].get(id)?.[key];
          if(!Number.isFinite(after)||after<before)continue;
          let flat=true;
          for(let j=first;j<=last;j++)if(maps[j].get(id)?.[key]!==before)flat=false;
          if(!flat)continue;
          eligible++;if(after>before)ids.add(id);
        }
        // A later reading must confirm recovery in the same affected cohort.
        if(eligible>=100&&ids.size/eligible>=.8)
          events.push({start,first,last,end,ids,pending:false,flatFraction:flags[first].flatFraction,recovered:ids.size,eligible});
      }
      result[key]=events;
    }
    cache.set(data,result);return result;
  }
  function series(data,id,key,smooth=true){
    const a=analyze(data),seq=a.times.map((t,i)=>({t,i,row:a.maps[i].get(id),estimated:false,event:null}));
    if(!smooth)return seq;
    for(const event of a[key]||[]){
      if(event.pending||!event.ids.has(id))continue;
      const before=seq[event.start].row[key],after=seq[event.end].row[key];
      for(let j=event.first;j<=event.last;j++){
        const fraction=(seq[j].t-seq[event.start].t)/(seq[event.end].t-seq[event.start].t);
        seq[j]={...seq[j],row:{...seq[j].row,[key]:before+(after-before)*fraction},estimated:true,event};
      }
    }
    return seq;
  }
  function project(seq,key,mode,start){
    let base=null,baseEvent=null,broken=false,hasRebasedGap=false;
    const points=[];
    for(let i=0;i<seq.length;i++){
      const p=seq[i],prev=seq[i-1];if(p.t<start)continue;
      let v=p.row?.[key]??null,event=p.event;
      if(mode==='interval'||mode==='pace'){
        v=M.intervalGain(prev,p,key);if(mode==='pace'&&v!=null)v/=((p.t-prev.t)/DAY);
        event=p.event||prev?.event;
      }else if(mode==='gains'){
        if(base===null&&v!=null){base=v;baseEvent=p.event;}
        else if(base!==null&&M.intervalGain(prev,p,key)==null)broken=true;
        v=broken||v==null?null:v-base;event=event||baseEvent;
        if(broken)hasRebasedGap=true;
      }
      points.push({t:p.t,v,event,estimated:v!=null&&!!event,break:!!prev&&p.t-prev.t>18*HOUR});
    }
    return {points,hasRebasedGap};
  }
  function points(data,id,key,mode,start,smooth=true){
    const raw=project(series(data,id,key,false),key,mode,start);
    if(!smooth)return {...raw,points:raw.points.map(p=>({...p,raw:p.v}))};
    const adjusted=project(series(data,id,key,true),key,mode,start);
    adjusted.points=adjusted.points.map((p,i)=>({...p,raw:raw.points[i].v}));return adjusted;
  }
  function tint(hex){return '#'+hex.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.92+255*.08).toString(16).padStart(2,'0')).join('');}
  function paths(points,x,y){
    const result={recorded:'',estimated:''};let prev=null;
    for(const p of points){if(p.v==null){prev=null;continue;}if(prev&&!p.break){const key=p.estimated||prev.estimated?'estimated':'recorded';result[key]+=`M${x(prev.t)},${y(prev.v)}L${x(p.t)},${y(p.v)} `;}prev=p;}
    return result;
  }
  function note(data,key,start,end,smooth){
    const events=analyze(data)[key].filter(e=>Date.parse(data.snapshots[e.last].at)>=start&&Date.parse(data.snapshots[e.first].at)<=end);
    const confirmed=events.filter(e=>!e.pending).length,pending=events.some(e=>e.pending);
    return (smooth?'Slightly lighter sections are estimates: delayed gains are spread over elapsed time. Recorded totals, tables and exports are unchanged. ':'Showing recorded values. ')+(confirmed?`${confirmed} likely shared update delay${confirmed===1?'':'s'} detected in this range. `:'No confirmed shared update delays in this range. ')+(pending?'Latest shared stall is awaiting a catch-up reading; no estimate is made yet.':'');
  }
  const api={analyze,series,points,tint,paths,note};
  if(typeof module!=='undefined')module.exports=api;else root.KinChart=api;
})(typeof globalThis==='undefined'?this:globalThis);
