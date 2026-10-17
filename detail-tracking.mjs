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
export function handTargets(result,face,{flipX=false}={}){
  const targets={left:null,right:null};
  if(!result?.landmarks||!face||!Number.isFinite(face.span))return targets;
  for(let i=0;i<result.landmarks.length;i++){
    const hand=result.landmarks[i],label=result.handedness?.[i]?.[0];
    if(!hand?.[9]||!label||label.score<.6)continue;
    // The detector receives unmirrored camera frames. Mirror both position and side together.
    let side=label.categoryName==='Left'?'right':'left';
    if(flipX)side=side==='left'?'right':'left';
    const span=Math.max(.04,face.span),wrist=hand[0],palm=hand[9];
    const x=(wrist.x-face.x)/span*44*(flipX?-1:1);
    const y=(wrist.y-face.y)/span*44;
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    targets[side]={x:clamp(250+x,10,490),y:clamp(132+y,15,550),rotation:clamp(Math.atan2((palm.x-wrist.x)*(flipX?-1:1),wrist.y-palm.y),-1.2,1.2)};
  }
  return targets;
}
export function colorNumber(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Invalid background colour');
  return (0xff000000|parseInt(hex.slice(1),16))>>>0;
}
