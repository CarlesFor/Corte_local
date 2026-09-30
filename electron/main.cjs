const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
protocol.registerSchemesAsPrivileged([{ scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },{scheme:'corte',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
if (!app.isPackaged) app.setPath('userData', path.join(__dirname, '..', '.local-data'));
if (process.env.CORTE_DATA_DIR) app.setPath('userData', process.env.CORTE_DATA_DIR);
let win, engine, dataDir, shared, settings = { recent: [], presets: [] };
const assets = new Map(), reverseAssets = new Map();
function register(file) {const full=path.resolve(file);let id=reverseAssets.get(full);if(!id){id=randomUUID();assets.set(id,full);reverseAssets.set(full,id);}return `media://asset/${id}`;}
async function atomic(file,data) {await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,typeof data==='string'?data:JSON.stringify(data,null,2));await fs.rename(tmp,file);}
// The waveform is derived from the source and cached locally; don't duplicate
// hundreds of thousands of peaks in saved projects or recovery files.
function projectJSON(project) {return JSON.stringify(project,(key,value)=>key==='waveform'||key==='waveformStep'?undefined:value,2);}
async function remember(name,file) {settings.recent=[{name,path:file,updated:new Date().toISOString()},...settings.recent.filter(r=>r.path!==file)].slice(0,12);await atomic(path.join(dataDir,'settings.json'),settings);}
const mediaFilters=[{name:'Vídeos, audio e imágenes',extensions:['mp4','mov','mkv','webm','avi','m4v','mp3','wav','m4a','flac','ogg','aac','png','jpg','jpeg','webp']}];
async function chooseMedia(multiple=true) {const r=await dialog.showOpenDialog(win,{properties:['openFile',...(multiple?['multiSelections']:[])],filters:mediaFilters});return r.canceled?[]:r.filePaths;}
async function loadProject(file) {
  const stat=await fs.stat(file);if(stat.size>25*1024*1024) throw new Error('El proyecto supera el tamaño permitido.');
  const p=shared.validateProject(JSON.parse(await fs.readFile(file,'utf8')));
  for(const font of p.fontAssets||[]) {const source=path.resolve(path.dirname(file),font.file);if(existsSync(source)&&/\.(ttf|otf|woff2)$/i.test(source)) await fs.copyFile(source,path.join(engine.fontsDir,path.basename(source)));}
  for(let i=0;i<p.media.length;i++) {const m=p.media[i];m.path=path.resolve(path.dirname(file),m.path);m.missing=!existsSync(m.path);m.url='';m.thumbnail=undefined;
    if(!m.missing) {const fresh=await engine.importMedia(m.path);p.media[i]={...fresh,id:m.id};}}
  await remember(p.name,file);return {project:p,path:file};
}
function job(kind,fn) {return engine.job(kind,fn);}
function handler(name,fn) {ipcMain.handle(`corte:${name}`,async(event,...args)=>{
  if(!win || event.sender!==win.webContents || (event.senderFrame && event.senderFrame!==win.webContents.mainFrame)) throw new Error('Origen de solicitud no válido.');
  return fn(...args);
});}
async function fontList() {
  const roots=[engine.fontsDir,path.join(process.env.WINDIR||'C:/Windows','Fonts')],list=[];
  for(const root of roots) {let names=[];try{names=await fs.readdir(root);}catch{}for(const name of names.filter(x=>/\.(ttf|otf|woff2)$/i.test(x))) {const file=path.join(root,name);list.push({name:/^inter-/i.test(name)?'Inter':name.replace(/\.(ttf|otf|woff2)$/i,'').replace(/[-_]/g,' '),path:file,url:register(file)});}}
  // Font family names are read from the font's name table, not inferred from filenames.
  const { fontName } = await import('./fonts.mjs');
  for(const f of list) {try{f.name=fontName(await fs.readFile(f.path))||f.name;}catch{}}
  engine.fontCatalog=list;return list;
}
app.whenReady().then(async()=>{
  dataDir=app.getPath('userData');await fs.mkdir(dataDir,{recursive:true});
  shared=await import('../shared/project.mjs');const {Engine,MODEL_NAMES}=await import('./engine.mjs');
  const resources=app.isPackaged?path.join(process.resourcesPath,'engines'):path.join(__dirname,'..','resources');
  engine=new Engine({dataDir,resources,register,emit:j=>{if(win&&!win.isDestroyed()) win.webContents.send('corte:job',j);}});await engine.init();
  if(existsSync(path.join(resources,'fonts'))) await fs.cp(path.join(resources,'fonts'),engine.fontsDir,{recursive:true});
  try{settings=JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8'));}catch{}
  protocol.handle('media',async request=>{const url=new URL(request.url),file=assets.get(url.pathname.slice(1));if(url.hostname!=='asset'||!file) return new Response('No encontrado',{status:404});const response=await net.fetch(pathToFileURL(file).toString(),{headers:request.headers});const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin','*');headers.set('Access-Control-Expose-Headers','Accept-Ranges, Content-Length, Content-Range');return new Response(response.body,{status:response.status,headers});});
  protocol.handle('corte',async request=>{const url=new URL(request.url),root=path.resolve(__dirname,'..','dist'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(url.hostname!=='app'||!file.startsWith(root+path.sep))return new Response('No encontrado',{status:404});const response=await net.fetch(pathToFileURL(file).toString());const headers=new Headers(response.headers);const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.woff2':'font/woff2','.woff':'font/woff'};if(types[path.extname(file)])headers.set('Content-Type',types[path.extname(file)]);return new Response(response.body,{status:response.status,headers});});
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  handler('status',async()=>{let recovery;try{recovery=JSON.parse(await fs.readFile(path.join(dataDir,'recovery.json'),'utf8'));shared.validateProject(recovery);for(let i=0;i<recovery.media.length;i++){const m=recovery.media[i];if(existsSync(m.path)){const fresh=await engine.importMedia(m.path);recovery.media[i]={...fresh,id:m.id};}else m.missing=true;}}catch{recovery=undefined;}
    return {ffmpeg:!!engine.ffmpeg,ffprobe:!!engine.ffprobe,whisper:!!await engine.whisperPath(),models:MODEL_NAMES.filter(m=>existsSync(path.join(dataDir,'models',`ggml-${m}.bin`))),fonts:await fontList(),presets:settings.presets||[],recent:settings.recent||[],memoryGB:Math.round(os.totalmem()/1024**3),cpu:os.cpus()[0]?.model||'',cacheMB:await engine.cacheSize(),recovery};});
  handler('importMedia',async paths=>{const files=paths?.length?paths:await chooseMedia();if(files.length>100) throw new Error('Importa hasta 100 archivos a la vez.');const results=[];for(const file of files) {if(typeof file!=='string'||!path.isAbsolute(file)) throw new Error('Ruta no válida.');results.push(await engine.importMedia(file));}return results;});
  handler('openProject',async file=>{if(!file){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Proyecto Corte Local',extensions:['corte']}]});if(r.canceled) return null;file=r.filePaths[0];}return loadProject(file);});
  handler('saveProject',async(p,file,portable=false)=>{
    shared.validateProject(p);
    if(portable) {const r=await dialog.showOpenDialog(win,{title:'Carpeta para recopilar el proyecto',properties:['openDirectory','createDirectory']});if(r.canceled) return null;
      const folder=path.join(r.filePaths[0],`${p.name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)||'Proyecto'}-${randomUUID().slice(0,6)}`);await fs.mkdir(path.join(folder,'medios'),{recursive:true});
      const portableProject=structuredClone(p);for(const m of portableProject.media){if(!existsSync(m.path)) throw new Error(`Archivo ausente: ${m.name}`);const dest=path.join(folder,'medios',`${m.id}-${path.basename(m.path)}`);await fs.copyFile(m.path,dest);m.path=path.relative(folder,dest);delete m.url;delete m.thumbnail;delete m.originalUrl;}
      const fonts=await fontList(),families=new Set([p.captionStyle.font,...p.captions.map(c=>c.style?.font),...p.clips.map(c=>c.style?.font)]);portableProject.fontAssets=[];
      await fs.mkdir(path.join(folder,'fuentes'),{recursive:true});for(const f of fonts) if(families.has(f.name)){const dest=path.join(folder,'fuentes',path.basename(f.path));await fs.copyFile(f.path,dest);portableProject.fontAssets.push({name:f.name,file:path.relative(folder,dest)});}
      const dest=path.join(folder,'proyecto.corte');await atomic(dest,projectJSON(portableProject));return dest;
    }
    if(!file){const r=await dialog.showSaveDialog(win,{defaultPath:`${p.name}.corte`,filters:[{name:'Proyecto Corte Local',extensions:['corte']}]});if(r.canceled) return null;file=r.filePath;}
    if(p.media.some(m=>path.resolve(m.path).toLowerCase()===path.resolve(file).toLowerCase())) throw new Error('El proyecto no puede sobrescribir un archivo original.');
    const saved=structuredClone(p);for(const m of saved.media){m.path=path.relative(path.dirname(file),m.path);delete m.url;delete m.originalUrl;delete m.thumbnail;}
    await atomic(file,projectJSON(saved));await remember(p.name,file);return file;
  });
  handler('autosave',async p=>{shared.validateProject(p);await atomic(path.join(dataDir,'recovery.json'),projectJSON(p));});
  handler('clearRecovery',()=>fs.rm(path.join(dataDir,'recovery.json'),{force:true}));
  handler('exportVideo',async(p,options)=>{
    shared.validateProject(p);if(![720,1080].includes(options.height)||![24,25,30,60].includes(options.fps)) throw new Error('Resolución o fps no válidos.');
    const r=await dialog.showSaveDialog(win,{defaultPath:`${p.name}.mp4`,filters:[{name:'Vídeo MP4',extensions:['mp4']}]});if(r.canceled) return null;
    const dest=r.filePath;if(p.media.some(m=>path.resolve(m.path).toLowerCase()===path.resolve(dest).toLowerCase())) throw new Error('La exportación no puede sobrescribir un original.');
    const disk=await fs.statfs(path.dirname(dest));const estimate=(options.end-options.start)*3000000;if(Number(disk.bavail)*Number(disk.bsize)<estimate) throw new Error('No hay espacio libre suficiente para esta exportación.');
    return job('export',async(signal,progress)=>{const tmp=path.join(path.dirname(dest),`.${path.basename(dest)}-${randomUUID()}.partial.mp4`);try{await engine.render(p,options,tmp,{signal,progress});await fs.rename(tmp,dest);if(!options.burnCaptions&&p.captions.length){const shifted=p.captions.filter(c=>c.end>options.start&&c.start<options.end).map(c=>({...c,start:Math.max(0,c.start-options.start),end:Math.min(options.end,c.end)-options.start}));await atomic(dest.replace(/\.mp4$/i,'.srt'),shared.toSrt(shifted));}return {path:dest};}finally{await fs.rm(tmp,{force:true});}});
  });
  handler('renderPreview',async(p,start,end)=>job('preview',async(signal,progress)=>{const key=require('node:crypto').createHash('sha256').update(JSON.stringify({p,start,end})).digest('hex');const dest=path.join(engine.cache,`preview-${key}.mp4`);if(!existsSync(dest)){const tmp=dest+'.partial.mp4';try{await engine.render(p,{height:540,fps:p.fps,quality:'standard',burnCaptions:true,start,end,preview:true},tmp,{signal,progress});await fs.rename(tmp,dest);}finally{await fs.rm(tmp,{force:true});}}return {url:register(dest),start,end};}));
  handler('transcribe',(p,model,tracks,start,end)=>job('transcribe',async(signal,progress)=>({captions:await engine.transcribe(p,model,tracks,start,end,signal,progress),start,end,projectId:p.id})));
  handler('installWhisper',()=>job('download',async(signal,progress)=>engine.installWhisper(signal,progress)));
  handler('downloadModel',model=>job('download',async(signal,progress)=>engine.downloadModel(model,signal,progress)));
  handler('cancelJob',id=>engine.cancel(id));
  handler('importCaptions',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'Subtítulos SRT',extensions:['srt']}],properties:['openFile']});if(r.canceled) return null;const text=await fs.readFile(r.filePaths[0],'utf8');const cues=shared.parseSrt(text);if(!cues.length) throw new Error('No se han encontrado subtítulos válidos.');return cues;});
  handler('exportCaptions',async(p,format)=>{shared.validateProject(p);if(!['srt','ass'].includes(format)) throw new Error('Formato no válido.');const r=await dialog.showSaveDialog(win,{defaultPath:`${p.name}.${format}`,filters:[{name:'Subtítulos',extensions:[format]}]});if(r.canceled) return null;await atomic(r.filePath,format==='srt'?shared.toSrt(p.captions):shared.toAss(p,{texts:false}));return r.filePath;});
  handler('addFont',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Fuentes',extensions:['ttf','otf']}]});if(r.canceled) return null;const source=r.filePaths[0];const {fontName}=await import('./fonts.mjs');const bytes=await fs.readFile(source),name=fontName(bytes);if(!name) throw new Error('No se pudo leer esta fuente.');const dest=path.join(engine.fontsDir,path.basename(source));await fs.copyFile(source,dest);return {name,path:dest,url:register(dest)};});
  handler('savePreset',async(name,style)=>{const test=shared.newProject();test.captionStyle=style;shared.validateProject(test);if(typeof name!=='string'||!name.trim()) throw new Error('Escribe un nombre.');settings.presets=[...(settings.presets||[]).filter(s=>s.name!==name),{name:name.trim().slice(0,50),style}];await atomic(path.join(dataDir,'settings.json'),settings);});
  handler('relink',async(p,id)=>{const files=await chooseMedia(false);if(!files.length) return null;const fresh=await engine.importMedia(files[0]);const old=p.media.find(m=>m.id===id);if(!old||old.type!==fresh.type) throw new Error('Selecciona un archivo del mismo tipo.');return {...fresh,id};});
  handler('reveal',async file=>{if(typeof file==='string') shell.showItemInFolder(file);});
  handler('clearCache',()=>engine.clearCache());
  win=new BrowserWindow({width:1500,height:960,minWidth:1100,minHeight:740,title:'Corte Local',backgroundColor:'#111214',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:!!process.env.CORTE_TEST}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  win.on('close',e=>{if(engine.jobs.size){const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['Seguir trabajando','Cancelar tareas y cerrar'],defaultId:0,cancelId:0,message:'Hay tareas en curso.'});if(choice===0)e.preventDefault();else for(const id of engine.jobs.keys())engine.cancel(id);}});
  win.once('ready-to-show',()=>{if(!process.env.CORTE_TEST)win.show();});
  if(process.env.CORTE_DEV_URL) await win.loadURL(process.env.CORTE_DEV_URL);else await win.loadURL('corte://app/index.html');
}).catch(e=>{console.error(e);dialog.showErrorBox('No se pudo abrir Corte Local',e.message);app.quit();});
app.on('window-all-closed',()=>app.quit());
