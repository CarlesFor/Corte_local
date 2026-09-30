import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({command})=>({ plugins: [react(),{name:'local-dev-csp',transformIndexHtml:{order:'post',handler:html=>command==='serve'?html.replace("script-src 'self' 'wasm-unsafe-eval'","script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"):html}}], base: './', server: { host: '127.0.0.1', port: 5173, strictPort: true } }));
