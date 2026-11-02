# KTS — Kazan Altı Parçası, Oynar Rekor ve Kelepçe Sıkma Ucu

Pirinç (CW511L) parçaların ve çelik (42CrMo4) sıkma ucunun 360° döndürülebilir 3D modelleri, teknik çizimleri ve fason üretim paketi.

- Canlı model: https://kts.ratel.systems (`?model=kazan`, `?model=rekor`, `?model=kelepce`)
- Üretim paketleri: https://kts.ratel.systems/uretim/ (kazan altı parçası), https://kts.ratel.systems/uretim/rekor/ (oynar rekor)

## Ölçüler tek yerde

- `olculer.json`: kazan altı parçası. 3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadan üretilir.
- `rekor-olculer.json`: oynar rekor (ölçüler onaylı). 3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadan üretilir.
- `kelepce-olculer.json`: kelepçe sıkma ucu (taslak, `varsayim` işaretli ölçüler gerçek kelepçe ölçülünce kesinleşir). 3D görüntüleyici ve teknik çizim bu dosyadan üretilir; üretim paketi henüz yok.

Ölçü değişince:

1. İlgili dosyada `olculer.*.deger`, `rev`, `tarih`, `revNot` güncellenir; ölçüler onaylıysa `"onayli": true` yapılır (turuncu "ön değer" işaretleri kalkar).
2. Yeniden üret:

   ```bash
   cd tools && npm install && npm run build
   ```

   Yalnızca rekor değiştiyse `npm run rekor`, yalnızca görüntüleyici veya kelepçe ucu değiştiyse `npm run site` yeterlidir.

3. Değişiklikler commit edilip `main`'e push edilir; GitHub Pages birkaç dakikada yayınlar.

`npm run build` şunları yazar: `uretim/*.step`, `uretim/*.dxf`, teknik resim ve üretim planı PDF'leri (Edge ile basılır), `uretim/index.html`, paket ZIP'i, `kazan-alti-parcasi-taslak.svg` (şablon: `tools/cizim-sablon.svg`). Ardından `npm run rekor` çalışır: `uretim/rekor/` altındaki paket, `oynar-rekor-taslak.svg` ve `index.html` içindeki `?v=` önbellek etiketleri.

## Dosyalar

- `index.html`, `app.js`, `style.css`: Three.js görüntüleyici (statik site). **Modeller** menüsü modeli seçer. **Ayrık** anahtarı (`A` tuşu) parçaları ayırıp birleştirir, tek parçalı modelde kapalıdır. **Teknik çizim** anahtarı (`T` tuşu) ölçü/etiket katmanını ve çizim panelini açar; `#teknik` ile doğrudan açık gelir.
- `model-kazan.js`, `model-rekor.js`, `model-kelepce.js`: modeller. `ortak.js`: diş yüzeyleri ve teknik katman yardımcıları. Yeni model için dosya, `index.html` içinde import map ve menü satırı, `tools/onbellek.mjs` içinde liste kaydı eklenir.
- `tools/build.mjs`, `tools/rekor-paket.mjs`: üretim paketi üreticileri (STEP için replicad / OpenCascade). `tools/paket-ortak.mjs`: DXF yazıcı, plan biçemi, PDF baskısı. `tools/rekor-olcu.mjs`: rekorun türetilmiş ölçüleri.
- `tools/rekor.mjs`: rekor teknik çizimi ve sökme yolu denetimi (`rekor-olculer.json` içindeki `sokme.yol`, boşluk 0,3 mm altına inerse uyarır). `tools/kelepce.mjs`: kelepçe ucu teknik çizimi, tırnak ve SDS-Plus kanal denetimi. `tools/onbellek.mjs`: önbellek etiketleri.
- `tools/cizim-sablon.svg`: kazan altı parçası teknik resim şablonu. Çizim geometrisi şematiktir (ölçeksiz); port sayısı veya yerleşimi değişirse şablon da elle güncellenir.
