const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./metrics.js');
const hour=3600000;
const row=(id,i,c,creator='By @Maker',rank=1)=>({id,name:id,interactions:i,creations:c,creator,rank});
const data=rows=>M.prepare({snapshots:rows.map((r,i)=>({at:new Date(Date.UTC(2026,9,1)+i*12*hour).toISOString(),rows:r}))});
test('handles are case insensitive; anonymous users remain ungrouped',()=>{
  const r=M.aggregate(data([[row('a',10,1),row('b',20,2,'By @MAKER'),row('c',10,2,'By Anonymous User'),row('d',10,2,null),row('e',10,2,'By @Anonymous.User')]]));
  assert.equal(r.creators.length,2);assert.equal(r.creators[0].kins,2);assert.equal(r.unattributed,2);assert.equal(r.attributed,3);
});
test('new entrants do not manufacture growth; hidden interactions stay missing',()=>{
  const r=M.aggregate(data([[row('a',100,20),row('c',null,2)],[row('a',120,24),row('b',9000,100),row('c',null,4)]]),'update').creators[0];
  assert.equal(r.interactions,9120);assert.equal(r.visibleI,2);assert.equal(r.igain,20);assert.equal(r.iCovered,1);assert.equal(r.cgain,6);assert.equal(r.cCovered,2);assert.equal(r.iday,40);assert.equal(r.ratio,9120/124);
});
test('counter decreases and owner changes are excluded per counter',()=>{
  const r=M.aggregate(data([[row('a',100,20),row('b',100,20,'By @Other')],[row('a',80,22),row('b',130,23)]]),'update').creators[0];
  assert.equal(r.igain,null);assert.equal(r.cgain,2);assert.equal(r.iCovered,0);assert.equal(r.cCovered,1);
});
test('missing Kin observations and long collection gaps prevent invented continuity',()=>{
  const d=data([[row('a',100,20)],[],[row('a',120,22)]]);
  assert.equal(M.aggregate(d,'1').creators[0].igain,null);
  const gap=data([[row('a',100,20)],[row('a',120,22)]]);gap.snapshots[1].t+=12*hour;
  assert.equal(M.aggregate(gap,'update').creators[0].igain,null);
});
test('fixed common baseline and actual elapsed time; insufficient history is not zero',()=>{
  const d=data([[row('a',100,20)],[row('a',110,21)],[row('a',120,22)]]);
  assert.equal(M.aggregate(d,'1').creators[0].iday,20);assert.equal(M.aggregate(d,'7').creators[0].igain,null);assert.equal(M.aggregate(d,'all').creators[0].igain,20);
});
test('unknown earlier attribution matches by stable Kin ID; fully hidden totals stay null',()=>{
  const r=M.aggregate(data([[row('a',null,1,null)],[row('a',null,2)]]),'update').creators[0];
  assert.equal(r.interactions,null);assert.equal(r.average,null);assert.equal(r.ratio,null);assert.equal(r.cgain,1);
});
test('ties share ranks; unavailable metrics are last; full coverage filters partial growth',()=>{
  const groups=[{key:'a',kins:2,igain:5,iCovered:1},{key:'b',kins:1,igain:5,iCovered:1},{key:'c',kins:1,igain:null,iCovered:0},{key:'d',kins:1,igain:2,iCovered:1}];
  assert.deepEqual(M.ranked(groups,'igain').map(g=>[g.key,g.position]),[['a',1],['b',1],['d',3],['c',null]]);
  assert.deepEqual(M.ranked(groups,'igain',true).map(g=>g.key),['b','d']);
});
