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
// Drive the user's existing Rive targets from shoulder-relative elbow positions.
export function mapHands(_hands,pose,{mirror=true,aspect=.75}={}){
  const out={left:null,right:null};
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.55;
  if(!valid(pose?.[11])||!valid(pose?.[12]))return out;
  const width=Math.hypot(pose[11].x-pose[12].x,(pose[11].y-pose[12].y)*aspect);
  if(width<.08)return out;
  const mid=(pose[11].x+pose[12].x)/2,sign=mirror?-1:1,scale=294/(width*1.55);
  for(const [s,e] of [[11,13],[12,14]]){
    const shoulder=pose[s],elbow=pose[e];if(!valid(elbow))continue;
    const side=(shoulder.x-mid)*sign>0?'left':'right';
    out[side]={x:(elbow.x-shoulder.x)*sign*scale,y:(elbow.y-shoulder.y)*aspect*scale};
  }
  return out;
}
