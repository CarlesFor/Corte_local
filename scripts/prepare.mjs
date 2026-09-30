import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Engine, WHISPER_VERSION } from '../electron/engine.mjs';
import { prepareVCRuntime } from './prepare-vc-runtime.mjs';
const require=createRequire(import.meta.url);
await fs.mkdir('resources/fonts',{recursive:true});
await fs.copyFile(require('ffmpeg-static'),'resources/ffmpeg.exe');
await fs.copyFile(require('ffprobe-static').path,'resources/ffprobe.exe');
for(const weight of [400,700]) for(const variant of ['normal','italic']) await fs.copyFile(path.resolve(`node_modules/@fontsource/inter/files/inter-latin-${weight}-${variant}.woff2`),`resources/fonts/inter-${weight}-${variant}.woff2`);
await fs.copyFile('node_modules/@fontsource/inter/LICENSE','resources/fonts/LICENSE-Inter.txt');
await fs.copyFile('node_modules/libass-wasm/dist/js/COPYRIGHT','resources/LICENSE-libass.txt');
await fs.copyFile('node_modules/ffmpeg-static/ffmpeg.exe.LICENSE','resources/LICENSE-FFmpeg.txt');
await fs.copyFile('node_modules/ffmpeg-static/ffmpeg.exe.README','resources/FFmpeg-build-and-source.txt');
await fs.copyFile('node_modules/ffprobe-static/LICENSE','resources/LICENSE-ffprobe-static.txt');
await fs.copyFile('licenses/Whisper-MIT.txt','resources/LICENSE-Whisper.txt');
let whisperVersion='';
try {whisperVersion=(await fs.readFile('resources/whisper/VERSION','utf8')).trim();}catch{}
if(whisperVersion!==WHISPER_VERSION) {
  const engine=new Engine({dataDir:path.resolve('.build-data')});await engine.init();
  console.log(`Preparando Whisper ${WHISPER_VERSION} para incluirlo en la descarga.`);
  await engine.installWhisper(undefined,()=>{});
  await fs.cp(path.join(engine.dataDir,'whisper'),'resources/whisper',{recursive:true});
}
await prepareVCRuntime(path.resolve('resources/whisper'));
await fs.writeFile('resources/NOTICE.txt','FFmpeg: https://ffmpeg.org/legal.html — GPLv3 build; source/build: https://github.com/eugeneware/ffmpeg-static\nFFprobe: https://github.com/joshwnj/ffprobe-static\nWhisper.cpp (download optional): MIT, https://github.com/ggml-org/whisper.cpp\nInter: SIL OFL 1.1 (see fonts/LICENSE-Inter.txt)\nlibass WASM: see LICENSE-libass.txt\n');
console.log('Motores de vídeo y fuentes preparados para uso sin conexión.');
