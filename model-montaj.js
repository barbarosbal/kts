import * as kazan from 'kts/kazan';
import * as rekor from 'kts/rekor';

// Rekor bileziği Parça 1'in üst dişine oturur; conta Parça 1'in üst alnına basar.
const TASIMA = kazan.HEIGHT - rekor.SEAT_Y;
const TOP = TASIMA + rekor.HEIGHT;

// Ayrık görünümde Parça 1 yerinde kalır, rekorun parçaları yukarı açılır
const AYRIK = { govde: 56, tel: 42, bilezik: 26, conta: 6 };

export function kur(malzeme) {
  const k = kazan.kur(malzeme);
  const r = rekor.kur(malzeme);
  const ust = r.parcalar.map((p) => {
    p.obj.position.y = TASIMA;
    return { ...p, ayrik: AYRIK[p.ad], donus: p.ad === 'bilezik' ? 2 : 0 };
  });

  return {
    ad: 'Montaj',
    alt: `Oynar rekor + kazan altı parçası · Rev ${rekor.SPEC.rev} taslak`,
    rev: rekor.SPEC.rev,
    paket: null,
    cizim: r.cizim,
    parcalar: [...k.parcalar, ...ust],
    occluder: { r: k.occluder.r, y0: 0, y1: TOP },
    fit: (tech, ayrik) => (ayrik
      ? { y: (TOP + AYRIK.govde) / 2, h: tech ? 132 : 124, w: tech ? 96 : 66 }
      : { y: TOP / 2, h: tech ? 108 : 100, w: tech ? 96 : 60 }),
    annotate(a) {
      const x = 58;
      a.line([[0, -12, 0], [0, TOP + 12, 0]], a.dashMat);
      a.ext(TOP, 25, x + 16);
      a.ext(kazan.HEIGHT, 26, x + 3);
      a.ext(0, 25, x + 16);
      a.dim(x, 0, kazan.HEIGHT, `Parça 1 = ${kazan.HEIGHT}`);
      a.dim(x + 13, 0, TOP, `Toplam = ${TOP}`);
      a.callout([-30, TASIMA + 14, 0], [-62, TASIMA + 24, 10], 'Oynar rekor', 'Bilezik sökülür, gövde bağlı kalır');
      a.callout([-24, 96, 0], [-62, 96, 10], 'Bilezik dişi', `${rekor.SPEC.uclar.alt.dis} · ${rekor.SPEC.olculer.C.deger} mm oturur`);
    },
    annotateAyrik: (a) => rekor.parcaEtiketleri(a, AYRIK, TASIMA),
  };
}
