#!/bin/bash
# Converts the CC0 sound packs into small mp3 files for the game.
# Usage: tools/prep-audio.sh <dir with kenney_* folders> <dir with music files>
set -e
K="$1"; M="$2"; OUT="$(dirname "$0")/../public/assets"
sfx() { ffmpeg -v error -y -i "$1" -ac 1 -ar 44100 -b:a 64k "$OUT/sfx/$2.mp3"; }
R="$K/kenney_rpg-audio/Audio"; I="$K/kenney_impact-sounds/Audio"; U="$K/kenney_interface-sounds/Audio"
sfx "$R/knifeSlice.ogg" swing1; sfx "$R/knifeSlice2.ogg" swing2; sfx "$R/drawKnife1.ogg" swing3; sfx "$R/drawKnife2.ogg" swing4
sfx "$R/chop.ogg" chop
for i in 0 1 2 3 4; do
  sfx "$I/impactPunch_medium_00$i.ogg" hit$i; sfx "$I/impactPunch_heavy_00$i.ogg" crit$i; sfx "$I/impactMetal_light_00$i.ogg" metal$i
  sfx "$I/impactWood_light_00$i.ogg" bone$i; sfx "$I/impactSoft_heavy_00$i.ogg" hurt$i; sfx "$I/footstep_grass_00$i.ogg" step$i
  sfx "$I/footstep_snow_00$i.ogg" snow$i; sfx "$I/impactGlass_light_00$i.ogg" glass$i
done
for i in 0 1 2; do sfx "$I/impactWood_heavy_00$i.ogg" wood$i; sfx "$I/impactPlate_heavy_00$i.ogg" plate$i; sfx "$I/impactBell_heavy_00$i.ogg" bell$i; sfx "$I/impactMining_00$i.ogg" rock$i; sfx "$I/impactGlass_heavy_00$i.ogg" shatter$i; done
sfx "$R/handleCoins.ogg" coin1; sfx "$R/handleCoins2.ogg" coin2
sfx "$R/handleSmallLeather.ogg" leather1; sfx "$R/handleSmallLeather2.ogg" leather2; sfx "$R/dropLeather.ogg" drop
sfx "$R/cloth1.ogg" cloth1; sfx "$R/cloth2.ogg" cloth2
sfx "$R/metalPot1.ogg" pot1; sfx "$R/metalPot2.ogg" pot2
sfx "$R/bookOpen.ogg" book
sfx "$U/click_001.ogg" click; sfx "$U/select_002.ogg" select; sfx "$U/error_004.ogg" error; sfx "$U/confirmation_002.ogg" confirm
sfx "$U/maximize_006.ogg" rare; sfx "$U/bong_001.ogg" bong; sfx "$U/open_002.ogg" open; sfx "$U/close_002.ogg" close
mus() { ffmpeg -v error -y -i "$1" ${3:+-t $3} -af "afade=t=in:d=1.5${3:+,afade=t=out:st=$(( $3 - 4 )):d=4}" -ac 2 -ar 44100 -b:a 80k "$OUT/music/$2.mp3"; }
mus "$M/Elven_Companion.mp3" camp
mus "$M/Interlude.mp3" title
mus "$M/Akash_Chamber.mp3" explore1
mus "$M/Faerie_Shrine.mp3" explore2
mus "$M/Awakening.mp3" explore3 240
mus "$M/Aural.mp3" explore4 240
mus "$M/Shores_of_Yore.mp3" explore5
mus "$M/determined_pursuit_loop.wav" boss
mus "$M/QaziJamJam.wav" final
