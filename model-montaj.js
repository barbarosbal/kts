import * as kazan from 'kts/kazan';
import * as rekor from 'kts/rekor';

// Rekor bileziği Parça 1'in üst dişine oturur; conta Parça 1'in üst alnına basar.
const TASIMA = kazan.HEIGHT - rekor.SEAT_Y;
const TOP = TASIMA + rekor.HEIGHT;

// Ayrık görünümde Parça 1 yerinde kalır, rekorun parçaları yukarı açılır
const AYRIK = { govde: 56, bilezik: 26, conta: 6 };

export function kur(malzeme) {
  const k = kazan.kur(malzeme);
  const r = rekor.kur(malzeme);
  const ust = r.parcalar.map((p) => {
    p.obj.position.y = TASIMA;
    return { ...p, ayrik: AYRIK[p.ad] };
  });

  return {
    ad: 'Montaj',
    alt: `Oynar rekor + kazan altı parçası · Rev ${rekor.SPEC.rev} taslak`,
    rev: rekor.SPEC.rev,
    paket: null,
    cizim: r.cizim,
    parcalar: [...k.parcalar, ...ust],
    gecikme: r.gecikme,
    occluder: { r: k.occluder.r, y0: 0, y1: TOP },
    fit: (tech, ayrik) => (ayrik
      ? { y: (TOP + AYRIK.govde) / 2, h: tech ? 128 : 120, w: tech ? 100 : 66 }
      : { y: TOP / 2, h: tech ? 106 : 98, w: tech ? 100 : 64 }),
    annotate(a) {
      const x = 62;
      a.line([[0, -12, 0], [0, TOP + 12, 0]], a.dashMat);
      a.ext(TOP, 25, x + 16);
      a.ext(kazan.HEIGHT, 26, x + 3);
      a.ext(0, 25, x + 16);
      a.dim(x, 0, kazan.HEIGHT, `Parça 1 = ${kazan.HEIGHT}`);
      a.dim(x + 13, 0, TOP, `Toplam = ${TOP}`);
      a.callout([-35, TASIMA + 14, 0], [-66, TASIMA + 24, 10], 'Oynar rekor', 'Bilezik çevrilip çıkar, gövde bağlı kalır');
      a.callout([-24, 96, 0], [-62, 88, 10], 'Bilezik dişi', `${rekor.SPEC.uclar.alt.dis} · ${rekor.SPEC.olculer.C.deger} mm oturur`);
    },
    annotateAyrik: (a) => rekor.parcaEtiketleri(a, AYRIK, TASIMA),
  };
}
