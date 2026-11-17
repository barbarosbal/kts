// Optional PDF/preview renderer for hosts where headless Edge is unavailable.
// Uses runtime-owned sharp/pdf-lib when CODEX_PRIMARY_RUNTIME_NODE_MODULES is set.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const req=createRequire(import.meta.url);
const dependency=name=>{try{return req(name);}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;return req(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,name));}};
const sharp=dependency('sharp');
const {PDFDocument}=dependency('pdf-lib');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'uretim','kelepce-revJ');
for(const name of ['kelepce-ucu-revJ-teknik-resim','kelepce-ucu-revJ-lazer-kazima']){
 const input=await readFile(path.join(out,name+'.svg'));
 const png=await sharp(input,{density:360}).resize({width:4961}).png().toBuffer();
 await writeFile(path.join(out,name+'.png'),png);
 const pdf=await PDFDocument.create();const image=await pdf.embedPng(png);const page=pdf.addPage([420/25.4*72,297/25.4*72]);
 page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
 pdf.setTitle(name+' - Rev J review candidate');pdf.setAuthor('Ratel Systems');pdf.setSubject('Manufacturing review drawing; source SVG and STEP supplied');
 await writeFile(path.join(out,name+'.pdf'),await pdf.save());
 console.log('PDF A3 / ~300 dpi '+name);
}
await sharp(await readFile(path.join(out,'revI-revJ-karsilastirma.svg')),{density:144}).resize({width:1800}).png().toFile(path.join(out,'revI-revJ-karsilastirma.png'));
console.log('PNG comparison rendered');
