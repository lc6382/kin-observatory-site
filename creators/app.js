(()=>{
  'use strict';
  const $=id=>document.getElementById(id),M=CreatorMetrics;
  const labels={interactions:'Total interactions',creations:'Total creations',igain:'Interactions gained',cgain:'Creations gained',iday:'Interactions / day',cday:'Creations / day',kins:'Tracked Kins',top100:'Top 100 Kins',average:'Interactions / Kin',ratio:'Interactions / creation'};
  const periods={update:'single update','1':'24 hours','7':'7 days','30':'30 days','365':'1 year',all:'since first snapshot'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(n,decimal=0)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:decimal}):'—';
  const short=n=>Number.isFinite(n)?new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(n):'—';
  const date=t=>new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const kinLink=id=>'../#kins='+encodeURIComponent(id)+'&days=7&metric=interactions&plot=total';
  let data,result,weekly,filtered=[],page=0,selected='',allKins=false,toastTimer;
  function readHash(){
    const p=new URLSearchParams(location.hash.slice(1));
    $('sort').value=Object.hasOwn(labels,p.get('sort'))?p.get('sort'):'interactions';
    $('period').value=Object.hasOwn(periods,p.get('period'))?p.get('period'):'7';
    $('complete').checked=p.get('complete')==='1';selected=(p.get('creator')||'').toLowerCase();
  }
  function saveHash(){const p=new URLSearchParams({sort:$('sort').value,period:$('period').value});if(selected)p.set('creator',selected);if($('complete').checked)p.set('complete','1');history.replaceState(null,'','#'+p);}
  function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3500);}
  function badge(group){return '<span class="avatar" aria-hidden="true">'+esc(group.key.slice(0,2).toUpperCase())+'</span>';}
  function coverage(group,key){const count=key==='interactions'?group.visibleI:key==='creations'?group.visibleC:M.coverage(group,key);return count===null||count===group.kins?'':`<small>${count}/${group.kins} Kins · partial</small>`;}
  function gain(group,key){const count=key==='igain'?group.iCovered:group.cCovered;return `${group[key]===null?'—':'+'+number(group[key])}<small>${count}/${group.kins} Kins covered</small>`;}
  function spotlight(group,title,score,description){return group?`<button class="spotlight" data-creator="${esc(group.key)}"><span class="eyebrow">${title}</span><span class="arrow" aria-hidden="true">↗</span><strong>${esc(group.name)}</strong><span class="score">${score}</span><small>${description}</small></button>`:`<div class="spotlight"><span class="eyebrow">${title}</span><strong>Building history</strong><span class="score">—</span><small>Needs a complete seven-day window.</small></div>`;}
  function renderHighlights(){
    const total=M.ranked(result.creators,'interactions')[0],growth=M.ranked(weekly.creators,'igain',true).find(g=>g.igain!==null),reach=M.ranked(result.creators,'top100')[0];
    $('spotlights').innerHTML=spotlight(total,'MOST INTERACTIONS',short(total?.interactions),`${number(total?.kins)} tracked Kins · visible lifetime total`)+spotlight(growth,'7-DAY LEADER / FULL COVERAGE','+'+short(growth?.igain),'Interactions gained · complete portfolio history')+spotlight(reach,'MOST KINS IN THE TOP 100',number(reach?.top100),'Current discovery positions 1–100');
  }
  function renderBoard(){
    const sort=$('sort').value,query=$('search').value.trim().toLowerCase();
    const ranked=M.ranked(result.creators,sort,$('complete').checked);
    filtered=ranked.filter(g=>!query||g.name.toLowerCase().includes(query)||g.rows.some(r=>r.name.toLowerCase().includes(query)||r.id.toLowerCase().includes(query)));
    page=Math.min(page,Math.max(0,Math.ceil(filtered.length/25)-1));const start=page*25;
    const extra=['interactions','creations','igain','cgain'].includes(sort)?'top100':sort;
    $('extraHeading').textContent=labels[extra];
    const activeColumns={interactions:3,creations:4,igain:5,cgain:6};
    document.querySelectorAll('thead th').forEach((th,i)=>th.classList.toggle('active-metric',i===(activeColumns[sort]??7)));
    $('rows').innerHTML=filtered.slice(start,start+25).map(g=>`<tr class="${selected===g.key?'selected':''}"><td>${number(g.position)}</td><td><div class="name-wrap">${badge(g)}<div><button class="creator-name" data-creator="${esc(g.key)}" aria-label="Explore ${esc(g.name)}">${esc(g.name)}</button><small>Best discovery #${number(g.bestRank)}</small></div></div></td><td>${g.kins}</td><td class="${sort==='interactions'?'active-metric':''}">${number(g.interactions)}${coverage(g,'interactions')}</td><td class="${sort==='creations'?'active-metric':''}">${number(g.creations)}${coverage(g,'creations')}</td><td class="${sort==='igain'?'active-metric':''}">${gain(g,'igain')}</td><td class="${sort==='cgain'?'active-metric':''}">${gain(g,'cgain')}</td><td class="${sort===extra?'active-metric':''}">${number(g[extra],['ratio','average','iday','cday'].includes(extra)?1:0)}${coverage(g,extra)}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No creators match these filters. Try another search or turn off full coverage.</td></tr>';
    $('countLabel').textContent=filtered.length?`${start+1}–${Math.min(start+25,filtered.length)} of ${filtered.length} creators`:'0 creators';
    $('pageLabel').textContent=`${page+1} / ${Math.max(1,Math.ceil(filtered.length/25))}`;$('previous').disabled=page===0;$('next').disabled=start+25>=filtered.length;
    $('complete').disabled=!['igain','cgain','iday','cday'].includes(sort);
    const w=result.window;
    $('windowNote').textContent=w?`Growth: ${date(w.start)} – ${date(w.end)} · ${(w.days*24).toFixed(1)} observed hours. Totals always use the latest discovery set.`:'Not enough history for this period. Lifetime totals remain available; growth shows a dash.';
  }
  function stat(label,value,note){return `<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;}
  function renderProfile(){
    const g=result.creators.find(g=>g.key===selected);$('profile').hidden=!g;if(!g)return;
    $('profileTitle').textContent=g.name;
    $('profileSubtitle').textContent=`${g.kins} tracked ${g.kins===1?'Kin':'Kins'} · ${g.top100} in discovery’s top 100 · best position #${g.bestRank}`;
    $('profileStats').innerHTML=stat('VISIBLE INTERACTIONS',number(g.interactions),`${g.visibleI}/${g.kins} Kins with visible counters`)+stat('CREATIONS',number(g.creations),'Across the current tracked portfolio')+stat('INTERACTIONS GAINED',g.igain===null?'—':'+'+number(g.igain),`${periods[$('period').value]} · ${g.iCovered}/${g.kins} Kins covered`)+stat('CREATIONS GAINED',g.cgain===null?'—':'+'+number(g.cgain),`${periods[$('period').value]} · ${g.cCovered}/${g.kins} Kins covered`);
    const byTotal=g.rows.filter(r=>Number.isFinite(r.interactions)).sort((a,b)=>b.interactions-a.interactions),top=byTotal.slice(0,5);
    $('contributions').innerHTML=g.interactions>0?top.map(r=>{const share=r.interactions/g.interactions*100;return `<div class="contribution"><div><a href="${kinLink(r.id)}">${esc(r.name)}</a><span>${number(share,1)}%</span></div><div class="track"><span style="width:${share.toFixed(3)}%"></span></div></div>`;}).join(''):'<p class="footnote">No visible interactions to break down yet.</p>';
    const rest=g.interactions-top.reduce((n,r)=>n+r.interactions,0);
    $('concentrationNote').textContent=g.concentration===null?'':`${g.leader.name} accounts for ${number(g.concentration,1)}% of this tracked interaction total.${rest>0?` The other ${byTotal.length-top.length} Kins account for ${number(rest/g.interactions*100,1)}%.`:''}`;
    const rows=g.rows.slice().sort((a,b)=>a.rank-b.rank);
    $('portfolio').innerHTML=rows.slice(0,allKins?Infinity:6).map(r=>`<div class="kin-row"><span class="kin-rank">#${r.rank}</span><div><a href="${kinLink(r.id)}">${esc(r.name)} ↗</a><small>${esc(r.id)} · ${number(r.creations)} creations</small></div><div class="kin-values">${short(r.interactions)}<small>interactions</small></div></div>`).join('');
    $('moreKins').hidden=rows.length<=6;$('moreKins').textContent=allKins?'Show fewer ↑':`Show all ${rows.length} Kins ↓`;
  }
  function choose(key,scroll=true){selected=key;allKins=false;renderBoard();renderProfile();saveHash();if(scroll)$('profile').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  function recompute(){result=M.aggregate(data,$('period').value);renderBoard();renderProfile();saveHash();}
  async function load(){
    $('reload').disabled=true;
    try{
      const history=await KinData.load('history.json');data=M.prepare(history);result=M.aggregate(data,$('period').value);weekly=$('period').value==='7'?result:M.aggregate(data,'7');
      $('creatorCount').textContent=number(result.creators.length);
      $('coverageSummary').textContent=`${number(result.attributed)} of ${number(data.last.rows.length)} current Kins have identifiable creators. ${result.unattributed} anonymous or unlabeled Kins excluded.`;
      $('freshness').textContent=`Last observation: ${new Date(data.last.at).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})} · ${history.snapshots.length} snapshots`;
      if(!selected||!result.creators.some(g=>g.key===selected))selected=M.ranked(result.creators,'interactions')[0]?.key||'';
      renderHighlights();renderBoard();renderProfile();saveHash();
    }catch(error){$('freshness').textContent=data?'Refresh failed. Showing the last loaded observation.':'Unable to load creator statistics. Try Refresh in a moment.';if(!data){$('spotlights').innerHTML='<div class="loading">The public data feed is unavailable. Your filters are saved.</div>';$('rows').innerHTML='<tr><td colspan="8" class="empty">Waiting for data.</td></tr>';}}
    finally{$('reload').disabled=false;}
  }
  readHash();
  document.addEventListener('click',e=>{const b=e.target.closest('[data-creator]');if(b&&data)choose(b.dataset.creator);});
  $('sort').addEventListener('change',()=>{if(!data)return;page=0;renderBoard();saveHash();});
  $('period').addEventListener('change',()=>{if(!data)return;page=0;recompute();});
  $('search').addEventListener('input',()=>{if(!data)return;page=0;renderBoard();});
  $('complete').addEventListener('change',()=>{if(!data)return;page=0;renderBoard();saveHash();});
  $('previous').addEventListener('click',()=>{if(!data)return;page--;renderBoard();});$('next').addEventListener('click',()=>{if(!data)return;page++;renderBoard();});
  $('moreKins').addEventListener('click',()=>{allKins=!allKins;renderProfile();});$('reload').addEventListener('click',load);
  $('share').addEventListener('click',async()=>{saveHash();try{await navigator.clipboard.writeText(location.href);toast('Creator link copied');}catch{toast('Copy the page address to share this creator.');}});
  $('export').addEventListener('click',()=>{
    if(!result)return;
    const keys=['position','name','kins','top100','interactions','visibleI','creations','visibleC','igain','iCovered','cgain','cCovered','iday','cday','average','ratio'];
    const cell=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';
    const rows=[['Observation','Period','Growth start','Elapsed days',...keys],...filtered.map(g=>[data.last.at,$('period').value,result.window?new Date(result.window.start).toISOString():'',result.window?.days??'',...keys.map(k=>g[k])])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`kin-creators-${data.last.at.slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('hashchange',()=>{if(location.hash&&!location.hash.includes('='))return;readHash();if(data){page=0;recompute();}});
  load();
})();
