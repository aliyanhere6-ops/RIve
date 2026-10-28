let pose,delegate='CPU';
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   delegate=data.acceleration||'CPU';
   const options={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate},runningMode:'VIDEO',numPoses:1};
   try{pose=await PoseLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';pose=await PoseLandmarker.createFromOptions(files,options);}
   self.postMessage({type:'ready'});return;
  }
  if(data.type==='frame')try{const start=performance.now(),body=pose.detectForVideo(data.image,data.now);self.postMessage({type:'body',id:data.id,body,ms:performance.now()-start});}finally{data.image.close();}
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
