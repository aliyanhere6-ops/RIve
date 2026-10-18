import {HeadTracker,LipTracker,Dwell,measureFace} from './tracking-core.mjs';
import {createAvatar} from './avatar-renderer.mjs';
import {facePointer} from './pointer-mapping.mjs';
import {createTrackingClient} from './tracking-client.mjs';
import {handTargets} from './detail-tracking.mjs';
const $=id=>document.getElementById(id);
const names=['idle','L','R','TH','FV','Ch.j.Sh','DGKNSTXYZ','A E I','Ee','Uh H Ah','O','Oo Uu W','Oo Uu W 2','wink','shocked','angry'];
const fields=[['visemes',15],['Expressions',12],['poses',3],['sizing ',2],['xy',5]];
const props={},values={},sliders={};
let avatar,stream,audio,analyser,face,pose,recognition,modelPromise;
let running=false,generation=0,lastFrame=-1,lastTick=0,lastPose=0,lastFace=0,poseValue=0;
let shoulderNeutral=null;
let tracker=null,inferenceBusy=false,lastDebug=0,lastOverlay=0;
let inferenceEnd=0,inferenceCost=0;
let head=new HeadTracker(),lips=new LipTracker(),poseFilter=new Dwell(0,200),expressionFilter=new Dwell(0,220);
const wave=new Float32Array(1024);
const message=t=>$('message').textContent=t,status=t=>$('status').textContent=t;
const detailPanel=document.createElement('section');detailPanel.className='panel rig-details';
detailPanel.innerHTML=`<div class="tag"><span>03 / HANDS & BACKGROUND</span></div>
<label class="toggle"><span>Hand tracking<small>Your hands drive the new Rive targets</small></span><input id="handTracking" type="checkbox" checked></label>
<p id="detailStatus" class="muted">Hands · waiting for camera</p><div class="divider"></div>
<label class="toggle"><span>Transparent background<small>Off: background visible · On: transparent</small></span><input id="bgTransparent" type="checkbox"></label>
<label class="background-color"><span>Background colour<small id="bgColorLabel">#FFFFFF</small></span><input id="bgColor" aria-label="Background colour" type="color" value="#ffffff"></label>`;
document.querySelector('aside').insertBefore(detailPanel,document.querySelector('aside .advanced'));
$('bgTransparent').onchange=()=>{avatar?.background.setTransparent($('bgTransparent').checked);$('bgColor').disabled=$('bgTransparent').checked;};
$('bgColor').oninput=()=>{avatar?.background.setColor($('bgColor').value);$('bgColorLabel').textContent=$('bgColor').value.toUpperCase();};
$('handTracking').onchange=()=>{if(avatar)avatar.detailTargets.hands={left:null,right:null};};
let handSeen={left:0,right:0};
let armPose=null,armPoseAt=0;
for(const [key,max] of fields){
  const row=document.createElement('div');row.className='control';
  const label=document.createElement('div'),text=document.createElement('span'),out=document.createElement('output'),input=document.createElement('input');
  text.textContent=key;out.textContent='0';label.append(text,out);
  Object.assign(input,{type:'range',min:0,max,value:0,step:1});input.setAttribute('aria-label',key);
  if(key==='xy'){input.disabled=true;input.title='Disabled: head movement uses the Rive pointer rig';text.textContent='xy · off (pointer only)';}
  row.append(label,input);$('controls').append(row);sliders[key]={input,out};
  input.oninput=()=>{
    // Adjusting size must not silently disable head/mouth tracking.
    if(key==='sizing '){$('autoSize').checked=false;}
    else {$('tracking').checked=false;$('mode').textContent='MANUAL';}
    set(key,Number(input.value));
  };
}
function set(key,n){
  if(key==='xy')n=1; // Hold the legacy directional binding at its neutral state.
  if(values[key]===n)return;
  values[key]=n;if(props[key])props[key].value=n;
  sliders[key].input.value=n;sliders[key].out.textContent=String(n);
  if(key==='visemes')$('visemeName').textContent=`${n} · ${names[n]}`;
}
window.studio={values,set,get avatar(){return avatar},get properties(){return Object.keys(props)}};
createAvatar($('avatar'),states=>{$('states').textContent='Rive: '+states.join(', ');}).then(result=>{
  avatar=result;
  for(const [key]of fields){props[key]=avatar.number(key);if(!props[key])throw Error('Missing property '+key);set(key,key==='xy'?1:0);}
  $('start').disabled=false;status('Character ready');message('Start performance, then look straight ahead during calibration.');
}).catch(e=>{status('Avatar load failed');message(e.message);});

function models(){return modelPromise??=(loadModels().catch(e=>{modelPromise=null;throw e;}));}
async function loadModels(){
  if(!tracker)tracker=createTrackingClient();
  try{await tracker.ready;}catch(error){tracker.dispose();tracker=null;throw error;}
}
function neutralize(){if(avatar){avatar.target.enabled=false;avatar.target.voice=0;avatar.detailTargets.hands={left:null,right:null};avatar.detailTargets.eyes=null;avatar.detailTargets.enabled=false;}handSeen={left:0,right:0};armPose=null;armPoseAt=0;set('visemes',0);set('Expressions',0);set('poses',0);set('xy',1);}
async function stop(){
  running=false;generation++;const old=stream;stream=null;old?.getTracks().forEach(t=>t.stop());
  const rec=recognition;recognition=null;rec?.abort();const ac=audio;audio=null;analyser=null;await ac?.close().catch(()=>{});
  $('camera').srcObject=null;$('stop').disabled=true;$('start').disabled=!avatar?.loaded;$('calibrate').disabled=true;
  $('faceStatus').textContent='OFFLINE';$('mode').textContent='STANDBY';$('volume').style.width='0';
  $('mesh').getContext('2d').clearRect(0,0,640,480);neutralize();status('Stopped · devices released');
}
$('stop').onclick=()=>void stop();
$('start').onclick=async()=>{
  const token=++generation;$('start').disabled=true;$('stop').disabled=false;
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30},facingMode:'user'},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
    if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;$('camera').srcObject=stream;await $('camera').play();
    if(token!==generation)return;
    audio=new AudioContext();await audio.resume();analyser=audio.createAnalyser();analyser.fftSize=1024;
    audio.createMediaStreamSource(stream).connect(analyser);status('Preparing tracking…');await models();if(token!==generation)return;
    head=new HeadTracker();lips=new LipTracker();shoulderNeutral=null;poseFilter=new Dwell(0,200);expressionFilter=new Dwell(0,220);
    lastFrame=-1;lastTick=lastPose=lastFace=0;running=true;$('tracking').checked=true;$('calibrate').disabled=false;
    $('mode').textContent='CALIBRATING';status('Camera + microphone live');
    message('Look straight ahead with relaxed lips for one second. Size stays at your selected value.');startSpeech();requestAnimationFrame(loop);
  }catch(e){if(token===generation){await stop();status('Camera setup failed');message(e.name+': '+e.message+'. Close other camera apps and retry in Chrome or Edge.');}}
};
$('calibrate').onclick=()=>{head=new HeadTracker();lips=new LipTracker();shoulderNeutral=null;neutralize();message('Recalibrating: look straight ahead with relaxed lips for one second.');};
$('tracking').onchange=()=>{if(avatar)avatar.target.enabled=$('tracking').checked&&running;$('mode').textContent=$('tracking').checked?'TRACKING':'MANUAL';};
$('autoSize').onchange=()=>{message($('autoSize').checked?'Auto size enabled: sustained distance changes only; head turns freeze sizing.':'Size locked. Adjust the sizing slider without disabling face tracking.');};

function body(l){
  const ok=i=>l[i]&&(l[i].visibility??1)>.55;
  if(![11,12,15,16].every(ok))return 0;
  const dist=(a,b)=>Math.hypot(l[a].x-l[b].x,l[a].y-l[b].y);
  if(l[16].y<l[12].y-.08)return 3;
  if(ok(7)&&dist(15,7)<.2)return 2;
  if(ok(23)&&ok(24)&&dist(15,23)<.22&&dist(16,24)<.22)return 1;
  return 0;
}
function draw(l){
  const canvas=$('mesh');if(canvas.width!==640){canvas.width=640;canvas.height=480;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,640,480);ctx.fillStyle='#82e9bb';
  for(let i=0;i<l.length;i+=4){ctx.beginPath();ctx.arc(l[i].x*640,l[i].y*480,1.2,0,7);ctx.fill();}
}
async function loop(now){
  if(!running)return;requestAnimationFrame(loop);
  const video=$('camera');if(inferenceBusy||now-inferenceEnd<Math.min(45,Math.max(8,inferenceCost*.12))||now-lastTick<42||video.readyState<2||video.currentTime===lastFrame)return;
  lastTick=now;lastFrame=video.currentTime;
  const token=generation;inferenceBusy=true;
  try{
    analyser.getFloatTimeDomainData(wave);const rms=Math.sqrt(wave.reduce((s,v)=>s+v*v,0)/wave.length);
    $('volume').style.width=Math.min(100,rms*Number($('micGain').value)*700)+'%';
    const wantBody=($('bodyTracking').checked||$('handTracking').checked)&&now-lastPose>($('handTracking').checked?250:inferenceCost>100?1500:500);
    const tracked=await tracker.detect(video,now,wantBody,$('handTracking').checked);
    if(!tracked||!running||token!==generation)return;
    inferenceCost=tracked.ms;
    if(wantBody){armPose=tracked.body?.landmarks?.[0]||null;armPoseAt=now;lastPose=now;}
    avatar.detailTargets.enabled=$('handTracking').checked;
    if($('handTracking').checked){
      const detected=handTargets(tracked.hands,now-armPoseAt<900?armPose:null,{flipX:$('flipHorizontal').checked,aspect:video.videoHeight/video.videoWidth,fallbackFace:head.neutral,previous:avatar.detailTargets.hands});
      for(const side of ['left','right'])if(detected[side]){avatar.detailTargets.hands[side]=detected[side];handSeen[side]=now;}
    }
    for(const side of ['left','right'])if(now-handSeen[side]>450)avatar.detailTargets.hands[side]=null;
    if(now-lastDebug>500)$('detailStatus').textContent=armPose?`Hands: ${avatar.detailTargets.hands.left?'L':'—'} / ${avatar.detailTargets.hands.right?'R':'—'}`:'Keep shoulders and elbows in camera view';
    const result=tracked.result,landmarks=result.faceLandmarks[0];
    if(now-lastDebug>500){$('perf').textContent=`${Math.round(avatar.metrics.fps)} FPS · ${tracker.acceleration} ${Math.round(tracked.ms)} ms`;$('perf').title='Avatar rendering FPS and camera inference time';$('pointerStatus').textContent=`Rive pointer: ${avatar.pointer.source} · ${avatar.pointer.targetX.toFixed(0)}, ${avatar.pointer.targetY.toFixed(0)}`;}
    if(!landmarks){
      avatar.target.voice=0;
      $('faceStatus').textContent='NO FACE';$('mesh').getContext('2d').clearRect(0,0,640,480);
      // Brief lost detections hold position/size. Sustained loss releases mouth only.
      if($('tracking').checked&&now-lastFace>300){avatar.target.opening=0;avatar.target.pointerX=0;avatar.target.pointerY=0;avatar.target.x=0;avatar.target.y=0;avatar.target.bodyX=0;avatar.target.bodyY=0;avatar.target.bodyRoll=0;set('visemes',0);set('Expressions',0);set('poses',0);}
      return;
    }
    lastFace=now;if(now-lastOverlay>100){draw(landmarks);lastOverlay=now;}const measurement=measureFace(landmarks,result.facialTransformationMatrixes?.[0]?.data);if(!measurement)return;
    const b=Object.fromEntries((result.faceBlendshapes[0]?.categories||[]).map(c=>[c.categoryName,c.score]));
    const h=head.update(measurement,now,{sensitivity:Number($('sensitivity').value),autoSize:$('autoSize').checked,currentSize:values['sizing ']??0});
    const lip=lips.update(b,h.m,rms,now,{gain:Number($('micGain').value)});
    avatar.target.voice=lip.speaking?Math.max(0,Math.min(1,(lip.level-lip.gate)/Math.max(.025,lip.gate*3))):0;
    $('faceStatus').textContent=h.ready?'FACE TRACKED':`CALIBRATING ${Math.round(h.progress*100)}%`;
    if(now-lastDebug>500){$('telemetry').textContent=h.ready?`Head H ${(h.yaw*100).toFixed(0)} / V ${(h.pitch*100).toFixed(0)} · mouth ${lip.jaw.toFixed(2)} · mic ${lip.level.toFixed(3)} / gate ${lip.gate.toFixed(3)} · size ${$('autoSize').checked?'auto':'locked'}`:'Hold a neutral face for one second…';lastDebug=now;}
    // Body inference is optional and less frequent to keep face/mouth tracking responsive.
    avatar.target.bodyEnabled=$('bodyTracking').checked;
    if(wantBody){
      const s=tracked.body?.landmarks[0];poseValue=s?body(s):0;
      if(s&&(s[11].visibility??1)>.6&&(s[12].visibility??1)>.6){
        const center={x:(s[11].x+s[12].x)/2,y:(s[11].y+s[12].y)/2,roll:Math.atan2(s[11].y-s[12].y,Math.abs(s[11].x-s[12].x))};
        shoulderNeutral??=center;
        avatar.target.bodyX=Math.max(-1,Math.min(1,(center.x-shoulderNeutral.x)*5))*($('flipHorizontal').checked?-1:1);
        avatar.target.bodyY=Math.max(-1,Math.min(1,(center.y-shoulderNeutral.y)*4));
        avatar.target.bodyRoll=Math.max(-1,Math.min(1,(center.roll-shoulderNeutral.roll)*2))*($('flipHorizontal').checked?-1:1);
      }else{avatar.target.bodyX=0;avatar.target.bodyY=0;avatar.target.bodyRoll=0;}
      lastPose=now;
    }
    if(!$('tracking').checked){avatar.target.enabled=false;return;}
    $('mode').textContent=h.ready?'TRACKING':'CALIBRATING';
    if(!h.ready){avatar.target.enabled=false;return;}
    avatar.target.enabled=true;
    avatar.target.x=Math.max(-1,Math.min(1,h.yaw*4))*($('flipHorizontal').checked?-1:1);
    avatar.target.y=Math.max(-1,Math.min(1,h.pitch*4))*($('flipVertical').checked?-1:1);
    const facePoint=facePointer(h.m,head.neutral,{flipX:$('flipHorizontal').checked,flipY:$('flipVertical').checked,sensitivity:Number($('sensitivity').value)});
    avatar.target.pointerX=facePoint.x;avatar.target.pointerY=facePoint.y;
    if($('autoSize').checked)set('sizing ',h.size);
    let viseme=lip.viseme;
    // Wink is deliberate only; normal blinking and eyebrow motion cannot interrupt speech.
    if($('faceExpressions').checked&&!lip.speaking&&lip.jaw<.12){
      const left=b.eyeBlinkLeft||0,right=b.eyeBlinkRight||0;
      if((left>.8&&right<.15)||(right>.8&&left<.15))viseme=13;
      else if((b.browInnerUp||0)>.7)viseme=14;
    }
    avatar.target.viseme=viseme;avatar.target.opening=lip.amount;set('visemes',viseme);
    const smile=((b.mouthSmileLeft||0)+(b.mouthSmileRight||0))/2;
    // Avoid expression changes competing with the user's speaking performance.
    const exp=$('faceExpressions').checked&&!lip.speaking&&lip.jaw<.12?(smile>.6?2:0):0;
    set('Expressions',expressionFilter.next(exp,now));
    set('poses',poseFilter.next($('bodyTracking').checked&&$('gestures').checked?poseValue:0,now));
  }catch(e){const error=e.message;if(token===generation)void stop().then(()=>{status('Tracking error');message(error);});}
  finally{inferenceBusy=false;inferenceEnd=performance.now();}
}

// Speech transcripts are shown as captions, never replayed as delayed lip animation.
function startSpeech(){
  const old=recognition;recognition=null;old?.abort();
  if(!$('speech').checked||!running)return;
  const API=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!API){$('transcript').textContent='Browser captions unavailable; live lip tracking remains active.';return;}
  const rec=new API();recognition=rec;rec.lang=$('language').value;rec.continuous=true;rec.interimResults=true;
  rec.onresult=e=>{$('transcript').textContent=e.results[e.results.length-1][0].transcript;};
  rec.onerror=e=>{$('transcript').textContent='Captions: '+e.error;};
  rec.onend=()=>{if(running&&$('speech').checked&&recognition===rec)setTimeout(()=>{if(running&&recognition===rec)try{rec.start();}catch{}},500);};
  try{rec.start();}catch(e){$('transcript').textContent=e.message;}
}
$('speech').onchange=startSpeech;$('language').onchange=startSpeech;
window.addEventListener('pagehide',()=>{running=false;stream?.getTracks().forEach(t=>t.stop());recognition?.abort();audio?.close();avatar?.dispose();tracker?.dispose();});
models().then(()=>{if(!running)status('Tracking models ready');}).catch(e=>{message('Tracking model setup failed: '+e.message);});
$('studioView').onclick=()=>{const clean=document.body.classList.toggle('stage-only');$('studioView').textContent=clean?'← Studio controls':'Stage view ↗';};
document.querySelectorAll('[data-backdrop]').forEach(button=>button.onclick=()=>{document.querySelector('.stage').dataset.backdrop=button.dataset.backdrop;});
$('hairMotion').onchange=()=>{if(avatar)avatar.target.hairEnabled=$('hairMotion').checked;};
$('hairStrength').oninput=()=>{if(avatar)avatar.target.hairStrength=Number($('hairStrength').value);};
$('rivePointer').onchange=()=>{if(avatar)avatar.target.pointerEnabled=$('rivePointer').checked;};
