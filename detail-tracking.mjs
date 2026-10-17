const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
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
export function handTargets(result,face,{flipX=false,referenceSpan=face?.span}={}){
  const targets={left:null,right:null};
  if(!result?.landmarks||!face||!Number.isFinite(face.span))return targets;
  for(let i=0;i<result.landmarks.length;i++){
    const hand=result.landmarks[i],label=result.handedness?.[i]?.[0];
    if(!hand?.[9]||!label||label.score<.75)continue;
    // The detector receives unmirrored camera frames. Mirror both position and side together.
    let side=label.categoryName==='Left'?'right':'left';
    if(flipX)side=side==='left'?'right':'left';
    const span=Math.max(.04,referenceSpan||face.span),wrist=hand[0];
    const x=(wrist.x-face.x)/span*44*(flipX?-1:1);
    const y=(wrist.y-face.y)/span*44;
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    targets[side]={x:clamp(250+x,20,480),y:clamp(132+y,70,530)};
  }
  return targets;
}
export function armReach(point,shoulder,maxReach=235,minReach=65){
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
