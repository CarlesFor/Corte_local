import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const folder=path.resolve(process.argv[2]||'release');
const files=['Corte-Local-Windows.exe','Corte-Local-Instalador-Windows.exe','Corte-Local-Windows.zip'];
const lines=[];
for(const name of files){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(folder,name)))hash.update(chunk);lines.push(`${hash.digest('hex')}  ${name}`);}
await fs.writeFile(path.join(folder,'SHA256SUMS.txt'),lines.join('\n')+'\n');
console.log('SHA256 de las tres descargas guardados en SHA256SUMS.txt.');
