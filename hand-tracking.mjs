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
// Match each detected wrist to a body wrist; labels alone can swap during crossed hands.
export function mapHands(hands,pose,{mirror=true,aspect=.75}={}){
  const out={left:null,right:null};
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.55;
  if(!valid(pose?.[11])||!valid(pose?.[12]))return out;
  const dist=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*aspect);
  const width=dist(pose[11],pose[12]);if(width<.08)return out;
  const detected=(hands?.landmarks||[]).map(x=>x[0]).filter(valid);
  const arms=[[11,15],[12,16]].map(([s,w])=>({s:pose[s],w:pose[w],hand:null}));
  if(detected.length>=2){
    const direct=dist(detected[0],arms[0].w)+dist(detected[1],arms[1].w);
    const swap=dist(detected[1],arms[0].w)+dist(detected[0],arms[1].w);
    arms[0].hand=detected[direct<=swap?0:1];arms[1].hand=detected[direct<=swap?1:0];
  }else if(detected.length===1){arms[dist(detected[0],arms[0].w)<=dist(detected[0],arms[1].w)?0:1].hand=detected[0];}
  const mid=(pose[11].x+pose[12].x)/2,sign=mirror?-1:1;
  for(const a of arms){
    // Only a visible hand activates an arm; offscreen hands return to the authored rest.
    if(!a.hand||!valid(a.w)||dist(a.hand,a.w)>.3)continue;
    const side=(a.s.x-mid)*sign>0?'left':'right';
    const scale=294/(width*1.55);
    out[side]={x:(a.hand.x-a.s.x)*sign*scale,y:(a.hand.y-a.s.y)*aspect*scale};
  }
  return out;
}
