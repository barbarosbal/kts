// kelepce-v2-olculer.json → kelepce-ucu-v2-taslak.svg (teknik çizim sayfası)
// Kullanım: cd tools && npm run site
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, oku, fmt, uc, gorunus, hdim, vdim, extV, extH, note, agiz, kesitA, sayfa } from './kelepce-ortak.mjs';

const spec = await oku('kelepce-v2-olculer.json');
const U = uc(spec);
const {
  M, onDeger, SDS_Q, BODY_R, SAP_R, NECK_R, RING_R, FACE_Y, MOUTH_X, OUTER_X, RING_0, RING_1, GROOVE_Y, GROOVE_D,
  CH_G, UC_I, UC_D, UC_Y, AC, KI, KV_BAS, KV_SON, KV_KENAR, AC_TABAN, AC_CIKIS, AC_KENAR, KI_TABAN, KIRIS,
  acikYol, sapKesitYol, sapDisYol, sapYanYol, boyunHalka, tirnakKalinlik, tirnakEn, icCep,
} = U;
const { yatak: YT, rulman: RL, segman: SG, kovan: KV } = spec;

// ---------------- eksen zinciri ----------------
// Yatak yeri → segman kanalı → arka rulman/kovan → ön rulman → dayama omzu → kafa (model-kelepce-v2.js ile aynı)
const JR = YT.cap / 2;
const OMUZ_R = YT.omuzCap / 2;
const KANAL_R = SG.kanalCap / 2;
const Y_J = M.L + M.T;
const Y_K0 = Y_J + SG.kenar;
const Y_K1 = Y_K0 + SG.kanalEn;
const Y_R = Y_K1 + SG.bosluk;
const Y_C = Y_R + M.K;
const Y_KAFA = Y_C + YT.omuzBoy;
const G = FACE_Y - Y_KAFA;
const MANDREN = Y_R - M.L;                 // sap bitiminden (mandren burnu) kovan arka alnına
const ZINCIR = Y_C - Y_K1;                 // segman kanalı ön duvarından dayama omzuna

const KV_R = M.E / 2;
const SIPER_R = M.F / 2;
const YUVA_R = RL.D / 2;
const TIRTIL_SON = M.K - KV.siper - KV.tirtil.bosluk;

// ---------------- denetim ----------------
const uyar = (kosul, metin) => { if (kosul) console.warn(`UYARI: ${metin}`); };
uyar(G < M.Q, `kafa boyu ${fmt(G)} mm, orta cep derinliğinden (${M.Q}) kısa`);
uyar(SG.kenar < 1.5, `segman kanalı yatak yeri başına ${SG.kenar} mm, DIN 471 en az 1,5 ister`);
uyar(KV.icCap <= RL.icBilezik, `kovan iç omzu Ø${KV.icCap}, dönen iç bileziğe (Ø${RL.icBilezik}) sürtünür`);
uyar(KV.icCap >= RL.disBilezik, `kovan iç omzu Ø${KV.icCap}, dış bileziğe basmıyor (Ø${RL.disBilezik})`);
uyar(YT.omuzCap >= RL.icBilezik || YT.omuzCap <= YT.cap, `dayama omzu Ø${YT.omuzCap}, iç bilezik alnında değil`);
uyar(M.K < 2 * RL.B + 10, `kovan ${M.K} mm, iki rulman ve iç omuz için kısa`);
uyar(MANDREN < 8, `kovan mandren burnuna ${fmt(MANDREN)} mm, parmak sıkışır`);
uyar(SIPER_R <= KV_R, `siper Ø${M.F}, kovandan (Ø${M.E}) büyük değil`);
uyar(KV_R - YUVA_R - KV.tirtil.derinlik < 2, `kovan et kalınlığı rulman yuvasında ${fmt(+(KV_R - YUVA_R - KV.tirtil.derinlik).toFixed(2))} mm, 2 mm altında`);
uyar(KV.siper < KV.kavis + KV.siperR, 'siper bölgesi, genişleme ve ön yuvarlatmadan kısa');
console.log(`UC v2 ağız ≥ ${M.A} · kovan Ø${M.E} × ${M.K} · ${RL.adet} × ${RL.kod} · toplam boy ${M.H} · kafa ${fmt(G)} · mandren boşluğu ${fmt(MANDREN)} mm`);

// ---------------- profiller ----------------
// Mil: sap sonundan ön kanala dış çizgi
const boyunGovde = [
  ...boyunHalka,
  [NECK_R, Y_J],
  [JR - YT.pah, Y_J],
  [JR, Y_J + YT.pah],
  [JR, Y_K0],
  [KANAL_R, Y_K0],
  [KANAL_R, Y_K1],
  [JR, Y_K1],
  [JR, Y_C],
  [OMUZ_R, Y_C],
  [OMUZ_R, Y_KAFA],
  [BODY_R - CH_G, Y_KAFA],
  [BODY_R, Y_KAFA + CH_G],
  [BODY_R, GROOVE_Y - GROOVE_D],
  [BODY_R - GROOVE_D, GROOVE_Y],
];

const kesitYari = [[0, 0], ...sapKesitYol, ...boyunGovde, ...tirnakKalinlik, ...icCep];
const disYari = [[0, 0], ...sapDisYol, ...boyunGovde, ...tirnakKalinlik, [0, FACE_Y]];
const yanYari = [[0, 0], ...sapYanYol, ...boyunGovde.slice(2), ...tirnakEn];

// Kovan: dış çizgi (arka yuvarlatmadan siperin ön yuvarlatmasına), ve kesiti (yatak yerleri, iç omuz)
const R1 = KV.siperR;                      // siper ön kenar yuvarlatması
const RA = KV.arkaR;                       // arka kenar yuvarlatması
const YS = Y_R + M.K - KV.siper;           // siper genişlemesinin başı
const YF = YS + KV.kavis;                  // siper düz bölgesinin başı
const yay = (cr, cy, rho, a0, a1, n = 6) => Array.from({ length: n }, (_, i) => {
  const a = a0 + ((a1 - a0) * (i + 1)) / n;
  return [cr + rho * Math.cos(a), cy + rho * Math.sin(a)];
});
const siperEgrisi = Array.from({ length: 12 }, (_, i) => {
  const t = (i + 1) / 12;
  return [KV_R + ((SIPER_R - KV_R) * (1 - Math.cos(Math.PI * t))) / 2, YS + KV.kavis * t];
});
const kovanDis = [
  [KV_R - RA, Y_R],
  ...yay(KV_R - RA, Y_R + RA, RA, -Math.PI / 2, 0),
  [KV_R, YS],
  ...siperEgrisi,
  [SIPER_R, Y_C - R1],
  ...yay(SIPER_R - R1, Y_C - R1, R1, 0, Math.PI / 2),
];
const k = 0.5;
const kovanKesit = [
  [YUVA_R + k, Y_R],
  ...kovanDis,
  [YUVA_R + k, Y_C],
  [YUVA_R, Y_C - k],
  [YUVA_R, Y_C - RL.B],
  [KV.icCap / 2, Y_C - RL.B],
  [KV.icCap / 2, Y_R + RL.B],
  [YUVA_R, Y_R + RL.B],
  [YUVA_R, Y_R + k],
];
const kovanGorunus = [[0, Y_R], ...kovanDis, [0, Y_C]];

// ---------------- montaj: yarım kesit ----------------
const S = 4.4;                             // 1 mm = 4,4 px
const X0 = 96;
const A1 = 214;                            // montaj ekseni
const A2 = 566;                            // mil yan görünüş ekseni
const X1 = X0 + S * M.H;
const { vx, vy, yari, tumu, cross, along } = gorunus(S, X0);

// Rulman kesiti: bilezikler sık taralı, bilye beyaz, keçe ince çizgi
function rulmanKesit(y0) {
  const { d, D, B, icBilezik, disBilezik, bilye } = RL;
  const kutu = (r0, r1) => yari(A1, [[r0, y0], [r1, y0], [r1, y0 + B], [r0, y0 + B]]);
  return `
    <polygon class="vis" fill="url(#h3)" points="${kutu(d / 2, icBilezik / 2)}"/>
    <polygon class="vis" fill="url(#h3)" points="${kutu(disBilezik / 2, D / 2)}"/>
    <circle class="vis" style="fill:#fff;stroke-width:1.4" cx="${vx(y0 + B / 2)}" cy="${vy(A1, (d + D) / 4)}" r="${((S * bilye) / 2).toFixed(1)}"/>
    ${cross(A1, y0 + 0.3, icBilezik / 2, disBilezik / 2)}
    ${cross(A1, y0 + B - 0.3, icBilezik / 2, disBilezik / 2)}`;
}

// Segman: ince parça, kesitte dolu siyah
const SEG_Y0 = Y_K0 + (SG.kanalEn - SG.kalinlik) / 2;
const SEG_R1 = KANAL_R + SG.sirt - 0.5;
const segmanKesit = `<polygon fill="#111" points="${yari(A1, [[KANAL_R, SEG_Y0], [SEG_R1, SEG_Y0], [SEG_R1, SEG_Y0 + SG.kalinlik], [KANAL_R, SEG_Y0 + SG.kalinlik]])}"/>`;
const segmanDis = `<polygon class="vis" style="fill:#fff;stroke-width:1.4" points="${yari(A1, [[JR, SEG_Y0], [SEG_R1, SEG_Y0], [SEG_R1, SEG_Y0 + SG.kalinlik], [JR, SEG_Y0 + SG.kalinlik]], -1)}"/>`;

// Parça numarası: balon ve ucu noktalı kılavuz
function balon(no, bx, by, [x, y]) {
  return `
    <line class="dim" x1="${bx}" y1="${by + 11}" x2="${x}" y2="${y}"/>
    <circle cx="${x}" cy="${y}" r="2.2" fill="#111"/>
    <circle class="bal" cx="${bx}" cy="${by}" r="11"/>
    <text class="tb" x="${bx}" y="${by + 5}" text-anchor="middle">${no}</text>`;
}

// Tırtıl alanının ortasında kutulu yazı
const TX0 = vx(Y_R + (KV.tirtil.bas + TIRTIL_SON) / 2);
const TY0 = vy(A1, -KV_R / 2);
const tirtilEtiket = `
    <rect x="${TX0 - 52}" y="${TY0 - 22}" width="104" height="42" fill="#fff" stroke="#111" stroke-width=".8"/>
    <text class="tb" x="${TX0}" y="${TY0 - 4}" text-anchor="middle">TIRTIL</text>
    <text class="tb" x="${TX0}" y="${TY0 + 14}" text-anchor="middle">${KV.tirtil.tip} ${fmt(KV.tirtil.adim)}</text>`;

const tirtil = `<rect x="${vx(Y_R + KV.tirtil.bas)}" y="${A1}" width="${(S * (TIRTIL_SON - KV.tirtil.bas)).toFixed(1)}" height="${(S * KV_R).toFixed(1)}" fill="url(#kn)"/>`;

const montaj = `
    <line class="ctr" x1="${X0 - 26}" y1="${A1}" x2="${X1 + 22}" y2="${A1}"/>
    <polygon class="vis" fill="url(#h1)" points="${yari(A1, kesitYari)}"/>
    <polygon class="vis" fill="url(#h2)" points="${yari(A1, kovanKesit)}"/>
    ${rulmanKesit(Y_R)}
    ${rulmanKesit(Y_C - RL.B)}
    ${segmanKesit}
    <polygon class="vis" points="${yari(A1, disYari, -1)}"/>
    ${along(A1, -AC.en / 2, 0, AC.boy - AC_CIKIS)}
    ${cross(A1, AC.boy - AC_CIKIS, 0, -AC.en / 2)}
    ${along(A1, -KV_KENAR, KV_BAS, KV_SON)}
    ${cross(A1, KV_BAS, 0, -SAP_R)}
    ${cross(A1, KV_SON, 0, -NECK_R)}
    ${cross(A1, RING_0, 0, -RING_R)}
    ${cross(A1, RING_1, 0, -RING_R)}
    ${cross(A1, Y_J + YT.pah, 0, -JR)}
    ${cross(A1, Y_KAFA + CH_G, 0, -BODY_R)}
    ${cross(A1, GROOVE_Y, 0, GROOVE_D - BODY_R)}
    ${cross(A1, FACE_Y, -MOUTH_X, -OUTER_X)}
    <polygon class="vis" points="${yari(A1, kovanGorunus, -1)}"/>
    ${tirtil}
    ${cross(A1, Y_R + RA, 0, -KV_R)}
    ${cross(A1, YF, 0, -SIPER_R)}
    ${cross(A1, Y_C - R1, 0, -SIPER_R)}
    ${segmanDis}
    ${balon(4, 322, 70, [vx(SEG_Y0 + 0.6), vy(A1, KANAL_R + 1)])}
    ${balon(2, 400, 70, [vx(Y_R + 22), vy(A1, KV_R - 2)])}
    ${balon(3, 480, 70, [vx(Y_C - RL.B / 2), vy(A1, (RL.disBilezik + RL.D) / 4)])}
    ${balon(1, 560, 70, [vx(FACE_Y - 4), vy(A1, OMUZ_R)])}
    ${tirtilEtiket}
    ${extV(vx(0), vy(A1, -SAP_R) + 4, A1 + 158)}
    ${extV(vx(M.L), vy(A1, -SAP_R) + 4, A1 + 132)}
    ${extV(vx(Y_R), vy(A1, -(KV_R - RA)) + 4, A1 + 132)}
    ${extV(vx(Y_C), vy(A1, -(SIPER_R - R1)) + 4, A1 + 132)}
    ${extV(vx(FACE_Y), vy(A1, -OUTER_X) + 4, A1 + 132)}
    ${extV(X1, vy(A1, -OUTER_X + UC_D) + 4, A1 + 158)}
    ${extH(vx(M.H - UC_I), X1 + 44, vy(A1, MOUTH_X))}
    ${extH(vx(M.H - UC_I), X1 + 44, vy(A1, -MOUTH_X))}
    ${extH(vx(Y_C - R1) + 4, X1 + 116, vy(A1, SIPER_R))}
    ${extH(vx(Y_C - R1) + 4, X1 + 116, vy(A1, -SIPER_R))}
    ${extH(vx(Y_R + RA) - 4, vx(0) - 40, vy(A1, KV_R))}
    ${extH(vx(Y_R + RA) - 4, vx(0) - 40, vy(A1, -KV_R))}
    ${hdim(vx(0), vx(M.L), A1 + 128, `L = ${fmt(M.L)}`)}
    ${hdim(vx(M.L), vx(Y_R), A1 + 128, fmt(MANDREN))}
    ${hdim(vx(Y_R), vx(Y_C), A1 + 128, `K = ${fmt(M.K)}`)}
    ${hdim(vx(Y_C), vx(FACE_Y), A1 + 128, `(${fmt(FACE_Y - Y_C)})`)}
    ${hdim(vx(FACE_Y), X1, A1 + 128, `C = ${fmt(M.C)}`, onDeger('C'))}
    ${hdim(vx(0), X1, A1 + 154, `H = ${fmt(M.H)}`)}
    ${vdim(X1 + 40, vy(A1, MOUTH_X), vy(A1, -MOUTH_X), `A ≥ ${fmt(M.A)}`)}
    ${vdim(X1 + 112, vy(A1, SIPER_R), vy(A1, -SIPER_R), `ØF = ${fmt(M.F)}`)}
    ${vdim(vx(0) - 36, vy(A1, KV_R), vy(A1, -KV_R), `ØE = ${fmt(M.E)}`)}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A1 + 186}" text-anchor="middle">MONTAJ · YARIM KESİT</text>
    <text class="ts" x="${X0 + (S * M.H) / 2}" y="${A1 + 204}" text-anchor="middle">üst yarı kesit, alt yarı görünüş · kovan elde durur, mil içinde döner</text>`;

// ---------------- mil: yan görünüş ----------------
const ovalY = [KI.bas + KI.en / 2, KI.son - KI.en / 2].map(vx);
const ovalR = (S * KI.en) / 2;
const oval = `<path class="thin" d="M${ovalY[0]} ${A2 - ovalR} H${ovalY[1]} A${ovalR} ${ovalR} 0 0 1 ${ovalY[1]} ${A2 + ovalR} H${ovalY[0]} A${ovalR} ${ovalR} 0 0 1 ${ovalY[0]} ${A2 - ovalR} Z"/>`;
const acikGorunen = acikYol().filter(([r]) => r <= U.KV_R);

const milYan = `
    <line class="ctr" x1="${X0 - 26}" y1="${A2}" x2="${X1 + 22}" y2="${A2}"/>
    <polygon class="vis" points="${tumu(A2, yanYari)}"/>
    ${oval}
    ${along(A2, AC_TABAN, 0, AC.boy - AC_CIKIS, 'hid')}
    ${along(A2, -AC_TABAN, 0, AC.boy - AC_CIKIS, 'hid')}
    <polyline class="hid" points="${yari(A2, acikGorunen)}"/>
    <polyline class="hid" points="${yari(A2, acikGorunen, -1)}"/>
    ${cross(A2, RING_0, -RING_R, RING_R)}
    ${cross(A2, RING_1, -RING_R, RING_R)}
    ${cross(A2, Y_J + YT.pah, -JR, JR)}
    ${cross(A2, Y_KAFA + CH_G, -BODY_R, BODY_R)}
    ${cross(A2, GROOVE_Y, GROOVE_D - BODY_R, BODY_R - GROOVE_D)}
    ${cross(A2, FACE_Y, -M.V / 2, M.V / 2)}
    ${along(A2, KIRIS, GROOVE_Y, FACE_Y)}
    ${along(A2, -KIRIS, GROOVE_Y, FACE_Y)}
    ${cross(A2, M.H - UC_D, UC_Y - M.V / 2, M.V / 2 - UC_Y)}
    <path class="dim" d="M${vx(25)} ${vy(A2, SAP_R) - 30} V${vy(A2, SAP_R) - 10} M${vx(25)} ${vy(A2, -SAP_R) + 10} V${vy(A2, -SAP_R) + 30}"/>
    <text class="tb" x="${vx(25)}" y="${vy(A2, SAP_R) - 36}" text-anchor="middle">A</text>
    <text class="tb" x="${vx(25)}" y="${vy(A2, -SAP_R) + 46}" text-anchor="middle">A</text>
    ${note([vx(18), vy(A2, KI.en / 2 - 0.6)], vx(18) + 4, 440, `SDS-PLUS SAP Ø${fmt(M.S)} × ${fmt(M.L)}`, `kilit ${fmt(KI.en)} × ${fmt(KI.derinlik)} · açık ${fmt(AC.en)} × ${fmt(AC.derinlik)}`, SDS_Q, 180)}
    ${note([vx(Y_K0 + SG.kanalEn / 2), vy(A2, KANAL_R)], 400, 440, `SEGMAN KANALI Ø${fmt(SG.kanalCap)} × ${fmt(SG.kanalEn)}`, `${SG.standart} · yatak yeri başından ${fmt(SG.kenar)}`, '', 180)}
    ${note([vx(Y_C + YT.omuzBoy / 2), vy(A2, OMUZ_R)], 600, 466, `DAYAMA OMZU Ø${fmt(YT.omuzCap)} × ${fmt(YT.omuzBoy)}`, 'yalnız iç bileziğe basar', '', 160)}
    ${vdim(vx(Y_R + 22), vy(A2, JR), vy(A2, -JR), `Ø${fmt(YT.cap)} ${YT.tolerans}`)}
    ${extV(vx(0), vy(A2, -AC_KENAR) + 4, A2 + 152)}
    ${extV(vx(M.L), vy(A2, -NECK_R) + 4, A2 + 100)}
    ${extV(vx(Y_J), vy(A2, -NECK_R) + 4, A2 + 100)}
    ${extV(vx(Y_K1), vy(A2, -KANAL_R) + 4, A2 + 126)}
    ${extV(vx(Y_C), vy(A2, -JR) + 4, A2 + 126)}
    ${extV(vx(FACE_Y), vy(A2, -BODY_R) + 4, A2 + 100)}
    ${extV(X1, vy(A2, -M.V / 2 + UC_Y) + 4, A2 + 152)}
    ${extH(vx(M.H - UC_Y), X1 + 40, vy(A2, M.V / 2))}
    ${extH(vx(M.H - UC_Y), X1 + 40, vy(A2, -M.V / 2))}
    ${extH(vx(FACE_Y), X1 + 108, vy(A2, BODY_R))}
    ${extH(vx(FACE_Y), X1 + 108, vy(A2, -BODY_R))}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A2, SAP_R))}
    ${extH(vx(0) - 44, vx(0) + 8, vy(A2, -SAP_R))}
    ${hdim(vx(0), vx(M.L), A2 + 96, `L = ${fmt(M.L)}`)}
    <line class="dima" x1="${vx(M.L)}" y1="${A2 + 96}" x2="${vx(Y_J)}" y2="${A2 + 96}"/>
    <text class="tb" x="${(vx(M.L) + vx(Y_J)) / 2}" y="${A2 + 114}" text-anchor="middle">T = ${fmt(M.T)}</text>
    ${hdim(vx(Y_J), vx(Y_C), A2 + 96, fmt(Y_C - Y_J))}
    ${hdim(vx(Y_C), vx(FACE_Y), A2 + 96, `(${fmt(FACE_Y - Y_C)})`)}
    ${hdim(vx(FACE_Y), X1, A2 + 96, `C = ${fmt(M.C)}`, onDeger('C'))}
    ${hdim(vx(Y_K1), vx(Y_C), A2 + 122, `${fmt(+ZINCIR.toFixed(2))} +0,1/0`)}
    ${hdim(vx(0), X1, A2 + 148, `H = ${fmt(M.H)}`)}
    ${vdim(vx(0) - 40, vy(A2, SAP_R), vy(A2, -SAP_R), `ØS = ${fmt(M.S)}`)}
    ${vdim(X1 + 36, vy(A2, M.V / 2), vy(A2, -M.V / 2), `V = ${fmt(M.V)}`, onDeger('V'))}
    ${vdim(X1 + 104, vy(A2, BODY_R), vy(A2, -BODY_R), `ØD = ${fmt(M.D)}`)}
    <text class="h" x="${X0 + (S * M.H) / 2}" y="${A2 + 178}" text-anchor="middle">MİL · YAN GÖRÜNÜŞ</text>
    <text class="ts" x="${X0 + (S * M.H) / 2}" y="${A2 + 196}" text-anchor="middle">montaja göre 90° döndürülmüş · kafa boyu ${fmt(G)}</text>`;

// ---------------- ağız ve A–A ----------------
const NX = 890;
const NY = 168;
const T = 4.2;
const siperArkada = `
    <circle class="vis" style="fill:#fff" cx="${NX}" cy="${NY}" r="${(T * SIPER_R).toFixed(1)}"/>
    <circle class="hid" cx="${NX}" cy="${NY}" r="${(T * KV_R).toFixed(1)}"/>`;
const agizG = agiz(U, NX, NY, T, siperArkada);
const kesitAG = kesitA(U, 1190, NY, 16);

// ---------------- parça listesi, sıralar, açık noktalar ----------------
const PARCALAR = [
  ['1', 'Mil', '1', `${spec.malzemeKisa} · ${spec.sertlik} · siyah oksit`],
  ['2', 'Döner kovan', '1', `${KV.malzeme.replace(' alüminyum', '')} · ${KV.yuzey}`],
  ['3', `Rulman ${RL.kod}`, String(RL.adet), `${RL.d} × ${RL.D} × ${RL.B} · sabit bilyalı, iki yanı keçeli`],
  ['4', `Segman ${SG.standart} – ${SG.olcu}`, '1', 'yay çeliği, fosfatlı'],
  ['–', 'Yatak sabitleyici', '–', 'anaerobik, orta mukavemet (ör. Loctite 641)'],
];
const TX = [790, 826, 1024, 1070];
const TY = 382;
const RH = 20;
const tablo = `
    <text class="tb" x="790" y="372">PARÇA LİSTESİ</text>
    <rect class="grid" x="784" y="${TY}" width="572" height="${RH * (PARCALAR.length + 1)}"/>
    <path class="grid" d="${[...Array(PARCALAR.length).keys()].map((i) => `M784 ${TY + RH * (i + 1)} H1356`).join(' ')} ${TX.slice(1).map((x) => `M${x - 6} ${TY} V${TY + RH * (PARCALAR.length + 1)}`).join(' ')}"/>
    ${['NO', 'PARÇA', 'ADET', 'MALZEME · STANDART'].map((t, i) => `<text class="tl" x="${TX[i]}" y="${TY + 14}">${t}</text>`).join('')}
    ${PARCALAR.map((row, j) => row.map((t, i) => `<text class="${i === 1 ? 'tb' : 'tn'}" x="${TX[i]}" y="${TY + RH * (j + 1) + 15}">${t}</text>`).join('')).join('\n    ')}`;

const ISLEM = [
  `Mil torna: sap, halka, yatak yeri Ø${fmt(YT.cap)} (taşlama payı), kanal, omuz, kafa Ø${fmt(M.D)}, alın ve cep.`,
  `Mil freze: SDS kanalları, altıgen SW ${fmt(spec.kavrama.sw)}, iki tırnak ve dış düz yüzler.`,
  `Isıl işlem ${spec.sertlik}; yatak yeri Ø${fmt(YT.cap)} ${YT.tolerans} taşlanır; kumlama + siyah oksit.`,
  `Kovan torna: Ø${fmt(M.E)}, siper Ø${fmt(M.F)}, yatak yerleri Ø${fmt(RL.D)} ${KV.yatakTolerans}; tırtıl; ${KV.yuzey}.`,
  'Rulmanlar kovana preslenir; kovan saptan mile sürülür, segman takılır.',
  'Deneme: kovan elde serbest döner; matkapta 2 dk boşta, sonra kelepçede tork.',
];

const ACIK = [
  'SDS kanal ölçüleri gerçek bir SDS-Plus uçtan; altıgenli sap SDS mandrende denenecek.',
  `Tırnakların kelepçede oturduğu yer, C × V (${fmt(M.C)} × ${fmt(M.V)}) ve orta cep Ø${fmt(M.P)} × ${fmt(M.Q)}.`,
  `Kelepçe çevresinde siper Ø${fmt(M.F)} için yer: siper tırnak ucundan ${fmt(M.H - Y_C)} mm geride.`,
  `Mandren burnu ile kovan arası ${fmt(MANDREN)} mm: matkabın mandren burnu ölçülecek.`,
  'Gereken sıkma torku (N·m).',
];

if (ISLEM.length > 6 || ACIK.length > 5) console.warn('UYARI: işleme / doğrulama listesi antede taşar');

const planlar = `${tablo}
    <text class="tb" x="790" y="524">İŞLEME VE MONTAJ SIRASI</text>
    ${ISLEM.map((t, i) => `<text class="tn" x="790" y="${544 + i * 18}">${i + 1}. ${t}</text>`).join('\n    ')}
    <text class="tb q" x="790" y="660">ÜRETİMDEN ÖNCE DOĞRULANACAK</text>
    ${ACIK.map((t, i) => `<text class="tn" x="790" y="${680 + i * 18}">${i + 1}. ${t}</text>`).join('\n    ')}`;

// ---------------- notlar ----------------
const NOTES = [
  `${spec.onayli ? 'Ölçüler onaylıdır.' : 'Taslak: turuncu ölçüler varsayımdır, gerçek kelepçe ölçülmeden üretime verilmez.'} Çizim orantılıdır, değerler esastır.`,
  `Genel tolerans ${spec.genelTolerans}. Ağız A en az ${fmt(M.A)}: +0,50 / 0. Kovanın mil üzerindeki eksenel boşluğu 0,1–0,3.`,
  `Mil: ${spec.malzemeKisa}, ${spec.sertlik}. Yatak yeri Ø${fmt(YT.cap)} ${YT.tolerans}, Ra 0,4, kumlamada maskelenir. Kafada salgı en çok 0,05.`,
  `Kovan: ${KV.malzemeKisa}, ${KV.yuzey}. Yatak yerleri Ø${fmt(RL.D)} ${KV.yatakTolerans} × ${fmt(RL.B)}, eş eksenlik 0,02, maskeli; iç omuz Ø${fmt(KV.icCap)}.`,
  `Kovan alnı kafadan ${fmt(YT.omuzBoy)} mm geride kalır; dönen kafa ile duran kovan birbirine değmez.`,
  'SDS-Plus matkapta darbe kapalı kullanılır. El kovanı siperin arkasından tutar, ucu kelepçeye bastırır.',
  'Üç ayaklı mandrende uç halkaya dayanana kadar sürülür, çeneler altıgene oturur. 1/4″ altıgen mandrene girmez.',
];

const desen = `
    <pattern id="h2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="#111" stroke-width=".8"/></pattern>
    <pattern id="h3" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="4" stroke="#111" stroke-width=".7"/></pattern>
    <pattern id="kn" width="14" height="8.08" patternUnits="userSpaceOnUse"><path d="M0 0 L14 8.08 M0 8.08 L14 0" stroke="#111" stroke-width=".6" fill="none"/></pattern>`;

const svg = sayfa(spec, {
  bloklar: [montaj, milYan, agizG, kesitAG, planlar],
  notlar: NOTES,
  desen,
  stil: '\n      .bal{fill:#fff;stroke:#111;stroke-width:1.2}',
  antet: { ad: 'KELEPÇE SIKMA UCU v2', malzeme: `${spec.malzemeKisa} + Al 6082` },
});

await writeFile(path.join(ROOT, 'kelepce-ucu-v2-taslak.svg'), svg);
console.log('SVG   kelepce-ucu-v2-taslak.svg');
