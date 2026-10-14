/* Statistics are published independently of the website deployment. */
(()=>{
  'use strict';
  const base=new URL('.',document.currentScript.src);
  const upstream='https://raw.githubusercontent.com/lc6382/kin-observatory-site/main/';
  const requests=new Map();
  const sources={};
  function valid(name,value){
    if(name==='history.json')return value?.version===1&&Array.isArray(value.snapshots)&&value.snapshots.length>0&&value.snapshots.every(s=>Number.isFinite(Date.parse(s.at))&&Array.isArray(s.rows));
    return value&&typeof value.outcome==='string'&&Number.isFinite(Date.parse(value.checkedAt));
  }
  async function read(name){
    for(const [origin,url] of [['direct',new URL(name,upstream)],['website',new URL(name,base)]]){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        url.searchParams.set('t',Date.now());
        const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});
        if(!response.ok)throw Error('Data request failed');
        const value=await response.json();
        if(!valid(name,value))throw Error('Invalid published data');
        sources[name]=origin;
        return value;
      }catch{}finally{clearTimeout(timer);}
    }
    throw Error('Published statistics unavailable');
  }
  window.KinData={sources,load(name){
    if(!['history.json','status.json'].includes(name))return Promise.reject(Error('Unknown data file'));
    const previous=requests.get(name);
    if(previous&&Date.now()-previous.at<5000)return previous.promise;
    const promise=read(name).catch(error=>{requests.delete(name);throw error;});
    requests.set(name,{at:Date.now(),promise});
    return promise;
  }};
})();
