const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class HairMotion {
  constructor(){this.angle=0;this.velocity=0;this.lift=0;this.liftVelocity=0;this.voice=0;this.head=0;}
  update(dt,time,{voice=0,head=0,strength=1,enabled=true}={}){
    dt=clamp(dt,0,.1);
    const speech=enabled?clamp(voice,0,1):0;
    this.voice+=(speech-this.voice)*(1-Math.exp(-dt/(speech>this.voice?.07:.35)));
    const turn=clamp(head,-1,1),inertia=clamp((turn-this.head)/Math.max(dt,.001),-3,3);this.head=turn;
    const scale=enabled?clamp(strength,0,2):0;
    // Low-amplitude, non-repeating idle motion; speech adds a soft syllable pulse.
    const idle=Math.sin(time*1.55)*.007+Math.sin(time*2.31+.8)*.003;
    const pulse=Math.sin(time*7.2)*.009*this.voice;
    const goal=scale*(idle*(1+this.voice*.65)+pulse-inertia*.0025);
    const liftGoal=scale*(Math.sin(time*1.8+.4)*.22+this.voice*(.2+Math.sin(time*7.2+.9)*.28));
    // Small integration steps keep the spring stable at both 15 and 60 FPS.
    const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;
    for(let i=0;i<steps;i++){
      this.velocity+=(80*(goal-this.angle)-15*this.velocity)*step;this.angle+=this.velocity*step;
      this.liftVelocity+=(65*(liftGoal-this.lift)-14*this.liftVelocity)*step;this.lift+=this.liftVelocity*step;
    }
    return {rotation:clamp(this.angle,-.045,.045),y:clamp(this.lift,-.9,.9),voice:this.voice};
  }
}
