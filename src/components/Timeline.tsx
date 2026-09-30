import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Layers, LockKeyhole, UnlockKeyhole, Volume2, VolumeX, Film, Music2, Type, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import type { Project, Clip, Track } from '../types';
import { duration } from '../../shared/project.mjs';
import { IconButton } from './Controls';
import Waveform from './Waveform';
type Props={project:Project;time:number;selected:string|null;zoom:number;seek:(t:number)=>void;select:(id:string)=>void;change:(p:Project)=>void;addTrack:(kind:Track['kind'])=>void;addMedia:(id:string,trackId:string,start:number)=>void;addOverlay:(id:string,start:number)=>void;dropFiles:(files:File[],trackId:string|undefined,start:number,overlay?:boolean)=>void;importOverlay:()=>void;importing:boolean;captionSelect:(id:string)=>void};
export default function Timeline({project:p,time,selected,zoom,seek,select,change,addTrack,addMedia,addOverlay,dropFiles,importOverlay,importing,captionSelect}:Props) {
  const scroll=useRef<HTMLDivElement>(null),[drag,setDrag]=useState<{id:string;start:number;duration:number;in:number;trackId:string}|null>(null);
  const [viewport,setViewport]=useState({left:0,width:1200});
  const [overOverlay,setOverOverlay]=useState(false);
  useEffect(()=>{
    const element=scroll.current!;
    const update=()=>setViewport({left:element.scrollLeft,width:Math.max(0,element.clientWidth-168)});
    const observer=new ResizeObserver(update);observer.observe(element);
    element.addEventListener('scroll',update,{passive:true});update();
    return()=>{observer.disconnect();element.removeEventListener('scroll',update);};
  },[]);
  const px=zoom,total=Math.max(20,duration(p)+5),width=Math.max(total*px,700);
  const getTime=(event:{clientX:number})=>{const el=scroll.current!;return Math.max(0,(event.clientX-el.getBoundingClientRect().left+el.scrollLeft-168)/px);};
  function snap(t:number,id:string) {const points=[0,time,...p.clips.filter(c=>c.id!==id).flatMap(c=>[c.start,c.start+c.duration])];let best=t,distance=7/px;for(const point of points) if(Math.abs(point-t)<distance){best=point;distance=Math.abs(point-t);}return Math.max(0,best);}
  function startDrag(e:React.PointerEvent,c:Clip,mode:'move'|'left'|'right') {
    e.stopPropagation();select(c.id);if(p.tracks.find(t=>t.id===c.trackId)?.locked)return;
    const originalX=e.clientX,originalY=e.clientY;let next={id:c.id,start:c.start,duration:c.duration,in:c.in,trackId:c.trackId};
    const move=(event:PointerEvent)=>{const delta=(event.clientX-originalX)/px;next={id:c.id,start:c.start,duration:c.duration,in:c.in,trackId:c.trackId};
      if(mode==='move'){next.start=snap(c.start+delta,c.id);const rows=Array.from(document.querySelectorAll<HTMLElement>('[data-track]'));const row=rows.find(r=>event.clientY>=r.getBoundingClientRect().top&&event.clientY<r.getBoundingClientRect().bottom);const target=p.tracks.find(t=>t.id===row?.dataset.track),source=p.tracks.find(t=>t.id===c.trackId);if(target&&source&&target.kind===source.kind&&!target.locked)next.trackId=target.id;}
      if(mode==='left'){const deltaT=Math.max(-c.in/c.speed,Math.min(c.duration-0.05,snap(c.start+delta,c.id)-c.start));next.start=c.start+deltaT;next.in=c.in+deltaT*c.speed;next.duration=c.duration-deltaT;}
      if(mode==='right'){const m=p.media.find(m=>m.id===c.mediaId);const max=m&&m.type!=='image'?(m.duration-c.in)/c.speed:86400;next.duration=Math.max(0.05,Math.min(max,snap(c.start+c.duration+delta,c.id)-c.start));}
      setDrag(next);
    };
    const up=(event:PointerEvent)=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);setDrag(null);if(Math.abs(event.clientX-originalX)<2&&Math.abs(event.clientY-originalY)<2)return;
      const project=structuredClone(p),clip=project.clips.find(x=>x.id===c.id)!;Object.assign(clip,next);delete (clip as any).id;clip.id=c.id;
      if(c.linkId){for(const sibling of project.clips.filter(x=>x.linkId===c.linkId&&x.id!==c.id)){sibling.start+=next.start-c.start;if(mode!=='move'){sibling.in+=next.in-c.in;sibling.duration=next.duration;}}}
      if(project.captions.length)project.captionStale=true;change(project);
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  }
  function trackChange(t:Track,patch:Partial<Track>) {const next=structuredClone(p);Object.assign(next.tracks.find(x=>x.id===t.id)!,patch);change(next);}
  function reorder(t:Track,delta:number) {const next=structuredClone(p),i=next.tracks.findIndex(x=>x.id===t.id);if(i+delta<0||i+delta>=next.tracks.length)return;[next.tracks[i],next.tracks[i+delta]]=[next.tracks[i+delta],next.tracks[i]];change(next);}
  return <div className="timeline-scroll" ref={scroll} onWheel={e=>{if(e.shiftKey&&scroll.current){scroll.current.scrollLeft+=e.deltaY;e.preventDefault();}}}>
    <div className="timeline-inner" style={{width:width+168}}>
      <div className="ruler" onPointerDown={e=>{seek(Math.min(duration(p),getTime(e)));const move=(event:PointerEvent)=>seek(Math.min(duration(p),getTime(event)));const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);}}><div className="ruler-label">PISTAS</div>{Array.from({length:Math.ceil(total/(px>50?1:5))},(_,i)=>i*(px>50?1:5)).map(t=><span key={t} style={{left:168+t*px}}>{Math.floor(t/60)}:{String(Math.floor(t%60)).padStart(2,'0')}</span>)}</div>
      <div className={`overlay-row ${overOverlay?'drag-over':''}`}>
        <div className="track-label"><button className="overlay-import" onClick={importOverlay} disabled={importing} title="Elegir un vídeo o una imagen para superponer en el cursor"><Layers size={14}/> Superponer</button><button className="new-video-track" title="Añadir pista de vídeo" aria-label="Añadir pista de vídeo" onClick={()=>{addTrack('video');scroll.current!.scrollTop=0;}}><Plus size={14}/></button></div>
        <div className="overlay-drop-zone" onDragOver={e=>{e.preventDefault();setOverOverlay(true);}} onDragLeave={()=>setOverOverlay(false)} onDrop={e=>{e.preventDefault();e.stopPropagation();setOverOverlay(false);const at=snap(getTime(e),'');const id=e.dataTransfer.getData('application/corte-media');if(id)addOverlay(id,at);else if(e.dataTransfer.files.length)dropFiles(Array.from(e.dataTransfer.files),undefined,at,true);}}><Layers size={12}/><span>Arrastra un vídeo o imagen aquí para crear una capa encima</span></div>
      </div>
      {p.tracks.map(t=><div className={`track-row ${t.kind}-track ${t.hidden?'hidden-track':''}`} key={t.id} data-track={t.id}>
        <div className="track-label"><div className="track-name">{t.kind==='video'?<Film size={14}/>:t.kind==='audio'?<Music2 size={14}/>:<Type size={14}/>}<span>{t.name}</span><div className="track-reorder"><button title="Subir pista" onClick={()=>reorder(t,-1)}><ChevronUp size={11}/></button><button title="Bajar pista" onClick={()=>reorder(t,1)}><ChevronDown size={11}/></button></div></div><div className="track-actions"><IconButton title={t.locked?'Desbloquear pista':'Bloquear pista'} onClick={()=>trackChange(t,{locked:!t.locked})}>{t.locked?<LockKeyhole size={12}/>:<UnlockKeyhole size={12}/>}</IconButton>{t.kind!=='audio'&&<IconButton title={t.hidden?'Mostrar pista':'Ocultar pista'} onClick={()=>trackChange(t,{hidden:!t.hidden})}>{t.hidden?<EyeOff size={12}/>:<Eye size={12}/>}</IconButton>}{t.kind!=='text'&&<IconButton title={t.muted?'Activar audio':'Silenciar pista'} onClick={()=>trackChange(t,{muted:!t.muted})}>{t.muted?<VolumeX size={12}/>:<Volume2 size={12}/>}</IconButton>}</div></div>
        <div className="track-content" onPointerDown={e=>{if(e.target===e.currentTarget)seek(Math.min(duration(p),getTime(e)));}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();if(t.locked)return;const at=snap(getTime(e),'');const id=e.dataTransfer.getData('application/corte-media');if(id)addMedia(id,t.id,at);else if(e.dataTransfer.files.length)dropFiles(Array.from(e.dataTransfer.files),t.id,at);}}>
          {p.clips.filter(c=>(drag?.id===c.id?drag.trackId:c.trackId)===t.id).map(c=>{const display=drag?.id===c.id?{...c,...drag}:c,m=p.media.find(m=>m.id===c.mediaId);return <div key={c.id} className={`timeline-clip ${t.kind} ${m?.waveform?.length?'has-waveform':''} ${selected===c.id?'selected':''} ${m?.missing?'missing':''}`} style={{left:display.start*px,width:Math.max(4,display.duration*px)}} onPointerDown={e=>startDrag(e,c,'move')}>
            {m?.thumbnail&&<div className="clip-thumb" style={{backgroundImage:`url("${m.thumbnail}")`}}/>}
            <div className="clip-title">{t.kind==='audio'?<Music2 size={12}/>:t.kind==='text'?<Type size={12}/>:<Film size={12}/>}<span>{c.text||c.name}</span>{c.speed!==1&&<b>{c.speed}×</b>}</div>
            {!!m?.waveform?.length&&<Waveform media={m} clip={display} zoom={px} viewport={viewport} muted={c.muted||t.muted}/>}
            {c.transition!=='none'&&<span className="transition-badge" style={{width:Math.min(30,c.transitionDuration*px)}}/>}
            <div className="trim-handle left" onPointerDown={e=>startDrag(e,c,'left')}/><div className="trim-handle right" onPointerDown={e=>startDrag(e,c,'right')}/>
          </div>;})}
          {!p.clips.some(c=>c.trackId===t.id)&&<span className="empty-track">{t.kind==='text'?'Añade un texto desde la barra de herramientas':'Arrastra un archivo aquí'}</span>}
        </div>
      </div>)}
      <div className="track-row caption-track"><div className="track-label"><div className="track-name"><span className="cc-small">CC</span><span>Subtítulos</span><b>{p.captions.length}</b></div></div><div className="track-content">{p.captions.map(c=><button className={`caption-clip ${selected===c.id?'selected':''}`} key={c.id} style={{left:c.start*px,width:Math.max(5,(c.end-c.start)*px)}} onClick={()=>{captionSelect(c.id);seek(c.start);}}>{c.text}</button>)}</div></div>
      <div className="add-track-row"><button onClick={()=>addTrack('video')}><Plus size={12}/> Vídeo</button><button onClick={()=>addTrack('audio')}><Plus size={12}/> Audio</button><button onClick={()=>addTrack('text')}><Plus size={12}/> Texto</button></div>
      <div className="playhead" style={{left:168+time*px}}><span/></div>
    </div>
  </div>;
}
