// Read the OpenType/TrueType name table without loading arbitrary executable code.
export function fontName(buffer) {
  if(buffer.length<12) return null;const count=buffer.readUInt16BE(4);let offset=0;
  for(let i=0;i<count;i++){const p=12+i*16;if(p+16>buffer.length)return null;if(buffer.toString('ascii',p,p+4)==='name'){offset=buffer.readUInt32BE(p+8);break;}}
  if(!offset||offset+6>buffer.length)return null;const n=buffer.readUInt16BE(offset+2),strings=offset+buffer.readUInt16BE(offset+4),names=[];
  for(let i=0;i<n;i++){const p=offset+6+i*12;if(p+12>buffer.length)break;const platform=buffer.readUInt16BE(p),language=buffer.readUInt16BE(p+4),id=buffer.readUInt16BE(p+6),length=buffer.readUInt16BE(p+8),start=strings+buffer.readUInt16BE(p+10);if(![1,16].includes(id)||start+length>buffer.length)continue;
    const bytes=Buffer.from(buffer.subarray(start,start+length));let text;if(platform===0||platform===3){if(bytes.length%2)continue;bytes.swap16();text=bytes.toString('utf16le');}else text=bytes.toString('latin1');if(text&&!/[\r\n,]/.test(text))names.push({text,rank:(id===16?4:0)+(platform===3?2:0)+(language===1033?1:0)});
  }
  return names.sort((a,b)=>b.rank-a.rank)[0]?.text||null;
}
