export const uid = () => globalThis.crypto.randomUUID();
export const presets = [
  { name: 'Clásico', style: { color: '#ffffff', outline: 3, outlineColor: '#000000' } },
  { name: 'Bold redes', style: { color: '#ffffff', bold: true, size: 68, outline: 5 } },
  { name: 'Caja blanca', style: { color: '#151515', outline: 0, background: '#ffffff', backgroundOpacity: 1 } },
  { name: 'Caja oscura', style: { outline: 0, background: '#000000', backgroundOpacity: 0.75 } },
  { name: 'Amarillo', style: { color: '#ffe15a', bold: true, outline: 4 } },
  { name: 'Minimalista', style: { outline: 0, shadow: 2, size: 44 } }
];
export const defaultStyle = () => ({ font: 'Inter', size: 54, color: '#ffffff', bold: true, italic: false, outline: 3, outlineColor: '#000000', shadow: 0, background: '#000000', backgroundOpacity: 0, padding: 10, align: 'center', x: 0.5, y: 0.88, spacing: 0 });
export function newProject() {
  return { version: 1, id: uid(), name: 'Mi proyecto', width: 1920, height: 1080, fps: 30, media: [],
    tracks: [{ id: uid(), name: 'Vídeo 1', kind: 'video', hidden: false, muted: false, locked: false }, { id: uid(), name: 'Audio 1', kind: 'audio', hidden: false, muted: false, locked: false }, { id: uid(), name: 'Textos', kind: 'text', hidden: false, muted: false, locked: false }],
    clips: [], captions: [], captionStyle: defaultStyle(), captionStale: false, background: '#111111' };
}
export function newClip(media, trackId, start = 0) {
  return { id: uid(), mediaId: media?.id, trackId, name: media?.name || 'Texto', start, in: 0, duration: media?.type === 'image' ? 5 : media?.duration || 5, speed: 1, x: 0, y: 0, scale: 1, rotation: 0, fit: 'contain', opacity: 1, brightness: 0, contrast: 1, saturation: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, transition: 'none', transitionDuration: 0.5 };
}
export const duration = p => Math.max(0, ...p.clips.map(c => c.start + c.duration), ...p.captions.map(c => c.end));
export function splitClip(project, id, at) {
  const p = structuredClone(project), c = p.clips.find(c => c.id === id);
  if (!c || at <= c.start + 0.02 || at >= c.start + c.duration - 0.02 || p.tracks.find(t => t.id === c.trackId)?.locked) return project;
  const group = c.linkId ? p.clips.filter(x=>x.linkId===c.linkId) : [c];
  if(group.some(x=>p.tracks.find(t=>t.id===x.trackId)?.locked))return project;
  const secondLink = group.length > 1 ? uid() : undefined;
  for (const x of group) {
    if (at <= x.start || at >= x.start+x.duration) continue;
    const left = at - x.start;
    p.clips.push({ ...structuredClone(x), id: uid(), start: at, in: x.in + left * x.speed, duration: x.duration - left, fadeIn: 0, linkId: secondLink });
    x.duration = left; x.fadeOut = 0;
  }
  if (p.captions.length) p.captionStale = true;
  return p;
}
export function deleteClip(project, id, ripple = false) {
  const p = structuredClone(project), c = p.clips.find(c => c.id === id);
  if (!c || p.tracks.find(t=>t.id===c.trackId)?.locked) return project;
  const ids = c.linkId ? p.clips.filter(x=>x.linkId===c.linkId).map(x=>x.id) : [id];
  if(p.clips.some(x=>ids.includes(x.id)&&p.tracks.find(t=>t.id===x.trackId)?.locked))return project;
  p.clips = p.clips.filter(x=>!ids.includes(x.id));
  if (ripple) { for (const x of p.clips) if (x.start >= c.start+c.duration-0.001&&!p.tracks.find(t=>t.id===x.trackId)?.locked) x.start -= c.duration;
    p.captions = p.captions.filter(x=>x.end<=c.start || x.start>=c.start+c.duration).map(x=>x.start>=c.start+c.duration ? {...x,start:x.start-c.duration,end:x.end-c.duration}:x); }
  if (p.captions.length) p.captionStale = true;
  return p;
}
export function clipOpacity(c, time) {
  const local = time-c.start;
  let alpha = c.opacity;
  if (c.transition === 'black') alpha *= Math.min(1, Math.max(0, local/c.transitionDuration), Math.max(0,(c.duration-local)/c.transitionDuration));
  if (c.transition === 'dissolve') alpha *= Math.min(1, Math.max(0,local/c.transitionDuration));
  return alpha;
}
export function validateProject(p) {
  if (!p || p.version !== 1 || !Array.isArray(p.clips) || !Array.isArray(p.tracks) || !Array.isArray(p.media) || !Array.isArray(p.captions)) throw new Error('Proyecto incompatible o dañado.');
  if (!Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width<16 || p.height<16 || p.width>4096 || p.height>4096 || ![24,25,30,60].includes(p.fps)) throw new Error('Dimensiones o frecuencia no válidas.');
  if (p.clips.length>5000 || p.captions.length>20000) throw new Error('Proyecto demasiado grande.');
  if(!/^#[0-9a-f]{6}$/i.test(p.background)||typeof p.name!=='string'||typeof p.id!=='string') throw new Error('Datos del proyecto no válidos.');
  const ids=new Set();for(const t of p.tracks){if(!t||typeof t.id!=='string'||ids.has(t.id)||!['video','audio','text'].includes(t.kind))throw new Error('Pista no válida.');ids.add(t.id);}
  for(const m of p.media)if(!m||typeof m.id!=='string'||typeof m.path!=='string'||!['video','audio','image'].includes(m.type))throw new Error('Medio no válido.');
  for (const c of p.clips) {
    for (const k of ['start','in','duration','speed','x','y','scale','rotation','opacity','volume','brightness','contrast','saturation','fadeIn','fadeOut','transitionDuration']) if (!Number.isFinite(c[k])) throw new Error('Un clip contiene valores no válidos.');
    if (c.start<0 || c.in<0 || c.duration<=0 || c.speed<0.25 || c.speed>4 || c.scale<0.05 || c.scale>10 || c.opacity<0 || c.opacity>1 || c.volume<0 || c.volume>4 || !p.tracks.some(t=>t.id===c.trackId) || (c.mediaId&&!p.media.some(m=>m.id===c.mediaId))) throw new Error('Un clip contiene una referencia o duración no válida.');
    if(c.style) validateStyle(c.style);
  }
  validateStyle(p.captionStyle);
  for (const c of p.captions) if (!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||typeof c.text!=='string') throw new Error('Subtítulo no válido.'); else if(c.style) validateStyle(c.style);
  return p;
}
function validateStyle(s) {
  if(!s || typeof s.font!=='string' || /[\r\n,]/.test(s.font)) throw new Error('Fuente no válida.');
  for(const k of ['size','outline','shadow','backgroundOpacity','padding','x','y','spacing']) if(!Number.isFinite(s[k])) throw new Error('Estilo no válido.');
  for(const k of ['color','outlineColor','background']) if(!/^#[0-9a-f]{6}$/i.test(s[k])) throw new Error('Color no válido.');
}
export function timecode(t, fps = 30) { const s = Math.max(0,t); return [Math.floor(s/3600), Math.floor(s/60)%60, Math.floor(s)%60].map(x=>String(x).padStart(2,'0')).join(':') + ':' + String(Math.floor((s%1)*fps)).padStart(2,'0'); }
const stamp = (t, ass = false) => { const ms = Math.round(Math.max(0,t)*(ass?100:1000)), unit=ass?100:1000; return `${ass?Math.floor(ms/unit/3600):String(Math.floor(ms/unit/3600)).padStart(2,'0')}:${String(Math.floor(ms/unit/60)%60).padStart(2,'0')}:${String(Math.floor(ms/unit)%60).padStart(2,'0')}${ass?'.':','}${String(ms%unit).padStart(ass?2:3,'0')}`; };
export function toSrt(captions) { return [...captions].sort((a,b)=>a.start-b.start).map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'); }
export function parseSrt(text) {
  const cues=[];
  for(const block of text.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/)) {
    const lines=block.split('\n'), index=lines.findIndex(x=>x.includes('-->')); if(index<0) continue;
    const m=lines[index].match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{3})/); if(!m) continue;
    const t = offset=>Number(m[offset])*3600+Number(m[offset+1])*60+Number(m[offset+2])+Number(m[offset+3])/1000;
    if(t(5)>t(1)) cues.push({id:uid(),start:t(1),end:t(5),text:lines.slice(index+1).join('\n').replace(/<[^>]+>/g,'')});
  }
  return cues;
}
const assColor = (hex, opacity=1) => `&H${Math.round((1-opacity)*255).toString(16).padStart(2,'0')}${hex.slice(5,7)}${hex.slice(3,5)}${hex.slice(1,3)}`.toUpperCase();
const escapeAss = s => s.replace(/\\/g,'\\\\').replace(/{/g,'\\{').replace(/}/g,'\\}').replace(/\r?\n/g,'\\N');
export function wrapCaption(text,max=38) {
  if(text.includes('\n')) return text;
  const words=text.split(/\s+/), lines=[]; let line='';
  for(const word of words) { if(line.length+word.length+1>max && line) {lines.push(line);line=word;} else line+=(line?' ':'')+word; }
  if(line) lines.push(line); return lines.join('\n');
}
export function segmentCaption(cue,max=38) {
  const lines=wrapCaption(cue.text.replace(/\s+/g,' ').trim(),max).split('\n'),chunks=[];
  for(let i=0;i<lines.length;i+=2)chunks.push(lines.slice(i,i+2).join('\n'));
  const total=chunks.reduce((n,s)=>n+s.length,0);let position=cue.start;
  return chunks.map((text,i)=>{const start=position;position=i===chunks.length-1?cue.end:position+(cue.end-cue.start)*text.length/total;return {...cue,id:uid(),text,start,end:position};});
}
export function toAss(project, { captions=true, texts=true }={}) {
  const styles=[],events=[];
  function add(c,s,layer) {
    const name=`S${styles.length}`, align=s.align==='left'?1:s.align==='right'?3:2;
    if(s.backgroundOpacity>0) {
      const bg=`${name}bg`;
      styles.push(`Style: ${bg},${s.font},${s.size},${assColor(s.color,0)},${assColor(s.color,0)},${assColor(s.background,s.backgroundOpacity)},${assColor(s.background,s.backgroundOpacity)},${s.bold?-1:0},${s.italic?-1:0},0,0,100,100,${s.spacing},0,3,${s.padding},0,${align},0,0,0,1`);
      events.push(`Dialogue: ${layer},${stamp(c.start,true)},${stamp(c.end,true)},${bg},,0,0,0,,{\\pos(${Math.round(s.x*project.width)},${Math.round(s.y*project.height)})}${escapeAss(c.text)}`);
    }
    styles.push(`Style: ${name},${s.font},${s.size},${assColor(s.color)},${assColor(s.color)},${assColor(s.outlineColor)},${assColor('#000000')},${s.bold?-1:0},${s.italic?-1:0},0,0,100,100,${s.spacing},0,1,${s.outline},${s.shadow},${align},0,0,0,1`);
    events.push(`Dialogue: ${layer+1},${stamp(c.start,true)},${stamp(c.end,true)},${name},,0,0,0,,{\\pos(${Math.round(s.x*project.width)},${Math.round(s.y*project.height)})}${escapeAss(c.text)}`);
  }
  if(texts) for(const c of project.clips) if(c.text && !project.tracks.find(t=>t.id===c.trackId)?.hidden) add({start:c.start,end:c.start+c.duration,text:c.text},c.style||defaultStyle(),10);
  if(captions) for(const c of project.captions) add(c,c.style||project.captionStyle,20);
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${project.width}\nPlayResY: ${project.height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${styles.join('\n')}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`;
}
