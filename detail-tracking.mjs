const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Native chain: upper arm 134.5 + forearm 144.1 + wrist 31.8 = 310.4 units.
export const ARM_REACH=300;
export function eyeGaze(points,blendshapes={}){
  if(!points?.[477])return null;
  function eye(cornerA,cornerB,top,bottom,iris,blink){
    const a=points[cornerA],b=points[cornerB],p=points[iris];
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(len<.005||(blendshapes[blink]||0)>.65)return null;
    const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    const x=((p.x-cx)*dx+(p.y-cy)*dy)/(len*len);
    const vertical=((p.y-cy)*dx-(p.x-cx)*dy)/(len*len);
    const opening=Math.hypot(points[top].x-points[bottom].x,points[top].y-points[bottom].y)/len;
    if(opening<.07)return null;
    return {x:clamp(x*5,-1,1),y:clamp(vertical*7,-1,1)};
  }
  return {right:eye(33,133,159,145,468,'eyeBlinkRight'),left:eye(362,263,386,374,473,'eyeBlinkLeft')};
}
export function handTargets(result,pose,{flipX=false,aspect=.75,fallbackFace=null,previous={}}={}){
  const targets={left:null,right:null};
  const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.55;
  if(!visible(pose?.[11])||!visible(pose?.[12])){
    // Close-up framing: use calibrated, fixed proportions rather than noisy live face size.
    if(!fallbackFace?.span)return targets;
    const span=fallbackFace.span,length=span*5.7;
    const used=new Set();
    for(const landmarks of result?.landmarks||[]){
      const wrist=landmarks?.[0];if(!visible(wrist))continue;
      const screenRight=(wrist.x-fallbackFace.x)*(flipX?-1:1)>0;
      let side=screenRight?'left':'right';
      const nearby=['left','right'].filter(s=>!used.has(s)&&Number.isFinite(previous[s]?.cameraX)).map(s=>({side:s,d:Math.hypot(wrist.x-previous[s].cameraX,wrist.y-previous[s].cameraY)})).sort((a,b)=>a.d-b.d);
      if(nearby[0]?.d<.25)side=nearby[0].side;
      if(used.has(side))side=side==='left'?'right':'left';used.add(side);
      const shoulderX=fallbackFace.x+(side==='left'?1:-1)*(flipX?-1:1)*span*1.9;
      const shoulderY=fallbackFace.y+span*2.4/aspect;
      targets[side]={x:(wrist.x-shoulderX)*(flipX?-1:1)*ARM_REACH/length,y:(wrist.y-shoulderY)*aspect*ARM_REACH/length,relative:true,cameraX:wrist.x,cameraY:wrist.y};
    }
    return targets;
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*aspect);
  const width=distance(pose[11],pose[12]);if(width<.08)return targets;
  const arms=[[11,13,15],[12,14,16]].map(([s,e,w])=>({shoulder:pose[s],elbow:pose[e],wrist:pose[w],hand:null}));
  // Match hands to the body's wrists, never to a mirrored handedness label.
  const hands=(result?.landmarks||[]).map(p=>p?.[0]).filter(p=>visible(p)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
  if(hands.length>=2){
    const direct=distance(hands[0],arms[0].wrist)+distance(hands[1],arms[1].wrist);
    const swapped=distance(hands[1],arms[0].wrist)+distance(hands[0],arms[1].wrist);
    arms[0].hand=hands[direct<=swapped?0:1];arms[1].hand=hands[direct<=swapped?1:0];
  }else if(hands.length===1){
    const first=distance(hands[0],arms[0].wrist),second=distance(hands[0],arms[1].wrist);
    arms[first<=second?0:1].hand=hands[0];
  }
  const center=(pose[11].x+pose[12].x)/2;
  for(const arm of arms){
    const {shoulder,elbow}=arm,wrist=arm.hand||(visible(arm.wrist)?arm.wrist:null);
    if(!wrist||wrist.x<0||wrist.x>1||wrist.y<0||wrist.y>1)continue;
    const side=((shoulder.x-center)*(flipX?-1:1))<0?'right':'left';
    const measured=visible(elbow)&&visible(arm.wrist)?distance(shoulder,elbow)+distance(elbow,arm.wrist):width*1.4;
    const length=clamp(measured,width*1.05,width*1.8);
    const scale=ARM_REACH/length;
    targets[side]={x:(wrist.x-shoulder.x)*(flipX?-1:1)*scale,y:(wrist.y-shoulder.y)*aspect*scale,relative:true,cameraX:wrist.x,cameraY:wrist.y};
  }
  return targets;
}
export function armReach(point,shoulder,maxReach=ARM_REACH,minReach=65){
  const dx=point.x-shoulder.x,dy=point.y-shoulder.y,distance=Math.hypot(dx,dy);
  if(distance<.001)return {x:shoulder.x,y:shoulder.y+minReach};
  const reach=clamp(distance,minReach,maxReach);
  return {x:shoulder.x+dx/distance*reach,y:shoulder.y+dy/distance*reach};
}
export class HandMotion {
  constructor(x,y){this.x=x;this.y=y;this.tx=x;this.ty=y;this.vx=0;this.vy=0;}
  update(point,dt,active=true){
    dt=clamp(dt,0,.1);const omega=active?19:11,decay=Math.exp(-omega*dt);
    for(const axis of ['x','y']){
      const velocity='v'+axis;
      const t='t'+axis;
      if(Math.abs(point[axis]-this[t])>.65)this[t]+=clamp(point[axis]-this[t],-500*dt,500*dt);
      const desired=this[t];
      const offset=this[axis]-desired,c=this[velocity]+omega*offset;
      this[axis]=desired+(offset+c*dt)*decay;
      this[velocity]=(this[velocity]-omega*c*dt)*decay;
    }
    return {x:this.x,y:this.y};
  }
}
export function colorNumber(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Invalid background colour');
  return (0xff000000|parseInt(hex.slice(1),16))>>>0;
}
