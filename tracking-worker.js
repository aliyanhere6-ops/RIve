let face,acceleration='CPU',slowFrames=0;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {FilesetResolver,FaceLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      const faceOptions={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true};
      acceleration='GPU';
      try{face=await FaceLandmarker.createFromOptions(files,faceOptions);}catch{faceOptions.baseOptions.delegate='CPU';face=await FaceLandmarker.createFromOptions(files,faceOptions);acceleration='CPU';}
      self.postMessage({type:'ready',acceleration});return;
    }
    if(data.type==='frame'){
      const start=performance.now();
      try{
        const faceStart=performance.now();const result=face.detectForVideo(data.image,data.now);
        const faceMs=performance.now()-faceStart;
        const body=null;
        const ms=performance.now()-start;
        if(acceleration==='GPU'&&faceMs>150)slowFrames++;else slowFrames=0;
        if(slowFrames>=3){await face.setOptions({baseOptions:{delegate:'CPU'}});acceleration='CPU';slowFrames=0;}
        self.postMessage({type:'result',id:data.id,result,body,ms,acceleration});
      }finally{data.image.close();}
    }
  }catch(error){self.postMessage({type:'error',id:data.id,message:error.message});}
};
