import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Engine,run} from '../electron/engine.mjs';

export async function checkLayersUI(app,page,folder) {
  const fixture=name=>path.resolve('.test-output/engine',name);
  const base=fixture('layers-base.mp4'),image=fixture('layers-image.png'),video=fixture('layers-top.mp4');
  const choose=async file=>app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Archivo',exact:true}).click();await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
  await page.locator('.rail button').filter({hasText:'Archivos'}).click();await choose(base);
  await page.getByRole('button',{name:'Importar archivos',exact:true}).click();await page.waitForSelector('.timeline-clip.video',{timeout:30000});
  const zoom=Number(await page.getByLabel('Zoom de la línea de tiempo').inputValue());
  const seek=async time=>{const ruler=await page.locator('.ruler').boundingBox();await page.mouse.click(ruler.x+168+time*zoom,ruler.y+12);};
  await seek(1);await choose(image);await page.locator('.overlay-import').click();
  await page.waitForFunction(()=>document.querySelectorAll('.video-track').length===2&&document.querySelectorAll('.timeline-clip.video').length===2);
  assert.equal(Number(await page.getByLabel('Inicio (s)',{exact:true}).inputValue()),1,'image is placed at the cursor');
  await page.getByLabel('Duración (s)',{exact:true}).first().fill('2');
  await page.getByRole('button',{name:'Colocar en una esquina',exact:true}).click();
  const stage=await page.locator('.canvas-stage').boundingBox();
  const imageBox=await page.locator('.preview-layer:has(img)').boundingBox();
  assert.ok(imageBox.width<stage.width*0.4&&imageBox.x>stage.x+stage.width/2,'corner preset puts a smaller image over the video');
  const original=page.locator('.preview-layer video');
  assert.ok(await original.evaluate(element=>element.volume>0.5),'overlay does not mute the voice');
  await page.waitForFunction(()=>{const element=document.querySelector('.preview-layer video');return element.readyState>=2&&!element.seeking;});
  await page.getByRole('button',{name:'Reproducir',exact:true}).click();
  try {await page.waitForFunction(()=>{const element=document.querySelector('.preview-layer video');return !element.paused&&element.currentTime>1;},{},{timeout:2500});}
  catch(error){console.log('Media playback diagnostics:',await original.evaluate(element=>({paused:element.paused,time:element.currentTime,duration:element.duration,ready:element.readyState,seeking:element.seeking,error:element.error?.message})));throw error;}
  await page.getByRole('button',{name:'Pausar',exact:true}).click();await seek(1);
  await page.getByRole('button',{name:'Pantalla completa',exact:true}).click();
  console.log('PASS: Superponer imports an image at the cursor, with a corner preset and uninterrupted base audio');

  await choose(video);await page.getByRole('button',{name:'Importar archivos',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.media-card').length===3);
  assert.equal(await page.locator('.timeline-clip.video').count(),2,'ordinary import keeps media in the library');
  const videoCard=page.locator('.media-card').filter({hasText:'layers-top.mp4'});
  await videoCard.getByRole('button',{name:'Superponer',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.video-track').length===3);
  assert.equal(await page.locator('.timeline-clip.video').count(),3);
  await page.getByRole('button',{name:'Eliminar (Supr)',exact:true}).click();
  await videoCard.dragTo(page.locator('.overlay-drop-zone'),{targetPosition:{x:zoom,y:12}});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video').length===3);
  assert.equal(await page.locator('.video-track').count(),4,'library drag creates its own new upper track');
  await page.getByLabel('Duración (s)',{exact:true}).first().fill('1');
  await page.getByLabel('Escala',{exact:false}).evaluate(element=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'0.25');element.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await seek(1.5);await page.waitForTimeout(300);
  const readCenter=async name=>{
    const file=path.join(folder,name+'.png');await page.locator('.canvas-stage').screenshot({path:file});
    const engine=new Engine({dataDir:folder});const info=await engine.probe(file),stream=info.streams[0],raw=path.join(folder,name+'.rgb');
    await run(engine.ffmpeg,['-y','-v','error','-i',file,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo',raw]);
    const data=await fs.readFile(raw),i=(Math.floor(stream.height/2)*stream.width+Math.floor(stream.width/2))*3;return [...data.subarray(i,i+3)];
  };
  const before=await readCenter('layers-before-reorder');assert.ok(before[2]>180&&before[0]<50,'upper video covers the image in the live preview');
  await page.locator('.video-track').first().getByTitle('Bajar pista',{exact:true}).click();
  // The now-empty track is between the two active layers, so move down once more.
  await page.locator('.video-track').nth(1).getByTitle('Bajar pista',{exact:true}).click();
  await page.waitForTimeout(200);
  const after=await readCenter('layers-after-reorder');assert.ok(after[1]>180&&after[2]<50,'track order changes the visible layer in the live preview');
  console.log('PASS: multiple videos and images stack, library drag creates layers, and reordering changes the preview');

  await page.getByRole('button',{name:'Añadir pista de vídeo',exact:true}).click();
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='native-drop-fixture';input.style.display='none';document.body.append(input);});
  await page.locator('#native-drop-fixture').setInputFiles(image);
  const nativePath=await page.locator('#native-drop-fixture').evaluate(input=>window.corte.pathForFile(input.files[0]));
  assert.equal(path.resolve(nativePath),image,'test drop uses a real native file');
  const lane=page.locator('.video-track .track-content').first();
  await lane.evaluate((element,zoom)=>{
    const input=document.querySelector('#native-drop-fixture'),transfer=new DataTransfer();transfer.items.add(input.files[0]);const rect=element.getBoundingClientRect();
    element.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:rect.left+0.75*zoom,clientY:rect.top+25}));
  },zoom);
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video').length===4,{},{timeout:30000});
  assert.equal(await page.locator('.media-card').count(),4,'native drop imports exactly once');
  assert.ok(Math.abs(Number(await page.getByLabel('Inicio (s)',{exact:true}).inputValue())-0.75)<=1/zoom,'native file drop respects the chosen time within one mouse pixel');
  await page.getByLabel('Duración (s)',{exact:true}).first().fill('2');
  await page.locator('#native-drop-fixture').evaluate(element=>element.remove());
  console.log('PASS: dropping a native image on a video track places it at the chosen time without duplicate imports');

  await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();await page.waitForTimeout(800);
  const saved=path.join(folder,'proyecto.corte'),data=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(data.clips.length,4);assert.equal(data.tracks.filter(t=>t.kind==='video').length,5);
  const reopened=await page.evaluate(file=>window.corte.openProject(file),saved);assert.deepEqual(reopened.project.tracks,data.tracks);assert.ok(reopened.project.media.every(m=>!m.missing));
  await page.getByRole('button',{name:'Vista renderizada',exact:true}).click();await page.waitForSelector('.exact-preview',{timeout:60000});
  await page.getByRole('button',{name:'Volver al editor',exact:true}).click();await page.waitForTimeout(250);
  await page.screenshot({path:path.join(folder,'layers.png')});
  console.log('PASS: multitrack project persists, reopens and renders through the export engine');
}
