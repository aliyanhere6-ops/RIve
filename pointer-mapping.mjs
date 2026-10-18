const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// A critically damped follower preserves velocity between camera samples.
// Small landmark noise is ignored; large changes enter at a bounded speed.
export class PointerMotion {
  constructor(){this.x=0;this.y=0;this.vx=0;this.vy=0;this.tx=0;this.ty=0;}
  update(x,y,dt){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    const omega=30,decay=Math.exp(-omega*dt);
    for(const axis of ['x','y']){
      const value=axis==='x'?x:y;
      const desired=clamp(Number.isFinite(value)?value:0,-1,1);
      const t='t'+axis,v='v'+axis;
      if(Math.abs(desired-this[t])>.01)this[t]+=clamp(desired-this[t],-9*dt,9*dt);
      const offset=this[axis]-this[t],c=this[v]+omega*offset;
      this[axis]=this[t]+(offset+c*dt)*decay;
      this[v]=(this[v]-omega*c*dt)*decay;
    }
    return {x:this.x,y:this.y};
  }
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
