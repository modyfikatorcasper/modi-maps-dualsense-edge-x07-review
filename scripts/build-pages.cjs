const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {minify}=require('html-minifier-terser'),terser=require('terser'),sharp=require('sharp');
const hash=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const source=path.resolve(process.argv[2]||'.'),dist=path.resolve(process.argv[3]||'dist');
 if(dist===source||!dist.startsWith(source+path.sep))throw Error('dist must be inside the source folder');
 let html=await fs.readFile(path.join(source,'index.html'),'utf8');
 const assets=[...new Set(html.match(/assets\/[\w.-]+\.png/g))].sort();
 if(assets.length!==18)throw Error('Expected exactly 18 approved image assets');
 await fs.mkdir(path.join(dist,'a'),{recursive:true});
 for(const asset of assets){let bytes=await fs.readFile(path.join(source,asset));
  if(/\/board_(bottom|top)\.png$/.test(asset)){
   const {width,height}=await sharp(bytes).metadata();
   // The photograph keeps its dimensions and PCB coordinates. Credit is part of the image.
   const mark=Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="16" y="${height/2}" transform="rotate(-90 16 ${height/2})" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="#38516a">modyfikatorcasper / modyfikator89 · Modi Diagnostic Lab</text></svg>`);
   bytes=await sharp(bytes).composite([{input:mark,top:0,left:0}]).png().toBuffer();
  }
  const renamed='a/'+hash(bytes).slice(0,24)+'.png';await fs.writeFile(path.join(dist,renamed),bytes);html=html.split(asset).join(renamed);
 }
 html=html.replaceAll('rel="noopener"','rel="noopener noreferrer"').replaceAll('loading="lazy"','loading="lazy" draggable="false"');
 html=await minify(html,{collapseWhitespace:true,removeComments:true,minifyCSS:true,minifyJS:async code=>{
  const result=await terser.minify(code,{compress:{passes:2},mangle:{toplevel:true},format:{comments:false},sourceMap:false});return result.code;
 }});
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'");
 if(scripts.length!==1)throw Error('Expected one inline application script');
 const csp=`default-src 'none'; script-src ${scripts.join(' ')}; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
 html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="icon" href="data:,">');
 if(/sourceMappingURL|components\.(csv|json)|https?:\/\/[^"<>\s]+\.js/.test(html))throw Error('Unexpected public data, source map or external script');
 await fs.writeFile(path.join(dist,'index.html'),html);
 const files=await fs.readdir(dist);if(files.length!==2||!files.includes('index.html')||!files.includes('a'))throw Error('Unexpected dist files');
 console.log('Production build: index.html + 18 hashed images; CSP script hash; no source maps or working documents.');
})();
