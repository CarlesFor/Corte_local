// Each display column covers its actual interval in the original recording.
// Taking the maximum keeps short sounds visible when the timeline is zoomed out.
export function waveformColumns(peaks,step,start,end,count) {
  if(!peaks.length||step<=0||end<=start||count<=0)return [];
  const columns=[],span=(end-start)/count;
  for(let column=0;column<count;column++) {
    const from=Math.max(0,Math.floor((start+column*span)/step+1e-8));
    const to=Math.min(peaks.length,Math.ceil((start+(column+1)*span)/step-1e-8));
    let peak=0;
    for(let i=from;i<to;i++)peak=Math.max(peak,peaks[i]);
    columns.push(peak);
  }
  return columns;
}

export function waveformGain(peaks) {
  let max=0;
  for(const peak of peaks)max=Math.max(max,peak);
  // A single gain for the whole source keeps cuts comparable; don't amplify silence.
  return max>0?Math.min(8,0.9/max):1;
}
