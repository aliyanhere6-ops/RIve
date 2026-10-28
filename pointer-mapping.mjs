// Keep the original camera rig independent of later artboard/background resizing.
export const CAMERA_RIG={center:{x:250,y:154},bounds:{minX:0,minY:0,maxX:500,maxY:499}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// A critically damped follower preserves velocity between camera samples.
// Small landmark noise is ignored; large changes enter at a bounded speed.
export class PointerMotion {
  constructor(){this.x=0;this.y=0;this.vx=0;this.vy=0;this.tx=0;this.ty=0;}
  update(x,y,dt){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    const omega=26,decay=Math.exp(-omega*dt);
    for(const axis of ['x','y']){
      const value=axis==='x'?x:y;
      const desired=clamp(Number.isFinite(value)?value:0,-1,1);
      const t='t'+axis,v='v'+axis;
      if(Math.abs(desired-this[t])>.012)this[t]+=clamp(desired-this[t],-6*dt,6*dt);
      const offset=this[axis]-this[t],c=this[v]+omega*offset;
      this[axis]=this[t]+(offset+c*dt)*decay;
      this[v]=(this[v]-omega*c*dt)*decay;
    }
    return {x:this.x,y:this.y};
  }
}
// Intersect the original listener travel with this file's actual artboard.
// A small inset keeps edge hits reliable instead of sending the pointer outside the clip.
export function cameraPointerRig(artboard,neutral=CAMERA_RIG.center){
 const valid=artboard&&['minX','minY','maxX','maxY'].every(k=>Number.isFinite(artboard[k]))&&artboard.maxX>artboard.minX&&artboard.maxY>artboard.minY;
 const source=valid?artboard:CAMERA_RIG.bounds,inset=.5;
 const bounds={minX:Math.max(source.minX,CAMERA_RIG.bounds.minX)+inset,minY:Math.max(source.minY,CAMERA_RIG.bounds.minY)+inset,maxX:Math.min(source.maxX,CAMERA_RIG.bounds.maxX)-inset,maxY:Math.min(source.maxY,CAMERA_RIG.bounds.maxY)-inset};
 const center={x:clamp(Number.isFinite(neutral?.x)?neutral.x:CAMERA_RIG.center.x,bounds.minX,bounds.maxX),y:clamp(Number.isFinite(neutral?.y)?neutral.y:CAMERA_RIG.center.y,bounds.minY,bounds.maxY)};
 return {center,bounds};
}
export function facePointer(face,neutral,{flipX=false,flipY=false,sensitivity=1}={}){
  const span=Math.max(.04,neutral.span||.2);
  // Turning in place must move the pointer even when the eye center barely moves.
  const yaw=Number.isFinite(face.yaw)&&Number.isFinite(neutral.yaw)?(face.yaw-neutral.yaw)/.35:0;
  const pitch=Number.isFinite(face.pitch)&&Number.isFinite(neutral.pitch)?(face.pitch-neutral.pitch)/.3:0;
  const x=((face.x-neutral.x)/span*2+yaw)*sensitivity;
  const y=((face.y-neutral.y)/span*2+pitch)*sensitivity;
  return {x:clamp(Number.isFinite(x)?x:0,-1,1)*(flipX?-1:1),y:clamp(Number.isFinite(y)?y:0,-1,1)*(flipY?-1:1)};
}
export function headPointer(x,y,center={x:250,y:154},range={x:60,y:45}){
  return {x:center.x+clamp(Number.isFinite(x)?x:0,-1,1)*range.x,y:center.y+clamp(Number.isFinite(y)?y:0,-1,1)*range.y};
}
export function rigPointer(x,y,center,bounds){
  const axis=(value,origin,min,max)=>{
    const n=clamp(Number.isFinite(value)?value:0,-1,1);
    return origin+n*(n<0?origin-min:max-origin);
  };
  return {x:axis(x,center.x,bounds.minX,bounds.maxX),y:axis(y,center.y,bounds.minY,bounds.maxY)};
}
export function clientPointer(clientX,clientY,rect,bounds){
  const width=bounds.maxX-bounds.minX,height=bounds.maxY-bounds.minY;
  if(rect.width<=0||rect.height<=0||width<=0||height<=0)return null;
  const scale=Math.min(rect.width/width,rect.height/height);
  const left=rect.left+(rect.width-width*scale)/2,top=rect.top+(rect.height-height*scale)/2;
  return {x:clamp(bounds.minX+(clientX-left)/scale,bounds.minX,bounds.maxX),y:clamp(bounds.minY+(clientY-top)/scale,bounds.minY,bounds.maxY)};
}
