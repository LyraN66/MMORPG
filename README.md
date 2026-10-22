# Kemik Vadisi

Telefonda ve tarayıcıda oynanan 3D aksiyon RPG prototipi. Lanetli bir vadide iskeletleri kes, seviye atla, eşyalarını güçlendir ve bölgede belirli aralıklarla doğan **unique boss**'ları avla.

## Oynanış
- **Sınıflar:** Şövalye (yakın dövüş) ve Büyücü (uzaktan büyü). Her birinin 3 yeteneği var (1., 3. ve 6. seviyede açılır).
- **Bölgeler:** Sürgün Kampı (güvenli) → Solgun Orman (Sv.1–4) → Kırık Mezarlık (Sv.4–8) → Kemik Tapınağı (Sv.8–13).
- **Unique boss'lar:** Çürük Kral Gorran (Mezarlık, ~2.5 dk'da bir) ve Kemik Lordu Morvath (Tapınak, ~5 dk'da bir). Sıçrama, dönme ve minyon çağırma saldırıları; %35 canın altında öfkelenirler.
- **Ganimet:** Altın, iksir ve 4 nadirlikte eşya (Sıradan / Nadir / Destansı / Efsanevi).
- **Görevler:** Kamptaki *Gözcü Kaan*'dan 10 görevlik hikâye zinciri (mob kesme, yerden toplama, mobdan düşen eşyayı toplama, boss) ve seviyeye göre tekrarlanabilir av sözleşmeleri. Ekranın solunda görev takibi, haritada görev bölgeleri.
- **Harita:** Mini haritaya dokun (veya M) → kaydırılabilir tam bölge haritası, mob kampı seviyeleri ve boss doğma süreleri.
- **Demirci:** Eşyaları +10'a kadar güçlendir. +4 ve üstünde başarısızlık seviyeyi düşürür; +5'ten itibaren silah parlar.
- İlerleme cihazda otomatik kaydedilir.

## Kontroller
- **Mobil:** Sol yarıda joystick · düşmana dokun = hedefle ve saldır · yere dokun = yürü · iki parmak = yakınlaştır.
- **PC:** WASD veya tıkla-yürü · Boşluk = saldır · 1/2/3 = yetenek · Q/E = can/mana iksiri · F = etkileşim · M = harita · I = çanta · tekerlek = zoom.

## Çevrimiçi dünya
- Ana menü → **🌍 Çevrimiçi Oyna**: herkes aynı vadiye girer. Dünyayı (moblar, boss'lar, ganimet, yeniden doğma) sunucu yönetir (`server/sim.js`), karakterler oyuncunun cihazında kayıtlıdır.
- Ortak ganimet (ilk alan kapar), yakındaki herkese XP ve görev ilerlemesi.
- Bağlantı koparsa oyun otomatik yeniden bağlanır.
- Sunucu: `server/` (Node.js + ws), Render'da `Root Directory: server`. Ücretsiz katmanda kimse yokken uyur, ilk giriş ~1 dk sürebilir.
- Dünya düzeni ve oyun verileri `server/shared/` altında; istemci de aynı dosyaları kullanır.

## Performans
- Uzaktaki ve ekran dışındaki düşmanlar "uyur" (yapay zekâ, animasyon ve çizim yapılmaz).
- Dünya bölgelere ayrılmıştır; sisin arkasında kalan obje ve çimler çizilmez.
- Çözünürlük FPS'e göre otomatik ayarlanır (grafik kalitesi Yüksek kalır).
- Ayarlar → *Performans göstergesi* ile FPS, çözünürlük ve çizim sayısı görülebilir.

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
