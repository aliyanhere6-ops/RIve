export function createTrackingClient(){
 const worker=new Worker(new URL('./tracking-worker.js',import.meta.url));
 let bodyWorker=null,bodyReady=false,bodyBusy=false,bodyId=0,bodyCutoff=0,bodyVersion=0,bodyConsumed=0,latestBody=null;
 let pending=null,id=0,disposed=false,acceleration='loading';
 let readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const fail=error=>{readyReject(error);pending?.reject(error);pending=null;};
 const startBody=()=>{
  bodyWorker=new Worker(new URL('./body-worker.js',import.meta.url));
  bodyWorker.onmessage=({data})=>{
   if(data.type==='ready'){bodyReady=true;return;}
   if(data.type==='body'){bodyBusy=false;if(data.id>bodyCutoff){latestBody=data.body;bodyVersion++;}}
   if(data.type==='error'){bodyBusy=false;bodyReady=false;}
  };
  bodyWorker.onerror=()=>{bodyBusy=false;bodyReady=false;};
  bodyWorker.postMessage({type:'init',acceleration:'CPU'});
 };
 worker.onmessage=({data})=>{
  if(data.type==='ready'){acceleration=data.acceleration;startBody();readyResolve();return;}
  if(data.type==='error'){fail(Error(data.message));return;}
  if(data.type==='result'&&pending?.id===data.id){
   acceleration=data.acceleration;
   const fresh=bodyVersion>bodyConsumed;bodyConsumed=bodyVersion;
   const resolve=pending.resolve;pending=null;resolve({...data,body:latestBody,bodyFresh:fresh});
  }
 };
 worker.onerror=event=>fail(Error(event.message||'Tracking worker failed'));
 worker.postMessage({type:'init'});
 return {ready,get acceleration(){return acceleration;},get busy(){return !!pending;},reset(){latestBody=null;bodyConsumed=bodyVersion;bodyCutoff=bodyId;},async detect(video,now,body){
  if(disposed||pending)return null;
  const frameId=++id;
  let resolve,reject;const result=new Promise((ok,no)=>{resolve=ok;reject=no;});pending={id:frameId,resolve,reject};
  try{
   const width=384,height=Math.round(width*video.videoHeight/video.videoWidth);
   const image=await createImageBitmap(video,{resizeWidth:width,resizeHeight:height});
   if(disposed){image.close();throw Error('Tracking stopped');}
   // Body inference never blocks a face result. Each worker has at most one frame in flight.
   if(body&&bodyReady&&!bodyBusy){
    bodyBusy=true;const current=++bodyId;
    createImageBitmap(video,{resizeWidth:width,resizeHeight:height}).then(copy=>{if(disposed){copy.close();return;}bodyWorker.postMessage({type:'frame',id:current,image:copy,now},[copy]);}).catch(()=>{bodyBusy=false;});
   }
   worker.postMessage({type:'frame',id:frameId,image,now,body:false},[image]);
  }catch(error){pending=null;reject(error);}
  return result;
 },dispose(){disposed=true;worker.terminate();bodyWorker?.terminate();pending?.resolve(null);pending=null;}};
}

