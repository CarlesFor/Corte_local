import fs from 'node:fs/promises';
await fs.mkdir('public/libass',{recursive:true});
for(const name of ['subtitles-octopus-worker.js','subtitles-octopus-worker.wasm']) await fs.copyFile(`node_modules/libass-wasm/dist/js/${name}`,`public/libass/${name}`);
await fs.copyFile('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2','public/libass/default.woff2');
