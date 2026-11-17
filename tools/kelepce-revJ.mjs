// Rev J: single turned/milled solid. Review candidate, not a torque certification.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { setOC, draw, makeCylinder, exportSTEP, measureVolume, importSTEP } from 'replicad';
import opencascade from 'replicad-opencascadejs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'uretim', 'kelepce-revJ');
const require = createRequire(import.meta.url);
const oc = await opencascade({ locateFile: () => require.resolve('replicad-opencascadejs/wasm') });
setOC(oc);
const polyline = pts => pts.slice(1).reduce((pen,p) => pen.lineTo(p), draw(pts[0])).close();
const revolve = pts => polyline(pts).sketchOnPlane('XZ').revolve();
const ortala = (solid, axis) => {
  const [a,b] = solid.boundingBox.bounds;
  const delta = [0,0,0]; delta[axis] = -(a[axis]+b[axis])/2;
  return solid.translate(delta);
};
const values = s => Object.fromEntries(Object.entries(s.olculer).map(([k,v])=>[k,v.deger]));
function profilV1(spec, M) {
  const { sap, govde, alin, halka } = spec.pah;
  const BODY_R = M.D / 2, SAP_R = M.S / 2, NECK_R = M.N / 2;
  const BODY_Y = M.L + M.T;
  const FACE_Y = M.H - M.C;
  const GROOVE_Y = FACE_Y - spec.onKanal.konum;
  const ringR = M.Z / 2;
  const ring0 = M.L + spec.halka.konum;
  const ring1 = ring0 + spec.halka.kalinlik;
  const g = spec.onKanal.derinlik;
  const cep = FACE_Y - M.Q;
  return [
    [0, 0], [SAP_R - sap, 0], [SAP_R, sap * 0.8], [SAP_R, M.L], [NECK_R, M.L + SAP_R - NECK_R], [NECK_R, ring0],
    [ringR - halka, ring0], [ringR, ring0 + halka], [ringR, ring1 - halka], [ringR - halka, ring1], [NECK_R, ring1],
    [NECK_R, BODY_Y], [BODY_R - govde, BODY_Y], [BODY_R, BODY_Y + govde], [BODY_R, GROOVE_Y - g], [BODY_R - g, GROOVE_Y],
    [BODY_R, GROOVE_Y + g], [BODY_R, FACE_Y - alin], [BODY_R - alin, FACE_Y], [M.W / 2, FACE_Y], [M.W / 2, FACE_Y - M.Y],
    [M.P / 2, FACE_Y - M.Y], [M.P / 2, cep], [M.J / 2, cep], [M.J / 2, cep - 3], [0, cep - 3 - (M.J / 2) * 0.6],
  ];
}


function mil(spec, M, profil) {
  const SAP_R = M.S / 2;
  const FACE_Y = M.H - M.C;
  const MOUTH_X = M.A / 2;
  const OUTER_X = MOUTH_X + M.U;
  const GROOVE_Y = FACE_Y - spec.onKanal.konum;
  let govde = revolve(profil);

  // Altıgen sap: sap ucundan boyun pahının sonuna; köşeler ±X, sap çapında; SW iki karşılıklı yüz arası
  const { sw } = spec.kavrama;
  const [hb, hs] = [-1, M.L + (M.S - M.N) / 2];
  const rk = sw / Math.sqrt(3);
  const altigen = polyline(Array.from({ length: 6 }, (_, i) => [rk * Math.cos((i * Math.PI) / 3), rk * Math.sin((i * Math.PI) / 3)]))
    .sketchOnPlane('XY', hb).extrude(hs - hb);
  govde = govde.cut(makeCylinder(M.D, hs - hb, [0, 0, hb], [0, 0, 1]).cut(altigen));

  // Tırnaklar (±X): kalınlık profili (ağız pahı) ∩ en profili (yan pahlar); dış yüz ön kanaldan uca düz
  const { ic, yan, dis } = spec.pah.uc;
  const y0 = FACE_Y - 1;
  const hv = M.V / 2;
  for (const s of [1, -1]) {
    const p = (r, z) => [s * r, z];
    const kalinlik = ortala(polyline([p(MOUTH_X, y0), p(OUTER_X + 2, y0), p(OUTER_X + 2, M.H), p(MOUTH_X + ic, M.H), p(MOUTH_X, M.H - ic)])
      .sketchOnPlane('XZ').extrude(M.V + 2), 1);
    const enProfil = ortala(polyline([[-hv, y0], [hv, y0], [hv, M.H - yan], [hv - yan, M.H], [-hv + yan, M.H], [-hv, M.H - yan]])
      .sketchOnPlane('YZ').extrude(M.U + 6), 0).translate([s * (OUTER_X - (M.U + 6) / 2 + 3), 0, 0]);
    govde = govde.fuse(kalinlik.intersect(enProfil));
    const duz = ortala(polyline([p(OUTER_X, GROOVE_Y + 0.2), p(OUTER_X + 6, GROOVE_Y + 0.2), p(OUTER_X + 6, M.H + 2), p(OUTER_X - dis - 2, M.H + 2), p(OUTER_X, M.H - dis)])
      .sketchOnPlane('XZ').extrude(M.D + 4), 1);
    govde = govde.cut(duz);
  }
  return govde;
}



export function reinforcedProfile(spec, M) {
  const sr=M.S/2, nr=M.N/2, br=M.D/2, body=M.L+M.T, face=M.H-M.C;
  const r=spec.guclendirme.boyunR, q=face-M.Q;
  const k=Math.SQRT1_2;
  assert(body-r >= M.L+sr-nr, 'Neck fillet overlaps hex transition');
  return draw([0,0]).lineTo([sr,0]).lineTo([sr,M.L])
    .lineTo([nr,M.L+sr-nr]).lineTo([nr,body-r])
    .threePointsArcTo([nr+r,body],[nr+r-r*k,body-r+r*k])
    .lineTo([br-spec.pah.govde,body]).lineTo([br,body+spec.pah.govde])
    .lineTo([br,face-spec.pah.alin]).lineTo([br-spec.pah.alin,face])
    .lineTo([M.W/2,face]).lineTo([M.W/2,face-M.Y])
    .lineTo([M.P/2,face-M.Y]).lineTo([M.P/2,q])
    .lineTo([M.J/2,q]).lineTo([M.J/2,q-3])
    .lineTo([0,q-3-(M.J/2)*.6]).close();
}

export function buildReinforced(spec) {
  const M=values(spec), face=M.H-M.C, mouth=M.A/2, outer=mouth+M.U;
  const r=spec.guclendirme.tirnakDipR, hv=M.V/2, rh=hv+r, k=Math.SQRT1_2;
  assert.equal(M.C-r,spec.guclendirme.tirnakCalismaBoyu);
  assert.equal(2*rh,spec.guclendirme.tirnakKokEni);
  assert(Math.hypot(outer,rh) < M.D/2, 'Root corners exceed turned stock');
  let body=reinforcedProfile(spec,M).sketchOnPlane('XZ').revolve();
  const hb=-1, hs=M.L+(M.S-M.N)/2, rk=spec.kavrama.sw/Math.sqrt(3);
  const hex=polyline(Array.from({length:6},(_,i)=>[rk*Math.cos(i*Math.PI/3),rk*Math.sin(i*Math.PI/3)]))
    .sketchOnPlane('XY',hb).extrude(hs-hb);
  body=body.cut(makeCylinder(M.D,hs-hb,[0,0,hb],[0,0,1]).cut(hex));
  const {ic,yan,dis}=spec.pah.uc, z0=face-1;
  for(const sign of [1,-1]) {
    const p=(x,z)=>[sign*x,z];
    const radial=ortala(polyline([p(mouth,z0),p(outer,z0),p(outer,M.H-dis),p(outer-dis,M.H),p(mouth+ic,M.H),p(mouth,M.H-ic)])
      .sketchOnPlane('XZ').extrude(2*rh+2),1);
    const plan=draw([-rh,z0]).lineTo([rh,z0]).lineTo([rh,face])
      .threePointsArcTo([hv,face+r],[rh-r*k,face+r-r*k])
      .lineTo([hv,M.H-yan]).lineTo([hv-yan,M.H])
      .lineTo([-hv+yan,M.H]).lineTo([-hv,M.H-yan])
      .lineTo([-hv,face+r])
      .threePointsArcTo([-rh,face],[-rh+r*k,face+r-r*k])
      .lineTo([-rh,z0]).close();
    const width=ortala(plan.sketchOnPlane('YZ').extrude(M.U+6),0)
      .translate([sign*(outer-(M.U+6)/2+3),0,0]);
    body=body.fuse(radial.intersect(width));
  }
  return body.simplify();
}

const legacySpec=JSON.parse(await readFile(path.join(ROOT,'kelepce-olculer.json'),'utf8'));
const spec=JSON.parse(await readFile(path.join(ROOT,'kelepce-revJ-olculer.json'),'utf8'));
const oldM=values(legacySpec), M=values(spec);
const original=mil(legacySpec,oldM,profilV1(legacySpec,oldM));
const reinforced=buildReinforced(spec);
const volume=s=>s.solids.length ? Math.abs(measureVolume(s)) : 0;
const referencePath=path.join(ROOT,'uretim','kelepce','kelepce-ucu-revI.step');
const reference=await importSTEP(new Blob([await readFile(referencePath)]));
const legacyDifference=Math.abs(volume(original)-volume(reference));
const legacyGeometryError=volume(reference.cut(original))+volume(original.cut(reference));
assert(legacyGeometryError<.01,'Legacy geometry differs from published Rev I');
assert(legacyDifference<.01,'Legacy rebuild differs from published Rev I volume');
assert.equal(reinforced.solids.length,1,'Part must be one connected solid');
const stockEscape=volume(reinforced.cut(makeCylinder(M.D/2,M.H,[0,0,0],[0,0,1])));
assert(stockEscape<.001,'Geometry exceeds the specified turned blank');
const brepCheck=new oc.BRepCheck_Analyzer(reinforced.wrapped,true,false,true);
const brepValid=brepCheck.IsValid(); brepCheck.delete();
assert(brepValid,'OpenCascade geometry/topology validation failed');
const [low,high]=reinforced.boundingBox.bounds;
assert(Math.abs(high[2]-low[2]-M.H)<1e-5,'Length mismatch');
assert(Math.abs(high[0]-low[0]-M.D)<1e-5,'Diameter mismatch');
const workingStart=M.H-spec.guclendirme.tirnakCalismaBoyu;
assert.equal(workingStart,oldM.H-oldM.C,'Working tips moved');
const workingMask=makeCylinder(50,M.H-workingStart,[0,0,workingStart],[0,0,1]);
const oldWorking=original.intersect(workingMask);
const newWorking=reinforced.intersect(workingMask);
const added=volume(newWorking.cut(oldWorking));
const removed=volume(oldWorking.cut(newWorking));
assert(added<.001 && removed<.001,'Protected 20 mm working tips changed');
const step=exportSTEP([{shape:reinforced,name:'Kelepce Rev J C45E QT - REVIEW CANDIDATE',color:'#8b929a'}],{unit:'MM',modelUnit:'MM'});
await mkdir(OUT,{recursive:true});
const stepBytes=Buffer.from(await step.arrayBuffer());
await writeFile(path.join(OUT,'kelepce-ucu-revJ.step'),stepBytes);
const roundTrip=await importSTEP(new Blob([stepBytes]));
assert.equal(roundTrip.solids.length,1,'STEP round trip has multiple solids');
const stepCheck=new oc.BRepCheck_Analyzer(roundTrip.wrapped,true,false,true);
const stepBrepValid=stepCheck.IsValid(); stepCheck.delete();
assert(stepBrepValid,'STEP round trip geometry/topology is invalid');
assert(Math.abs(volume(roundTrip)-volume(reinforced))<.01,'STEP volume mismatch');
const mesh=reinforced.mesh({tolerance:.035,angularTolerance:.12});
const edges=reinforced.meshEdges({tolerance:.035,angularTolerance:.12});
await writeFile(path.join(OUT,'revJ-mesh.json'),JSON.stringify({mesh,edges}));
await writeFile(path.join(OUT,'revI-mesh.json'),JSON.stringify({mesh:original.mesh({tolerance:.035,angularTolerance:.12}),edges:original.meshEdges({tolerance:.035,angularTolerance:.12})}));
const report={
  revision:'J',date:'2026-11-17',status:'REVIEW CANDIDATE - NOT APPROVED FOR PRODUCTION',
  units:'mm',solids:reinforced.solids.length,
  bounds:reinforced.boundingBox.bounds,volumeMm3:volume(reinforced),
  estimatedMassGrams:volume(reinforced)*.00785,
  legacyVolumeMm3:volume(original),legacyMassGrams:volume(original)*.00785,
  checks:{brepValid,stepBrepValid,stockEscapeMm3:stockEscape,legacyGeometryErrorMm3:legacyGeometryError,legacyRebuildVolumeErrorMm3:legacyDifference,workingTipsAddedMm3:added,workingTipsRemovedMm3:removed,
    stepRoundTripVolumeErrorMm3:Math.abs(volume(roundTrip)-volume(reinforced)),stepRoundTripSolids:roundTrip.solids.length},
  changed:{bodyDiameter:[32,M.D],hexAcrossFlats:[8,spec.kavrama.sw],shankEnvelope:[9,M.S],neckDiameter:[8,M.N],
    neckTransitionLength:[5,M.T],bodyShoulderZ:[oldM.L+oldM.T,M.L+M.T],pocketFaceZ:[oldM.H-oldM.C,M.H-M.C],neckFilletRadius:[0,spec.guclendirme.boyunR],jawRootFilletRadius:[0,spec.guclendirme.tirnakDipR],
    jawTotalLength:[20,M.C],straightWorkingLength:[20,spec.guclendirme.tirnakCalismaBoyu]},
  preserved:['23 +0.50/0 mouth','10 x 3.5 x 20 straight working tips','71 overall','30 grip length','central seat and pocket diameters/depths relative to new face'],
  qualifications:['No approved working torque','No FEA or physical load/fit test performed','New body envelope, shoulder seating, 2 mm rearward pocket-face shift and C45E+QT delivery properties require verification'],
  materialSpec:spec.malzeme,deliveryRequirement:spec.sertlik,
  nominalComparisons:{neckSectionTorsionFactorSameSteel:(M.N/oldM.N)**3,neckPolarInertiaFactorSameSteel:(M.N/oldM.N)**4,
    warning:'Ideal circular neck only; excludes shoulders, hex shank, jaws, fatigue and material change. Not a tool torque rating.'}
};
await writeFile(path.join(OUT,'kontrol-raporu.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(OUT,'kelepce-revJ-olculer.json'),JSON.stringify(spec,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

