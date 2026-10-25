# Слово пацана: Улицы Казани

A browser game in the style of GTA, based on the series «Слово пацана». It is a 3D third-person game
set in a winter Kazan district in 1989, with street fights, rival gangs and a Mortal Kombat-style
character select screen. The interface is in Russian.

## Run it

```bash
cd slovo-patsana
npm install
npm run dev        # opens http://localhost:5173
```

You need Node 18 or newer and a browser with WebGL (Chrome, Edge or Firefox).
`npm run build` builds a static version into `dist/`, and `npm run preview` serves it.

## What works now (step 1)

- **Character select**: Вова «Адидас», Андрей «Пальто» and Кащей, each with their own stats, special
  move and passive ability.
- **Open district**: a 6×6 grid of blocks with panel housing, the Универсам supermarket, the
  rink, the video salon, the school, the market, the garages and the gym. Snow, night,
  streetlights.
- **Territories**: Универсам (yours), Разъезд and Хади Такташ. Rival groups wait in their
  courtyards and pick a fight when you enter their turf. Universam allies (Турбо, Зима, Марат…)
  join fights near you.
- **Fighting**: a 3-hit punch combo, kick, block, dodge and a special for each character. Knockdowns,
  hit-stop, blocking, guard breaks.
- **Passers-by** walk the sidewalks, run away from fights, and sometimes fight back.
- **Money and authority**: beating rivals pays and earns authority, hitting civilians loses
  authority. If you get knocked out, you respawn at the Универсам.
- **HUD**: health, stamina (yellow means the special is ready), a minimap with territories, name tags,
  speech bubbles and damage numbers.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD | left stick |
| Sprint | Shift | RT / L3 |
| Camera | mouse (click to capture) · Z / C | right stick |
| Punch (combo) | LMB / J | X |
| Kick | RMB / K | Y |
| Block | Q / L (hold) | LB |
| Special | E / U | B |
| Dodge | Space | A |
| Get in / out of a car | F (at the driver's door) | RB |
| Drive | W/S throttle and brake · A/D steer · Space handbrake | stick |
| Pause | Esc | — |

## Code layout

| Path | What |
|---|---|
| `src/actors/HumanModel.ts` | Procedural low-poly people: joints, clothing, faces, hats |
| `src/actors/Animator.ts` | Pose clips (jab, cross, hook, kick, specials, falls) blended with walk and run |
| `src/actors/Fighter.ts` | Combat state machine: attacks, hit windows, block, knockdown |
| `src/combat/attacks.ts` | Damage, range, timing and knockback for every move |
| `src/actors/ai.ts` | Brains for passers-by, gangs and allies |
| `src/actors/characters.ts` | The playable roster |
| `src/world/City.ts` | District generator, landmarks, territories, colliders |
| `src/world/textures.ts` | Every texture is drawn in code: facades, snow, asphalt, signs |
| `src/game/*Mode.ts` | Menu, character select, free roam |

## Cars and militsiya (step 3)

- **Cars:** LADA 2107, GAZ-24 «Волга», a Volga taxi, UAZ-469 and a militsiya VAZ-2106. These are realistic
  Sketchfab models (credits below).
- **Driving:** arcade physics with a handbrake slide, adapted from gta7 (MIT). Grip is reduced for the snow.
  The player's car has working headlights and engine sound. Cars crash into walls and each other, and knock
  people down.
- **Traffic:** right-hand lanes on the road grid, random turns at crossings, braking for people and cars,
  and horns when stuck.
- **Wanted level (★★★):** you get stars for knocking out passers-by, running people over, stealing a car with
  someone in it, hitting militsiya, or stealing a militsiya car. UAZs come with sirens and chase you around
  the grid. Officers get out and fight on foot. If they knock you out, you get «ЗАДЕРЖАН» (arrested) and lose
  half your money. Stay out of sight long enough and the stars fade.

## Graphics (step 2)

- **Characters:** realistic 3D models of Вова, Андрей and Кащей. Each was generated from a concept image on
  Higgsfield (Meshy image-to-3D with auto-rigging). The faces are original, not the actors'.
- **Animations:** [Quaternius Universal Animation Library 1 & 2](https://quaternius.com) (CC0): walk, jog,
  sprint, jab, cross, hook, hits, knockdown, get-up, roll and more. The kick is from Meshy's animation library.
  `tools/retarget.py` (headless Blender) bakes them onto each character's skeleton.
- **World:** [Poly Haven](https://polyhaven.com) (CC0) supplies the `winter_evening` HDRI lighting, the PBR snow,
  snowy asphalt, pavement, concrete and brick textures, and the props (lamps, covered cars, bins, benches,
  tyres, crates…). `tools/optimize_props.py` decimates the props to game budgets.
- **Rendering:** [postprocessing](https://github.com/pmndrs/postprocessing) for bloom, AgX tone mapping, SMAA,
  vignette and film grain, plus [N8AO](https://github.com/N8python/n8ao) ambient occlusion.

## Realistic vehicles, street furniture and passers-by

The cars, the ZiL truck, the bus stops, the kiosks, the Soviet street lights, benches, bins, the
playgrounds (rocket climbing frame and seesaw), the kvass barrel, the garages and the photoscanned
passers-by are 3D models from Sketchfab under CC BY (attribution):
- Carla Rigged 001 - Rigged 3D Business Women by Renderpeople (https://sketchfab.com/3d-models/carla-rigged-001-rigged-3d-business-women-acf520f450d14dd799f98a6fede3edf5), CC Attribution
- Claudia Rigged 002 - 3D Rigged Business Women by Renderpeople (https://sketchfab.com/3d-models/claudia-rigged-002-3d-rigged-business-women-c659bd0accab47c6bbe390cf822a2b92), CC Attribution
- Eric Rigged 001 - Rigged 3D Business Man by Renderpeople (https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f), CC Attribution
- Nathan Animated 003 - Walking 3D Man by Renderpeople (https://sketchfab.com/3d-models/nathan-animated-003-walking-3d-man-143a2b1ea5eb4385ae90a73657aca3bc), CC Attribution
- old man in coat - human riged model by Kasit Studio (https://sketchfab.com/3d-models/old-man-in-coat-human-riged-model-e8052f5928ef42f1ae5b5af02eb1a36b), CC Attribution
- Sophia Animated 003 - Animated 3D Woman by Renderpeople (https://sketchfab.com/3d-models/sophia-animated-003-animated-3d-woman-dc448c3be0e74f96a55fb475a13433cf), CC Attribution
- Old Soviet Bus Stop by Coozy (https://sketchfab.com/3d-models/old-soviet-bus-stop-fe4d132434c24e1c8447a6d1190e8c6d), CC Attribution
- Abandoned Soviet Garages Pack Game-Ready by olegolegperepelica (https://sketchfab.com/3d-models/abandoned-soviet-garages-pack-game-ready-fcf453872c2d4cfbad12197d072fbfc4), CC Attribution
- Soviet Kiosk – 3D Model by dimmeyster (https://sketchfab.com/3d-models/soviet-kiosk-3d-model-3b85ae768ecd43f394991a1f0027c72c), CC Attribution
- Kvass Barrel by barracudazp (https://sketchfab.com/3d-models/kvass-barrel-c4958926b88c4b918d0a902f0628b6c7), CC Attribution
- Soviet Rocket Play Scape by Occam (https://sketchfab.com/3d-models/soviet-rocket-play-scape-9885be3845fa4b488fae42b122fd59d0), CC Attribution
- Seesaw "Type-1" by targa (https://sketchfab.com/3d-models/seesaw-type-1-9855438bf7d14f9b8a83e779c03e937f), CC Attribution
- Old Soviet Bench Rework by MrUnity (https://sketchfab.com/3d-models/old-soviet-bench-rework-ec973b24addb4e738486f4d3fb6d2eb8), CC Attribution
- Old Soviet Trash Can by Unka II (https://sketchfab.com/3d-models/old-soviet-trash-can-a2ebe6f94ecb43e19d45e1ac7376672b), CC Attribution
- Soviet Streetlight Pack by Unka II (https://sketchfab.com/3d-models/soviet-streetlight-pack-209fb45b77434af4b6830ff4da7d58b2), CC Attribution
- U469 by buh (https://sketchfab.com/3d-models/u469-b5a9f983a5a143f2a6994e083ef2b867), CC Attribution
- GAZ 24 Volga by maxdragonn (https://sketchfab.com/3d-models/gaz-24-volga-19074d0e6287462ea5e2be3e0a115665), CC Attribution
- LADA 2107 by tiunov.se (https://sketchfab.com/3d-models/lada-2107-31201f80892b404a8e49c272490a664c), CC Attribution
- VAZ-2106 Police by CGMeller (https://sketchfab.com/3d-models/vaz-2106-police-3eba9b129f214615b2ff24fdc857d5c9), CC Attribution
- ZIL 130 (body) / Lowpoly by romunql (https://sketchfab.com/3d-models/zil-130-body-lowpoly-48c2d4c7691c411396a0c22aca853518), CC Attribution

Tools:
- `tools/sketchfab_fetch.py` downloads and decimates a model.
- `tools/prep_car.py` strips scenery, turns a car to face +Z, scales it, splits out the wheels so they spin
  and steer, and merges the body by material.
- `tools/split_pack.py` splits a pack (e.g. three street lights) into single props.
- `tools/retarget.py` bakes the Quaternius animations onto any humanoid rig. It recognises Meshy, Mixamo,
  RenderPeople, Unreal and Reallusion bone names, converts centimetre rigs and normalises height.

A shader recolours the paint so every Zhiguli or Volga on the street is a different 80s colour.

## Credits and references

- Circle-vs-box collision is adapted from [depixeled-chris/gta7](https://github.com/depixeled-chris/gta7) (MIT).
  That repo's arcade car model is the planned basis for driving in step 3.
- [swift502/Sketchbook](https://github.com/swift502/Sketchbook) (MIT) was a reference for the
  third-person camera and vehicles.
- Built on [three.js](https://threejs.org). There are no external art or audio files: models,
  textures, music and sound effects are all generated in code.

This is a non-commercial fan game. The characters are stylised, not likenesses of the actors.
