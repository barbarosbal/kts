# tipay Bileklik Tokası · PA12 · Rev C

**Durum:** Numune adayı · ölçüler bant tedarikçisinin gerçek ölçüsüyle ve 3 numunede kesinleşir. Bu paket üretim onayı değildir; 3 numune → 100 adet ilk parti.

## Parça

Kurucunun sac prototipinin fikri: toka bandın dikiş yerini örter, bant tokanın içinden geçer.
Rev B: **arkası kapalı kanal** (bant çıkmaz, bileğe kenar değmez) ve **bilek formunda kavis** (bilek yüzü R45).
Metal yerine **PA12**: NFC metalde çalışmaz; plastikte normal NFC inlay yeterli, ferrit gerekmez.

| Ölçü | Değer |
|---|---:|
| Dış ölçü (önden izdüşüm × tepe kalınlığı) | 44 × 28,8 × 5,8 mm |
| Bilek yüzü kavsi / uç sehimi | R45 / 5,2 mm |
| Kapalı bant kanalı | 26 × 3 mm (dikişte iki kat 1,4 mm bant) |
| Ön / yan / arka duvar | 1,8 / 1,4 / 1 mm |
| Etiket cebi | 38,4 × 18,4 × 0,7 mm, kavisi izler |
| Kenar yuvarlatması | ön ve bilek yüzü R0.8, önden köşe R3 |
| Tahmini kütle | ≈ 3,5 g |

## Üretim

- **Malzeme:** PA12, endüstriyel 3D baskı (MJF / SLS), mat siyah boyalı. **Yüzey:** Boyanmış mat siyah; isteğe bağlı buhar düzeltme. Bilek yüzü ve kanal ağızları çapaksız, yuvarlatılmış.
- **Tolerans:** ±0,2 mm (3D baskı); kanal iç ölçüsü numunede bantla denenir.
- Kanal iki uçtan açık; 3D baskı tozu temizlenebilir.
- Önce 3 numune: banda geçirme, ter / su / sürtünme, bilekte kullanım; iPhone ve Android'de QR + NFC.
- Montaj tipay'de: NFC inlay cebe, esnek etiket üstüne yapıştırılır. Toka üreticisi kimlik görmez.

## CAD kontrolleri

- Bellekte tek katı, OpenCascade kesin (exact) BRep kontrolü: geçti.
- STEP dışa aktarma ve geri okuma: standart BRep kontrolü geçti, hacim farkı 5.9e-5 mm³.
- Kesin (exact) kontrol STEP dönüşünde geçmiyor: kavisli yüz kesişim eğrileri STEP'e yaklaşık yazılıyor (tolerans düzeyi).

## Dosyalar

- `tipay-toka-pa12-revC.step`: mm, tek katı CAD modeli (3D baskı teklifi için).
- `tipay-toka-pa12-revC-teknik-resim.pdf` / `.svg`: A3 ölçülü resim.
- `tipay-toka-pa12-revC-etiket-sablon.svg`: 1:1 (mm) etiket baskı şablonu; QR alanı yer tutucudur.
- `toka-olculer.json`: parametreler. `kontrol-raporu.json`: geometri ve STEP dönüş kontrolleri.
