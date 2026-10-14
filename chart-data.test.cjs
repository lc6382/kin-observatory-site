const test=require('node:test'),assert=require('node:assert/strict'),C=require('./chart-data.js'),M=require('./metrics.js');
const H=3600000;
function fixture(values=[100,200,200,400,500],hours=values.map((_,i)=>i*12)){
  return {snapshots:values.map((v,i)=>({at:new Date(hours[i]*H).toISOString(),rows:Array.from({length:200},(_,id)=>({id:String(id),rank:id+1,interactions:v+id*100,creations:10+i}))}))};
}
test('shared stall is interpolated by elapsed time without altering recorded data or total gains',()=>{
  const d=fixture([100,200,200,400,500],[0,12,21,36,48]),before=JSON.stringify(d),s=C.series(d,'0','interactions');
  assert.equal(C.analyze(d).interactions.length,1);assert.equal(s[2].row.interactions,275);assert.equal(s[2].estimated,true);assert.equal(s[3].row.interactions,400);
  assert.equal(M.intervalGain(s[1],s[2],'interactions')+M.intervalGain(s[2],s[3],'interactions'),200);
  assert.equal(JSON.stringify(d),before);assert.deepEqual(C.analyze(d).creations,[]);
});
test('interval gains and daily pace mark both redistributed updates and retain raw tooltips',()=>{
  const d=fixture(),g=C.points(d,'0','interactions','interval',0),p=C.points(d,'0','interactions','pace',0);
  assert.deepEqual(g.points.slice(2,4).map(p=>[p.v,p.raw,p.estimated]),[[100,0,true],[100,200,true]]);
  assert.deepEqual(p.points.slice(2,4).map(p=>p.v),[200,200]);assert.equal(g.points[4].estimated,false);
});
test('recorded toggle restores original totals and gains',()=>{
  const d=fixture();assert.equal(C.points(d,'0','interactions','total',0,false).points[2].v,200);
  const g=C.points(d,'0','interactions','interval',0,false).points;
  assert.equal(g[2].v,0);assert.equal(g[3].v,200);assert.ok(g.every(p=>!p.estimated));
});
test('creation delays are detected independently of interaction delays',()=>{
  const d=fixture();d.snapshots.forEach((s,i)=>s.rows.forEach(r=>{r.creations=[10,20,20,40,50][i];r.interactions=100+i*100;}));
  assert.equal(C.analyze(d).interactions.length,0);assert.equal(C.analyze(d).creations.length,1);
  assert.equal(C.series(d,'0','creations')[2].row.creations,30);
});
test('isolated zeros and kins that updated normally are not adjusted',()=>{
  const d=fixture();d.snapshots[2].rows[0].interactions=250;assert.equal(C.series(d,'0','interactions')[2].row.interactions,250);
  const isolated=fixture([100,200,300,400]);isolated.snapshots[2].rows[0].interactions=200;
  assert.equal(C.analyze(isolated).interactions.length,0);
});
test('latest unresolved stall waits for actual recovery; a widespread stall without recovery is not smoothed',()=>{
  const d=fixture([100,200,200]);assert.equal(C.analyze(d).interactions[0].pending,true);assert.ok(C.series(d,'0','interactions').every(p=>!p.estimated));
  const slow=fixture();for(let id=0;id<80;id++)slow.snapshots[3].rows[id].interactions=slow.snapshots[2].rows[id].interactions;
  assert.equal(C.analyze(slow).interactions.length,0);
});
test('consecutive shared stalls share one elapsed-time allocation',()=>{
  const d=fixture([100,200,200,200,500,600]),s=C.series(d,'0','interactions');assert.equal(C.analyze(d).interactions.length,1);
  assert.deepEqual(s.slice(2,5).map(p=>p.row.interactions),[300,400,500]);
});
test('missing rows, hidden counters, resets and inactive kins are never filled',()=>{
  for(const kind of ['missing','hidden','reset','inactive']){
    const d=fixture();if(kind==='missing')d.snapshots[2].rows.shift();if(kind==='hidden')d.snapshots[2].rows[0].interactions=null;if(kind==='reset')d.snapshots[3].rows[0].interactions=150;
    if(kind==='inactive')for(let i=0;i<3;i++)d.snapshots[i].rows[0].interactions=200;
    assert.ok(C.series(d,'0','interactions').every(p=>!p.estimated),kind);
  }
});
test('manual duplicate reads, long collection gaps and small cohorts do not qualify',()=>{
  for(const times of [[0,12,13,24,36],[0,12,36,48,60]])assert.equal(C.analyze(fixture(undefined,times)).interactions.length,0);
  const small=fixture();small.snapshots.forEach(s=>s.rows=s.rows.slice(0,99));assert.equal(C.analyze(small).interactions.length,0);
});
test('rebasing from an estimated point marks subsequent rebased values and retains raw comparisons',()=>{
  const p=C.points(fixture(),'0','interactions','gains',24*H).points;
  assert.equal(p[1].v,100);assert.equal(p[1].raw,200);assert.equal(p[1].estimated,true);
});
test('chart paths retain gaps and use distinct estimated segments',()=>{
  const paths=C.paths([{t:0,v:0},{t:1,v:1,estimated:true},{t:2,v:2},{t:3,v:null},{t:4,v:4}],x=>x,y=>y);
  assert.equal(paths.estimated,'M0,0L1,1 M1,1L2,2 ');assert.equal(paths.recorded,'');
});
