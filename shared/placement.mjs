import { newClip, uid } from './project.mjs';

/** @param {{trackId?:string,start?:number,overlay?:boolean}} options */
export function placeMedia(project,mediaId,options={}) {
  const {trackId,start,overlay=false}=options;
  const media=project.media.find(m=>m.id===mediaId);
  if(!media||media.missing)throw new Error('Localiza el archivo antes de añadirlo.');
  if(overlay&&media.type==='audio')throw new Error('Para superponer, elige un vídeo o una imagen.');
  const p=structuredClone(project),kind=media.type==='audio'?'audio':'video';
  let track;
  if(overlay) {
    track={id:uid(),name:`Vídeo ${p.tracks.filter(t=>t.kind==='video').length+1}`,kind:'video',hidden:false,muted:false,locked:false};
    p.tracks.unshift(track);
  } else if(trackId)track=p.tracks.find(t=>t.id===trackId);
  else {
    // Normal additions continue the base video, even after creating overlays.
    const candidates=p.tracks.filter(t=>t.kind===kind&&!t.locked&&!t.hidden);
    track=kind==='video'?candidates.at(-1):candidates[0];
    if(!track){track={id:uid(),name:kind==='audio'?'Audio':'Vídeo',kind,hidden:false,muted:false,locked:false};p.tracks.push(track);}
  }
  if(!track||track.locked||track.kind!==kind)throw new Error('Usa una pista del mismo tipo y que esté desbloqueada.');
  const at=start??Math.max(0,...p.clips.filter(c=>c.trackId===track.id).map(c=>c.start+c.duration));
  if(!Number.isFinite(at)||at<0)throw new Error('El inicio del clip no es válido.');
  p.clips.push(newClip(media,track.id,at));
  if(p.captions.length)p.captionStale=true;
  return p;
}

export function cornerPlacement(project,media) {
  const scale=0.35,margin=Math.min(project.width,project.height)*0.04;
  const factor=Math.min(project.width/media.width,project.height/media.height)*scale;
  return {scale,fit:'contain',rotation:0,x:project.width/2-media.width*factor/2-margin,y:project.height/2-media.height*factor/2-margin};
}
