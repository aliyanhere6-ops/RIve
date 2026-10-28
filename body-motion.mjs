const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
// Preserve velocity between sparse shoulder samples, with no elastic bounce.
export class BodyMotion{
 constructor(){this.axes=Object.fromEntries(['x','y','rotation'].map(key=>[key,{value:0,velocity:0,goal:0}]));}
 update(dt,{enabled=false,x=0,y=0,roll=0,head=0}={}){
  dt=clamp(dt,0,.1);
  const goals=enabled?{x:clamp(x,-1,1)*12+clamp(head,-1,1)*3,y:clamp(y,-1,1)*6,rotation:clamp(roll,-1,1)*.1+clamp(head,-1,1)*.022}:{x:0,y:0,rotation:0};
  const limits={x:15,y:6,rotation:.122},noise={x:.12,y:.08,rotation:.0012},speeds={x:12,y:10,rotation:11};
  const out={};
  for(const key of Object.keys(this.axes)){
   const a=this.axes[key],goal=goals[key];
   if(!enabled||Math.abs(goal-a.goal)>noise[key])a.goal=goal;
   const w=speeds[key],decay=Math.exp(-w*dt),offset=a.value-a.goal,c=a.velocity+w*offset;
   a.value=a.goal+(offset+c*dt)*decay;a.velocity=(a.velocity-w*c*dt)*decay;
   a.value=clamp(a.value,-limits[key],limits[key]);out[key]=a.value;
  }
  return out;
 }
}
