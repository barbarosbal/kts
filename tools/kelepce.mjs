// kelepce-olculer.json → kelepce-ucu-taslak.svg (teknik çizim sayfası)
// Kullanım: cd tools && npm run site
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, oku, fmt, uc, gorunus, hdim, vdim, extV, extH, note, agiz, kesitA, sayfa, logoOku, logoYollari } from './kelepce-ortak.mjs';

const spec = await oku('kelepce-olculer.json');
const U = uc(spec);
const {
  M, onDeger, BODY_R, SAP_R, NECK_R, RING_R, FACE_Y, MOUTH_X, OUTER_X, RING_0, RING_1, GROOVE_Y, GROOVE_D,
  CH_G, UC_I, UC_D, UC_Y, KV_SW, KV_R, KV_KENAR, KIRIS,
  sapKesitYol, sapDisYol, sapYanYol, boyunHalka, tirnakKalinlik, tirnakEn, icCep,
} = U;
const BODY_Y = M.L + M.T;
const BOY = FACE_Y - BODY_Y;
console.log(`UC    ağız ≥ ${M.A} · altıgen sap SW ${KV_SW} × ${M.L} (köşeler Ø${M.S}) · toplam boy ${M.H} · gövde ${BOY} mm`);

// ---------------- profil ----------------
// Sap sonundan ön kanala ortak dış çizgi: [r, y]
const boyunGovde = [
  ...boyunHalka,
  [NECK_R, BODY_Y],
  [BODY_R - CH_G, BODY_Y],
  [BODY_R, BODY_Y + CH_G],
  [BODY_R, GROOVE_Y - GROOVE_D],
  [BODY_R - GROOVE_D, GROOVE_Y],
];

const kesitYari = [[0, 0], ...sapKesitYol, ...boyunGovde, ...tirnakKalinlik, ...icCep];
const disYari = [[0, 0], ...sapDisYol, ...boyunGovde, ...tirnakKalinlik, [0, FACE_Y]];
const yanYari = [[0, 0], ...sapYanYol, ...boyunGovde.slice(2), ...tirnakEn];

// ---------------- yarım kesit ve yan görünüş ----------------
const S = 7;                               // 1 mm = 7 px (H 71 sağ sütuna taşmasın)
const X0 = 120;
const A1 = 190;                            // yarım kesit ekseni
const A2 = 544;                            // yan görünüş ekseni
const X1 = X0 + S * M.H;
const { vx, vy, yari, tumu, cross, along } = gorunus(S, X0);

// ---------------- markalama ----------------
// Ratel logosu gövde çevresine sarılır, ortası tırnaklardan birinin altında. Yan görünüş o tırnağa
// bakar: logo eksen yönünde dik okunur (harf üstleri tırnağa), çevre yönünde sinüsle daralır.
const MARK = spec.markalama;
const LOGO = await logoOku(MARK.logo);
const { LW, LH } = LOGO;
const MK = MARK.yukseklik / LH;            // logo birimi → mm
const MARK_Y = BODY_Y + MARK.alt;          // logonun alt kenarı
const MARK_YAY = LW * MK;                  // çevre yönünde yay boyu
const MARK_ACI = Math.round((MARK_YAY / BODY_R) * (180 / Math.PI));
const MARK_UST = MARK_Y + MARK.yukseklik;
if (MARK.alt < CH_G + 1 || MARK_UST > GROOVE_Y - GROOVE_D - 1) {
  console.warn(`UYARI: logo (${MARK_Y}–${MARK_UST}) gövdenin düz bandından (${BODY_Y + CH_G}–${GROOVE_Y - GROOVE_D}) taşıyor ya da kenara 1 mm'den yakın`);
}
if (MARK_ACI > 120) console.warn(`UYARI: logo gövdede ${MARK_ACI}° sarıyor, uçları okunmaz`);
console.log(`LOGO  ${MARK.yukseklik} × ${MARK_YAY.toFixed(1)} yay (${MARK_ACI}°) · gövde arka yüzünden ${MARK.alt}`);

// Logo birimi (u sağa, v aşağı) → yan görünüş
function logoNokta(u, v) {
  const s = (u - LW / 2) * MK;
  return [X0 + S * (MARK_UST - v * MK), A2 + S * BODY_R * Math.sin(s / BODY_R)];
}

const logoCizim = logoYollari(LOGO.svg, logoNokta);

const yarimKesit = `
    <line class="ctr" x1="${X0 - 26}" y1="${A1}" x2="${X1 + 22}" y2="${A1}"/>
    <polygon class="vis" fill="url(#h1)" points="${yari(A1, kesitYari)}"/>
    <polygon class="vis" points="${yari(A1, disYari, -1)}"/>
    ${along(A1, -KV_KENAR, 0, M.L)}
    ${cross(A1, M.L, 0, -SAP_R)}
    ${cross(A1, RING_0, 0, -RING_R)}
    ${cross(A1, RING_1, 0, -RING_R)}
    ${cross(A1, BODY_Y + CH_G, 0, -BODY_R)}
    ${cross(A1, GROOVE_Y, 0, GROOVE_D - BODY_R)}
    ${cross(A1, FACE_Y, -MOUTH_X, -OUTER_X)}
    ${extV(vx(0), vy(A1, -SAP_R) + 4, A1 + 166)}
    ${extV(vx(M.L), vy(A1, -SAP_R) + 4, A1 + 138)}
    ${extV(vx(BODY_Y), vy(A1, -NECK_R) + 4, A1 + 138)}
    ${extV(vx(FACE_Y), vy(A1, -OUTER_X) + 4, A1 + 138)}
    ${extV(X1, vy(A1, -OUTER_X + UC_D) + 4, A1 + 166)}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A1, SAP_R))}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A1, -SAP_R))}
    ${extH(vx(M.H - UC_I), X1 + 46, vy(A1, MOUTH_X))}
    ${extH(vx(M.H - UC_I), X1 + 46, vy(A1, -MOUTH_X))}
    ${hdim(vx(0), vx(M.L), A1 + 134, `L = ${fmt(M.L)}`)}
    ${hdim(vx(BODY_Y), vx(FACE_Y), A1 + 134, `(${fmt(BOY)})`)}
    ${hdim(vx(FACE_Y), X1, A1 + 134, `C = ${fmt(M.C)}`, onDeger('C'))}
    ${hdim(vx(0), X1, A1 + 162, `H = ${fmt(M.H)}`)}
    ${vdim(vx(0) - 40, vy(A1, SAP_R), vy(A1, -SAP_R), `ØS = ${fmt(M.S)}`)}
    ${vdim(X1 + 42, vy(A1, MOUTH_X), vy(A1, -MOUTH_X), `A ≥ ${fmt(M.A)}`)}
    ${note([vx(M.L / 2), vy(A1, SAP_R)], 100, 40, `ALTIGEN SAP SW ${fmt(KV_SW)} × ${fmt(M.L)}`, `köşeler Ø${fmt(M.S)} · akülü vidalama mandreni`)}
    ${note([vx(FACE_Y - M.Q + 2), vy(A1, M.P / 2 - 2)], 400, 40, `ORTA CEP Ø${fmt(M.P)} × ${fmt(M.Q)}`, `alın yuvası Ø${fmt(M.W)} × ${fmt(M.Y)} · delik Ø${fmt(M.J)}`, onDeger('P'))}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A1 + 196}" text-anchor="middle">YARIM KESİT</text>`;

// Logo notu: yan görünüşün sağ altında, ØD ölçüsünün altında
const MN = [548, 690];
const logoUc = logoNokta(LW * 0.78, LH * 0.62).map((n) => +n.toFixed(1));
const logoNot = `
    <polyline class="lead" points="${logoUc.join(',')} ${MN[0] - 4},${MN[1] + 6} ${MN[0] + 206},${MN[1] + 6}"/>
    <text class="tb" x="${MN[0]}" y="${MN[1]}">LAZER MARKALAMA</text>
    <text class="ts" x="${MN[0]}" y="${MN[1] + 22}">Ratel logosu · h ${fmt(MARK.yukseklik)} · yay ${fmt(+MARK_YAY.toFixed(1))} (${MARK_ACI}°)</text>
    <text class="ts" x="${MN[0]}" y="${MN[1] + 38}">arka yüzden ${fmt(MARK.alt)} · tırnak altında ortalı</text>`;

const yanGorunus = `
    <line class="ctr" x1="${X0 - 26}" y1="${A2}" x2="${X1 + 22}" y2="${A2}"/>
    <polygon class="vis" points="${tumu(A2, yanYari)}"/>
    ${logoCizim}
    ${logoNot}
    ${cross(A2, RING_0, -RING_R, RING_R)}
    ${cross(A2, RING_1, -RING_R, RING_R)}
    ${cross(A2, BODY_Y + CH_G, -BODY_R, BODY_R)}
    ${cross(A2, GROOVE_Y, GROOVE_D - BODY_R, BODY_R - GROOVE_D)}
    ${cross(A2, FACE_Y, -M.V / 2, M.V / 2)}
    ${along(A2, KIRIS, GROOVE_Y, FACE_Y)}
    ${along(A2, -KIRIS, GROOVE_Y, FACE_Y)}
    ${cross(A2, M.H - UC_D, UC_Y - M.V / 2, M.V / 2 - UC_Y)}
    <path class="dim" d="M${vx(M.L / 2)} ${vy(A2, SAP_R) - 30} V${vy(A2, SAP_R) - 10} M${vx(M.L / 2)} ${vy(A2, -SAP_R) + 10} V${vy(A2, -SAP_R) + 30}"/>
    <text class="tb" x="${vx(M.L / 2)}" y="${vy(A2, SAP_R) - 36}" text-anchor="middle">A</text>
    <text class="tb" x="${vx(M.L / 2)}" y="${vy(A2, -SAP_R) + 46}" text-anchor="middle">A</text>
    ${extH(vx(0) - 44, vx(0) + 8, vy(A2, KV_R))}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A2, -KV_R))}
    ${vdim(vx(0) - 40, vy(A2, KV_R), vy(A2, -KV_R), `SW ${fmt(KV_SW)}`)}
    ${extV(vx(M.L), vy(A2, -NECK_R) + 4, A2 + 138)}
    ${extV(vx(BODY_Y), vy(A2, -NECK_R) + 4, A2 + 138)}
    ${extH(vx(M.H - UC_Y), X1 + 46, vy(A2, M.V / 2))}
    ${extH(vx(M.H - UC_Y), X1 + 46, vy(A2, -M.V / 2))}
    ${extH(vx(FACE_Y), X1 + 108, vy(A2, BODY_R))}
    ${extH(vx(FACE_Y), X1 + 108, vy(A2, -BODY_R))}
    ${hdim(vx(M.L), vx(BODY_Y), A2 + 134, `T = ${fmt(M.T)}`)}
    ${vdim(X1 + 42, vy(A2, M.V / 2), vy(A2, -M.V / 2), `V = ${fmt(M.V)}`, onDeger('V'))}
    ${vdim(X1 + 104, vy(A2, BODY_R), vy(A2, -BODY_R), `ØD = ${fmt(M.D)}`)}
    ${note([vx(RING_0 + 1), vy(A2, RING_R)], 100, 396, `DAYAMA HALKASI Ø${fmt(M.Z)}`, 'mandren çeneleri buraya dayanır')}
    ${note([vx(M.H - 8), vy(A2, M.V / 2)], 480, 396, `TIRNAK ${fmt(M.V)} × ${fmt(M.U)} × ${fmt(M.C)}`, 'uçlarda iki yan ve ağız pahı', onDeger('V'))}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A2 + 198}" text-anchor="middle">YAN GÖRÜNÜŞ</text>
    <text class="ts" x="${X0 + (S * M.H) / 2}" y="${A2 + 218}" text-anchor="middle">yarım kesite göre 90° döndürülmüş</text>`;

// ---------------- ağız ve sap kesiti ----------------
const T = 6.4;
const NX = 930;
const NY = 196;
const CX = 1190;
const HS = 18;                             // A–A ölçeği: 1 mm = 18 px

const agizG = agiz(U, NX, NY, T);
const kesitAG = kesitA(U, CX, NY, HS);

// ---------------- işleme sırası ve açık noktalar ----------------
const ISLEM = [
  `Torna: sap Ø${fmt(M.S)} × ${fmt(M.L)}, boyun Ø${fmt(M.N)}, halka Ø${fmt(M.Z)}, gövde Ø${fmt(M.D)}, ön kanal.`,
  `Torna: alın yuvası Ø${fmt(M.W)}, orta cep Ø${fmt(M.P)} × ${fmt(M.Q)}, delik Ø${fmt(M.J)}.`,
  `Freze (bölücülü): altıgen sap SW ${fmt(KV_SW)} × ${fmt(M.L)}, köşeler Ø${fmt(M.S)} kalır.`,
  `Freze: iki tırnak ${fmt(M.V)} × ${fmt(M.U)}, dış düz yüzler ${fmt(2 * OUTER_X)}, uç pahları.`,
  `Isıl işlem yok: çubuk ıslahlı (+QT) gelir, ${spec.sertlik}. Yüzey: ${spec.yuzey}.`,
  `Lazer markalama: Ratel logosu, gövde çevresinde ${MARK_ACI}° yay, döner eksenle.`,
  'Deneme: akülü vidalamanın mandreninde oturma ve salgı, sonra gerçek kelepçede tork testi.',
];

const ACIK = [
  ...(spec.onayli ? [] : [
    'Tırnaklar kelepçede nereye oturuyor: karşılıklı iki nokta mı, kaç mm genişlik?',
    `Tırnak eni V (şimdilik ${fmt(M.V)}); boy C ${fmt(M.C)} onaylı.`,
    `Orta cep Ø${fmt(M.P)} × ${fmt(M.Q)} kelepçenin ortasındaki parçayı alıyor mu?`,
  ]),
  `Gereken sıkma torku (N·m): sap ≈ 40 N·m'ye dayanır, tork ayarı bunun altında tutulur.`,
];

const planlar = `
    <text class="tb" x="780" y="414">İŞLEME SIRASI</text>
    ${ISLEM.map((t, i) => `<text class="tn" x="780" y="${436 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}
    <text class="tb q" x="780" y="584">ÜRETİMDEN ÖNCE DOĞRULANACAK</text>
    ${ACIK.map((t, i) => `<text class="tn" x="780" y="${606 + i * 20}">${i + 1}. ${t}</text>`).join('\n    ')}`;

// ---------------- notlar ----------------
const NOTES = [
  `${spec.onayli ? 'Ölçüler onaylıdır.' : 'Taslak: turuncu ölçüler varsayımdır, gerçek kelepçe ölçülmeden üretime verilmez.'} Çizim orantılıdır, değerler esastır.`,
  `Genel tolerans ${spec.genelTolerans}. Ağız açıklığı A en az ${fmt(M.A)}: +0,50 / 0.`,
  `Sap: altıgen SW ${fmt(KV_SW)} × ${fmt(M.L)}, köşeler Ø${fmt(M.S)} çapında tornalanır; 10 ve 13 mm mandrene girer.`,
  `Gövde ile sap ekseni arasında salgı en çok 0,10. Malzeme: ${spec.malzeme}.`,
  `Sertlik ${spec.sertlik} (ıslahlı çubuk, ek ısıl işlem yok), yüzey ${spec.yuzey}. Keskin kenarlar 0,3 × 45°.`,
  'Üç ayaklı mandrenli akülü vidalamaya takılır; darbeli vidalama ve SDS matkap için değildir.',
  'Mandrende uç halkaya dayanana kadar sürülür, çeneler altıgenin yüzlerine oturur. 1/4″ hızlı bağlantıya girmez.',
  `Markalama: Ratel logosu (${MARK.logo}), tek renk, siyah oksitten sonra. Kabartı ve çapak bırakmaz.`,
];
const svg = sayfa(spec, {
  bloklar: [yarimKesit, yanGorunus, agizG, kesitAG, planlar],
  notlar: NOTES,
  not: { baslik: 822, ilk: 842, adim: 16.5 },
  stil: '\n      .mark{fill:#111;stroke:none}',
  antet: { ad: 'KELEPÇE SIKMA UCU', malzeme: `Çelik ${spec.malzemeKisa}` },
});

await writeFile(path.join(ROOT, 'kelepce-ucu-taslak.svg'), svg);
console.log('SVG   kelepce-ucu-taslak.svg');
