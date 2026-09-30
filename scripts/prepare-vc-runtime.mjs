import fs from 'node:fs/promises';
import path from 'node:path';
const directories=async root=>{try{return (await fs.readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>path.join(root,e.name));}catch{return [];}};
export async function prepareVCRuntime(destination) {
  if(process.platform!=='win32')return;
  const candidates=[];
  if(process.env.CORTE_VC_REDIST_DIR)candidates.push(process.env.CORTE_VC_REDIST_DIR);
  if(process.env.VCToolsRedistDir)candidates.push(process.env.VCToolsRedistDir);
  for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean))
    for(const version of await directories(path.join(base,'Microsoft Visual Studio')))
      for(const edition of await directories(version))
        candidates.push(...await directories(path.join(edition,'VC','Redist','MSVC')));
  candidates.sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  let installed=false;
  for(const root of candidates) {
    const folders=(await directories(path.join(root,'x64'))).filter(p=>/\.CRT$|\.OpenMP$/i.test(p));
    const files=(await Promise.all(folders.map(async p=>(await fs.readdir(p)).filter(n=>/\.dll$/i.test(n)).map(n=>path.join(p,n))))).flat();
    if(!['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll','vcomp140.dll'].every(n=>files.some(f=>path.basename(f).toLowerCase()===n)))continue;
    for(const file of files)await fs.copyFile(file,path.join(destination,path.basename(file)));
    installed=true;break;
  }
  if(!installed)throw new Error('Para empaquetar Whisper sin instalaciones adicionales, instala Visual Studio con C++ o define CORTE_VC_REDIST_DIR con la carpeta redistribuible de MSVC (con x64/CRT y x64/OpenMP).');
  await fs.writeFile(path.join(destination,'NOTICE-VC-runtime.txt'),'Microsoft Visual C++ x64 runtime: app-local redistribution from the installed Visual Studio redistributable directories.\nhttps://learn.microsoft.com/cpp/windows/determining-which-dlls-to-redistribute\n');
}
