import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,Dxf,printDrawing} from './paket-ortak.mjs';
import {uc,logoOku,logoYollari} from './kelepce-ortak.mjs';
import {markaOku,markaDxf} from './marka.mjs';
const OUT=path.join(ROOT,'uretim','kelepce-revJ');
const spec=JSON.parse(await readFile(path.join(ROOT,'kelepce-revJ-olculer.json'),'utf8'));
const report=JSON.parse(await readFile(path.join(OUT,'kontrol-raporu.json'),'utf8'));
const M=Object.fromEntries(Object.entries(spec.olculer).map(([k,v])=>[k,v.deger]));
const F=M.H-M.C,B=M.L+M.T,R=spec.guclendirme.tirnakDipR,NR=spec.guclendirme.boyunR;
const br=M.D/2,sr=M.S/2,nr=M.N/2,mouth=M.A/2,outer=mouth+M.U,hv=M.V/2,rh=hv+R;
const fmt=n=>String(Number(n.toFixed(2))).replace('.',',');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const LOGO=await logoOku(spec.markalama.logo),lm=spec.markalama.yukseklik/LOGO.LH;
const logoArc=LOGO.LW*lm,logoAngle=logoArc/br*180/Math.PI;
const def=[
'<defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9Z" fill="#172027"/></marker>',
'<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="white"/><path d="M0 0V8" stroke="#96a0a8" stroke-width=".7"/></pattern>',
'<style>text{font-family:Arial,Helvetica,sans-serif;fill:#172027;font-size:13px}.h{font-weight:700;font-size:18px}.t{font-weight:700;font-size:14px}.s{font-size:12px;fill:#52606b}.dim{stroke:#172027;fill:none;stroke-width:1;marker-start:url(#arr);marker-end:url(#arr)}.ext{stroke:#67737c;fill:none;stroke-width:.8}.ctr{stroke:#8c969e;stroke-dasharray:14 4 2 4;stroke-width:.8}.part{fill:white;stroke:#172027;stroke-width:2;stroke-linejoin:round}.note{fill:#a44716;font-weight:700}.mark{fill:#667781;stroke:none}</style></defs>'
].join('\n');
const line=(x1,y1,x2,y2,c='ext')=>'<line class="'+c+'" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"/>';
const text=(x,y,s,c='',anchor='start')=>'<text x="'+x+'" y="'+y+'" class="'+c+'" text-anchor="'+anchor+'">'+esc(s)+'</text>';
function hd(x0,x1,y,label){return line(x0,y-20,x0,y+10)+line(x1,y-20,x1,y+10)+line(x0,y,x1,y,'dim')+'<rect x="'+((x0+x1)/2-label.length*3.8)+'" y="'+(y-8)+'" width="'+label.length*7.6+'" height="17" fill="white"/>'+text((x0+x1)/2,y+4,label,'t','middle');}
function vd(x,y0,y1,label){return line(x-10,y0,x+15,y0)+line(x-10,y1,x+15,y1)+line(x,y0,x,y1,'dim')+text(x+18,(y0+y1)/2+4,label,'t');}
function profile(axis,half=false){
 const s=7,x0=100,x=z=>x0+z*s,y=r=>axis-r*s,p=[];
 const pt=(op,r,z)=>p.push(op+x(z).toFixed(2)+' '+y(r).toFixed(2));
 const arc=(r,z)=>p.push('A'+NR*s+' '+NR*s+' 0 0 0 '+x(z)+' '+y(r));
 const v=half?sr:spec.kavrama.sw/2;
 pt('M',0,0);pt('L',v,0);pt('L',v,M.L);if(half)pt('L',nr,M.L+sr-nr);
 pt('L',nr,B-NR);arc(nr+NR,B);pt('L',br-spec.pah.govde,B);pt('L',br,B+spec.pah.govde);
 pt('L',br,F-spec.pah.alin);pt('L',br-spec.pah.alin,F);
 if(half){
  pt('L',outer,F);pt('L',outer,M.H-spec.pah.uc.dis);pt('L',outer-spec.pah.uc.dis,M.H);
  pt('L',mouth+spec.pah.uc.ic,M.H);pt('L',mouth,M.H-spec.pah.uc.ic);pt('L',mouth,F);
  pt('L',M.W/2,F);pt('L',M.W/2,F-M.Y);pt('L',M.P/2,F-M.Y);pt('L',M.P/2,F-M.Q);
  pt('L',M.J/2,F-M.Q);pt('L',M.J/2,F-M.Q-3);pt('L',0,F-M.Q-3-M.J*.3);p.push('Z');
  return '<path d="'+p.join(' ')+'" class="part" style="fill:url(#hatch)"/>';
 }
 pt('L',rh,F);p.push('A'+R*s+' '+R*s+' 0 0 0 '+x(F+R)+' '+y(hv));
 pt('L',hv,M.H-spec.pah.uc.yan);pt('L',hv-spec.pah.uc.yan,M.H);pt('L',-hv+spec.pah.uc.yan,M.H);
 pt('L',-hv,M.H-spec.pah.uc.yan);pt('L',-hv,F+R);
 p.push('A'+R*s+' '+R*s+' 0 0 0 '+x(F)+' '+y(-rh));
 pt('L',-br+spec.pah.alin,F);pt('L',-br,F-spec.pah.alin);pt('L',-br,B+spec.pah.govde);pt('L',-br+spec.pah.govde,B);
 pt('L',-nr-NR,B);p.push('A'+NR*s+' '+NR*s+' 0 0 0 '+x(B-NR)+' '+y(-nr));
 pt('L',-nr,M.L);pt('L',-v,M.L);pt('L',-v,0);p.push('Z');return '<path d="'+p.join(' ')+'" class="part"/>';
}
const x=z=>100+z*7;
const logoPaths=logoYollari(LOGO.svg,(u,v)=>[x(B+spec.markalama.alt+spec.markalama.yukseklik-v*lm),520+7*br*Math.sin((u-LOGO.LW/2)*lm/br)]);
const wrap=body=>'<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990">'+def+body+'</svg>';
const background='<rect width="1400" height="990" fill="white"/><rect x="20" y="20" width="1360" height="950" fill="none" stroke="#172027"/>';
let b=background+text(45,52,'KELEPÇE SIKMA UCU - REV J','h')+text(45,77,'Tek parça / torna + freze / C45E+QT / mm','s');
b+=text(745,52,'TEKLİF VE NUMUNE ADAYI','note')+text(745,76,'Üretim onayı: uyum ve tork doğrulaması bekliyor.','s');
b+=line(70,200,635,200,'ctr')+profile(200,true);
b+=hd(100,x(M.H),354,'H = 71')+hd(100,x(M.L),324,'Sap L = 30')+hd(x(F),x(M.H),324,'Toplam 22');
b+=vd(650,200-7*mouth,200+7*mouth,'A = 23 +0,50 / 0');
b+=text(100,392,'YARIM KESİT - radyal kalınlık yönü','t');
b+=text(100,111,'Sap zarfı Ø10 +0 / -0,05; SW9','s')+line(230,119,x(18),165);
b+=text(320,285,'Boyun Ø9; omuz R2','t')+line(410,274,x(32),158);
b+=text(730,355,'Alın Ø21 x 2; orta cep Ø15 x 7; delik Ø4','s');
b+=line(70,520,635,520,'ctr')+profile(520)+logoPaths;
b+=hd(x(F+R),x(M.H),681,'Düz çalışma boyu = 20')+hd(x(B),x(F),711,'Gövde = 16');
b+=text(100,746,'YAN GÖRÜNÜŞ - tırnak eni ve dip R2','t')+text(100,768,'Ayrı halka ve ön dekoratif kanal kaldırıldı; dayama gövde omzundan.','s');
b+=text(895,120,'UÇTAN GÖRÜNÜŞ','t','middle')+line(810,200,980,200,'ctr')+line(895,115,895,285,'ctr');
b+='<circle cx="895" cy="200" r="68" class="part"/><circle cx="895" cy="200" r="42" class="ext"/><circle cx="895" cy="200" r="30" class="ext"/><circle cx="895" cy="200" r="8" class="ext"/>';
for(const sign of [-1,1]){const rx=sign>0?895+mouth*4:895-outer*4;b+='<rect x="'+rx+'" y="180" width="'+M.U*4+'" height="40" class="part"/>';}
b+=hd(895-mouth*4,895+mouth*4,302,'A = 23')+text(895,333,'Gövde Ø34; uç 10 x 3,5','s','middle');
b+='<polygon points="'+uc(spec).sapKesit(1200,200,10)+'" class="part" style="fill:url(#hatch)"/><circle cx="1200" cy="200" r="50" fill="none" stroke="#67737c" stroke-dasharray="5 4"/>';
b+=text(1200,120,'KESİT A-A','t','middle')+text(1200,279,'SW9 / köşe zarfı Ø10','s','middle');
b+='<rect x="745" y="382" width="590" height="275" rx="5" fill="#f7fafc" stroke="#d7e0e6"/>'+text(765,409,'DETAY B - tek tırnağın en yönündeki dip geçişi','t');
const dx=z=>820+(z-(F-1))*16,dy=r=>535-r*11;
let dp='M'+dx(F-1)+' '+dy(rh)+' L'+dx(F)+' '+dy(rh)+' A32 22 0 0 0 '+dx(F+R)+' '+dy(hv);
dp+=' L'+dx(F+7)+' '+dy(hv)+' L'+dx(F+7)+' '+dy(-hv)+' L'+dx(F+R)+' '+dy(-hv)+' A32 22 0 0 0 '+dx(F)+' '+dy(-rh)+' L'+dx(F-1)+' '+dy(-rh)+' Z';
b+='<path d="'+dp+'" class="part" style="fill:url(#hatch)"/>'+text(1015,468,'Dip R2','t')+line(1004,473,dx(F+.6),dy(6));
b+=text(1015,501,'Kök eni 14 → çalışma eni 10','s')+text(1015,527,'2 mm geçiş, düz bölgenin gerisinde.','s')+text(1015,557,'A = 23 ağza malzeme eklenmedi.','s');
b+=text(765,637,'Y-Z kesiti: standart R2 silindirik geçiş; serbest yüzey yok.','s');
b+='<rect x="835" y="720" width="520" height="73" fill="white" stroke="#d7e0e6"/>'+text(852,745,'REV J | 17.11.2026 | ISO 2768-m | ÖLÇEKSİZ','t')+text(852,770,'STEP ile tutarlı; yaklaşık ağırlık '+fmt(report.estimatedMassGrams)+' g.','s');
const notes=[
'Ölçüler STEP ile tutarlıdır. Rev J fiziksel uyum ve tork testi tamamlanmış bir ürün değildir.',
'C45E+QT / 1.1191: hazır ıslahlı stok. Rp0,2 ≥430 MPa; teslim özellikleri teklif yanıtında.',
'Gövde Ø34; sap SW9 x 30, zarf Ø10 +0/-0,05. 10/13 mm mandrende numune kontrolü gerekir.',
'71 mm toplam boy ve 10 x 3,5 x 20 mm düz çalışma uçları Rev I ile aynıdır.',
'Alın/cep referansı 2 mm geriye alındı; omuz, cep oturması ve çevre açıklığı kontrol edilir.',
'Sap ucu düz: yalnız çapak giderme ≤0,2. Diğer keskin kenarlar 0,3 x 45; kritik ölçü bozulmasın.',
'Ratel 0,03-0,05 mm LAZER KAZIMA; boya/koyu markalama yok; ayrı resim ve DXF esastır.',
'Çalışma torku onaylanmadı. Darbesiz kullanım; eski ≈24 N.m notu bu revizyon için kullanılmaz.'
];b+=text(45,792,'NOTLAR','t');notes.forEach((n,i)=>{b+=text(45,814+i*18,(i+1)+'. '+n,'s');});
await writeFile(path.join(OUT,'kelepce-ucu-revJ-teknik-resim.svg'),wrap(b));
if (!process.env.KELEPCE_SVG_ONLY) await printDrawing(path.join(OUT,'kelepce-ucu-revJ-teknik-resim.svg'),path.join(OUT,'kelepce-ucu-revJ-teknik-resim.pdf'));
const mark=await markaOku(spec.markalama.logo),dxf=new Dxf();markaDxf(dxf,'MARKA',mark,spec.markalama.yukseklik);
dxf.text('YAZI',[-logoArc/2,-4],1.5,'Ratel Rev J - 1:1 mm - laser engraving 0.03-0.05 mm');
dxf.text('YAZI',[-logoArc/2,-7],1.5,'Wrap on diameter 34; YAZI layer is reference only; do not engrave.');
await writeFile(path.join(OUT,'kelepce-ucu-revJ-logo-1-1.dxf'),dxf.toString(),'latin1');
const flat=LOGO.svg.replace(/<svg\b[^>]*>/,tag=>tag.replace(/\swidth="[^"]*"/,' width="'+logoArc.toFixed(3)+'mm"').replace(/\sheight="[^"]*"/,' height="5mm"'));
await writeFile(path.join(OUT,'kelepce-ucu-revJ-logo-1-1.svg'),flat);
let m=background+text(65,85,'RATEL LOGOSU - REV J - LAZER KAZIMA','h')+text(65,115,'C45E+QT / gövde Ø34 / teklif ve numune adayı','s');
m+=line(70,520,635,520,'ctr')+profile(520)+logoPaths+hd(x(B),x(B+4),710,'4 mm')+hd(x(B+4),x(B+9),680,'h = 5 mm');
m+=text(755,210,'AÇINIM REFERANSI','t');
m+='<svg x="750" y="255" width="560" height="'+(560/LOGO.LW*LOGO.LH)+'" viewBox="0 0 '+LOGO.LW+' '+LOGO.LH+'">'+LOGO.svg.replace(/^([\s\S]*?<svg\b[^>]*>)/,'').replace(/<\/svg>\s*$/,'')+'</svg>';
['Logo yüksekliği 5 mm; yay boyu '+fmt(logoArc)+' mm.','Yeni Ø34 gövdede sarma açısı '+fmt(logoAngle)+' derece.','Gövde arka omzundan logonun alt kenarı 4 mm.','Bir tırnağın altında ortalı; üst yön tırnaklara bakar.','Metal kaldırarak lazer kazıma: 0,03-0,05 mm derinlik.','Döner eksen / fiber lazer; çelik renginde ve çapaksız.','Boya, siyah baskı veya koyu yüzey markalaması yok.','1:1 DXF MARKA katmanı işlenir; YAZI katmanı işlenmez.','Büyük logo ölçekli değildir; 1:1 vektör dosyası esastır.'].forEach((t,i)=>{m+=text(755,430+i*34,t,i===4?'t':'s');});
await writeFile(path.join(OUT,'kelepce-ucu-revJ-lazer-kazima.svg'),wrap(m));
if (!process.env.KELEPCE_SVG_ONLY) await printDrawing(path.join(OUT,'kelepce-ucu-revJ-lazer-kazima.svg'),path.join(OUT,'kelepce-ucu-revJ-lazer-kazima.pdf'));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
const view=norm([1.7,-2.5,1.7]),right=norm(cross([0,0,1],view)),up=norm(cross(view,right)),light=norm([.3,-.7,1]);
function iso(mesh,cx,cy,scale,tint){
 const p=i=>mesh.vertices.slice(i*3,i*3+3),n=i=>mesh.normals.slice(i*3,i*3+3);
 const project=v=>{const q=[v[0],v[1],v[2]-35.5];return[cx+dot(q,right)*scale,cy-dot(q,up)*scale];};
 const tris=[];for(let t=0;t<mesh.triangles.length;t+=3){
  const ids=mesh.triangles.slice(t,t+3),pts=ids.map(p),normal=norm(ids.reduce((s,i)=>s.map((v,j)=>v+n(i)[j]),[0,0,0]));
  if(dot(normal,view)<0)continue;
  const brightness=.46+.48*Math.max(0,dot(normal,light)),color='rgb('+tint.map(v=>Math.round(v*brightness)).join(',')+')';
  tris.push({depth:dot(pts.reduce((s,v)=>s.map((q,j)=>q+v[j]/3),[0,0,0]),view),svg:'<polygon points="'+pts.map(v=>project(v).map(q=>q.toFixed(2)).join(',')).join(' ')+'" fill="'+color+'" stroke="'+color+'" stroke-width=".3"/>'});
 }return tris.sort((a,b)=>a.depth-b.depth).map(t=>t.svg).join('');
}
const om=JSON.parse(await readFile(path.join(OUT,'revI-mesh.json'),'utf8')).mesh,nm=JSON.parse(await readFile(path.join(OUT,'revJ-mesh.json'),'utf8')).mesh;
let c='<rect width="1500" height="1000" fill="#f6f8fa"/>'+text(70,72,'KELEPÇE SIKMA UCU','h')+text(70,106,'Tek parça torna + freze | aynı 20 mm çalışma uçları | Rev J inceleme adayı','s');
c+='<rect x="45" y="150" width="680" height="730" rx="20" fill="white"/><rect x="775" y="150" width="680" height="730" rx="20" fill="white"/>';
c+=text(385,200,'REV I','h','middle')+text(1115,200,'REV J','h','middle')+iso(om,385,505,8.4,[214,220,226])+iso(nm,1115,505,8.4,[184,215,231]);
c+=text(385,814,'Boyun Ø8 / sap SW8 / gövde Ø32','t','middle')+text(1115,814,'Boyun Ø9 / sap SW9 / gövde Ø34 / dipler R2','t','middle');
c+=text(385,846,'Referans geometri: ~'+fmt(report.legacyMassGrams)+' g','s','middle')+text(1115,846,'Yeni geometri: ~'+fmt(report.estimatedMassGrams)+' g','s','middle');
c+=text(70,931,'Geometrik kontrol: tek katı; 20 mm çalışma uçları aynı; STEP yeniden açılış ve geometri kontrolü geçti.','s')+text(70,964,'Tork ve fiziksel uyum onaylanmadı. C45E+QT teslimi, yeni omuz/cep oturması ve Ø34 çevre açıklığı kontrol edilecek.','note');
await writeFile(path.join(OUT,'revI-revJ-karsilastirma.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" viewBox="0 0 1500 1000">'+def+c+'</svg>');
console.log('DRAWINGS '+OUT+'; logo wrap '+fmt(logoAngle)+' degrees');

