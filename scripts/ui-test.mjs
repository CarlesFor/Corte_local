import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { checkWaveformUI } from './check-waveform-ui.mjs';
import { checkLayersUI } from './check-layers-ui.mjs';
const executableIndex=process.argv.indexOf('--executable');
const packaged=process.argv.includes('--packaged')||executableIndex!==-1;
const packagedExecutable=executableIndex!==-1?path.resolve(process.argv[executableIndex+1]):path.resolve('release/win-unpacked/Corte Local.exe');
const waveformOnly=process.argv.includes('--waveform-only');
const layersOnly=process.argv.includes('--layers-only');
const require=createRequire(import.meta.url),folder=path.resolve(packaged?'.test-output/ui-packaged':'.test-output/ui');await fs.mkdir(folder,{recursive:true});
const source=path.resolve('.test-output/engine/vídeo con espacios.mp4'),srt=path.join(folder,'prueba.srt'),saved=path.join(folder,'proyecto.corte'),output=path.join(folder,'resultado.mp4');
await fs.writeFile(srt,'1\n00:00:00,200 --> 00:00:02,000\n¡Una historia en español!\n\n2\n00:00:02,000 --> 00:00:03,800\nTodo se queda en tu ordenador.\n');
const env={...process.env,CORTE_TEST:'1',CORTE_DATA_DIR:path.join(folder,'data'),CORTE_TEST_SOURCE:source,CORTE_TEST_SRT:srt,CORTE_TEST_SAVE:saved,CORTE_TEST_OUTPUT:output,CORTE_TEST_FOLDER:folder};delete env.ELECTRON_RUN_AS_NODE;
// CI runners may have no audio output device. Chromium's fake output keeps
// the real decoding and playback clock running without requiring speakers.
const launchArgs=packaged?[]:['.'];if(process.env.CI)launchArgs.unshift('--disable-audio-output');
const app=await electron.launch({executablePath:packaged?packagedExecutable:require('electron'),args:launchArgs,env,timeout:60000});
const errors=[],logs=[];let page;
try {
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
  await page.waitForSelector('.brand');await page.waitForTimeout(1500);
  if(await page.getByRole('button',{name:'Empezar de nuevo',exact:true}).count())await page.getByRole('button',{name:'Empezar de nuevo',exact:true}).click();
  console.log('PASS: desktop renderer loaded');
  if(layersOnly) {
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},saved);
    await checkLayersUI(app,page,folder);
  } else if(waveformOnly) {
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},saved);
    await checkWaveformUI(app,page,folder);
  } else {
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async(_window,options)=>({canceled:false,filePaths:[options.properties?.includes('openDirectory')?process.env.CORTE_TEST_FOLDER:options.filters?.[0]?.extensions?.includes('srt')?process.env.CORTE_TEST_SRT:process.env.CORTE_TEST_SOURCE]});dialog.showSaveDialog=async(_window,options)=>({canceled:false,filePath:options.filters?.[0]?.extensions?.includes('mp4')?process.env.CORTE_TEST_OUTPUT:process.env.CORTE_TEST_SAVE});});
  await page.getByRole('button',{name:'Importar archivos',exact:true}).click();await page.waitForSelector('.media-card',{timeout:30000});
  assert.equal(await page.locator('.timeline-clip.video').count(),1);console.log('PASS: native import, proxy, thumbnails, automatic first clip');
  await page.getByRole('button',{name:'Reproducir',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'Pausar',exact:true}).click();
  const current=await page.locator('.time-display b').textContent();assert.notEqual(current,'00:00:00:00');console.log('PASS: playback advances timeline');
  await page.locator('.edit-tools').getByRole('button',{name:'Texto',exact:true}).click();await page.waitForSelector('.timeline-clip.text');assert.equal(await page.locator('.timeline-clip.text').count(),1);console.log('PASS: title added to text track');
  await page.locator('.rail button').filter({hasText:'Subtítulos'}).click();await page.getByRole('button',{name:'Importar SRT',exact:true}).click();await page.waitForSelector('.caption-card');assert.equal(await page.locator('.caption-card').count(),2);
  await page.getByRole('button',{name:'Estilos',exact:true}).click();await page.getByRole('button',{name:'Caja blanca',exact:true}).click();console.log('PASS: SRT import and style applied');
  await page.locator('.style-editor .font-row select').selectOption('Georgia');console.log('PASS: native Windows font selected');
  await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();await page.waitForTimeout(900);const project=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(project.captions.length,2);assert.equal(project.captionStyle.backgroundOpacity,1);assert.equal(project.clips.length,2);console.log('PASS: real project persistence');
  const reopened=await page.evaluate(file=>window.corte.openProject(file),saved);assert.equal(reopened.project.captions.length,2);assert.equal(reopened.project.media[0].missing,undefined);assert.match(reopened.project.media[0].url,/^media:/);console.log('PASS: saved project reopens and restores native media URLs');
  const missing=structuredClone(project);missing.media[0].path='archivo-ausente.mp4';const missingFile=path.join(folder,'missing.corte');await fs.writeFile(missingFile,JSON.stringify(missing));const loadedMissing=await page.evaluate(file=>window.corte.openProject(file),missingFile);assert.equal(loadedMissing.project.media[0].missing,true);console.log('PASS: project with missing media opens for relinking');
  const portable=await page.evaluate(p=>window.corte.saveProject(p,undefined,true),reopened.project),portableData=JSON.parse(await fs.readFile(portable,'utf8'));assert.ok(portableData.media[0].path.startsWith('medios'));assert.ok(portableData.fontAssets.length);const openedPortable=await page.evaluate(file=>window.corte.openProject(file),portable);assert.ok(openedPortable.project.media[0].url.startsWith('media:'));console.log('PASS: portable project collects media and fonts and reopens');
  await page.getByRole('button',{name:'Vista renderizada',exact:true}).click();await page.waitForSelector('.exact-preview',{timeout:30000});console.log('PASS: reference preview rendered by FFmpeg');
  await page.getByRole('button',{name:'Volver al editor',exact:true}).click();await page.waitForTimeout(1500);
  const pixels=await page.locator('.subtitle-canvas').evaluate(canvas=>{const context=canvas.getContext('2d'),data=context.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)count++;return count;});assert.ok(pixels>100,'captions remain rendered after returning from reference preview');console.log('PASS: subtitle canvas still renders after preview toggle');
  await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'Elegir ubicación y exportar',exact:true}).click();await page.waitForSelector('.export-finished',{timeout:60000});assert.ok((await fs.stat(output)).size>1000);console.log('PASS: desktop export completed');
  assert.ok((await fs.readdir(path.join(folder,'data','fonts'))).some(f=>/^georgia.*\.ttf$/i.test(f)));console.log('PASS: chosen Windows font included in the local export renderer');
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();await page.waitForSelector('.setting-card');assert.match(await page.locator('.setting-card').first().textContent(),/disponibles/);if(packaged)assert.match(await page.locator('.setting-card').nth(1).textContent(),/Whisper instalado/);await page.getByRole('button',{name:'Cerrar',exact:true}).click();console.log('PASS: local engine configuration');
  await page.screenshot({path:path.join(folder,'editor.png')});
  await checkWaveformUI(app,page,folder);
  await checkLayersUI(app,page,folder);
  }
  const badLogs=logs.filter(l=>!l.includes('Electron Security Warning'));console.log('Renderer errors:',JSON.stringify(errors));console.log('Console errors:',JSON.stringify(badLogs));
  assert.deepEqual(errors,[]);assert.deepEqual(badLogs,[]);console.log('Desktop integration passed. Screenshot: .test-output/ui/editor.png');
} catch(e) {if(page){console.log('Visible UI:',await page.locator('body').innerText());console.log('Renderer errors:',errors);console.log('Console errors:',logs);await page.screenshot({path:path.join(folder,'failure.png'),timeout:5000}).catch(()=>{});}throw e;} finally {await app.close();}
