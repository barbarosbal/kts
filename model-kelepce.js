import * as THREE from 'three';
import { metin } from 'kts/ortak';
import { olculer, milGeometrisi } from 'kts/kelepce-ortak';

// Tüm ölçüler kelepce-olculer.json'dan gelir (mm). Parça ekseni +Y, orijin SDS-Plus sap ucunun merkezi.
// Tek parça: dönel profil tornadan; sap kanalları, iki tırnak ve dış düz yüzeyler frezeden çıkar (kelepce-ortak.js).
export const SPEC = await fetch(`kelepce-olculer.json${new URL(import.meta.url).search}`).then((r) => r.json());
const M = olculer(SPEC);

const BODY_R = M.D / 2;
const SAP_R = M.S / 2;
const NECK_R = M.N / 2;
const BODY_Y = M.L + M.T;                  // gövde arka yüzü
const FACE_Y = M.H - M.C;                  // gövde alnı, tırnaklar buradan uzar
const MOUTH_X = M.A / 2;                   // tırnak iç yüzü
const OUTER_X = MOUTH_X + M.U;             // tırnak dış yüzü
const GROOVE_Y = FACE_Y - SPEC.onKanal.konum;

// Sap, boyun, halka, gövde, ön kanal, alın yuvası, orta cep ve delik
function profile() {
  const { sap, govde, alin, halka } = SPEC.pah;
  const ringR = M.Z / 2;
  const ring0 = M.L + SPEC.halka.konum;
  const ring1 = ring0 + SPEC.halka.kalinlik;
  const g = SPEC.onKanal.derinlik;
  const cep = FACE_Y - M.Q;
  return [
    [0, 0],
    [SAP_R - sap, 0],
    [SAP_R, sap * 0.8],
    [SAP_R, M.L],
    [NECK_R, M.L + SAP_R - NECK_R],
    [NECK_R, ring0],
    [ringR - halka, ring0],
    [ringR, ring0 + halka],
    [ringR, ring1 - halka],
    [ringR - halka, ring1],
    [NECK_R, ring1],
    [NECK_R, BODY_Y],
    [BODY_R - govde, BODY_Y],
    [BODY_R, BODY_Y + govde],
    [BODY_R, GROOVE_Y - g],
    [BODY_R - g, GROOVE_Y],
    [BODY_R, GROOVE_Y + g],
    [BODY_R, FACE_Y - alin],
    [BODY_R - alin, FACE_Y],
    [M.W / 2, FACE_Y],
    [M.W / 2, FACE_Y - M.Y],
    [M.P / 2, FACE_Y - M.Y],
    [M.P / 2, cep],
    [M.J / 2, cep],
    [M.J / 2, cep - 3],
    [0, cep - 3 - (M.J / 2) * 0.6],
  ];
}

function annotate(a) {
  const dim = (x, y0, y1, name) => a.dim(x, y0, y1, `${name} = ${metin(M[name])}`);
  const hdim = (y, r, text) => {
    a.line([[-r, y, 0], [r, y, 0]]);
    a.arrow([-r, y, 0], [r, y, 0]);
    a.arrow([r, y, 0], [-r, y, 0]);
    a.label(text, [0, y, 0], 'dimtag');
  };

  a.line([[0, -8, 0], [0, M.H + 8, 0]], a.dashMat);

  const [x0, x1] = [BODY_R + 8, BODY_R + 20];
  a.ext(M.H, OUTER_X + 1, x1 + 3);
  a.ext(FACE_Y, BODY_R + 1, x0 + 3);
  a.ext(M.L, NECK_R + 1, x0 + 3);
  a.ext(0, SAP_R + 1, x1 + 3);
  dim(x0, FACE_Y, M.H, 'C');
  dim(x0, 0, M.L, 'L');
  dim(x1, 0, M.H, 'H');

  a.line([[-MOUTH_X, M.H, 0], [-MOUTH_X, M.H + 9, 0]]);
  a.line([[MOUTH_X, M.H, 0], [MOUTH_X, M.H + 9, 0]]);
  hdim(M.H + 7, MOUTH_X, `A ≥ ${metin(M.A)}`);

  a.callout([-OUTER_X, M.H - 6, 0], [-40, M.H + 2, 6], `Tırnak ${metin(M.V)} × ${metin(M.U)}`, 'En ve boy varsayım');
  a.callout([-BODY_R, BODY_Y + 8, 0], [-42, BODY_Y - 2, 6], `Gövde Ø${metin(M.D)}`, `${SPEC.malzemeKisa} · ${SPEC.sertlik}`);
  const { sw, bas, son } = SPEC.kavrama;
  a.callout([-SAP_R, 32, 0], [-34, 28, 6], 'Altıgen kavrama', `SW ${metin(sw)} × ${metin(son - bas)} · mandren çeneleri`);
  a.callout([-SAP_R, 12, 0], [-30, 9, 6], 'SDS-Plus sap', `Ø${metin(M.S)} × ${metin(M.L)} · 2 açık + 2 kilit kanalı`);
}

export function kur({ celik }) {
  return {
    ad: SPEC.parca,
    alt: `Çelik ${SPEC.malzemeKisa} · CNC · Rev ${SPEC.rev}${SPEC.onayli ? '' : ' taslak'}`,
    rev: SPEC.rev,
    paket: null,
    cizim: {
      src: 'kelepce-ucu-taslak.svg',
      alt: 'Kelepçe sıkma ucu teknik çizimi: yarım kesit ve yan görünüş, ağız görünüşü, SDS-Plus sap kesiti, işleme sırası',
    },
    parcalar: [{ obj: new THREE.Mesh(milGeometrisi(SPEC, profile()), celik) }],
    occluder: { r: BODY_R, y0: BODY_Y, y1: FACE_Y },
    golge: 90,
    fit: (tech) => ({ y: M.H / 2, h: tech ? 70 : 64, w: tech ? 80 : 40 }),
    annotate,
  };
}
