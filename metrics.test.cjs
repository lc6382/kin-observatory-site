const test=require('node:test'),assert=require('node:assert/strict'),M=require('./metrics.js');
const point=(t,i,c)=>({t,row:{id:'KIN',rank:1,interactions:i,creations:c}});
const history=points=>({snapshots:points.map(p=>({at:new Date(p.t).toISOString(),rows:[p.row]}))});
test('hidden interactions never become zero, a gain, or a ratio',()=>{
 const a=point(0,null,1),b=point(43200000,100,10);
 assert.equal(M.intervalGain(a,b,'interactions'),null);assert.equal(M.intervalGain(b,point(86400000,null,9),'interactions'),null);
 assert.equal(M.metric(a.row,null,'ratio'),null);assert.equal(M.intervalGain(a,b,'creations'),9);
 const s=M.windowStats(history([a,b]),'KIN','all');assert.equal(s.interactions,null);assert.equal(s.perDay,null);assert.equal(s.perCreationDay,null);assert.equal(s.creations,9);
});
test('missing middle counters invalidate interaction rates, without losing observed creation growth',()=>{
 const d=history([point(0,100,8),point(43200000,null,9),point(86400000,300,10)]),s=M.windowStats(d,'KIN','all');assert.equal(s.interactions,null);assert.equal(s.creations,2);
});
test('numeric counters, zero, gaps and resets retain their semantics',()=>{
 const a=point(0,0,10),b=point(43200000,100,12);assert.equal(M.intervalGain(a,b,'interactions'),100);
 const s=M.windowStats(history([a,b]),'KIN','all');assert.equal(s.perDay,200);assert.equal(s.creations,2);
 assert.equal(M.intervalGain(b,point(86400000,90,12),'interactions'),null);assert.equal(M.windowStats(history([a,point(86400000,100,12)]),'KIN','all'),null);
});
test('single-update sorts use the previous snapshot even when the interval is shorter than 12 hours',()=>{
 const d=history([point(0,100,10),point(12*3600000,160,12),point(23*3600000,210,14)]);
 const s=M.windowStats(d,'KIN','update');assert.equal(s.interactions,50);assert.equal(s.creations,2);assert.equal(s.days,11/24);assert.equal(s.perDay,50/(11/24));assert.equal(M.recentWindow(d,'update').index,1);
});
test('24-hour sorts tolerate timing jitter without accidentally spanning 36 hours',()=>{
 for(const jitter of [-10000,10000,3600000]){
  const d=history([point(0,100,10),point(12*3600000,120,12),point(24*3600000,160,14),point(36*3600000+jitter,220,16)]);
  const s=M.windowStats(d,'KIN','1');assert.equal(s.interactions,100);assert.equal(s.creations,4);assert.equal(M.recentWindow(d,'1').index,1);
 }
});
test('short periods require the proper baseline and continuous observations',()=>{
 const a=point(0,100,10),b=point(12*3600000,150,12),c=point(24*3600000,200,14);
 assert.equal(M.windowStats(history([a,b]),'KIN','1'),null);assert.equal(M.windowStats(history([a]),'KIN','update'),null);
 assert.equal(M.windowStats(history([a,c]),'KIN','update'),null);assert.equal(M.windowStats(history([a,c]),'KIN','1'),null);
 const d=history([a,b,c]);d.snapshots[1].rows=[];assert.equal(M.windowStats(d,'KIN','update'),null);assert.equal(M.windowStats(d,'KIN','1'),null);
});
test('new periods preserve unavailable counters and existing longer windows',()=>{
 const d=history([point(0,null,1),point(12*3600000,null,3),point(24*3600000,100,10)]);
 for(const p of ['update','1']){const s=M.windowStats(d,'KIN',p);assert.equal(s.interactions,null);assert.equal(s.creations,p==='update'?7:9);assert.equal(s.perCreationDay,null);}
 const long=history(Array.from({length:731},(_,i)=>point(i*12*3600000,i*20,10+i)));
 for(const p of ['7','30','365'])assert.equal(M.windowStats(long,'KIN',p).interactions,Number(p)*40);
});
