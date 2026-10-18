const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class HairMotion {
  constructor(){this.angle=0;this.velocity=0;this.lift=0;this.liftVelocity=0;this.voice=0;this.head=0;}
  update(dt,time,{voice=0,head=0,strength=1,enabled=true}={}){
    dt=clamp(dt,0,.1);
    const speech=enabled?clamp(voice,0,1):0;
    this.voice+=(speech-this.voice)*(1-Math.exp(-dt/(speech>this.voice?.06:.24)));
    const turn=clamp(head,-1,1),inertia=clamp((turn-this.head)/Math.max(dt,.001),-3,3);this.head=turn;
    const scale=enabled?clamp(strength,0,2):0;
    // Low-amplitude, non-repeating idle motion; speech adds a soft syllable pulse.
    const idle=Math.sin(time*1.45)*.012+Math.sin(time*2.17+.8)*.005;
    const pulse=Math.sin(time*8.6)*.014*this.voice;
    const goal=scale*(idle*(1+this.voice*.45)+pulse-inertia*.004);
    const liftGoal=scale*(Math.sin(time*1.7+.4)*.42+this.voice*(.28+Math.sin(time*8.6+.9)*.38));
    // Small integration steps keep the spring stable at both 15 and 60 FPS.
    const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;
    for(let i=0;i<steps;i++){
      this.velocity+=(80*(goal-this.angle)-15*this.velocity)*step;this.angle+=this.velocity*step;
      this.liftVelocity+=(65*(liftGoal-this.lift)-14*this.liftVelocity)*step;this.lift+=this.liftVelocity*step;
    }
    return {rotation:clamp(this.angle,-.065,.065),y:clamp(this.lift,-1.8,1.8),voice:this.voice};
  }
}
