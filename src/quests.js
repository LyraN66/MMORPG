import * as THREE from 'three';
import { xpToNext, ENEMIES, UNIQUES, CAMPS, makeItem, randomSlot, MOUNT } from './data.js';
import { heightAt, rng, BOUNDS } from './world.js';
import { cloneProp } from './assets.js';
import { dist2d } from './units.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

import { OUTPOSTS, ACTIVE_MAP } from '../server/shared/terrain.js';
import { MAPS } from '../server/shared/maps.js';
// Every outpost has a scout who hands out and accepts quests.
export let GIVERS = [], GIVER = null;
// Called when the active map is chosen (before the game starts).
export function useQuestMap() {
  GIVERS = OUTPOSTS.flatMap((o) => o.npcs.filter((n) => n.role === 'quest').map((n) => ({ name: n.name, pos: [n.x, n.z], camp: o.id === 'camp' })));
  GIVER = GIVERS[0];
}
useQuestMap();
export const nearestGiver = (x, z) => GIVERS.reduce((a, g) => (Math.hypot(g.pos[0] - x, g.pos[1] - z) < Math.hypot(a.pos[0] - x, a.pos[1] - z) ? g : a));

// Main story chain, handed out one at a time by Gözcü Kaan.
export const QUESTS = [
  { id: 'q1', map: 'vadi', lv: 1, type: 'kill', target: 'minion', count: 6, name: 'Kemiklerin Uyanışı',
    story: 'Ormandaki eski mezarlar açıldı, ölüler yürüyor. Kampa ulaşmadan önce 6 Kemik Er\'i toprağa geri gönder.',
    done: 'İyi iş! Kılıcın keskin, yüreğin sağlam. Vadinin sana ihtiyacı var.', xpk: 0.9, gold: 40, potions: { hp: 3 } },
  { id: 'q2', map: 'vadi', lv: 2, type: 'collect', item: 'Altın Balkabağı', prop: 'pumpkin_yellow', scale: 0.75, count: 5, area: [14, 50], name: 'Ormanın Altını',
    story: 'Solgun Orman\'da parlayan altın balkabakları lanete karşı iksir yapımında kullanılır. Bana 5 tane getir.',
    done: 'Kokusu bile insanı iyileştiriyor! Zerrin bunlarla iksir kaynatacak.', xpk: 0.7, gold: 50, potions: { hp: 2, mp: 2 } },
  { id: 'q3', map: 'vadi', lv: 3, type: 'drop', item: 'Kemik Tozu', icon: 'bone_A', from: ['minion', 'rogue'], chance: 0.55, count: 8, name: 'Kemik Tozu',
    story: 'İskeletlerin kemiklerindeki tozla laneti çözebiliriz. Ormandaki iskeletlerden 8 avuç Kemik Tozu topla.',
    done: 'Bu toz hâlâ sıcak… Lanet sandığımızdan da güçlü.', xpk: 0.7, gold: 70, gear: 1 },
  { id: 'q4', map: 'vadi', lv: 4, type: 'kill', target: 'rogue', count: 8, name: 'Haydut Avı',
    story: 'Kemik Haydutlar orman ile mezarlık arasındaki yolu kesiyor. 8 tanesini temizle.',
    done: 'Yol artık güvende. Tüccarlar sana minnettar kalacak.', xpk: 0.7, gold: 90 },
  { id: 'q5', map: 'vadi', lv: 5, type: 'collect', item: 'Ruh Mumu', prop: 'candle_triple', scale: 1.3, count: 5, area: [-30, 6], name: 'Ruh Mumları',
    story: 'Kırık Mezarlık\'ta hâlâ yanan ruh mumları var. Onları getir; tapınağın yolunu aydınlatacaklar.',
    done: 'Alevleri mavi yanıyor… Ruhlar sana yol gösterecek. Al bakalım, bu sadık köpek artık senin; yollar kısalacak!', xpk: 0.6, gold: 110, potions: { mp: 3 }, mount: 'wolf' },
  { id: 'q6', map: 'vadi', lv: 6, type: 'drop', item: 'Kırık Asa', icon: 'staff', from: ['mage'], chance: 0.6, count: 5, name: 'Kâhinlerin Asaları',
    story: 'Kemik Kâhinler karanlık güçlerini asalarından alıyor. Bana 5 asa parçası getir ki onları yakalım.',
    done: 'Asalar kırıldıkça kâhinler zayıflayacak. Çok iyi.', xpk: 0.6, gold: 140, gear: 1 },
  { id: 'q7', map: 'vadi', lv: 7, type: 'boss', target: 'gorran', count: 1, name: 'Çürük Kral',
    story: 'Mezarlığın efendisi Çürük Kral Gorran uyandı. Onu yen ve vadiye nefes aldır. Dikkat et: sıçrar, döner ve ölüleri çağırır.',
    done: 'Gorran düştü! Şarkılar senin adını söyleyecek, kahraman.', xpk: 1.1, gold: 300, gear: 2 },
  { id: 'q8', map: 'vadi', lv: 8, type: 'kill', target: 'warrior', count: 8, name: 'Tapınak Muhafızları',
    story: 'Kemik Tapınağı\'nın kapısını Kemik Muhafızlar tutuyor. 8 tanesini yık ki içeri girebilelim.',
    done: 'Kapı aralandı. İçeriden gelen soğuğu buradan hissediyorum.', xpk: 0.6, gold: 220 },
  { id: 'q9', map: 'vadi', lv: 10, type: 'collect', item: 'Lanetli Kafatası', prop: 'skull', scale: 0.75, count: 6, area: [-82, -36], name: 'Lanetli Kafatasları',
    story: 'Tapınağın etrafına saçılmış lanetli kafatasları Morvath\'a güç veriyor. 6 tanesini topla.',
    done: 'Morvath artık eskisi kadar güçlü değil. Sıra onda.', xpk: 0.6, gold: 300, potions: { hp: 4, mp: 4 } },
  { id: 'q10', map: 'vadi', lv: 12, type: 'boss', target: 'morvath', count: 1, name: 'Kemik Lordu',
    story: 'Her şeyin kaynağı Kemik Lordu Morvath. Tapınağın kalbine gir ve laneti sonsuza dek bitir.',
    done: 'Başardın… Vadi yeniden nefes alıyor. Ama ölüler kolay pes etmez; sözleşmeler hâlâ seni bekliyor.', xpk: 1.3, gold: 1000, gear: 3 },
];

// Story chains of maps 2–8 follow one plan; each map supplies its own intro, items and ending.
const STORIES = {
  bataklik: { intro: 'Bataklıktan yükselen zehirli sis köyleri boğuyor.', end: 'Miselyum çürüdü, sis dağılıyor. Bataklık yeniden nefes alıyor!',
    c0: ['Zehirli Kabak', 'pumpkin_orange_jackolantern', 0.8, 'panzehir yapımında kullanılıyor'], d1: ['Yapışkan Öz', 'bone_A'], c2: ['Bataklık Feneri', 'lantern_standing', 0.9, 'göl üstündeki sisi yarabiliyorlar'], d3: ['Kurbağa Zehri', 'staff'], c4: ['Spor Taşı', 'rock_single_C', 2.2] },
  col: { intro: 'Kum fırtınaları kervanları yutuyor, çölde bir şeyler uyandı.', end: 'Monkrus düştü! Güneş Sunağı artık sadece güneşe tapıyor.',
    c0: ['Kayıp Sikke', 'coin_stack_large', 0.7, 'kervanın kayıp hazinesinden kalmış'], d1: ['Kaktüs Özü', 'bone_A'], c2: ['Kervan Sandığı', 'chest', 0.8, 'içlerinde kervanın erzakı var'], d3: ['Şaman Asası', 'staff'], c4: ['Güneş Mumu', 'candle_triple', 1.3] },
  buzul: { intro: 'Zirveden inen ayaz her gece biraz daha aşağı iniyor.', end: 'Yortun buzlara gömüldü. Bahar ilk kez zirveye ulaşacak!',
    c0: ['Donmuş Kafatası', 'skull', 0.75, 'eski kaşiflerden kalan izler'], d1: ['Beyaz Post', 'bone_A'], c2: ['Buz Kristali', 'rock_single_E', 1.8, 'ayazın gücünü içlerinde tutuyorlar'], d3: ['Alpaka Yünü', 'staff'], c4: ['Kayıp Erzak', 'barrel_small_stack', 0.8] },
  volkan: { intro: 'Ork klanları dağın ateşini uyandırdı; kül yağmuru dinmiyor.', end: 'Azgar küle döndü! Ateş dağı yeniden uykuya dalıyor.',
    c0: ['Kor Taşı', 'rock_single_A', 1.8, 'demircilerin en sevdiği yakıt'], d1: ['Ork Dişi', 'bone_A'], c2: ['Ork Fıçısı', 'keg_decorated', 0.9, 'içlerindeki ateş barutu tehlikeli'], d3: ['Lav Çekirdeği', 'staff'], c4: ['Kül Kafatası', 'skull', 0.8] },
  kiyi: { intro: 'Batık tapınaktan gelen şarkı denizcileri derinlere çekiyor.', end: 'Rex derinliklere geri döndü! Gemiler yeniden yelken açabilir.',
    c0: ['Batık Sandık', 'chest_gold', 0.8, 'dalgalar onları kıyıya vurdu'], d1: ['Parlak Pul', 'bone_A'], c2: ['Kıyı Feneri', 'lantern_standing', 0.9, 'kayalıklarda yolumuzu bulmamızı sağlarlar'], d3: ['Mürekkep Kesesi', 'staff'], c4: ['Kadim Sikke', 'coin_stack_large', 0.7] },
  hayalet: { intro: 'Sisli ormanda ölüler huzur bulamıyor; ruhlar yolcuları kandırıyor.', end: 'Vorgath\'ın kapısı kapandı. Ruhlar sonunda huzura kavuştu.',
    c0: ['Ruh Feneri', 'post_lantern', 0.8, 'kayıp ruhlara yol gösteriyorlar'], d1: ['Ruh Parçası', 'candle_triple'], c2: ['Mezar Mumu', 'shrine_candles', 0.9, 'hayaletleri uzak tutuyorlar'], d3: ['Lanetli Kafatası', 'skull'], c4: ['Kemik Kafes', 'ribcage', 1] },
  ejder: { intro: 'Ejder Kral Ignarok uyandı; gökyüzü alevle kızarıyor. Son savaş yaklaşıyor.', end: 'Ignarok düştü! Efsanen bütün diyarlarda anlatılacak, kahraman.',
    c0: ['Ejder Altını', 'coin_stack_large', 0.7, 'ejderin hazinesinden saçılmış'], d1: ['Ejder Pulu', 'bone_A'], c2: ['Ejder Yumurtası', 'pumpkin_yellow', 0.9, 'kötü ellere düşmemeli'], d3: ['Yıldız Tozu', 'staff'], c4: ['Kadim Rün', 'plaque_candles', 1] },
};
for (const m of MAPS) {
  const S = STORIES[m.id]; if (!S) continue;
  const N = (k) => ENEMIES[m.mobs[k]].name, [mid, fin] = m.uniques.map((u) => UNIQUES[u]);
  const z = m.zones.map((x) => x.name), L = m.lv[0], q = (i, o) => QUESTS.push({ id: `${m.id}${i}`, map: m.id, ...o });
  q(1, { lv: L, type: 'kill', target: m.mobs.a, count: 8, name: `${z[1]} Sınırı`, xpk: 0.9, gold: 13 * L, potions: { hp: 4 },
    story: `${S.intro} Önce kampın çevresindeki ${N('a')} sürülerini dağıt: 8 tane yeter.`, done: `Güzel başlangıç. ${z[1]} adını öğrenmeye başladı bile.` });
  q(2, { lv: L + 1, type: 'collect', item: S.c0[0], prop: S.c0[1], scale: S.c0[2], count: 5, area: [14, 50], name: S.c0[0], xpk: 0.7, gold: 15 * L, potions: { hp: 2, mp: 2 },
    story: `${z[1]} içinde ${S.c0[0]} bulunuyor; ${S.c0[3]}. Bana 5 tane getir.`, done: 'Tam ihtiyacımız olan şey. Tüccarımız bunlarla iyi iş çıkaracak.' });
  q(3, { lv: L + 2, type: 'drop', item: S.d1[0], icon: S.d1[1], from: [m.mobs.a, m.mobs.c], chance: 0.55, count: 8, name: S.d1[0], xpk: 0.7, gold: 16 * L, gear: 1,
    story: `${N('a')} ve ${N('c')} yaratıkları ${S.d1[0]} taşıyor. 8 tane topla; laneti çözmemize yarayacak.`, done: 'Bunlar hâlâ titriyor… Kötülüğün kaynağı daha derinde.' });
  q(4, { lv: L + 3, type: 'kill', target: m.mobs.c, count: 10, name: `${N('c')} Avı`, xpk: 0.7, gold: 18 * L,
    story: `${N('c')} grupları karakola giden yolu kesiyor. 10 tanesini temizle.`, done: 'Yol açıldı; karakoldakiler sana selam yolluyor.' });
  q(5, { lv: L + 4, type: 'collect', item: S.c2[0], prop: S.c2[1], scale: S.c2[2], count: 5, area: [-30, 6], name: S.c2[0], xpk: 0.6, gold: 20 * L, potions: { mp: 4 },
    story: `${z[2]} bölgesinde ${S.c2[0]} var; ${S.c2[3]}. 5 tane getir.`, done: 'Harika! Bunlar ileride hayatımızı kurtaracak.' });
  q(6, { lv: L + 5, type: 'drop', item: S.d3[0], icon: S.d3[1], from: [m.mobs.d], chance: 0.6, count: 5, name: S.d3[0], xpk: 0.6, gold: 21 * L, gear: 1,
    story: `${N('d')} uzaktan saldırıyor ve gücünü ${S.d3[0]} ile topluyor. 5 tane getir ki onları zayıflatalım.`, done: 'Güçleri azaldı. Şimdi sıra büyük düşmanda.' });
  q(7, { lv: mid.level - 1, type: 'boss', target: mid.id, count: 1, name: mid.name,
    story: `${mid.zone} derinlerinde ${mid.name} uyandı. Onu yen! Dikkat et: sıçrar, döner ve yardımcılarını çağırır.`, done: `${mid.name} düştü! Bütün karakol senin adını konuşuyor.`, xpk: 1.1, gold: 40 * L, gear: 2 });
  q(8, { lv: mid.level + 1, type: 'kill', target: m.mobs.b, count: 10, name: `${z[3]} Kapısı`, xpk: 0.6, gold: 26 * L,
    story: `${z[3]} kapısını ${N('b')} sürüleri tutuyor. 10 tanesini yık ki içeri girebilelim.`, done: 'Kapı aralandı. İçeriden gelen gücü buradan hissediyorum.' });
  q(9, { lv: m.lv[1] - 3, type: 'collect', item: S.c4[0], prop: S.c4[1], scale: S.c4[2], count: 6, area: [-82, -36], name: S.c4[0], xpk: 0.6, gold: 33 * L, potions: { hp: 5, mp: 5 },
    story: `${z[3]} çevresine saçılmış ${S.c4[0]} ${fin.name}'a güç veriyor. 6 tane topla.`, done: `${fin.name} artık eskisi kadar güçlü değil. Sıra onda.` });
  q(10, { lv: m.lv[1] - 1, type: 'boss', target: fin.id, count: 1, name: fin.name, xpk: 1.3, gold: 100 * L, gear: 3,
    story: `${fin.name} ${z[3]} kalbinde bekliyor. Bu diyarın kaderi senin elinde.`,
    done: `${S.end}${MAPS.find((x) => x.order === m.order + 1) ? ' Kamptaki ışınlanma kapısı artık yeni bir diyara açılıyor!' : ''}` });
}

const TYPE_NAMES = new Proxy({}, { get: (_, k) => ENEMIES[k]?.name || String(k) });

export function questReward(q, lv) {
  return { xp: Math.round(xpToNext(q.lv || lv) * q.xpk), gold: q.gold, potions: q.potions || null, item: q.gear ?? null, mount: q.mount || null };
}
export function objectiveText(q) {
  if (q.type === 'kill') return `${TYPE_NAMES[q.target]} öldür`;
  if (q.type === 'boss') return `${UNIQUES[q.target].name}'ı yen`;
  if (q.type === 'collect') return `${q.item} topla`;
  return `${q.item} topla (${q.from.map((f) => TYPE_NAMES[f]).join(', ')})`;
}

// Repeatable bounty scaled to the player's level.
function makeBounty(lv, n) {
  const R = rng(lv * 977 + n * 131);
  // Monster types of this map that live near the player's level.
  const types = [...new Set(CAMPS.filter((c) => c[4] <= lv + 2 && c[5] >= lv - 3).map((c) => c[2]))];
  const pool = types.length ? types : [...new Set(CAMPS.map((c) => c[2]))];
  const target = pool[Math.floor(R() * pool.length)];
  const drop = R() < 0.4;
  const count = drop ? 6 : 8 + Math.floor(R() * 5);
  const base = { id: 'bounty', lv, count, xpk: 0.35 + count * 0.01, gold: Math.round(25 + lv * 18), potions: R() < 0.5 ? { hp: 2 } : { mp: 2 } };
  const name = TYPE_NAMES[target];
  if (drop) {
    const item = ENEMIES[target]?.trophy || `${name} Nişanı`;
    return { ...base, type: 'drop', item, icon: ENEMIES[target]?.ranged ? 'staff' : 'bone_A', from: [target], chance: 0.5, name: `Sözleşme: ${item}`,
      story: `${name} türünün taşıdığı ${item} lazım. ${count} tane getir, karşılığını cömertçe ödeyeceğim.` };
  }
  return { ...base, type: 'kill', target, minLv: Math.max(1, lv - 4), name: `Sözleşme: ${name} Avı`,
    story: `${name} sürüleri yine çoğaldı. Seviyene yakın ${count} tanesini öldür.` };
}

// Quest chain of a map is finished when every quest of that map is done.
export const chainDone = (save, mapId) => QUESTS.filter((q) => q.map === mapId).every((q) => save.quests?.done?.includes(q.id));
// A map opens once the previous map's story is finished and the player is strong enough; visited maps stay open.
export function mapLock(save, map) {
  if (map.order === 1 || save.visited?.includes(map.id)) return null;
  const prev = MAPS.find((m) => m.order === map.order - 1);
  if (prev && !chainDone(save, prev.id)) return `${prev.name} hikâyesini bitir`;
  if (save.level < map.lv[0]) return `Seviye ${map.lv[0]} gerekli`;
  return null;
}

export class Quests {
  constructor(game) {
    this.g = game;
    const s = game.save;
    s.quests ||= { done: [], active: null, prog: 0, bounty: null, bountyN: 0 };
    this.st = s.quests;
    this.nodes = [];
    this.channel = null;
    this.ver = 0; // bumps when tracker text must refresh
    this.syncNodes();
    // Players who finished the mount quest before mounts existed get theirs now.
    for (const q of QUESTS) if (q.mount && this.st.done.includes(q.id) && !(s.mounts || []).includes(q.mount)) setTimeout(() => this.giveMount(q.mount), 3000);
  }
  giveMount(id) {
    const s = this.g.save; s.mounts ||= [];
    if (s.mounts.includes(id)) return;
    s.mounts.push(id); s.mountPick ||= id;
    this.g.ui.announce(`🐕 Yeni binek: ${MOUNT[id].name}! Sağ alttaki 🐎 ile bin.`, 'victory'); sfx.levelUp();
    saveGame(s, this.g.player);
  }

  get next() { return QUESTS.find((q) => q.map === ACTIVE_MAP.id && !this.st.done.includes(q.id)) || null; }
  // A main quest from another map stays active but only progresses on its own map.
  get main() { const q = this.st.active ? QUESTS.find((x) => x.id === this.st.active) : null; return q && q.map === ACTIVE_MAP.id ? q : null; }
  get mainDone() { const q = this.main; return !!q && this.st.prog >= q.count; }
  get bounty() { return this.st.bounty; }
  get bountyDone() { const b = this.st.bounty; return !!b && b.prog >= b.count; }

  // A new story quest is waiting (only the camp's scout hands them out).
  get newMain() { const n = this.next; return !this.st.active && !!n && n.lv <= this.g.save.level; }
  // NPC head marker: '?' ready to hand in, '!' new quest, '…' in progress. Outpost scouts only do bounties and hand-ins.
  npcMark(camp = true) {
    if (this.mainDone || this.bountyDone) return '?';
    if (camp && this.newMain) return '!';
    if (!this.st.bounty && this.st.done.length) return '!';
    if (this.st.active || this.st.bounty) return '…';
    return '';
  }

  list() {
    const out = [];
    const m = this.main;
    if (m) out.push({ q: m, prog: Math.min(this.st.prog, m.count), done: this.mainDone, kind: 'main' });
    const b = this.st.bounty;
    if (b) out.push({ q: b, prog: Math.min(b.prog, b.count), done: this.bountyDone, kind: 'bounty' });
    return out;
  }

  accept() {
    const n = this.next; if (!n || this.st.active || n.lv > this.g.save.level) return;
    this.st.active = n.id; this.st.prog = 0;
    this.g.ui.announce(`📜 Yeni görev: ${n.name}`, 'skill'); sfx.pickup();
    this.syncNodes(); this.changed();
  }
  acceptBounty() {
    if (this.st.bounty) return;
    this.st.bountyN++;
    this.st.bounty = { ...makeBounty(this.g.save.level, this.st.bountyN), prog: 0 };
    this.g.ui.announce(`📜 ${this.st.bounty.name}`, 'skill'); sfx.pickup();
    this.changed();
  }
  abandonBounty() { this.st.bounty = null; this.changed(); }

  turnIn(kind) {
    const g = this.g, s = g.save;
    let q;
    if (kind === 'main') { if (!this.mainDone) return; q = this.main; s.quests.done.push(q.id); this.st.active = null; this.st.prog = 0; }
    else { if (!this.bountyDone) return; q = this.st.bounty; this.st.bounty = null; }
    const r = questReward(q, s.level);
    s.gold += r.gold;
    if (r.potions) for (const k in r.potions) s.potions[k] = (s.potions[k] || 0) + r.potions[k];
    if (r.item != null) g.giveItem(makeItem(randomSlot(s.cls), Math.max(s.level, q.lv), r.item, s.cls));
    if (r.mount) this.giveMount(r.mount);
    sfx.enhanceOk();
    g.ui.announce(`✔ Görev tamamlandı: ${q.name}`, 'victory');
    g.fx.pillar(g.player.pos, 0x7dff9a, { h: 10, r: 1.2, dur: 1.2 });
    g.gainXp(r.xp, g.player.pos);
    this.syncNodes(); this.changed();
    saveGame(s, g.player);
    return q;
  }

  changed() { this.ver++; this.g.ui.refreshQuests?.(); }

  bump(q, isMain, label) {
    const st = isMain ? this.st : this.st.bounty;
    if (st.prog >= q.count) return;
    st.prog++;
    this.changed();
    this.g.ui.toast(`${label} ${st.prog}/${q.count}`, '#ffe08a');
    if (st.prog >= q.count) {
      sfx.rare();
      this.g.ui.announce(`✔ ${q.name} — teslim için bir Gözcü'ye git`, 'victory');
      if (isMain) this.syncNodes();
    }
  }

  // ---------- hooks ----------
  onKill(e) {
    const m = this.main, b = this.st.bounty;
    for (const [q, isMain] of [[m, true], [b, false]]) {
      if (!q) continue;
      if (q.type === 'kill' && !e.unique && e.type === q.target && (!q.minLv || e.level >= q.minLv)) this.bump(q, isMain, TYPE_NAMES[q.target]);
      if (q.type === 'boss' && e.unique && e.unique.id === q.target) this.bump(q, isMain, UNIQUES[q.target].name);
      if (q.type === 'drop' && !e.unique && q.from.includes(e.type)) {
        const st = isMain ? this.st : b;
        const pending = this.g.loot.filter((l) => l.kind === 'quest' && l.data.qid === (isMain ? q.id : 'bounty')).length;
        if (st.prog + pending < q.count && Math.random() < q.chance) this.g.dropLoot(e.pos, 'quest', { qid: isMain ? q.id : 'bounty', item: q.item, icon: q.icon });
      }
    }
  }
  onQuestItem(d) {
    const isMain = d.qid !== 'bounty';
    const q = isMain ? this.main : this.st.bounty;
    if (!q || (isMain && q.id !== d.qid)) { this.g.ui.toast(`${d.item} artık gerekmiyor`, '#aaa'); return; }
    this.bump(q, isMain, d.item);
  }

  // ---------- collectible nodes ----------
  syncNodes() {
    const q = this.main;
    const want = q && q.type === 'collect' && !this.mainDone ? q : null;
    if (this.nodeQuest === want?.id) return;
    for (const n of this.nodes) this.removeNode(n);
    this.nodes = [];
    this.nodeQuest = want?.id;
    if (!want) return;
    const R = rng(want.id.length * 7919 + 17);
    const spots = [];
    let tries = 0;
    while (spots.length < want.count + 4 && tries++ < 500) {
      const x = BOUNDS.minX + 8 + R() * (BOUNDS.maxX - BOUNDS.minX - 16);
      const z = want.area[0] + R() * (want.area[1] - want.area[0]);
      if (this.g.world.blocked(x, z, 1.2)) continue;
      if (spots.some((p) => Math.hypot(p[0] - x, p[1] - z) < 7)) continue;
      spots.push([x, z]);
    }
    for (const [x, z] of spots) this.nodes.push(this.makeNode(want, x, z));
  }
  makeNode(q, x, z) {
    const g = this.g;
    const mesh = cloneProp(q.prop, q.scale || 1);
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    const glow = g.fx.glow(0xffe08a, 2.4); glow.position.y = 0.5 / (q.scale || 1); glow.material.opacity = 0.6; mesh.add(glow);
    g.scene.add(mesh);
    const beam = g.fx.lootBeam(new THREE.Vector3(x, y, z), 0xffd36b); beam.material.opacity = 0.25; beam.scale.set(1.4, 0.7, 1.4);
    return { q, pos: new THREE.Vector3(x, y, z), mesh, beam, glow, alive: true, respawn: 0, seed: Math.random() * 10 };
  }
  removeNode(n) { this.g.scene.remove(n.mesh); this.g.scene.remove(n.beam); }

  nearestNode(pos, r = 2.6) {
    let best = null, bd = r;
    for (const n of this.nodes) { if (!n.alive) continue; const d = dist2d(n.pos, pos); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  startCollect(n) {
    const p = this.g.player;
    if (!n || !n.alive || p.dead || this.channel) return;
    if (dist2d(n.pos, p.pos) > 2.8) { p.moveTarget = n.pos.clone(); p.autoAttack = false; return; }
    p.autoAttack = false; p.moveTarget = null; p.target = null;
    p.yaw = Math.atan2(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
    p.anim.once('PickUp', { timeScale: 1.1, lockFor: 1.1 });
    this.channel = { n, t: 0, dur: 1.2, hp: p.hp };
    this.g.ui.channel(n.q.item, 0);
  }

  update(dt) {
    const g = this.g, p = g.player;
    for (const n of this.nodes) {
      if (!n.alive) {
        n.respawn -= dt;
        if (n.respawn <= 0) { n.alive = true; n.mesh.visible = true; n.beam.visible = true; g.fx.burst(n.pos.clone().setY(n.pos.y + 0.5), 14, 0xffe08a, { speed: 2, up: 2, size: 0.3 }); }
        continue;
      }
      const near = dist2d(n.pos, p.pos) < 40;
      n.mesh.visible = near; n.beam.visible = near;
      if (!near) continue;
      n.glow.material.opacity = 0.45 + Math.sin(g.time * 3 + n.seed) * 0.2;
      n.mesh.rotation.y += dt * 0.6;
      if (Math.random() < dt * 4) g.fx.trail(n.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2)), 0xffe08a, 0.25, 0.8);
    }
    const c = this.channel;
    if (c) {
      const moved = g.input.move.x !== 0 || g.input.move.y !== 0 || p.moveTarget || p.autoAttack;
      if (moved || p.dead || p.hp < c.hp - 0.5 || !c.n.alive) {
        this.channel = null; g.ui.channel(null); p.anim.unlock();
        if (p.hp < c.hp - 0.5) g.ui.toast('Toplama bölündü!', '#ff8a6a');
        return;
      }
      c.t += dt; g.ui.channel(c.n.q.item, c.t / c.dur);
      if (c.t >= c.dur) {
        this.channel = null; g.ui.channel(null);
        const n = c.n; n.alive = false; n.respawn = 25; n.mesh.visible = false; n.beam.visible = false;
        sfx.pickup(); g.fx.burst(n.pos.clone().setY(n.pos.y + 0.6), 26, 0xffe08a, { speed: 4, up: 4, size: 0.4, grav: 2 });
        if (this.main && this.main.id === n.q.id) this.bump(n.q, true, n.q.item);
      }
    }
  }

  // ---------- map targets ----------
  targets() {
    const out = [];
    const pp = this.g.player.pos, gv = nearestGiver(pp.x, pp.z);
    const add = (q, done) => {
      if (done) { out.push({ x: gv.pos[0], z: gv.pos[1], r: 0, kind: 'turnin', label: q.name }); return; }
      if (q.type === 'kill' || q.type === 'drop') {
        const types = q.type === 'kill' ? [q.target] : q.from;
        const lv = this.g.save.level;
        const camps = CAMPS.filter((c) => types.includes(c[2]));
        // Prefer camps near the player's level so the marker points somewhere sensible.
        const good = camps.filter((c) => c[5] >= lv - 3 && c[4] <= lv + 3);
        for (const c of (good.length ? good : camps)) out.push({ x: c[0], z: c[1], r: 6, kind: 'area', label: q.name });
      } else if (q.type === 'boss') {
        const u = UNIQUES[q.target]; out.push({ x: u.pos[0], z: u.pos[1], r: 7, kind: 'boss', label: q.name });
      } else {
        for (const n of this.nodes) if (n.alive) out.push({ x: n.pos.x, z: n.pos.z, r: 0, kind: 'node', label: q.item });
      }
    };
    const m = this.main; if (m) add(m, this.mainDone);
    const b = this.st.bounty; if (b) add(b, this.bountyDone);
    if (!m && this.newMain) out.push({ x: GIVER.pos[0], z: GIVER.pos[1], r: 0, kind: 'turnin', label: 'Yeni görev (kamp)' });
    else if (!m && !b && this.npcMark(false) === '!') out.push({ x: gv.pos[0], z: gv.pos[1], r: 0, kind: 'turnin', label: 'Sözleşme' });
    return out;
  }
}

export { TYPE_NAMES, ENEMIES };
