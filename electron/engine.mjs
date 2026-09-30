import fs from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { duration, toAss, uid, validateProject, segmentCaption } from '../shared/project.mjs';
import { createPeakAccumulator } from './waveform.mjs';
const require = createRequire(import.meta.url);
export const WHISPER_VERSION = 'v1.8.3';
const WHISPER_SHA = 'd824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d';
export const MODEL_NAMES = ['base','small','medium'];
const num = n => Number(n.toFixed(6)).toString();
export const filterPath = p => p.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"'\\''");

export function run(binary,args,{signal,onProgress,total=1,cwd,onStderr,onStdout}={}) {
  return new Promise((resolve,reject)=> {
    if(signal?.aborted) return reject(new Error('Tarea cancelada.'));
    const child=spawn(binary,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],cwd});
    let out='',err='',pending='';
    const abort=()=>child.kill(); signal?.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',chunk=>{ if(onStdout){onStdout(chunk);return;}const s=chunk.toString();out=(out+s).slice(-8000000);pending+=s;
      const lines=pending.split('\n');pending=lines.pop()||'';
      for(const line of lines) if(line.startsWith('out_time_us=')) onProgress?.(Math.min(0.99,Number(line.split('=')[1])/1000000/total));
    });
    child.stderr.on('data',chunk=>{err=(err+chunk.toString()).slice(-12000);onStderr?.(chunk.toString());});
    child.on('error',e=>{signal?.removeEventListener('abort',abort);reject(new Error(`No se pudo iniciar ${path.basename(binary)}: ${e.message}`));});
    child.on('close',code=>{signal?.removeEventListener('abort',abort); if(signal?.aborted) reject(new Error('Tarea cancelada.')); else if(code!==0) reject(new Error(`${path.basename(binary)}: ${err.slice(-2500) || `salida ${code}`}`)); else resolve(out); });
  });
}
export function locateEngines(resources='') {
  let npmFfmpeg='',npmFfprobe='';
  try {npmFfmpeg=require('ffmpeg-static');npmFfprobe=require('ffprobe-static').path;} catch {}
  const first=items=>items.find(x=>x&&existsSync(x))||'';
  return {ffmpeg:first([process.env.CORTE_FFMPEG,path.join(resources,'ffmpeg.exe'),npmFfmpeg,'C:/ffmpeg/ffmpeg.exe']),ffprobe:first([process.env.CORTE_FFPROBE,path.join(resources,'ffprobe.exe'),npmFfprobe,'C:/ffmpeg/ffprobe.exe'])};
}
export class Engine {
  constructor({dataDir,resources='',emit=()=>{},register=p=>p}) {
    this.dataDir=dataDir;this.cache=path.join(dataDir,'cache');this.fontsDir=path.join(dataDir,'fonts');this.resources=resources;
    this.emit=emit;this.register=register;this.jobs=new Map();Object.assign(this,locateEngines(resources));
  }
  async init() {await Promise.all([this.cache,this.fontsDir,path.join(this.dataDir,'models')].map(x=>fs.mkdir(x,{recursive:true})));}
  async whisperPath() {const candidates=[path.join(this.resources,'whisper','whisper-cli.exe'),path.join(this.dataDir,'whisper','whisper-cli.exe'),path.join(this.dataDir,'whisper','Release','whisper-cli.exe')];return candidates.find(existsSync)||'';}
  job(kind,operation) {
    if(this.jobs.size) throw new Error('Espera a que termine o cancela la tarea en curso.');
    const id=randomUUID(),controller=new AbortController();
    this.jobs.set(id,controller);
    const progress=(value,message)=>this.emit({id,kind,progress:value,message,state:'running'});
    setTimeout(async()=>{try {progress(0,'Preparando…');const result=await operation(controller.signal,progress);if(controller.signal.aborted) throw new Error('Tarea cancelada.');this.emit({id,kind,progress:1,message:'Completado',state:'done',result});}catch(e){this.emit({id,kind,progress:0,message:e.message,state:controller.signal.aborted?'cancelled':'error'});}finally{this.jobs.delete(id);}},30);
    return id;
  }
  cancel(id) {this.jobs.get(id)?.abort();}
  async probe(file) {if(!this.ffprobe) throw new Error('FFprobe no está instalado.');const stat=await fs.stat(file);if(!stat.isFile()) throw new Error('Selecciona un archivo.');return JSON.parse(await run(this.ffprobe,['-v','error','-show_format','-show_streams','-of','json',file]));}
  async importMedia(file,signal,progress=()=>{}) {
    if(!this.ffmpeg) throw new Error('FFmpeg no está instalado.');
    const info=await this.probe(file),video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
    const isImage=/\.(png|jpe?g|webp)$/i.test(file); const type=isImage?'image':video?'video':audio?'audio':null;
    if(!type) throw new Error(`Formato no compatible: ${path.basename(file)}`);
    const stat=await fs.stat(file),hash=createHash('sha256').update(`${file}:${stat.size}:${stat.mtimeMs}`).digest('hex').slice(0,24);
    const media={id:uid(),path:file,name:path.basename(file),type,duration:isImage?5:Number(info.format.duration||video?.duration||audio?.duration||0),width:video?.width||0,height:video?.height||0,hasAudio:!!audio,originalUrl:this.register(file),url:this.register(file)};
    if(!Number.isFinite(media.duration)||media.duration<=0) throw new Error('No se pudo determinar la duración del archivo.');
    // FFprobe reports coded dimensions; auto-rotation applies to proxies and export.
    const rotation=Number(video?.side_data_list?.find(x=>x.rotation!==undefined)?.rotation||video?.tags?.rotate||0);
    if(Math.abs(rotation)%180===90) [media.width,media.height]=[media.height,media.width];
    if(type==='video') {
      const proxy=path.join(this.cache,`${hash}.mp4`),thumb=path.join(this.cache,`${hash}.jpg`);
      if(!existsSync(proxy)) {progress(0.05,`Preparando ${media.name}`);const tmp=proxy+'.partial.mp4';try {await run(this.ffmpeg,['-y','-v','error','-i',file,'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(960,iw)':h='min(540,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",'-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-threads','2','-movflags','+faststart','-progress','pipe:1',tmp],{signal,total:media.duration,onProgress:p=>progress(p,`Preparando ${media.name}`)});await fs.rename(tmp,proxy);}finally{await fs.rm(tmp,{force:true});}}
      media.url=this.register(proxy);
      if(!existsSync(thumb)) await run(this.ffmpeg,['-y','-v','error','-ss',num(Math.min(0.5,media.duration/2)),'-i',proxy,'-frames:v','1','-vf','scale=320:-2',thumb],{signal});
      media.thumbnail=this.register(thumb);
    } else if(type==='image') media.thumbnail=media.url;
    if(audio) {
      // Version the cache: the former 100 Hz PCM discarded speech frequencies.
      // Decode normal-rate PCM and stream peaks, retaining at most 360,000 bins.
      const raw=path.join(this.cache,`${hash}.wave-v2.json`);
      let envelope;
      if(existsSync(raw)) envelope=JSON.parse(await fs.readFile(raw,'utf8'));
      else {
        progress(0.99,`Analizando el audio de ${media.name}`);
        const sampleRate=16000,channels=Math.max(1,Math.min(8,audio.channels||1));
        const framesPerBin=Math.max(160,Math.ceil(media.duration*sampleRate/360000));
        const accumulator=createPeakAccumulator(channels,framesPerBin);
        // Keep channels separate so opposite stereo phases cannot cancel the waveform.
        // first_pts=0 preserves any initial silence before a delayed audio stream.
        await run(this.ffmpeg,['-v','error','-i',file,'-map','0:a:0','-vn','-af','aresample=async=1:first_pts=0','-ac',String(channels),'-ar',String(sampleRate),'-t',num(media.duration),'-f','s16le','pipe:1'],{signal,onStdout:chunk=>accumulator.write(chunk)});
        envelope={step:framesPerBin/sampleRate,peaks:accumulator.finish()};
        const temporary=raw+'.partial';
        try {await fs.writeFile(temporary,JSON.stringify(envelope));await fs.rename(temporary,raw);}
        finally {await fs.rm(temporary,{force:true});}
      }
      media.waveform=envelope.peaks;
      media.waveformStep=envelope.step;
    }
    return media;
  }
  audioGraph(project,inputs,{tracks=null,normalize=false}={}) {
    const filters=[],labels=[];const total=duration(project);
    for(const {c,m,index} of inputs) {
      const track=project.tracks.find(t=>t.id===c.trackId);
      if(!m.hasAudio||c.muted||track.muted|| (tracks&&!tracks.includes(c.trackId))) continue;
      const name=`a${index}`,tempo=[];let speed=c.speed;
      while(speed>2){tempo.push('atempo=2');speed/=2;}while(speed<0.5){tempo.push('atempo=0.5');speed/=0.5;}tempo.push(`atempo=${num(speed)}`);
      let f=`[${index}:a]atrim=start=${num(c.in)}:duration=${num(c.duration*c.speed)},asetpts=PTS-STARTPTS,${tempo.join(',')},aresample=48000,volume=${num(c.volume)}`;
      if(c.fadeIn>0) f+=`,afade=t=in:st=0:d=${num(Math.min(c.duration,c.fadeIn))}`;
      if(c.fadeOut>0) f+=`,afade=t=out:st=${num(Math.max(0,c.duration-c.fadeOut))}:d=${num(Math.min(c.duration,c.fadeOut))}`;
      f+=`,adelay=${Math.round(c.start*1000)}:all=1,asetpts=N/SR/TB[${name}]`;filters.push(f);labels.push(`[${name}]`);
    }
    if(labels.length) filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0,apad,atrim=duration=${num(total)}${normalize?',loudnorm=I=-16:TP=-1.5:LRA=11':''}[audio]`);
    else filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${num(total)}[audio]`);
    return filters;
  }
  inputs(project) {
    const inputs=[],args=[];
    for(const c of project.clips) {const m=project.media.find(m=>m.id===c.mediaId);if(!m) continue;
      if(m.missing||!existsSync(m.path)) throw new Error(`Archivo ausente: ${m.name}. Localízalo en la biblioteca.`);
      const index=inputs.length;
      if(m.type==='image') args.push('-loop','1','-framerate',String(project.fps),'-t',num(c.duration*c.speed));
      args.push('-i',m.path);inputs.push({c,m,index});
    }
    return {inputs,args};
  }
  async render(project,options,output,{signal,progress=()=>{},audioOnly=false,tracks=null}={}) {
    validateProject(project);if(!this.ffmpeg) throw new Error('FFmpeg no está disponible.');
    if(!audioOnly&&this.fontCatalog){const families=new Set([project.captionStyle.font,...project.captions.map(c=>c.style?.font),...project.clips.map(c=>c.style?.font)]);for(const font of this.fontCatalog)if(families.has(font.name)){const dest=path.join(this.fontsDir,path.basename(font.path));if(path.resolve(dest)!==path.resolve(font.path))await fs.copyFile(font.path,dest);}}
    const total=duration(project);if(total<=0) throw new Error('Añade al menos un clip o subtítulo.');
    const start=options.start??0,end=options.end??total;
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>total+0.02) throw new Error('Intervalo de exportación no válido.');
    const {inputs,args}=this.inputs(project),filters=this.audioGraph(project,inputs,{tracks,normalize:options.normalize});
    const temporary=path.join(this.cache,`render-${randomUUID()}`);await fs.mkdir(temporary,{recursive:true});
    try {
      if(!audioOnly) {
        const fps=options.fps||project.fps;
        const edge=options.height||Math.min(project.width,project.height),height=project.width<project.height&&!options.preview?Math.round(edge*project.height/project.width/2)*2:edge,width=Math.round(project.width/project.height*height/2)*2;
        filters.push(`color=c=${project.background.replace('#','0x')}:s=${project.width}x${project.height}:r=${fps}:d=${num(total)},format=rgba[base]`);
        let previous='base',count=0;
        const order=[...inputs].sort((a,b)=>project.tracks.findIndex(t=>t.id===b.c.trackId)-project.tracks.findIndex(t=>t.id===a.c.trackId)||a.c.start-b.c.start);
        for(const {c,m,index} of order) {
          const track=project.tracks.find(t=>t.id===c.trackId);if(track.kind!=='video'||track.hidden||m.type==='audio') continue;
          const boundW=Math.max(2,Math.round(project.width*c.scale/2)*2),boundH=Math.max(2,Math.round(project.height*c.scale/2)*2);
          let f=`[${index}:v]trim=start=${num(c.in)}:duration=${num(c.duration*c.speed)},setpts=(PTS-STARTPTS)/${num(c.speed)},fps=${fps},scale=${boundW}:${boundH}:force_original_aspect_ratio=${c.fit==='cover'?'increase':'decrease'}:force_divisible_by=2,setsar=1`;
          if(c.fit==='cover') f+=`,crop=${boundW}:${boundH}`;
          f+=`,eq=brightness=${num(c.brightness)}:contrast=${num(c.contrast)}:saturation=${num(c.saturation)},format=rgba`;
          if(c.rotation) f+=`,rotate=${num(c.rotation*Math.PI/180)}:ow=ceil(rotw(iw)/2)*2:oh=ceil(roth(ih)/2)*2:c=none`;
          f+=`,colorchannelmixer=aa=${num(c.opacity)}`;
          if(c.transition==='black'||c.transition==='dissolve') {f+=`,fade=t=in:st=0:d=${num(Math.min(c.transitionDuration,c.duration))}:alpha=1`;if(c.transition==='black') f+=`,fade=t=out:st=${num(Math.max(0,c.duration-c.transitionDuration))}:d=${num(Math.min(c.transitionDuration,c.duration))}:alpha=1`;}
          f+=`,setpts=PTS+${num(c.start)}/TB[v${index}]`;filters.push(f);
          const next=`comp${count++}`;filters.push(`[${previous}][v${index}]overlay=x=(W-w)/2+${num(c.x)}:y=(H-h)/2+${num(c.y)}:enable='gte(t,${num(c.start)})*lt(t,${num(c.start+c.duration)})':eof_action=pass:repeatlast=0:format=auto[${next}]`);previous=next;
        }
        const ass=toAss(project,{captions:options.burnCaptions!==false});
        await fs.writeFile(path.join(temporary,'titles.ass'),ass,'utf8');
        // Run in the temporary directory, avoiding escaping arbitrary subtitle filenames.
        filters.push(`[${previous}]ass=filename=titles.ass:fontsdir='${filterPath(this.fontsDir)}',scale=${width}:${height},setsar=1,format=yuv420p[video]`);
      }
      await fs.writeFile(path.join(temporary,'graph.txt'),filters.join(';\n'));
      const cmd=['-y','-v','error','-filter_complex_threads','2',...args,'-filter_complex_script','graph.txt'];
      if(!audioOnly) cmd.push('-map','[video]','-map','[audio]','-c:v','libx264','-preset',options.preview?'ultrafast':'medium','-crf',options.preview?'25':options.quality==='high'?'18':'23','-threads','2','-c:a','aac','-b:a','192k','-movflags','+faststart');
      else cmd.push('-map','[audio]','-ac','1','-ar','16000','-c:a','pcm_s16le');
      cmd.push('-ss',num(start),'-t',num(end-start),'-progress','pipe:1',output);
      await run(this.ffmpeg,cmd,{cwd:temporary,signal,total:end-start,onProgress:p=>progress(p,audioOnly?'Preparando voz…':'Renderizando vídeo…')});
    } finally {await fs.rm(temporary,{recursive:true,force:true});}
    return output;
  }
  async transcribe(project,model,tracks,start,end,signal,progress) {
    if(!MODEL_NAMES.includes(model)) throw new Error('Modelo no válido.');
    const whisper=await this.whisperPath(),modelFile=path.join(this.dataDir,'models',`ggml-${model}.bin`);
    if(!whisper||!existsSync(modelFile)) throw new Error('Instala el motor y descarga el modelo en Ajustes.');
    const sources=project.clips.filter(c=>tracks.includes(c.trackId)&&!c.muted&&!project.tracks.find(t=>t.id===c.trackId)?.muted&&project.media.find(m=>m.id===c.mediaId)?.hasAudio);
    if(!sources.length) throw new Error('Las pistas seleccionadas no contienen audio de voz activo.');
    const folder=path.join(this.cache,`speech-${randomUUID()}`);await fs.mkdir(folder,{recursive:true});
    try {
      const wav=path.join(folder,'voice.wav');await this.render(project,{start,end},wav,{signal,audioOnly:true,tracks,progress:p=>progress(p*0.15,'Preparando voz…')});
      progress(0.15,'Reconociendo voz en español…');
      await run(whisper,['-m',modelFile,'-f',wav,'-l','es','-t',String(Math.max(1,Math.min(6,os.cpus().length-1))),'-oj','-of',path.join(folder,'captions'),'-pp','-ml',project.width<project.height?'52':'76','-sow','-ng'],{signal,onStderr:s=>{const m=s.match(/progress\s*=\s*(\d+)%/);if(m) progress(0.15+Number(m[1])/100*0.85,'Reconociendo voz en español…');}});
      const data=JSON.parse(await fs.readFile(path.join(folder,'captions.json'),'utf8'));
      return (data.transcription||[]).filter(c=>c.text?.trim()&&!/^\s*\[[^\]]+\]\s*$/.test(c.text)).map(c=>({id:uid(),start:start+c.offsets.from/1000,end:Math.min(end,start+c.offsets.to/1000),text:c.text.trim()})).filter(c=>c.end>c.start).flatMap(c=>segmentCaption(c,project.width<project.height?26:38));
    } finally {await fs.rm(folder,{recursive:true,force:true});}
  }
  async cacheSize() {const walk=async dir=>{let size=0;for(const entry of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);size+=entry.isDirectory()?await walk(f):(await fs.stat(f)).size;}return size;};return Math.round(await walk(this.cache)/1024/1024);}
  async clearCache() {if(this.jobs.size) throw new Error('Espera a que terminen las tareas antes de limpiar la caché.');await fs.rm(this.cache,{recursive:true,force:true});await fs.mkdir(this.cache,{recursive:true});}
  async installWhisper(signal,progress) {
    const archive=path.join(this.cache,'whisper.zip'),dest=path.join(this.dataDir,'whisper');
    await downloadVerified(`https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_VERSION}/whisper-bin-x64.zip`,archive,WHISPER_SHA,signal,progress);
    const AdmZip=require('adm-zip'),zip=new AdmZip(archive);
    await fs.mkdir(dest,{recursive:true});
    // Extract only executables and their DLLs into a flat, controlled directory.
    for(const entry of zip.getEntries()) if(!entry.isDirectory&&/\.(exe|dll)$/i.test(entry.entryName)) await fs.writeFile(path.join(dest,path.basename(entry.entryName)),entry.getData());
    await fs.writeFile(path.join(dest,'VERSION'),WHISPER_VERSION);await fs.rm(archive,{force:true});
    if(!await this.whisperPath()) throw new Error('El paquete no contiene whisper-cli.exe.');
    return 'Motor Whisper instalado';
  }
  async downloadModel(model,signal,progress) {
    if(!MODEL_NAMES.includes(model)) throw new Error('Modelo no válido.');
    progress(0,'Consultando modelo oficial…');
    const response=await fetch('https://huggingface.co/api/models/ggerganov/whisper.cpp?blobs=true',{signal});if(!response.ok) throw new Error(`No se pudo consultar el modelo (${response.status}).`);
    const info=await response.json(),file=info.siblings.find(s=>s.rfilename===`ggml-${model}.bin`);
    if(!file?.lfs?.sha256||!info.sha) throw new Error('El proveedor no ofrece la huella de integridad del modelo.');
    await downloadVerified(`https://huggingface.co/ggerganov/whisper.cpp/resolve/${info.sha}/ggml-${model}.bin`,path.join(this.dataDir,'models',`ggml-${model}.bin`),file.lfs.sha256,signal,progress);
    return `Modelo ${model} instalado`;
  }
}
export async function downloadVerified(url,target,sha,signal,progress=()=>{}) {
  const temp=target+'.partial';await fs.mkdir(path.dirname(target),{recursive:true});
  let writer;
  try {
    const response=await fetch(url,{signal});if(!response.ok||!response.body) throw new Error(`Descarga fallida (${response.status}). Comprueba la conexión.`);
    const size=Number(response.headers.get('content-length')||0),hash=createHash('sha256');let received=0;
    writer=createWriteStream(temp);let writeError;writer.on('error',e=>{writeError=e;});
    for await(const chunk of response.body) {if(signal?.aborted) throw new Error('Tarea cancelada.');hash.update(chunk);received+=chunk.length;
      if(writeError) throw writeError;if(!writer.write(chunk)) await once(writer,'drain');
      progress(size?Math.min(0.99,received/size):0,`Descargando… ${Math.round(received/1024/1024)} MB`);
    }
    await new Promise((resolve,reject)=>{writer.once('error',reject);writer.end(resolve);});writer=null;
    if(hash.digest('hex')!==sha.toLowerCase()) throw new Error('La descarga no supera la comprobación de integridad. Inténtalo de nuevo.');
    await fs.rename(temp,target);
  } finally {if(writer){writer.destroy();await new Promise(resolve=>writer.once('close',resolve));}await fs.rm(temp,{force:true});}
}
