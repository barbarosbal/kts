# KTS — Kazan Altı Parçası, Oynar Rekor ve Kelepçe Sıkma Uçları

Pirinç (CW511L) parçaların ve çelik (42CrMo4) sıkma uçlarının 360° döndürülebilir 3D modelleri, teknik çizimleri ve fason üretim paketi.

- Canlı model: https://kts.ratel.systems (`?model=kazan`, `?model=rekor`, `?model=kelepce`, `?model=kelepce-v2`)
- Üretim paketleri: https://kts.ratel.systems/uretim/ (kazan altı parçası), https://kts.ratel.systems/uretim/rekor/ (oynar rekor)

## Ölçüler tek yerde

- `olculer.json`: kazan altı parçası. 3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadan üretilir. `markalama` alanı gövdenin boş tarafına sarılan Bahr logosunun (`brand/bahr-logo.svg`, lazer markalama) yüksekliğini, yerini ve açısını tutar.
- `rekor-olculer.json`: oynar rekor (ölçüler onaylı). 3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadan üretilir. `markalama` alanı bileziğin bir altıgen yüzündeki Bahr logosunun yüksekliğini ve yerini tutar.
- `kelepce-olculer.json`: kelepçe sıkma ucu (taslak, `varsayim` işaretli ölçüler gerçek kelepçe ölçülünce kesinleşir). 3D görüntüleyici ve teknik çizim bu dosyadan üretilir; üretim paketi henüz yok. `markalama` alanı gövdeye sarılan Ratel logosunun (`brand/ratel-lockup.svg`, lazer markalama) yüksekliğini ve yerini tutar.
- `kelepce-v2-olculer.json`: kelepçe sıkma ucu v2, ayrı ürün (taslak). Mil v1 ile aynı kafa ve sapı taşır (logo yok); kafanın arkasında iki rulmanla (6804-2RS) serbest dönen tırtıllı alüminyum kovan vardır, el kovanı tutup ucu kelepçenin dibinden destekler. Kafa, tırnak ve SDS ölçüleri v1 ile ayrı tutulur: kelepçe ölçülünce iki dosya da güncellenir. `markalama` kovanın arka düz bandına sarılan Ratel logosunun (lazer, siyah eloksal üstünde beyaz) yüksekliğini ve yerini tutar; `ayrik` görüntüleyicideki ayrık görünümün ötelemeleridir.

Ölçü değişince:

1. İlgili dosyada `olculer.*.deger`, `rev`, `tarih`, `revNot` güncellenir; ölçüler onaylıysa `"onayli": true` yapılır (turuncu "ön değer" işaretleri kalkar).
2. Yeniden üret:

   ```bash
   cd tools && npm install && npm run build
   ```

   Yalnızca rekor değiştiyse `npm run rekor`, yalnızca görüntüleyici veya kelepçe uçları değiştiyse `npm run site` yeterlidir.

3. Değişiklikler commit edilip `main`'e push edilir; GitHub Pages birkaç dakikada yayınlar.

`npm run build` şunları yazar: `uretim/*.step`, `uretim/*.dxf` (parça ve 1:1 marka DXF'i), teknik resim ve üretim planı PDF'leri (Edge ile basılır; Linux'ta `EDGE_PATH` Chromium headless shell'e verilebilir, ZIP için `bsdtar` gerekir), `uretim/index.html`, paket ZIP'i, `kazan-alti-parcasi-taslak.svg` (şablon: `tools/cizim-sablon.svg`). Ardından `npm run rekor` çalışır: `uretim/rekor/` altındaki paket, `oynar-rekor-taslak.svg` ve `index.html` içindeki `?v=` önbellek etiketleri.

## Dosyalar

- `index.html`, `app.js`, `style.css`: Three.js görüntüleyici (statik site). **Modeller** menüsü modeli seçer. **Ayrık** anahtarı (`A` tuşu) parçaları ayırıp birleştirir, tek parçalı modelde kapalıdır. **Teknik çizim** anahtarı (`T` tuşu) ölçü/etiket katmanını ve çizim panelini açar; `#teknik` ile doğrudan açık gelir.
- `model-kazan.js`, `model-rekor.js`, `model-kelepce.js`, `model-kelepce-v2.js`: modeller. `ortak.js`: diş yüzeyleri ve teknik katman yardımcıları. `kelepce-ortak.js`: iki kelepçe ucunun ortak mili (SDS-Plus kanalları, altıgen, tırnaklar). Yeni model için dosya, `index.html` içinde import map ve menü satırı, `tools/onbellek.mjs` içinde liste kaydı eklenir.
- `tools/build.mjs`, `tools/rekor-paket.mjs`: üretim paketi üreticileri (STEP için replicad / OpenCascade). `tools/paket-ortak.mjs`: DXF yazıcı, plan biçemi, PDF baskısı. `tools/rekor-olcu.mjs`: rekorun türetilmiş ölçüleri.
- `tools/rekor.mjs`: rekor teknik çizimi ve sökme yolu denetimi (`rekor-olculer.json` içindeki `sokme.yol`, boşluk 0,3 mm altına inerse uyarır). `tools/kelepce.mjs`, `tools/kelepce-v2.mjs`: kelepçe uçlarının teknik çizimleri; v2 ayrıca rulman, segman ve kovan zincirini denetler. `tools/kelepce-ortak.mjs`: ikisinin ortak sap, tırnak, ağız ve A–A çizimi, logo izdüşümü, sayfa ve antedi. `tools/onbellek.mjs`: önbellek etiketleri. `tools/marka.mjs`: pirinç parçaların logo izdüşümü ve 1:1 marka DXF'i.
- `tools/cizim-sablon.svg`: kazan altı parçası teknik resim şablonu. Çizim geometrisi şematiktir (ölçeksiz); port sayısı veya yerleşimi değişirse şablon da elle güncellenir.

## Bahr logosu

`brand/bahr-logo.svg` (işaret + "Bahr", Inter Regular; ilmeğin en geniş yeri B harfinin tepesinde, bağ uçları yazı tabanında) ve `brand/bahr-isaret.svg` (yalnız işaret, başörtüsü bağı) Figma'daki "Bahr — Logo" dosyasından gelir; yazı yola çevrilmiştir. Pirinç parçalarda lazer markalama olarak kullanılır; 3D görüntüleyicide iz rengi `ortak.js` içindeki `PIRINC_IZI`'dir.
