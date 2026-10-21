# Kemik Vadisi

Telefonda ve tarayıcıda oynanan 3D aksiyon RPG prototipi. Lanetli bir vadide iskeletleri kes, seviye atla, eşyalarını güçlendir ve bölgede belirli aralıklarla doğan **unique boss**'ları avla.

## Oynanış
- **Sınıflar:** Şövalye (yakın dövüş) ve Büyücü (uzaktan büyü). Her birinin 3 yeteneği var (1., 3. ve 6. seviyede açılır).
- **Bölgeler:** Sürgün Kampı (güvenli) → Solgun Orman (Sv.1–4) → Kırık Mezarlık (Sv.4–8) → Kemik Tapınağı (Sv.8–13).
- **Unique boss'lar:** Çürük Kral Gorran (Mezarlık, ~2.5 dk'da bir) ve Kemik Lordu Morvath (Tapınak, ~5 dk'da bir). Sıçrama, dönme ve minyon çağırma saldırıları; %35 canın altında öfkelenirler.
- **Ganimet:** Altın, iksir ve 4 nadirlikte eşya (Sıradan / Nadir / Destansı / Efsanevi).
- **Demirci:** Eşyaları +10'a kadar güçlendir. +4 ve üstünde başarısızlık seviyeyi düşürür; +5'ten itibaren silah parlar.
- İlerleme cihazda otomatik kaydedilir.

## Kontroller
- **Mobil:** Sol yarıda joystick · düşmana dokun = hedefle ve saldır · yere dokun = yürü · iki parmak = yakınlaştır.
- **PC:** WASD veya tıkla-yürü · Boşluk = saldır · 1/2/3 = yetenek · Q/E = can/mana iksiri · I = çanta · tekerlek = zoom.

## APK
Her `main` push'unda GitHub Actions oyunu derler ve **Releases → latest** altına `KemikVadisi.apk` koyar. İndirip telefona kur; yeni sürüm eskisinin üstüne kurulur (aynı imza anahtarı kullanılır).

## Geliştirme
```bash
npm install
npm run dev        # http://localhost:5173 (aynı ağdaki telefondan da açılır)
npm run build      # dist/
```
3D modeller `public/assets/` içinde optimize edilmiş hâlde durur. Kaynak paketlerden yeniden üretmek için:
`npm run assets -- <KayKit-paketlerinin-klasörü>`

## Teknoloji
Three.js (WebGL) · Vite · Capacitor (Android) · WebAudio ile üretilen sesler.

## Lisanslar
3D modeller ve animasyonlar: [KayKit](https://kaylousberg.itch.io) — Kay Lousberg, **CC0** (Adventurers, Skeletons, Dungeon Remastered, Halloween Bits, Medieval Hexagon). Yazı tipi: Cinzel (SIL OFL).
