export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function mapDirection(value,flipHorizontal=false,flipVertical=false){
  if(flipHorizontal&&(value===2||value===3))return 5-value;
  if(flipVertical&&(value===4||value===5))return 9-value;
  return value;
}

// All filters use elapsed time, so behavior is independent of camera frame rate.
export class Smooth {
  constructor(tau = 90) { this.tau = tau; this.value = null; this.time = null; }
  next(value, now) {
    if (!Number.isFinite(value)) return this.value ?? 0;
    const dt = this.time === null ? 1000 : clamp(now - this.time, 0, 250);
    this.value = this.value === null ? value : this.value + (value - this.value) * (1 - Math.exp(-dt / this.tau));
    this.time = now; return this.value;
  }
  clear() { this.value = this.time = null; }
}

export class Dwell {
  constructor(value, delay) { this.value = value; this.pending = value; this.since = 0; this.delay = delay; }
  next(value, now) {
    if (value !== this.pending) { this.pending = value; this.since = now; }
    if (now - this.since >= this.delay) this.value = value;
    return this.value;
  }
}

export function measureFace(l,matrix) {
  const mid = (a,b) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const left = mid(l[33], l[133]), right = mid(l[362], l[263]);
  const eyes = mid(left,right), mouth = mid(l[61],l[291]);
  // Project into an eye-aligned frame: roll does not masquerade as up/down.
  const vx=right.x-left.x, vy=right.y-left.y, eyeSpan=Math.hypot(vx,vy);
  if (eyeSpan < .025) return null;
  const project=p=>({x:((p.x-eyes.x)*vx+(p.y-eyes.y)*vy)/(eyeSpan*eyeSpan),y:((p.y-eyes.y)*vx-(p.x-eyes.x)*vy)/(eyeSpan*eyeSpan)});
  const nose=project(l[1]), lip=project(mouth);
  const mouthWidth=Math.hypot(l[291].x-l[61].x,l[291].y-l[61].y);
  const rotation=matrix?.length===16&&Array.from(matrix).every(Number.isFinite);
  return {x:eyes.x,y:eyes.y,span:eyeSpan,yaw:rotation?Math.atan2(matrix[8],matrix[10]):nose.x,pitch:rotation?Math.atan2(-matrix[9],Math.hypot(matrix[8],matrix[10])):nose.y/Math.max(.15,lip.y),
    opening:Math.hypot(l[14].x-l[13].x,l[14].y-l[13].y)/Math.max(.01,mouthWidth),mouthWidth:mouthWidth/eyeSpan};
}

export class HeadTracker {
  constructor() {
    this.filters=Object.fromEntries(['x','y','yaw','pitch','span','opening','mouthWidth'].map(k=>[k,new Smooth(k==='span'?500:k==='opening'?40:40)]));
    this.neutral=null;this.calibration=[];this.ready=false;this.direction=new Dwell(1,70);this.size=new Dwell(0,1200);
  }
  calibrate() { this.calibration=[]; this.ready=false; this.neutral=null; }
  update(measurement,now,{sensitivity=1,autoSize=false,currentSize=0}={}) {
    const m=Object.fromEntries(Object.entries(measurement).map(([k,v])=>[k,this.filters[k].next(v,now)]));
    if (!this.ready) {
      this.calibration.push(m);
      if(this.calibration.length>=18){this.neutral=Object.fromEntries(Object.keys(m).map(k=>[k,this.calibration.map(x=>x[k]).sort((a,b)=>a-b)[Math.floor(this.calibration.length/2)]]));this.ready=true;}
      return {ready:false,progress:this.calibration.length/18,xy:1,size:currentSize,m};
    }
    const n=this.neutral;
    const yaw=(m.yaw-n.yaw)*sensitivity, pitch=(m.pitch-n.pitch)*sensitivity;
    // Head rotation and lateral movement both drive the authored direction poses.
    const horizontal=(Math.abs(yaw)/.105 > Math.abs((m.x-n.x)/n.span)/.38)?yaw/.105:((m.x-n.x)/n.span)/.38;
    const vertical=(Math.abs(pitch)/.12 > Math.abs((m.y-n.y)/n.span)/.32)?pitch/.12:((m.y-n.y)/n.span)/.32;
    let xy=1; const old=this.direction.value;
    const horizontalLimit=(old===2||old===3) ? .55 : 1;
    const verticalLimit=(old===4||old===5) ? .55 : 1;
    if(Math.abs(horizontal)>horizontalLimit&&Math.abs(horizontal)>=Math.abs(vertical)*.85)xy=horizontal>0?2:3;
    else if(Math.abs(vertical)>verticalLimit)xy=vertical>0?5:4;
    xy=this.direction.next(xy,now);
    let size=currentSize;
    // Turning the head shortens projected eye distance. Freeze distance sizing during turns.
    if(autoSize&&Math.abs(yaw)<.06&&Math.abs(pitch)<.09){
      const ratio=m.span/n.span;
      let target=currentSize;
      if(currentSize===0&&ratio>1.42)target=1;
      if(currentSize===1){if(ratio<1.18)target=0;else if(ratio>1.95)target=2;}
      if(currentSize===2&&ratio<1.65)target=1;
      size=this.size.next(target,now);
    }else{this.size.value=currentSize;this.size.pending=currentSize;this.size.since=now;}
    return {ready:true,xy,size,yaw,pitch,ratio:m.span/n.span,m};
  }
}

export class LipTracker {
  constructor(){this.jaw=new Smooth(30);this.round=new Smooth(45);this.smile=new Smooth(60);this.volume=new Smooth(45);this.output=new Dwell(0,55);this.lastSwitch=0;this.floor=.005;this.speaking=false;this.lastVoice=0;}
  update(b,m,rms,now,{gain=1}={}){
    const g=k=>b[k]||0;
    // Learn a noise floor only when the mouth is closed, so speech does not raise the gate.
    if((m?.opening??0)<.045&&g('jawOpen')<.1)this.floor=this.floor*.985+Math.min(rms,.035)*.015;
    const level=this.volume.next(rms*gain,now),gate=Math.max(.006,this.floor*gain*2.3);
    if(level>gate*1.25){this.speaking=true;this.lastVoice=now;}else if(level<gate*.8&&now-this.lastVoice>120)this.speaking=false;
    const jaw=this.jaw.next(Math.max(g('jawOpen'),clamp(((m?.opening??0)-.025)*2.3,0,1)),now);
    const round=this.round.next(Math.max(g('mouthPucker'),g('mouthFunnel')),now);
    const smile=this.smile.next((g('mouthSmileLeft')+g('mouthSmileRight'))/2,now);
    let value=0;
    if(jaw>.09||this.speaking){
      if(round>.48)value=g('mouthPucker')>g('mouthFunnel')?12:11;
      else if(round>.24)value=10;
      else if(smile>.35&&jaw<.4)value=8;
      else if(jaw>.52)value=9;
      else if(jaw>.2)value=7;
      else if(g('mouthRollLower')>.35)value=4;
      else if(this.speaking)value=6;
    }
    // No transcript queue: recognition arrives too late to synchronize live speech.
    // A minimum hold prevents chatter without requiring a phoneme to remain unchanged
    // for several camera frames (which used to swallow short syllables entirely).
    if(value!==this.output.value&&(value===0||now-this.lastSwitch>=55)){this.output.value=value;this.lastSwitch=now;}
    const viseme=this.output.value;
    return {viseme,level,gate,jaw,amount:clamp(jaw*1.8,0,1),speaking:this.speaking};
  }
}
