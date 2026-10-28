import {BodyMotion} from './body-motion.mjs';
import {HairMotion} from './hair-motion.mjs';
import {rigPointer,PointerMotion,CAMERA_RIG} from './pointer-mapping.mjs';
// Keep the authored state machine/data bindings, then blend tracking poses before drawing.
export async function createAvatar(canvas, onState, onPose=()=>{}) {
  const base=new URL('./vendor/',import.meta.url).href;
  const {default:initialize}=await import(base+'canvas_advanced.mjs');
  const wasm=await fetch(base+'runtime.wasm');if(!wasm.ok)throw Error('Local Rive runtime unavailable');
  const runtime=await initialize({locateFile:file=>base+file,wasmBinary:await wasm.arrayBuffer()});
  const response=await fetch('vtuber.riv');if(!response.ok)throw Error('Avatar file unavailable');
  const file=await runtime.load(new Uint8Array(await response.arrayBuffer()));
  const artboard=file.artboardByName('character');
  const machine=new runtime.StateMachineInstance(artboard.stateMachineByName('State Machine 1'),artboard);
  const model=file.viewModelByName('main '),instance=model.instanceByName('Room')||model.defaultInstance()||model.instance();
  artboard.bindViewModelInstance(instance);machine.bindViewModelInstance(instance);
  const poseNames=['Guide','hey','peace sign','perfect','win'];
  const poseTriggers=new Map(poseNames.map(name=>{const property=instance.trigger(name);if(!property)throw Error('Missing pose trigger '+name);return [name,property];}));
  const poseStates=new Set(['guide 1','guide -1','hey 1','hey -1','peace sign 1','peace sign -1','perfect','perfect -1','winning ','winning  -1']);
  let pendingPose=null;
  const poses={active:null,queued:null,request(name){
    if(!poseTriggers.has(name))throw Error('Unknown pose '+name);
    if(this.active){this.queued=name;}else{this.active=name;pendingPose=name;}
    onPose(this.active,this.queued);
  }};
  const renderer=runtime.makeRenderer(canvas),animations=new Map();
  function animation(name){if(!animations.has(name)){const a=artboard.animationByName(name);if(!a)throw Error('Missing animation '+name);animations.set(name,new runtime.LinearAnimationInstance(a,artboard));}return animations.get(name);}
  function apply(name,mix=1){const a=animation(name);a.time=0;a.advance(0);a.apply(mix);}
  const mouths=['idle ','L','R','Th','Fv','Ch.j.Sh','DGKNSTXYZ','A E I','Ee','Uh H Ah','O','Oo Uu W','Oo Uu W 2','wink ','shoking ','Angry'];
  const torso=artboard.node('body'),bodyMotion=new BodyMotion();
  const pointerNode=artboard.node('Head Pointer Target');
  const pointerCenter=CAMERA_RIG.center;
  const pointer={available:!!pointerNode,source:'neutral',x:pointerCenter.x,y:pointerCenter.y,targetX:pointerCenter.x,targetY:pointerCenter.y,events:0};
  const pointerMotion=new PointerMotion();
  const hair=artboard.node('Hair Motion'),hairMotion=new HairMotion();
  let hairBase=hair?{y:hair.y,rotation:hair.rotation}:null;
  let torsoBase=torso?{x:torso.x,y:torso.y,rotation:torso.rotation}:null;
  const target={enabled:false,x:0,y:0,pointerX:null,pointerY:null,pointerEnabled:true,viseme:0,opening:0,bodyX:0,bodyY:0,bodyRoll:0,bodyEnabled:true,voice:0,hairEnabled:true,hairStrength:1};
  let x=0,y=0,opening=0,last=0,disposed=false,raf,selectedMouth=0,lastMouthSwitch=0;
  const metrics={fps:0,drawMs:0};let frames=0,metricTime=0;
  const resize=()=>{const dpr=Math.min(1.25,devicePixelRatio||1,Math.sqrt(1000000/Math.max(1,canvas.clientWidth*canvas.clientHeight)));canvas.width=Math.max(1,Math.round(canvas.clientWidth*dpr));canvas.height=Math.max(1,Math.round(canvas.clientHeight*dpr));};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function frame(now){
    if(disposed)return;
    // Smooth display interpolation when drawing is cheap; preserve camera budget otherwise.
    if(last&&now-last<(metrics.drawMs<9?15:30)){raf=runtime.requestAnimationFrame(frame);return;}
    const start=performance.now();
    if(!metricTime)metricTime=now;
    frames++;if(now-metricTime>=1000){metrics.fps=frames*1000/(now-metricTime);frames=0;metricTime=now;}
    const dt=Math.min(.05,last?(now-last)/1000:1/60);last=now;
    // Remove last frame's procedural offset before advancing authored animations.
    if(torso&&torsoBase){torso.x=torsoBase.x;torso.y=torsoBase.y;torso.rotation=torsoBase.rotation;}
    if(hair&&hairBase){hair.y=hairBase.y;hair.rotation=hairBase.rotation;}
    if(pointer.available){
      const active=target.pointerEnabled&&target.enabled;
      const motion=pointerMotion.update(active?(target.pointerX??target.x):0,active?(target.pointerY??target.y):0,dt);
      // Camera capture must never fall back to the user's mouse cursor.
      // Match the editor's full artboard pointer travel, preserving its authored neutral.
      const point=rigPointer(motion.x,motion.y,pointerCenter,CAMERA_RIG.bounds);
      pointer.source=target.pointerEnabled?(target.enabled?(target.pointerX===null?'head':'face'):'neutral'):'off';
      pointer.x=point.x;pointer.y=point.y;
      machine.pointerMove(point.x,point.y,1);pointer.events++;
    }
    // Reset before the authored listener runs; resetting afterwards erases its pose.
    if(target.enabled)apply('RESET');
    // The authored return-to-rest transition can take a few ticks to accept a trigger.
    // Keep the request pending until the state machine acknowledges a pose state.
    if(pendingPose){instance.trigger(pendingPose).trigger();}
    machine.advanceAndApply(dt);
    if(machine.stateChangedCount()){
      const states=[];for(let i=0;i<machine.stateChangedCount();i++)states.push(machine.stateChangedNameByIndex(i));
      onState(states);
      if(states.some(state=>poseStates.has(state)))pendingPose=null;
      if(states.includes('still')&&!states.some(state=>poseStates.has(state))){
        poses.active=null;const next=poses.queued;poses.queued=null;
        if(next)poses.request(next);else onPose(null,null);
      }
    }
    if(target.enabled){
      const a=1-Math.exp(-dt/.065);x+=(target.x-x)*a;y+=(target.y-y)*a;opening+=(target.opening-opening)*(1-Math.exp(-dt/.035));
      // The mouth drawings have separate teeth/tongue/visibility keys. Mixing
      // their geometry creates hybrid mouths. Apply exactly ONE authored shape.
      const wanted=target.viseme>=13?target.viseme:opening<.1?0:target.viseme;
      if(wanted!==selectedMouth&&(wanted===0||now-lastMouthSwitch>65)){selectedMouth=wanted;lastMouthSwitch=now;}
      apply('idle ');if(selectedMouth!==0)apply(mouths[selectedMouth]);
    }
    if(torso){
      torsoBase={x:torso.x,y:torso.y,rotation:torso.rotation};
      const motion=bodyMotion.update(dt,{enabled:target.enabled&&target.bodyEnabled,x:target.bodyX,y:target.bodyY,roll:target.bodyRoll,head:x});
      torso.x+=motion.x;torso.y+=motion.y;torso.rotation+=motion.rotation;
    }
    if(hair){
      hairBase={y:hair.y,rotation:hair.rotation};
      const sway=hairMotion.update(dt,now/1000,{voice:target.voice,head:x,strength:target.hairStrength,enabled:target.hairEnabled});
      hair.y+=sway.y;hair.rotation+=sway.rotation;
    }
    artboard.advance(dt);
    if(pointerNode){pointer.targetX=pointerNode.x;pointer.targetY=pointerNode.y;}
    renderer.clear();renderer.save();
    renderer.align(runtime.Fit.contain,runtime.Alignment.center,{minX:0,minY:0,maxX:canvas.width,maxY:canvas.height},CAMERA_RIG.bounds);
    artboard.draw(renderer);renderer.restore();metrics.drawMs=metrics.drawMs*.9+(performance.now()-start)*.1;raf=runtime.requestAnimationFrame(frame);
  }
  raf=runtime.requestAnimationFrame(frame);
  return {loaded:true,target,metrics,pointer,poses,hairAvailable:!!hair,bodyAvailable:!!torso,number:name=>instance.number(name),resizeDrawingSurfaceToCanvas:resize,dispose(){disposed=true;runtime.cancelAnimationFrame(raf);observer.disconnect();for(const a of animations.values())a.delete();machine.delete();artboard.delete();renderer.delete();instance.unref();file.unref();}};
}
