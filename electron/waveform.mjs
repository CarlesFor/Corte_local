// Consume signed 16-bit PCM without keeping the decoded recording in memory.
export function createPeakAccumulator(channels,framesPerBin) {
  const peaks=[],samplesPerBin=channels*framesPerBin;
  let peak=0,samples=0,remainingByte=null;
  const sample=value=>{
    peak=Math.max(peak,Math.abs(value)/32768);
    if(++samples===samplesPerBin){peaks.push(Math.round(peak*10000)/10000);peak=0;samples=0;}
  };
  return {
    write(chunk) {
      let offset=0;
      if(remainingByte!==null&&chunk.length){
        const value=remainingByte|(chunk[0]<<8);
        sample(value>=32768?value-65536:value);offset=1;remainingByte=null;
      }
      for(;offset+1<chunk.length;offset+=2) sample(chunk.readInt16LE(offset));
      if(offset<chunk.length) remainingByte=chunk[offset];
    },
    finish() {if(samples){peaks.push(Math.round(peak*10000)/10000);samples=0;peak=0;}return peaks;}
  };
}
