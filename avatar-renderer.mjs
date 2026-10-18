import {HandMotion,worldToParent,limitReach} from './hand-tracking.mjs';
import {HairMotion} from './hair-motion.mjs';
import {rigPointer,PointerMotion} from './pointer-mapping.mjs';
// Keep the authored state machine/data bindings, then blend tracking poses before drawing.
export async function createAvatar(canvas, onState) {
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
  const renderer=runtime.makeRenderer(canvas),animations=new Map();
  function animation(name){if(!animations.has(name)){const a=artboard.animationByName(name);if(!a)throw Error('Missing animation '+name);animations.set(name,new runtime.LinearAnimationInstance(a,artboard));}return animations.get(name);}
  function apply(name,mix=1){const a=animation(name);a.time=0;a.advance(0);a.apply(mix);}
  const mouths=['idle ','L','R','Th','Fv','Ch.j.Sh','DGKNSTXYZ','A E I','Ee','Uh H Ah','O','Oo Uu W','Oo Uu W 2','wink ','shoking ','Angry'];
  const torso=artboard.node('body');
  const pointerNode=artboard.node('Head Pointer Target');
  const pointerCenter=pointerNode?{x:pointerNode.x,y:pointerNode.y}:{x:250,y:154};
  const pointer={available:!!pointerNode,source:'neutral',x:pointerCenter.x,y:pointerCenter.y,targetX:pointerCenter.x,targetY:pointerCenter.y,events:0};
  const pointerMotion=new PointerMotion();
  const hands={enabled:false,targets:{left:null,right:null},updatedAt:0,available:false,details:{}};
  artboard.advance(0);
  const handRig={};
  for(const side of ['left','right']){
    const node=artboard.node(side==='left'?'hand left':'hand  right');
    const shoulder=artboard.rootBone(side==='left'?'Left Arm Shoulder':'Right Arm Shoulder');
    if(node&&shoulder){const m=node.worldTransform();handRig[side]={node,shoulder,base:{x:node.x,y:node.y,r:node.rotation},rotation:node.rotation,motion:new HandMotion(m.tx,m.ty)};m.delete();}
  }
  hands.available=!!handRig.left&&!!handRig.right;
  const hair=artboard.node('Hair Motion'),hairMotion=new HairMotion();
  let hairBase=hair?{y:hair.y,rotation:hair.rotation}:null;
  let torsoBase=torso?{x:torso.x,y:torso.y,rotation:torso.rotation}:null;
  const target={enabled:false,x:0,y:0,pointerX:null,pointerY:null,pointerEnabled:true,viseme:0,opening:0,bodyX:0,bodyY:0,bodyRoll:0,bodyEnabled:true,voice:0,hairEnabled:true,hairStrength:1};
  let x=0,y=0,opening=0,last=0,disposed=false,raf,bodyX=0,bodyY=0,bodyRoll=0,selectedMouth=0,lastMouthSwitch=0;
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
    for(const rig of Object.values(handRig)){rig.node.x=rig.base.x;rig.node.y=rig.base.y;rig.node.rotation=rig.base.r;}
    if(pointer.available){
      const active=target.pointerEnabled&&target.enabled;
      const motion=pointerMotion.update(active?(target.pointerX??target.x):0,active?(target.pointerY??target.y):0,dt);
      // Camera capture must never fall back to the user's mouse cursor.
      // Match the editor's full artboard pointer travel, preserving its authored neutral.
      const point=rigPointer(motion.x,motion.y,pointerCenter,artboard.bounds);
      pointer.source=target.pointerEnabled?(target.enabled?(target.pointerX===null?'head':'face'):'neutral'):'off';
      pointer.x=point.x;pointer.y=point.y;
      machine.pointerMove(point.x,point.y,1);pointer.events++;
    }
    // Reset before the authored listener runs; resetting afterwards erases its pose.
    if(target.enabled)apply('RESET');
    machine.advanceAndApply(dt);
    if(machine.stateChangedCount()){const states=[];for(let i=0;i<machine.stateChangedCount();i++)states.push(machine.stateChangedNameByIndex(i));onState(states);}
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
      const enabled=target.enabled&&target.bodyEnabled,follow=1-Math.exp(-dt/.16);
      bodyX+=((enabled?target.bodyX*12+x*3:0)-bodyX)*follow;
      bodyY+=((enabled?target.bodyY*6:0)-bodyY)*follow;
      bodyRoll+=((enabled?target.bodyRoll*.1+x*.022:0)-bodyRoll)*follow;
      torso.x+=bodyX;torso.y+=bodyY;torso.rotation+=bodyRoll;
    }
    if(hair){
      hairBase={y:hair.y,rotation:hair.rotation};
      const sway=hairMotion.update(dt,now/1000,{voice:target.voice,head:x,strength:target.hairStrength,enabled:target.hairEnabled});
      hair.y+=sway.y;hair.rotation+=sway.rotation;
    }
    artboard.advance(dt);
    for(const [side,rig] of Object.entries(handRig)){
      const {node,shoulder}=rig;
      rig.base={x:node.x,y:node.y,r:node.rotation};
      const sm=shoulder.worldTransform(),pm=new runtime.Mat2D(),rest=node.worldTransform();
      node.parentWorldTransform(pm);
      const anchor={x:sm.tx,y:sm.ty};
      const goal=hands.enabled&&now-hands.updatedAt<350?hands.targets[side]:null;
      apply('Camera '+(side==='left'?'Left':'Right')+' Bend '+(goal?.bendInverse?'B':'A'));
      const safe=goal?limitReach({x:(goal.relativeToRest?rest.tx:anchor.x)+goal.x,y:(goal.relativeToRest?rest.ty:anchor.y)+goal.y},anchor):{x:rest.tx,y:rest.ty};
      const smooth=rig.motion.update(safe,dt);
      const point=goal?limitReach(smooth,anchor):smooth;
      const local=worldToParent(point,pm);
      if(local){node.x=local.x;node.y=local.y;}
      let wanted=rig.base.r;
      if(goal&&Number.isFinite(goal.angle)){
        const direction=worldToParent({x:pm.tx-Math.cos(goal.angle),y:pm.ty-Math.sin(goal.angle)},pm);
        wanted=Math.atan2(direction.y,direction.x)-Math.atan2(-31.7285*node.scaleY,2.54745*node.scaleX);
      }
      const diff=Math.atan2(Math.sin(wanted-rig.rotation),Math.cos(wanted-rig.rotation));
      rig.rotation+=diff*(1-Math.exp(-dt/.075));node.rotation=rig.rotation;
      hands.details[side]={tracked:!!goal,world:point,local,anchor,reach:Math.hypot(point.x-anchor.x,point.y-anchor.y)};
      sm.delete();pm.delete();rest.delete();
    }
    artboard.advance(0);
    if(pointerNode){pointer.targetX=pointerNode.x;pointer.targetY=pointerNode.y;}
    renderer.clear();renderer.save();
    renderer.align(runtime.Fit.contain,runtime.Alignment.center,{minX:0,minY:0,maxX:canvas.width,maxY:canvas.height},artboard.bounds);
    artboard.draw(renderer);renderer.restore();metrics.drawMs=metrics.drawMs*.9+(performance.now()-start)*.1;raf=runtime.requestAnimationFrame(frame);
  }
  raf=runtime.requestAnimationFrame(frame);
  return {loaded:true,target,metrics,pointer,hands,hairAvailable:!!hair,bodyAvailable:!!torso,number:name=>instance.number(name),resizeDrawingSurfaceToCanvas:resize,dispose(){disposed=true;runtime.cancelAnimationFrame(raf);observer.disconnect();for(const a of animations.values())a.delete();machine.delete();artboard.delete();renderer.delete();instance.unref();file.unref();}};
}
