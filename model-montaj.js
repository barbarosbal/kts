import * as kazan from 'kts/kazan';
import * as rekor from 'kts/rekor';

// Rekor bileziği Parça 1'in üst dişine oturur; conta Parça 1'in üst alnına basar.
const TASIMA = kazan.HEIGHT - rekor.SEAT_Y;
const TOP = TASIMA + rekor.HEIGHT;

// Ayrık görünüm: bilezik Parça 1'den sökülür (dönerek yükselir), sonra gövdeden kaydırılıp eğilerek çıkar
const POZ = { kaldir: 30, ayir: 46, contaKay: 6, tur: 3, baslangic: 0.35 };
const SON = TOP + POZ.kaldir + POZ.ayir;

export function kur(malzeme) {
  const k = kazan.kur(malzeme);
  const r = rekor.kur(malzeme);

  return {
    ad: 'Montaj',
    alt: `Oynar rekor + kazan altı parçası · Rev ${rekor.SPEC.rev}${rekor.SPEC.onayli ? '' : ' taslak'}`,
    rev: rekor.SPEC.rev,
    paket: r.paket,
    cizim: r.cizim,
    parcalar: [...k.parcalar, ...r.parcalar],
    ayrikla: (e) => rekor.montajPozu(r.parts, e, TASIMA, POZ),
    occluder: { r: k.occluder.r, y0: 0, y1: TOP },
    fit: (tech, ayrik) => (ayrik
      ? { y: SON / 2, h: tech ? 136 : 128, w: tech ? 104 : 70 }
      : { y: TOP / 2, h: tech ? 108 : 100, w: tech ? 104 : 66 }),
    annotate(a) {
      const x = 64;
      a.line([[0, -12, 0], [0, TOP + 12, 0]], a.dashMat);
      a.ext(TOP, 25, x + 16);
      a.ext(kazan.HEIGHT, 26, x + 3);
      a.ext(0, 25, x + 16);
      a.dim(x, 0, kazan.HEIGHT, `Parça 1 = ${kazan.HEIGHT}`);
      a.dim(x + 13, 0, TOP, `Toplam = ${TOP}`);
      a.callout([-37, TASIMA + 16, 0], [-70, TASIMA + 26, 10], 'Oynar rekor', 'Gövde bağlı kalır, bilezik sökülür');
      a.callout([-24, 88, 0], [-62, 80, 10], 'Bilezik dişi', `${rekor.SPEC.uclar.alt.dis} · ${rekor.SPEC.olculer.C.deger} mm oturur`);
    },
    annotateAyrik: (a) => rekor.parcaEtiketleri(a, {
      govde: TASIMA + POZ.kaldir + POZ.ayir,
      bilezik: TASIMA + POZ.kaldir + POZ.ayir + rekor.SPEC.sokme.yol.at(-1)[1],
      conta: TASIMA + POZ.contaKay,
    }),
  };
}
