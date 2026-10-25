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

- **Cars:** VAZ-2106 «Жигули», GAZ-24 «Волга», a Volga taxi and the militsiya UAZ-469, all modelled in code
  (`src/vehicles/CarModel.ts`). They have clear-coat paint, chrome, quad headlights, brake lights and Soviet
  «а 12-34 ТА» plates. Parked cars wear a cap of snow.
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

## Credits and references

- Circle-vs-box collision is adapted from [depixeled-chris/gta7](https://github.com/depixeled-chris/gta7) (MIT).
  That repo's arcade car model is the planned basis for driving in step 3.
- [swift502/Sketchbook](https://github.com/swift502/Sketchbook) (MIT) was a reference for the
  third-person camera and vehicles.
- Built on [three.js](https://threejs.org). There are no external art or audio files: models,
  textures, music and sound effects are all generated in code.

This is a non-commercial fan game. The characters are stylised, not likenesses of the actors.
