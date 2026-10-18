const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function worldToParent(point,m){
  const d=m.xx*m.yy-m.xy*m.yx;if(Math.abs(d)<1e-8)return null;
  const x=point.x-m.tx,y=point.y-m.ty;
  return {x:(m.yy*x-m.yx*y)/d,y:(m.xx*y-m.xy*x)/d};
}
export function limitReach(point,shoulder,max=294,min=65){
  const x=point.x-shoulder.x,y=point.y-shoulder.y,d=Math.hypot(x,y);
  if(d<.001)return {x:shoulder.x,y:shoulder.y+min};
  const r=clamp(d,min,max);return {x:shoulder.x+x/d*r,y:shoulder.y+y/d*r};
}
export class HandMotion{
  constructor(x,y){this.x=x;this.y=y;this.vx=0;this.vy=0;}
  update(goal,dt){
    dt=clamp(dt,0,.05);const w=22,e=Math.exp(-w*dt);
    for(const k of ['x','y']){const v='v'+k,o=this[k]-goal[k],c=this[v]+w*o;this[k]=goal[k]+(o+c*dt)*e;this[v]=(this[v]-w*c*dt)*e;}
    return {x:this.x,y:this.y};
  }
}

// Retarget both arm segments independently, preserving the authored bone lengths.
export function mapHands(_hands,pose,{mirror=true,aspect=.75}={}){
 const out={left:null,right:null};
 const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.55;
 if(!valid(pose?.[11])||!valid(pose?.[12]))return out;
 const mid=(pose[11].x+pose[12].x)/2,sign=mirror?-1:1;
 const direction=(a,b)=>{const x=(b.x-a.x)*sign,y=(b.y-a.y)*aspect,d=Math.hypot(x,y);return d>.025?{x:x/d,y:y/d}:null;};
 for(const [s,e,w] of [[11,13,15],[12,14,16]]){
   if(!valid(pose[e])||!valid(pose[w]))continue;
   const upper=direction(pose[s],pose[e]),lower=direction(pose[e],pose[w]);if(!upper||!lower)continue;
   const side=(pose[s].x-mid)*sign>0?'left':'right';
   out[side]={x:upper.x*134.5048+lower.x*175.9123,y:upper.y*134.5048+lower.y*175.9123,angle:Math.atan2(lower.y,lower.x),upper,lower,bendInverse:(upper.x*lower.y-upper.y*lower.x)*(side==='left'?1:-1)<0};
 }
 return out;
}
export class ElbowTracker{
 constructor(){this.sides={};}
 update(pose,now,options={}){
   const measured=mapHands(null,pose,options),out={left:null,right:null};
   for(const side of ['left','right']){
     if(measured[side])this.sides[side]={last:now,output:measured[side]};
     const state=this.sides[side];if(state&&now-state.last<250)out[side]=state.output;
   }
   return out;
 }
}
