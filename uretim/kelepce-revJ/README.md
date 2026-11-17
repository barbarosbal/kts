# Kelepçe sıkma ucu - Rev J

**Durum:** Teklif ve numune için güçlendirme adayı. Çalışma torku ve fiziksel uyum henüz doğrulanmadı; bu paket üretim onayı değildir.

## Parça ve imalat

Tek parça C45E+QT (1.1191), ön ıslahlı çubuktan torna + bölücülü freze. Kaynak, montaj, rulman veya serbest biçimli yüzey eklenmedi. Stok ve kesici/bağlama planı üretici tarafından doğrulanır. Teslim akma dayanımı Rp0,2 en az 430 MPa (16-40 mm stok aralığı); sertlik ve malzeme teslim özellikleri teklif yanıtına yazılır. Menüde yalnız C45 seçilmesi bu teslim şartını garanti etmez.

## Rev I geometrisine göre değişiklikler

| Bölge | Rev I | Rev J |
|---|---:|---:|
| Toplam boy | 71 mm | 71 mm |
| Ağız açıklığı | 23 +0,50/0 mm | Aynı |
| Düz çalışma uçları | 10 x 3,5 x 20 mm | Aynı |
| Sap yüzleri / köşe zarfı | SW8 / Ø9 | SW9 / Ø10 +0/-0,05 |
| Boyun | Ø8 | Ø9 |
| Sap sonu - gövde geçişi | 5 mm | 3 mm |
| Gövde çapı | Ø32 | Ø34 |
| Boyun / tırnak dipleri | Keskin geçişler | R2 |
| Tırnak toplam boyu | 20 mm | 22 mm: 2 mm dip geçişi + 20 mm düz çalışma |
| Ayrı dayama halkası / ön dekoratif kanal | Var | Kaldırıldı; dayama gövde omzundan |
| Sap ucu | Konik pah | Düz; çapak giderme en çok 0,2 mm |

2 mm'lik dip geçişleri eski çalışma bölgesinin gerisindedir. Toplam boy korunurken gövde ve alın/cep referansı eksende 2 mm geriye kaydı. Alın/cep çapları ve yeni alın yüzüne göre derinlikleri korundu. Bu nedenle **yeni omuz/cep oturması ve Ø34 çevre açıklığı**, gerçek kelepçede ayrıca kontrol edilir. Çalışma uçlarının aynı olması tüm parçanın fiziksel uyum testi yerine geçmez.

## Lazer logo

Ratel logosu **metal kaldırılarak lazer kazıma**, 0,03-0,05 mm derinlik; boya/siyah baskı/koyu yüzey markalaması uygulanmaz. Logo h=5 mm, yay boyu yaklaşık 28,82 mm. Yeni Ø34 gövdede sarma açısı yaklaşık 97,14°. Alt kenar gövdenin arka omzundan 4 mm; bir tırnağın altında ortalı. Döner eksen ile uygulanır; 1:1 DXF'nin MARKA katmanı işlenir, YAZI katmanı referanstır.

## Dosyalar

- `kelepce-ucu-revJ.step`: mm, gerçek tek katı CAD modeli.
- `kelepce-ucu-revJ-teknik-resim.pdf` ve `.svg`: A3 ölçülü resim; SVG vektör kaynaktır. Çizim ölçekli ölçüm için değil, yazılı ölçüler içindir.
- `kelepce-ucu-revJ-lazer-kazima.pdf` ve `.svg`: logo konumu ve işlem şartları.
- `kelepce-ucu-revJ-logo-1-1.dxf` ve `.svg`: mm cinsinden 1:1 açınım.
- `revI-revJ-karsilastirma.png`: gerçek CAD üçgenlerinden eski/yeni görünüş.
- `kelepce-revJ-olculer.json`: revizyon parametreleri.
- `kontrol-raporu.json`: geometri ve STEP dönüş kontrol sonuçları.

## Yapılan kontroller

- Yayındaki Rev I STEP ile kaynak üreticinin yeniden oluşturduğu referans geometrinin hacimsel farkı 0.
- Rev J tek bağlı katı; OpenCascade geometri/topoloji kontrolü geçerli.
- Ø34 dönel stok zarfının dışına taşan hacim 0.
- Eski 20 mm çalışma bölgesinde eklenen veya çıkarılan hacim 0.
- STEP dışa aktarılıp yeniden açıldı: tek geçerli katı; hacim farkı 0,000001 mm³'ten az.
- Teknik resim ve logo PDF'leri görsel olarak kontrol edildi.

Bunlar geometri kontrolleridir. Sonlu elemanlar analizi veya fiziksel tork deneyi yapılmadı. Eski çizimde sap için yazan yaklaşık 24 N·m bu revizyonun çalışma torku değildir. Matkap modeli, tork ayarı ve gerçek kelepçedeki sıkma yüküyle numune testi gerekir. Darbeli vidalama/SDS kullanımı kapsam dışıdır.

## Fiyat

Önceki 6.194,56 TL + KDV, eski Rev I geometri / standart C45 seçimi içindi. Bu paketteki Rev J geometri, C45E+QT teslim şartı ve lazer kazıma için yeni fiyat istenir.

## Yeniden oluşturma

Kaynak depoda: `cd tools && npm ci && npm run kelepce:revj`.

Başsız Edge kullanılamayan ortamlarda SVG üretimi için `KELEPCE_SVG_ONLY=1`; ardından runtime-owned sharp/pdf-lib bulunan `CODEX_PRIMARY_RUNTIME_NODE_MODULES` ile `node tools/kelepce-revJ-render.mjs`. PDF'ler bu alternatifte A3, yaklaşık 300 dpi; vektör SVG'ler ayrıca sağlanır.

C45+QT teslim verisi: https://en.saarstahl.com/app/uploads/2024/03/20160401102929-0503_C45.pdf

