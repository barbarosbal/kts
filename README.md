# KTS — Kazan Altı Parçası

Pirinç (CW511L) kazan altı parçasının 360° döndürülebilir 3D modeli, teknik çizimi ve fason üretim paketi.

- Canlı model: https://kts.ratel.systems
- Üretim paketi: https://kts.ratel.systems/uretim/

## Ölçüler tek yerde: `olculer.json`

3D görüntüleyici, STEP, DXF, teknik resim ve üretim planı bu dosyadaki değerlerden üretilir.
Net ölçüler gelince:

1. `olculer.json` içinde `olculer.*.deger`, port ölçüleri, `rev`, `tarih`, `revNot` güncellenir; ölçüler onaylıysa `"onayli": true` yapılır (turuncu "ön değer" işaretleri kalkar).
2. Paketi yeniden üret:

   ```bash
   cd tools && npm install && npm run build
   ```

3. Değişiklikler commit edilip `main`'e push edilir; GitHub Pages birkaç dakikada yayınlar.

`npm run build` şunları yazar: `uretim/*.step`, `uretim/*.dxf`, teknik resim ve üretim planı PDF'leri (Edge ile basılır), `uretim/index.html`, paket ZIP'i, `kazan-alti-parcasi-taslak.svg` (şablon: `tools/cizim-sablon.svg`) ve `index.html` içindeki `?v=` önbellek etiketi.

## Dosyalar

- `index.html`, `app.js`, `style.css`: Three.js görüntüleyici (statik site). **Teknik çizim** anahtarı (veya `T` tuşu) ölçü/etiket katmanını ve çizim panelini açar; `#teknik` ile doğrudan açık gelir.
- `tools/build.mjs`: üretim paketi üreticisi (STEP için replicad / OpenCascade).
- `tools/cizim-sablon.svg`: teknik resim şablonu. Çizim geometrisi şematiktir (ölçeksiz); port sayısı veya yerleşimi değişirse şablon da elle güncellenir.
