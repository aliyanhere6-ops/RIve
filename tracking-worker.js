let face,pose,hands,acceleration='CPU',slowFrames=0,lastHands=0;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {FilesetResolver,FaceLandmarker,PoseLandmarker,HandLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      const faceOptions={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true};
      acceleration='GPU';
      try{face=await FaceLandmarker.createFromOptions(files,faceOptions);}catch{faceOptions.baseOptions.delegate='CPU';face=await FaceLandmarker.createFromOptions(files,faceOptions);acceleration='CPU';}
      const poseOptions={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:acceleration},runningMode:'VIDEO',numPoses:1};
      try{pose=await PoseLandmarker.createFromOptions(files,poseOptions);}catch{poseOptions.baseOptions.delegate='CPU';pose=await PoseLandmarker.createFromOptions(files,poseOptions);}
      const handOptions={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:acceleration},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6};
      try{hands=await HandLandmarker.createFromOptions(files,handOptions);}catch{handOptions.baseOptions.delegate='CPU';hands=await HandLandmarker.createFromOptions(files,handOptions);}
      self.postMessage({type:'ready',acceleration});return;
    }
    if(data.type==='frame'){
      const start=performance.now();
      try{
        const faceStart=performance.now();const result=face.detectForVideo(data.image,data.now);
        const faceMs=performance.now()-faceStart;
        const body=data.body?pose.detectForVideo(data.image,data.now):null;
        let handResult=null;
        if(data.hands&&data.now-lastHands>100){handResult=hands.detectForVideo(data.image,data.now);lastHands=data.now;}
        const ms=performance.now()-start;
        if(acceleration==='GPU'&&faceMs>150)slowFrames++;else slowFrames=0;
        if(slowFrames>=3){await face.setOptions({baseOptions:{delegate:'CPU'}});await pose.setOptions({baseOptions:{delegate:'CPU'}});await hands.setOptions({baseOptions:{delegate:'CPU'}});acceleration='CPU';slowFrames=0;}
        self.postMessage({type:'result',id:data.id,result,body,hands:handResult,ms,acceleration});
      }finally{data.image.close();}
    }
  }catch(error){self.postMessage({type:'error',id:data.id,message:error.message});}
};
