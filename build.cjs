const fs=require('node:fs');
const path=require('node:path');
const files=['index.html','style.css','app.js','avatar-renderer.mjs','hair-motion.mjs','pointer-mapping.mjs','tracking-core.mjs','tracking-client.mjs','tracking-worker.js','vtuber.riv'];
fs.mkdirSync('dist',{recursive:true});
for(const file of files)fs.copyFileSync(file,path.join('dist',file));
fs.mkdirSync('dist/vendor',{recursive:true});
for(const file of ['canvas_advanced.mjs','runtime.wasm'])fs.copyFileSync(path.join('vendor',file),path.join('dist/vendor',file));
console.log('Built static Avatar Studio in dist/');
