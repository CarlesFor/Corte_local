import { memo, useMemo } from 'react';
import type { Clip, Media } from '../types';
import { waveformColumns, waveformGain } from '../../shared/waveform.mjs';

type Props={media:Media;clip:Clip;zoom:number;viewport:{left:number;width:number};muted:boolean};
function Waveform({media,clip,zoom,viewport,muted}:Props) {
  const peaks=media.waveform!;
  const gain=useMemo(()=>waveformGain(peaks),[peaks]);
  // Render only the visible part, with a small overscan. A long clip never creates
  // an enormous SVG or thousands of off-screen elements, even at maximum zoom.
  const clipLeft=clip.start*zoom;
  const left=Math.max(0,viewport.left-clipLeft-32);
  const right=Math.min(clip.duration*zoom,viewport.left+viewport.width-clipLeft+32);
  const width=Math.max(0,right-left),count=Math.ceil(width/2);
  const step=media.waveformStep||media.duration/peaks.length;
  const start=clip.in+left/zoom*clip.speed,end=clip.in+right/zoom*clip.speed;
  const bars=useMemo(()=>waveformColumns(peaks,step,start,end,count),[peaks,step,start,end,count]);
  const height=30,center=height/2;
  const shape=bars.map((peak,i)=>{
    const amplitude=Math.min(1,peak*gain)*(center-3);
    if(amplitude<0.4)return '';
    const x=(i+0.5)*width/count;
    return `M${x.toFixed(2)},${(center-amplitude).toFixed(2)}v${(2*amplitude).toFixed(2)}`;
  }).join('');
  return <div className={`waveform-band ${muted?'muted-waveform':''}`} role="img" aria-label={`Forma de onda del audio de ${media.name}${muted?' (silenciado)':''}`} title="Los tramos planos indican silencio. Amplía la línea de tiempo para ajustar los cortes.">
    {width>0&&<svg className="waveform" style={{left,width}} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line className="waveform-baseline" x1={0} x2={width} y1={center} y2={center}/>
      <path className="waveform-peaks" d={shape}/>
    </svg>}
  </div>;
}
export default memo(Waveform);
