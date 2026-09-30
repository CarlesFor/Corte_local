import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

async function bars(clip) {
  return clip.locator('.waveform-peaks').evaluate(element=>
    [...element.getAttribute('d').matchAll(/M([\d.]+),([\d.]+)v([\d.]+)/g)]
      .map(match=>({x:Number(match[1]),height:Number(match[3])})));
}

export async function checkWaveformUI(app,page,folder) {
  const source=path.resolve('.test-output/engine/sonido-y-silencios.mp4');
  await fs.access(source);
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},source);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Archivo',exact:true}).click();
  await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
  await page.locator('.rail button').filter({hasText:'Archivos'}).click();
  await page.getByRole('button',{name:'Importar archivos',exact:true}).click();
  await page.waitForSelector('.waveform-peaks',{timeout:30000});
  const first=page.locator('.timeline-clip.video').first();
  const initial=await bars(first);
  assert.ok(initial.filter(b=>b.x>10&&b.x<35).length>5,'sound is visible');
  assert.equal(initial.filter(b=>b.x>55&&b.x<80).length,0,'one-second silence has no sound peaks');
  const band=await first.locator('.waveform-band').boundingBox();assert.ok(band.height>=28,'audio has its own readable band');
  console.log('PASS: video audio shows real peaks and flat silence under the thumbnails');

  const target=page.locator('.video-track .track-content').first();
  await page.locator('.media-card').first().dragTo(target,{targetPosition:{x:6*45+5,y:30}});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video').length===2);
  assert.equal(await page.locator('.timeline-clip.video .waveform-peaks').count(),2);
  console.log('PASS: dragging video from the library immediately shows its audio waveform');
  // Delete the added copy; test all following edits on the original recording.
  await page.keyboard.press('Delete');
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video').length===1);
  await first.click({position:{x:15,y:12}});
  await page.getByRole('button',{name:'Propiedades',exact:true}).click();
  await page.getByLabel('Duración (s)',{exact:true}).first().fill('4');
  await page.getByLabel('Recorte del original (s)',{exact:true}).fill('1');
  const trimmed=await bars(first);
  assert.equal(trimmed.filter(b=>b.x>10&&b.x<35).length,0,'trimmed source starts in silence');
  assert.ok(trimmed.filter(b=>b.x>55&&b.x<80).length>5,'trim shows the next source sound');
  const playbackSpeed=page.getByText('Reproducción',{exact:true}).locator('..').locator('select');
  await playbackSpeed.selectOption('2');
  const faster=await bars(first);
  assert.equal(faster.filter(b=>b.x>5&&b.x<15).length,0,'2x playback starts in silence');
  assert.ok(faster.filter(b=>b.x>30&&b.x<40).length>2,'2x playback compresses the wave accurately');
  console.log('PASS: source trims and speed changes reposition the waveform');

  await playbackSpeed.selectOption('1');
  const ruler=await page.locator('.ruler').boundingBox();
  await page.mouse.click(ruler.x+168+45,ruler.y+12);
  await page.getByRole('button',{name:'Dividir clip (B)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video').length===2);
  const right=page.locator('.timeline-clip.video').nth(1);
  const splitBars=await bars(right);
  assert.ok(splitBars.filter(b=>b.x>10&&b.x<35).length>5,'right split begins at source sound, not source silence');
  await page.getByRole('button',{name:'Eliminar y cerrar hueco (Mayús Supr)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-clip.video').length===1);
  assert.ok((await bars(first)).filter(b=>b.x>10&&b.x<35).length>5,'sound remains aligned after deleting the silent segment');
  console.log('PASS: silence can be split and removed while keeping the remaining waveform aligned');

  await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();
  const saved=path.join(folder,'proyecto.corte');
  await page.waitForTimeout(800);
  const data=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(data.media[0].waveform,undefined,'project excludes derived waveform cache');
  const reopened=await page.evaluate(file=>window.corte.openProject(file),saved);
  assert.equal(reopened.project.media[0].waveformStep,0.01);assert.ok(reopened.project.media[0].waveform.length>=590);
  console.log('PASS: reopening a project restores its detailed waveform from the local cache');

  // Zoom and scroll must render only the visible interval, even for long sources.
  await page.getByLabel('Zoom de la línea de tiempo').evaluate(element=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'160');
    element.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('.timeline-scroll').evaluate(element=>{element.scrollLeft=180;});
  await page.waitForTimeout(200);
  const svg=await first.locator('.waveform').boundingBox();const viewport=await page.locator('.timeline-scroll').boundingBox();
  assert.ok(svg.width<=viewport.width+64,'waveform rendering is bounded by the viewport');
  assert.ok(await first.locator('.waveform').evaluate(element=>parseFloat(element.style.left)>100),'scroll redraws only the visible source interval');
  await page.locator('.timeline-scroll').evaluate(element=>{element.scrollLeft=0;});
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(folder,'waveform.png')});
  console.log('PASS: waveform zoom and horizontal scrolling; screenshot saved to waveform.png');
}
