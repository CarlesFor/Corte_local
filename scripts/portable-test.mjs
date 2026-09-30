import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const executable=path.resolve(process.argv[2]||'release/Corte-Local-Windows.exe');
const folder=path.resolve('.test-output',`portable-${process.pid}`);
await fs.mkdir(folder,{recursive:true});
const server=net.createServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
await new Promise(resolve=>server.close(resolve));
const env={...process.env,CORTE_TEST:'1',CORTE_DATA_DIR:path.join(folder,'data')};
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let output='',closed=false,browser,page;
child.stdout.on('data',chunk=>{output=(output+chunk).slice(-4000);});
child.stderr.on('data',chunk=>{output=(output+chunk).slice(-4000);});
const exited=new Promise(resolve=>child.once('exit',code=>{closed=true;resolve(code);}));
child.on('error',error=>{output+=error.message;closed=true;});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  let ready=false;
  const deadline=Date.now()+90000;
  while(Date.now()<deadline&&!closed) {
    try {const response=await fetch(`http://127.0.0.1:${port}/json/version`);if(response.ok){ready=true;break;}}catch{}
    await pause(500);
  }
  assert.ok(ready,`The portable application did not start. ${output}`);
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context=browser.contexts()[0];
  page=context.pages()[0]||await context.waitForEvent('page',{timeout:30000});
  await page.waitForSelector('.brand',{timeout:30000});
  const status=await page.evaluate(()=>window.corte.status());
  assert.equal(status.ffmpeg,true);assert.equal(status.ffprobe,true);assert.equal(status.whisper,true);
  assert.ok(status.fonts.some(font=>font.name==='Inter'));
  assert.deepEqual(status.models,[],'Voice models are downloaded by the user, not bundled');
  console.log('PASS: single portable EXE opens with all engines and fonts, without a pre-existing profile.');
  const source=path.resolve('.test-output/engine/vídeo con espacios.mp4');
  const [media]=await page.evaluate(file=>window.corte.importMedia([file]),source);
  assert.equal(media.type,'video');assert.equal(media.hasAudio,true);assert.ok(media.thumbnail);assert.ok(media.waveform.length>100);
  console.log('PASS: portable EXE imports video, generates a preview and analyses its audio waveform.');
  await page.screenshot({path:path.join(folder,'editor.png')});
} finally {
  if(page&&!page.isClosed())await page.evaluate(()=>window.close()).catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  if(!closed)await Promise.race([exited,pause(10000)]);
  if(!closed) {
    // Only terminate the process tree created by this test.
    const stop=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    await new Promise(resolve=>stop.once('exit',resolve));
  }
}
