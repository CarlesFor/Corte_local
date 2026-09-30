import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Engine } from '../electron/engine.mjs';
import { newProject, newClip } from '../shared/project.mjs';
const dataDir=path.resolve('.local-data'),folder=path.resolve('.test-output/speech');await fs.mkdir(folder,{recursive:true});
const engine=new Engine({dataDir});await engine.init();let last=-1;
const progress=(p,m)=>{const rounded=Math.floor(p*10)*10;if(rounded!==last){console.log(`${rounded}% ${m}`);last=rounded;}};
if(!await engine.whisperPath()){await engine.installWhisper(undefined,progress);console.log('Whisper installed and SHA256 verified.');}
await fs.cp(path.join(dataDir,'whisper'),'resources/whisper',{recursive:true});
try{await fs.access(path.join(dataDir,'models/ggml-small.bin'));}catch{last=-1;await engine.downloadModel('small',undefined,progress);console.log('Small model installed and SHA256 verified.');}
const media=await engine.importMedia(path.join(folder,'español.wav'));
const p=newProject();p.media=[media];p.clips=[{...newClip(media,p.tracks[1].id,1),duration:media.duration}];
const nativeFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Network disabled in offline transcription test');};
try {last=-1;const captions=await engine.transcribe(p,'small',[p.tracks[1].id],0,media.duration+1,undefined,progress);const text=captions.map(c=>c.text).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();console.log('Offline Spanish transcript:',text);assert.ok(captions.length);assert.ok(text.includes('hola'));assert.ok(text.includes('video'));assert.ok(text.includes('subtitulo'));assert.ok(captions.every(c=>c.start>=0&&c.end<=media.duration+1));await fs.writeFile(path.join(folder,'transcript.json'),JSON.stringify(captions,null,2));console.log('PASS: real local Spanish speech recognition with network disabled.');}finally{globalThis.fetch=nativeFetch;}
