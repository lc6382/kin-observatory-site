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
