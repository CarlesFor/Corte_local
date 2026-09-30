import { useEffect, useRef, useState } from 'react';
import { Film, Move, Volume2 } from 'lucide-react';
import type { Project, Clip, Status } from '../types';
import { clipOpacity, toAss } from '../../shared/project.mjs';
// @ts-expect-error libass-wasm is a UMD module without TypeScript declarations.
import SubtitlesOctopus from 'libass-wasm/dist/js/subtitles-octopus.js';
const workerUrl = new URL('libass/subtitles-octopus-worker.js',window.location.href).href;
const fallbackFont = new URL('libass/default.woff2',window.location.href).href;
type Props={project:Project;time:number;playing:boolean;selected:string|null;status:Status|null;select:(id:string)=>void;updateClip:(id:string,patch:Partial<Clip>)=>void;preview:{url:string;start:number;end:number}|null;seek:(t:number)=>void;pause:()=>void;onError:(message:string)=>void};
export default function Preview({project:p,time,playing,selected,status,select,updateClip,preview,seek,pause,onError}:Props) {
  const outer=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<any>(null),medias=useRef(new Map<string,HTMLMediaElement>()),[size,setSize]=useState({w:640,h:360}),[peak,setPeak]=useState(0),exact=useRef<HTMLVideoElement>(null),currentTime=useRef(time);currentTime.current=time;
  const analyser=useRef<AnalyserNode|null>(null),audioContext=useRef<AudioContext|null>(null),audioSources=useRef(new WeakMap<HTMLMediaElement,MediaElementAudioSourceNode>());
  const pendingPlayback=useRef(new WeakSet<HTMLMediaElement>());
  useEffect(()=>{const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect,ratio=p.width/p.height;const w=Math.min(r.width-64,(r.height-40)*ratio);setSize({w:Math.max(1,w),h:Math.max(1,w/ratio)});});if(outer.current)observer.observe(outer.current);return()=>observer.disconnect();},[p.width,p.height]);
  const ass=toAss(p);
  const requiredFonts=[...new Set([p.captionStyle.font,...p.captions.map(c=>c.style?.font),...p.clips.map(c=>c.style?.font)])].filter(Boolean);
  const fontUrls=status?.fonts.filter(f=>requiredFonts.includes(f.name)).map(f=>f.url)||[];
  const fontKey=fontUrls.join('|');
  useEffect(()=>{if(!canvas.current)return;let instance:any;try{instance=new SubtitlesOctopus({canvas:canvas.current,subContent:ass,workerUrl,fallbackFont,fonts:fontUrls,targetFps:30,libassMemoryLimit:64,libassGlyphLimit:16,onReady:()=>instance.setCurrentTime(currentTime.current),onError:()=>onError('No se pudo cargar el visor de subtítulos. Usa «Vista renderizada» para comprobarlos.')});renderer.current=instance;}catch(e){onError((e as Error).message);}return()=>{instance?.dispose();renderer.current=null;};},[fontKey]);
  useEffect(()=>{if(renderer.current?.worker){renderer.current.setTrack(ass);renderer.current.setCurrentTime(currentTime.current);}},[ass]);
  useEffect(()=>{if(canvas.current){canvas.current.width=Math.round(size.w);canvas.current.height=Math.round(size.h);if(renderer.current?.worker)renderer.current.resize(size.w,size.h);}},[size]);
  useEffect(()=>{if(renderer.current?.worker)renderer.current.setCurrentTime(time);},[time]);
  const ratio=size.w/p.width;
  const visible=p.clips.filter(c=>{const t=p.tracks.find(t=>t.id===c.trackId);return t?.kind==='video'&&!t.hidden&&time>=c.start&&time<c.start+c.duration&&p.media.find(m=>m.id===c.mediaId)?.type!=='audio';}).sort((a,b)=>p.tracks.findIndex(t=>t.id===b.trackId)-p.tracks.findIndex(t=>t.id===a.trackId)||a.start-b.start);
  useEffect(()=>{
    for(const [id,element] of medias.current) {const c=p.clips.find(c=>c.id===id);if(!c)continue;const track=p.tracks.find(t=>t.id===c.trackId)!;const active=time>=c.start&&time<c.start+c.duration;
      const source=p.media.find(m=>m.id===c.mediaId),target=c.in+Math.max(0,time-c.start)*c.speed;
      if(active&&Number.isFinite(element.duration)&&(!playing||!element.seeking)&&Math.abs(element.currentTime-target)>(playing?0.2:0.025)) element.currentTime=Math.min(target,element.duration-0.001);
      element.playbackRate=c.speed;element.preservesPitch=true;
      const relative=time-c.start;let vol=c.muted||track.muted?0:c.volume;
      if(c.fadeIn>0)vol*=Math.min(1,Math.max(0,relative/c.fadeIn));if(c.fadeOut>0)vol*=Math.min(1,Math.max(0,(c.duration-relative)/c.fadeOut));
      element.volume=Math.max(0,Math.min(1,vol));
      if(playing&&active&&!source?.missing&&!preview){
        // Don't restart a pending play request or seek again before the last
        // frame has decoded. Several layers can otherwise keep interrupting it.
        if(element.paused&&!pendingPlayback.current.has(element)){
          pendingPlayback.current.add(element);
          element.play().catch(()=>{}).finally(()=>pendingPlayback.current.delete(element));
        }
        if(source?.hasAudio){try{if(!audioContext.current){audioContext.current=new AudioContext();analyser.current=audioContext.current.createAnalyser();analyser.current.fftSize=256;analyser.current.connect(audioContext.current.destination);}if(!audioSources.current.has(element)){const s=audioContext.current.createMediaElementSource(element);s.connect(analyser.current!);audioSources.current.set(element,s);}audioContext.current.resume();}catch{}}
      }else element.pause();
    }
  },[time,playing,p,preview]);
  useEffect(()=>{let frame:number;const tick=()=>{if(analyser.current){const bytes=new Uint8Array(analyser.current.fftSize);analyser.current.getByteTimeDomainData(bytes);setPeak(Math.max(...Array.from(bytes,x=>Math.abs(x-128)/128)));}frame=requestAnimationFrame(tick);};if(playing)frame=requestAnimationFrame(tick);else setPeak(0);return()=>cancelAnimationFrame(frame);},[playing]);
  useEffect(()=>()=>{audioContext.current?.close();},[]);
  useEffect(()=>{if(!exact.current||!preview)return;const el=exact.current;if(Math.abs(el.currentTime-(time-preview.start))>0.2)el.currentTime=Math.max(0,time-preview.start);if(playing)el.play().catch(()=>{});else el.pause();},[time,playing,preview]);
  function drag(e:React.PointerEvent,c:Clip) {select(c.id);if(p.tracks.find(t=>t.id===c.trackId)?.locked)return;e.preventDefault();const x=e.clientX,y=e.clientY;let dx=0,dy=0;const move=(event:PointerEvent)=>{dx=(event.clientX-x)/ratio;dy=(event.clientY-y)/ratio;const el=document.querySelector<HTMLElement>(`[data-preview="${c.id}"]`);if(el)el.style.transform=`translate(${(c.x+dx)*ratio}px,${(c.y+dy)*ratio}px) rotate(${c.rotation}deg)`;};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);if(dx||dy)updateClip(c.id,{x:c.x+dx,y:c.y+dy});};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);}
  return <div className="preview-wrap" ref={outer}>
    <div className="canvas-stage" style={{width:size.w,height:size.h,background:p.background}}>
      {p.clips.filter(c=>{const m=p.media.find(m=>m.id===c.mediaId);return m&&(m.type==='video'||m.type==='audio');}).map(c=>{const m=p.media.find(m=>m.id===c.mediaId)!;const visual=visible.some(v=>v.id===c.id),isVideo=m.type==='video',common={crossOrigin:'anonymous' as const,src:m.url,ref:(el:HTMLMediaElement|null)=>{if(el)medias.current.set(c.id,el);else medias.current.delete(c.id);},preload:'auto' as const,onLoadedMetadata:()=>{const el=medias.current.get(c.id);if(el)el.currentTime=Math.max(0,c.in+(time-c.start)*c.speed);}};
        const factor=c.fit==='cover'?Math.max(p.width/m.width,p.height/m.height):Math.min(p.width/m.width,p.height/m.height);const style={zIndex:visible.findIndex(v=>v.id===c.id)+1,width:m.width*factor*c.scale*ratio,height:m.height*factor*c.scale*ratio,transform:`translate(${c.x*ratio}px,${c.y*ratio}px) rotate(${c.rotation}deg)`,opacity:clipOpacity(c,time),filter:`brightness(${1+c.brightness}) contrast(${c.contrast}) saturate(${c.saturation})`,display:visual&&!preview?'block':'none'};
        return isVideo?<div key={c.id} className={`preview-layer ${selected===c.id?'selected':''}`} data-preview={c.id} style={style} onPointerDown={e=>drag(e,c)}><video {...common} draggable={false}/>{selected===c.id&&<span className="layer-corner"/>}</div>:<audio key={c.id} {...common}/>;
      })}
      {visible.filter(c=>p.media.find(m=>m.id===c.mediaId)?.type==='image').map(c=>{const m=p.media.find(m=>m.id===c.mediaId)!,factor=c.fit==='cover'?Math.max(p.width/m.width,p.height/m.height):Math.min(p.width/m.width,p.height/m.height);return <div key={c.id} className={`preview-layer ${selected===c.id?'selected':''}`} data-preview={c.id} onPointerDown={e=>drag(e,c)} style={{zIndex:visible.findIndex(v=>v.id===c.id)+1,display:preview?'none':'block',width:m.width*factor*c.scale*ratio,height:m.height*factor*c.scale*ratio,transform:`translate(${c.x*ratio}px,${c.y*ratio}px) rotate(${c.rotation}deg)`,opacity:clipOpacity(c,time),filter:`brightness(${1+c.brightness}) contrast(${c.contrast}) saturate(${c.saturation})`}}><img src={m.url} draggable={false}/></div>;})}
      <canvas ref={canvas} className="subtitle-canvas" style={{display:preview?'none':'block'}}/>
      {preview&&<video ref={exact} className="exact-preview" src={preview.url} onEnded={()=>{pause();seek(preview.end);}}/>}
      {!p.clips.length&&!p.captions.length&&<div className="canvas-empty"><Film size={35} strokeWidth={1}/><span>Tu historia empieza aquí</span><small>Importa un vídeo para darle forma.</small></div>}
      {!preview&&p.clips.filter(c=>c.text&&time>=c.start&&time<c.start+c.duration&&!p.tracks.find(t=>t.id===c.trackId)?.hidden).map(c=><div key={c.id} title="Arrastra para mover el texto" className="text-hit" style={{left:`${(c.style?.x||0.5)*100}%`,top:`${(c.style?.y||0.5)*100}%`,width:Math.min(size.w*0.8,(c.text!.length*(c.style?.size||54)*0.5)*ratio),height:(c.style?.size||54)*ratio*1.5}} onPointerDown={e=>{e.stopPropagation();select(c.id);if(p.tracks.find(t=>t.id===c.trackId)?.locked)return;const rect=outer.current!.querySelector('.canvas-stage')!.getBoundingClientRect();const move=(event:PointerEvent)=>{const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));(e.target as HTMLElement).dataset.x=String(x);(e.target as HTMLElement).dataset.y=String(y);};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);const el=e.target as HTMLElement;if(el.dataset.x)updateClip(c.id,{style:{...c.style!,x:Number(el.dataset.x),y:Number(el.dataset.y)}});};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);}}>{selected===c.id&&<Move size={12}/>}</div>)}
    </div>
    <div className="preview-footnote"><span>{preview?'Vista renderizada · calidad de exportación':'Previsualización ligera'}</span><div className="audio-meter" title={peak>0.95?'Nivel alto de audio':'Nivel de audio'}><Volume2 size={12}/><span><i style={{width:`${peak*100}%`,background:peak>0.95?'#ff7c7c':undefined}}/></span></div></div>
  </div>;
}
