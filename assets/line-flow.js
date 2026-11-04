/* Visual process demonstration. Timing is illustrative, not a throughput simulation. */
(function(){
'use strict';
window.createLineFlow=function({T,scene,getState,notify,el,invalidate=()=>{}}){
  const layer=new T.Group(); scene.add(layer);
  const cloth=new T.MeshStandardMaterial({color:0xe8d6b0,roughness:.9});
  const core=new T.MeshStandardMaterial({color:0x796248,roughness:.8});
  const film=new T.MeshStandardMaterial({color:0xbfe9f2,transparent:true,opacity:.28,roughness:.2,metalness:.15,depthWrite:false});
  const band=new T.MeshStandardMaterial({color:0x398b88,roughness:.55});
  const shellGeo=new T.CylinderGeometry(142,142,900,32),bodyGeo=new T.CylinderGeometry(135,135,880,32),coreGeo=new T.CylinderGeometry(36,36,930,24);
  const ringGeo=new T.TorusGeometry(136,8,6,40);
  let running=false,elapsed=0,last=null,steps=[],rolls=[],active=-1,signature='',done=0;
  const point=(m,x,y,z)=>new T.Vector3(m.x+x*Math.cos(m.rot*Math.PI/180)+z*Math.sin(m.rot*Math.PI/180),y,m.z-x*Math.sin(m.rot*Math.PI/180)+z*Math.cos(m.rot*Math.PI/180));
  function clear(){ for(const r of rolls)layer.remove(r.root); rolls=[]; steps=[];active=-1;elapsed=0;done=0; }
  function stateKey(){return JSON.stringify(getState().mach);}
  function reset(message){invalidate();running=false;last=null;clear();el.play.textContent='▶ 播放流程';el.play.setAttribute('aria-pressed','false');el.status.textContent=message||'卷布 → 输送 → 热缩 → 包装 → 推布入框';el.progress.value=0;el.count.textContent='已入框 0 卷';}
  function makeRoll(){
    const root=new T.Group(),spin=new T.Group();root.add(spin);
    const body=new T.Mesh(bodyGeo,cloth);body.rotation.z=Math.PI/2;spin.add(body);
    const tube=new T.Mesh(coreGeo,core);tube.rotation.z=Math.PI/2;spin.add(tube);
    const wrap=new T.Mesh(shellGeo,film);wrap.rotation.z=Math.PI/2;wrap.visible=false;spin.add(wrap);
    const bands=new T.Group();for(const x of [-300,300]){const ring=new T.Mesh(ringGeo,band);ring.rotation.y=Math.PI/2;ring.position.x=x;bands.add(ring);}bands.visible=false;spin.add(bands);
    root.visible=false;layer.add(root);return {root,spin,body,wrap,bands};
  }
  function prepare(){
    clear();const machines=getState().mach,by=t=>machines.filter(m=>m.t===t).sort((a,b)=>a.x-b.x);
    const sources=by('inspect'),shrink=by('shrink')[0],pack=by('pack')[0],pushers=by('pusher'),carts=by('cart');
    const belts=by('conv').filter(m=>!m.o.push),input=belts.filter(m=>shrink&&m.x<shrink.x),output=belts.filter(m=>pack&&m.x>pack.x);
    if(!sources.length||!shrink||!pack||!pushers.length||!carts.length||!input.length||!output.length){notify('流程需要卷布工位、入布输送带、热缩机、包装机、出料输送带、推布机和布框。可先载入图示产线。');return false;}
    // This route follows the reference line; reject disconnected/reversed arbitrary layouts.
    if(shrink.x>=pack.x||pushers.some(m=>m.x<=pack.x)||[shrink,pack,...input,...output,...pushers].some(m=>Math.abs(m.rot%360)>0.1)||[...input,...output,...pushers].some(m=>Math.abs(m.z-pack.z)>600)){
      notify('请将输送带、热缩机、包装机和推布机按图示横向对齐后播放。');return false;
    }
    let cursor=0;const used=new Set();
    const add=(r,label,seconds,from,to,mode,angle0,angle1)=>{steps.push({r,label,start:cursor,end:cursor+seconds,from,to,mode,angle0,angle1});cursor+=seconds;};
    for(let i=0;i<Math.min(4,sources.length,pushers.length,carts.length);i++){
      const source=sources[i],pusher=pushers[i];
      const cart=carts.filter(c=>!used.has(c.id)).sort((a,b)=>Math.hypot(a.x-pusher.x,a.z-pusher.z)-Math.hypot(b.x-pusher.x,b.z-pusher.z))[0];used.add(cart.id);
      const r=makeRoll();rolls.push(r);const infeed=input.reduce((a,b)=>Math.abs(a.x-source.x)<Math.abs(b.x-source.x)?a:b);
      const winding=point(source,0,1080,580),feed=point(infeed,0,infeed.o.h+140,0),sa=source.rot*Math.PI/180;
      const se=point(shrink,-1050,855,0),sx=point(shrink,1050,855,0);
      const pe=point(pack,-1700,1000,0),pc=point(pack,0,1000,0),px=point(pack,1700,1000,0);
      const out=point(output[0],0,output[0].o.h+140,0),push=point(pusher,0,pusher.o.h+140,0);
      const above=point(cart,0,1260,0),inside=point(cart,0,420,0);
      add(r,'卷布工位 '+(i+1)+' · 成卷',3,winding,winding,'wind',sa,sa);
      add(r,'下卷转运 · 储布机预留区',2.5,winding,feed,'transfer',sa,0);
      // Roll axis stays along the conveyor (+x); side discharge translates without turning.
      add(r,'输送带 · 送往热缩机',Math.max(2,(se.x-feed.x)/2800),feed,se,'move',0,0);
      add(r,'热缩机 · 热缩处理',3,se,sx,'shrink',0,0);
      add(r,'接驳 · 进入包装机',1.5,sx,pe,'move',0,0);
      add(r,'包装机 · 进料',1.5,pe,pc,'move',0,0);
      add(r,'包装机 · 封装',2.5,pc,pc,'pack',0,0);
      add(r,'包装机 · 出料',1.5,pc,px,'move',0,0);
      add(r,'出料辊筒 · 输送',1.5,px,out,'move',0,0);
      add(r,'分拣输送 · 布框 '+(i+1),Math.max(2,(push.x-out.x)/2800),out,push,'move',0,0);
      add(r,'推布机 '+(i+1)+' · 横向推送',2,push,above,'push',0,0);
      add(r,'布框 '+(i+1)+' · 落料',1,above,inside,'drop',0,0);
    }
    signature=stateKey();return true;
  }
  function paint(){
    invalidate();
    const total=steps[steps.length-1].end;
    const index=steps.findIndex(s=>elapsed<s.end),s=steps[index<0?steps.length-1:index];
    // Finalize crossed steps, even at high playback speed or after a slow frame.
    const endIndex=index<0?steps.length:index;
    for(let j=active;j<endIndex;j++)if(j>=0){const q=steps[j];q.r.root.position.copy(q.to);q.r.root.rotation.y=q.angle1;q.r.body.scale.set(1,1,1);if(q.mode==='shrink')q.r.wrap.visible=true;if(q.mode==='pack')q.r.bands.visible=true;if(q.mode==='drop')done++;}
    if(index<0){active=steps.length;running=false;el.play.textContent='↻ 重播流程';el.play.setAttribute('aria-pressed','false');el.status.textContent='流程完成 · '+rolls.length+' 卷布已分别进入布框';el.progress.value=100;el.count.textContent='已入框 '+done+' 卷';return;}
    active=index;const t=Math.max(0,Math.min(1,(elapsed-s.start)/(s.end-s.start))),r=s.r;
    r.root.visible=true;r.root.position.lerpVectors(s.from,s.to,t);r.root.rotation.y=s.angle0+(s.angle1-s.angle0)*t;
    if(s.mode==='wind'){const k=.25+.75*t;r.body.scale.set(k,1,k);r.spin.rotation.x=t*Math.PI*12;}
    if(s.mode==='shrink')r.wrap.visible=t>.4;if(s.mode==='pack')r.bands.visible=t>.5;
    if(el.status.textContent!==s.label)el.status.textContent=s.label;el.progress.value=elapsed/total*100;const count='已入框 '+done+' / '+rolls.length+' 卷';if(el.count.textContent!==count)el.count.textContent=count;
  }
  function play(){
    invalidate();
    if(running){running=false;el.play.textContent='▶ 继续流程';el.play.setAttribute('aria-pressed','false');return;}
    if(!steps.length||elapsed>=steps[steps.length-1].end||signature!==stateKey()){if(!prepare())return;elapsed=0;}
    running=true;last=null;el.play.textContent='Ⅱ 暂停流程';el.play.setAttribute('aria-pressed','true');paint();
  }
  function update(now){
    if(running&&signature!==stateKey()){reset('布局已调整，点击播放重新生成流程');return;}
    if(!running||document.hidden){last=null;return;}
    if(last!==null)elapsed+=Math.min((now-last)/1000,.1)*(Number(el.speed.value)||1);last=now;paint();
  }
  el.play.onclick=play;el.reset.onclick=()=>reset();reset();return {update,reset,isRunning:()=>running};
};
})();
