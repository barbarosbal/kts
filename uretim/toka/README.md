# tipay Bileklik Tokası · PA12 · Rev A

**Durum:** Numune adayı · ölçüler bant tedarikçisinin gerçek ölçüsüyle ve 3 numunede kesinleşir. Bu paket üretim onayı değildir; 3 numune → 100 adet ilk parti.

## Parça

Kurucunun elle büktüğü sac prototipin biçimi: bandı saran C kanal, arkada iki dudak, bant kanaldan kayar ve dikiş yerini örter.
Metal yerine **PA12**: NFC metalde çalışmaz; plastikte normal NFC inlay yeterli, ferrit gerekmez.

| Ölçü | Değer |
|---|---:|
| Dış ölçü | 44 × 23,4 × 6,4 mm |
| Bant kanalı | 20,6 × 3,4 mm (dikişte iki kat 1,6 mm bant) |
| Arka açıklık | 11,6 mm (dudaklar 4,5 × 1 mm) |
| Ön duvar / yan duvar | 2 / 1,4 mm |
| Plaka cebi | 38,4 × 18,4 × 1,25 mm, köşe R0,6 |
| Tahmini kütle | ≈ 2,07 g |

## Üretim

- **Malzeme:** PA12, endüstriyel 3D baskı (MJF / SLS), mat siyah boyalı. **Yüzey:** Boyanmış mat siyah; isteğe bağlı buhar düzeltme. Kenarlarda çapak yok.
- **Tolerans:** ±0,2 mm (3D baskı); kanal iç ölçüsü numunede bantla denenir.
- Önce 3 numune: banda geçirme, ter / su / sürtünme, bilekte kullanım; iPhone ve Android'de QR + NFC.
- Montaj tipay'de: NFC inlay cebe, baskılı plaka üstüne yapıştırılır. Toka üreticisi kimlik görmez.

## Dosyalar

- `tipay-toka-pa12-revA.step`: mm, tek katı CAD modeli (3D baskı teklifi için).
- `tipay-toka-pa12-revA-teknik-resim.pdf` / `.svg`: A3 ölçülü resim.
- `tipay-toka-pa12-revA-plaka-sablon.svg`: 1:1 (mm) plaka baskı şablonu; QR alanı yer tutucudur.
- `toka-olculer.json`: parametreler. `kontrol-raporu.json`: geometri ve STEP dönüş kontrolleri.
