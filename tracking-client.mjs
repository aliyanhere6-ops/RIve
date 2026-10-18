export function createTrackingClient(){
  const worker=new Worker(new URL('./tracking-worker.js',import.meta.url));
  let pending=null,id=0,disposed=false,acceleration='loading';
  let readyResolve,readyReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const fail=error=>{readyReject(error);pending?.reject(error);pending=null;};
  worker.onmessage=({data})=>{
    if(data.type==='ready'){acceleration=data.acceleration;readyResolve();return;}
    if(data.type==='error'){fail(Error(data.message));return;}
    if(data.type==='result'&&pending?.id===data.id){acceleration=data.acceleration;const resolve=pending.resolve;pending=null;resolve(data);}
  };
  worker.onerror=event=>fail(Error(event.message||'Tracking worker failed'));
  worker.postMessage({type:'init'});
  return {ready,get acceleration(){return acceleration;},get busy(){return !!pending;},async detect(video,now,body){
    if(disposed||pending)return null;
    // Only one image in flight: slow inference drops camera frames, never queues them.
    const frameId=++id;
    let resolve,reject;const result=new Promise((ok,no)=>{resolve=ok;reject=no;});
    pending={id:frameId,resolve,reject};
    try{
      const width=384,height=Math.round(width*video.videoHeight/video.videoWidth);
      const image=await createImageBitmap(video,{resizeWidth:width,resizeHeight:height});
      if(disposed){image.close();throw Error('Tracking stopped');}
      worker.postMessage({type:'frame',id:frameId,image,now,body},[image]);
    }catch(error){pending=null;reject(error);}
    return result;
  },dispose(){disposed=true;worker.terminate();pending?.resolve(null);pending=null;}};
}
