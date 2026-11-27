# KTS — Kazan Altı Parçası, Oynar Rekor ve Kelepçe Sıkma Uçları

Pirinç (CW511L) parçaların ve çelik sıkma uçlarının 360° döndürülebilir 3D modelleri, teknik çizimleri ve fason üretim paketi. Güncel tek parça kelepçe ucu **Rev J**, C45E+QT teslim şartıyla teklif / numune adayıdır; fiziksel uyum ve çalışma torku henüz doğrulanmadı.

- Canlı model: https://eng.ratel.systems (`?model=kelepce` güncel Rev J, `?model=kelepce-revI` önceki geometri, `?model=kelepce-v2`, `?model=kazan`, `?model=rekor`, `?model=bileklik`, `?model=bileklik-ayarli`, `?model=bileklik-kilif`, `?model=toka`; adres boşsa Rev J açılır)
- Gömülü görünüm: adrese `&embed=1` eklenince yalnız model ve İzo/Ön/Üst/Alt görünür; başlık bloğu (logo, ad, **Modeller**, **Üretim paketi**), **Ayrık** ve **Teknik çizim** gizlenir, A / T kısayolları ve `#teknik` kapanır; İzo/Ön/Üst/Alt her genişlikte sağ üstte durur (ör. ratel.systems/shop: `?model=kelepce&embed=1`).
- Üretim paketleri: https://eng.ratel.systems/uretim/ (kazan altı parçası), https://eng.ratel.systems/uretim/rekor/ (oynar rekor), https://eng.ratel.systems/uretim/kelepce/ (kelepçe uçları, teklif paketi)

## Ölçüler tek yerde

- `kelepce-revJ-olculer.json`: güncel tek parça Rev J. CAD ve kontrol raporu `tools/kelepce-revJ.mjs` ile, teknik resim ve lazer vektörleri `tools/kelepce-revJ-resim.mjs` ile üretilir. Görüntüleyici `model-kelepce-revJ.js`, aynı OpenCascade katısının `uretim/kelepce-revJ/revJ-mesh.json` ağını kullanır. Üretici incelemesi için STEP, PDF/SVG, 1:1 logo DXF, karşılaştırma ve ZIP: [Rev J paketi](uretim/kelepce-revJ/). Lazer **0,03–0,05 mm metal kaldırarak kazıma**, boyasız ve çelik rengindedir. Yeni fiyat ve C45E+QT teslimi ayrıca teyit edilir.
- `olculer.json`: kazan altı parçası. 3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadan üretilir. `markalama` alanı gövdenin boş tarafına sarılan Bahr logosunun (`brand/bahr-logo.svg`, lazer markalama) yüksekliğini, yerini ve açısını tutar.
- `rekor-olculer.json`: oynar rekor (ölçüler onaylı). 3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadan üretilir. `markalama` alanı bileziğin bir altıgen yüzündeki Bahr logosunun yüksekliğini ve yerini tutar.
- `kelepce-olculer.json`: kelepçe sıkma ucu (taslak, `varsayim` işaretli ölçüler gerçek kelepçe ölçülünce kesinleşir). 3D görüntüleyici, teknik çizim ve teklif paketi (`uretim/kelepce/`, `npm run kelepce`) bu dosyadan üretilir. `markalama` alanı gövdeye sarılan Ratel logosunun (`brand/ratel-lockup.svg`, lazer kazıma) yüksekliğini ve yerini tutar; `tools/kelepce-markalama.mjs` atölye için lazer kazıma resmini (`kelepce-ucu-markalama.svg`, pakette PDF) üretir, 1:1 logo DXF/SVG'si pakete yazılır.
- `kelepce-v2-olculer.json`: kelepçe sıkma ucu v2, ayrı ürün (taslak). Mil v1 ile aynı kafa ve sapı taşır (logo yok); kafanın arkasında iki rulmanla (6804-2RS) serbest dönen tırtıllı alüminyum kovan vardır, el kovanı tutup ucu kelepçenin dibinden destekler. Kafa, tırnak ve sap ölçüleri v1 ile ayrı tutulur: kelepçe ölçülünce iki dosya da güncellenir. `markalama` kovanın arka düz bandına sarılan Ratel logosunun (lazer, siyah eloksal üstünde beyaz) yüksekliğini ve yerini tutar; `ayrik` görüntüleyicideki ayrık görünümün ötelemeleridir.

- `bileklik-olculer.json`: tipay bileklik (taslak, ölçüler varsayım). Kapalı silikon halka, S/M/L boy (iç çevre), W 22; kimlik modülü (NFC inlay + 18 × 18 tekil QR plakası) cebe gömülü, yüzeyle aynı hizada; tüm bileklikler NFC + QR. Görüntüleyici `model-bileklik.js`, teknik çizim `bileklik-taslak.svg` (`cd tools && node bileklik-resim.mjs`, ardından `node onbellek.mjs`).
- `bileklik-ayarli-olculer.json`: aynı ön yüzün ayarlı eşi (taslak). Tek parça silikon kayış, toka bileğin arkasında (mantar pim, 7 delik, tutucu halka), tek beden. Görüntüleyici `model-bileklik-ayarli.js`, teknik çizim `bileklik-ayarli-taslak.svg`. İki bilekliğin ortak ön yüzü (gömme QR + NFC modülü, logo, dokun işareti) `bileklik-ortak.js`'te; iki teknik çizim de `tools/bileklik-resim.mjs` ile üretilir.
- `bileklik-kilif-olculer.json`: baskılı elastik kumaş bilekliğe kaydırılarak takılan tipay kimlik kılıfı (taslak). Kılıf dikiş yerini örter; önünde aynı gömme 18 × 18 QR + NFC modülü ve dokun işareti var. Görüntüleyici `model-bileklik-kilif.js`, teknik çizim `bileklik-kilif-taslak.svg` (aynı `tools/bileklik-resim.mjs`).
- `toka-olculer.json`: ilk 100 bileklik için PA12 toka (numune adayı, Rev C). Kurucunun sac prototipinin fikri; arkası kapalı kanal (26 × 3,0 mm, 25 mm bant), bilek yüzü R45 kavisli, ön yüzde 38 × 18 esnek etiket cebi, altında NFC. `tools/toka.mjs` replicad / OpenCascade ile STEP, ağ ve kontrol raporunu; `tools/toka-resim.mjs` A3 teknik resim (SVG/PDF), 1:1 etiket şablonu, paket sayfası ve ZIP'i üretir ([uretim/toka/](uretim/toka/)). Görüntüleyici `model-toka.js` aynı katının ağını kullanır.

Ölçü değişince:

1. İlgili dosyada `olculer.*.deger`, `rev`, `tarih`, `revNot` güncellenir; ölçüler onaylıysa `"onayli": true` yapılır (turuncu "ön değer" işaretleri kalkar).
2. Yeniden üret:

   ```bash
   cd tools && npm install && npm run build
   ```

   Yalnızca rekor değiştiyse `npm run rekor`; önceki kelepçe uçlarının çizimleri için `npm run site`. **Rev J** için `npm run kelepce:revj`, ardından `node onbellek.mjs` çalıştırılır. PDF alternatifleri ve numune kontrolü [Rev J notlarında](uretim/kelepce-revJ/README.md).

3. Değişiklikler commit edilip `main`'e push edilir; GitHub Pages birkaç dakikada yayınlar.

`npm run build` şunları yazar: `uretim/*.step`, `uretim/*.dxf` (parça ve 1:1 marka DXF'i), teknik resim ve üretim planı PDF'leri (Edge ile basılır; Linux'ta `EDGE_PATH` Chromium headless shell'e verilebilir, ZIP için `bsdtar` gerekir), `uretim/index.html`, paket ZIP'i, `kazan-alti-parcasi-taslak.svg` (şablon: `tools/cizim-sablon.svg`). Ardından `npm run rekor` çalışır: `uretim/rekor/` altındaki paket, `oynar-rekor-taslak.svg` ve `index.html` içindeki `?v=` önbellek etiketleri.

## Dosyalar

- `index.html`, `app.js`, `style.css`: Three.js görüntüleyici (statik site). **Modeller** menüsü modeli seçer. **Ayrık** anahtarı (`A` tuşu) parçaları ayırıp birleştirir, tek parçalı modelde kapalıdır. **Teknik çizim** anahtarı (`T` tuşu) ölçü/etiket katmanını ve çizim panelini açar; `#teknik` ile doğrudan açık gelir.
- `model-kazan.js`, `model-rekor.js`, `model-kelepce.js`, `model-kelepce-v2.js`: modeller. `ortak.js`: diş yüzeyleri ve teknik katman yardımcıları. `kelepce-ortak.js`: iki kelepçe ucunun ortak mili (8 mm altıgen sap, tırnaklar). Yeni model için dosya, `index.html` içinde import map ve menü satırı, `tools/onbellek.mjs` içinde liste kaydı eklenir.
- `tools/build.mjs`, `tools/rekor-paket.mjs`: üretim paketi üreticileri (STEP için replicad / OpenCascade). `tools/paket-ortak.mjs`: DXF yazıcı, plan biçemi, PDF baskısı. `tools/rekor-olcu.mjs`: rekorun türetilmiş ölçüleri.
- `tools/rekor.mjs`: rekor teknik çizimi ve sökme yolu denetimi (`rekor-olculer.json` içindeki `sokme.yol`, boşluk 0,3 mm altına inerse uyarır). `tools/kelepce.mjs`, `tools/kelepce-v2.mjs`: kelepçe uçlarının teknik çizimleri; v2 ayrıca rulman, segman ve kovan zincirini denetler. `tools/kelepce-ortak.mjs`: ikisinin ortak sap, tırnak, ağız ve A–A çizimi, logo izdüşümü, sayfa ve antedi. `tools/onbellek.mjs`: önbellek etiketleri. `tools/marka.mjs`: pirinç parçaların logo izdüşümü ve 1:1 marka DXF'i. `tools/kelepce-paket.mjs`: kelepçe uçlarının teklif paketi (v1 mil, v2 mil ve kovan STEP'leri, teknik resim PDF'leri, ZIP); Xometry gibi anında teklif platformlarına yüklenir.
- `tools/cizim-sablon.svg`: kazan altı parçası teknik resim şablonu. Çizim geometrisi şematiktir (ölçeksiz); port sayısı veya yerleşimi değişirse şablon da elle güncellenir.

## Bahr logosu

`brand/bahr-logo.svg` (işaret + "Bahr"; yazı Inter Regular ile Medium arası, gövdesi Regular'dan %15 kalın; kurgu: işaretin tepesi, B'nin sağ üst omzu ve a'nın tepesi tek doğruya teğet, bağ uçları yazı tabanında) ve `brand/bahr-isaret.svg` (yalnız işaret, başörtüsü bağı) Figma'daki "Bahr — Logo" dosyasından gelir; yazı yola çevrilmiştir. Pirinç parçalarda lazer markalama olarak kullanılır; 3D görüntüleyicide iz rengi `ortak.js` içindeki `PIRINC_IZI`'dir.

