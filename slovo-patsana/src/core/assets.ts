import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const BASE = import.meta.env.BASE_URL + 'assets/';

export const CHARACTER_FILES = ['vova', 'palto', 'kashchey'] as const;
export const NPC_FILES = ['eric', 'carla', 'claudia', 'nathan', 'sophia', 'oldcoat'] as const;
export const VEHICLE_FILES = ['zhiguli', 'zhiguli_police', 'volga', 'uaz', 'zil'] as const;
export const PROP_FILES = [
  'bus_stop', 'kiosk', 'sov_lamp', 'sov_bin', 'sov_bench', 'seesaw', 'rocket', 'kvass', 'garages',
  'metal_trash_can', 'utility_box_01', 'covered_car', 'old_tyre', 'trashbag',
  'concrete_road_barrier', 'dead_tree_trunk', 'wooden_crate_01', 'painted_wooden_bench',
  'water_manhole_cover', 'exterior_aircon_unit',
] as const;
export const TEXTURE_SETS = ['snow_01', 'asphalt_snow', 'concrete_pavement', 'red_brick', 'plastered_wall', 'pine_bark', 'bark_willow', 'painted_metal_shutter', 'rusty_metal_02'] as const;

export interface PbrSet {
  map: THREE.Texture;
  normal: THREE.Texture;
  rough: THREE.Texture;
  /** The raw diffuse image, for compositing facades on a canvas. */
  image: HTMLImageElement;
}

export interface Assets {
  characters: Record<string, GLTF>;
  /** Decimated, smaller-texture versions used for crowds. */
  charactersLod: Record<string, GLTF>;
  props: Record<string, THREE.Object3D>;
  vehicles: Record<string, GLTF>;
  /** Photoscanned passers-by (RenderPeople & co., CC-BY). */
  npcs: Record<string, GLTF>;
  tex: Record<string, PbrSet>;
  hdr: THREE.DataTexture;
}

/** Loads every model, texture and the HDR sky, reporting progress 0..1. */
export async function loadAssets(onProgress: (p: number, label: string) => void): Promise<Assets> {
  const gltf = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const imgLoader = new THREE.ImageLoader();
  let done = 0;
  const jobs: Promise<unknown>[] = [];
  const total = CHARACTER_FILES.length * 2 + NPC_FILES.length + VEHICLE_FILES.length + PROP_FILES.length + TEXTURE_SETS.length * 3 + 1;
  const tick = (label: string) => onProgress(++done / total, label);
  const track = <T>(p: Promise<T>, label: string) => {
    const q = p.then((v) => {
      tick(label);
      return v;
    });
    jobs.push(q);
    return q;
  };

  const a: Assets = { characters: {}, charactersLod: {}, props: {}, vehicles: {}, npcs: {}, tex: {}, hdr: null as unknown as THREE.DataTexture };
  for (const n of NPC_FILES) track(gltf.loadAsync(`${BASE}characters/npc/${n}.glb`), 'прохожие').then((g) => (a.npcs[n] = g));
  for (const v of VEHICLE_FILES) track(gltf.loadAsync(`${BASE}vehicles/${v}.glb`), 'машины').then((g) => (a.vehicles[v] = g));
  for (const c of CHARACTER_FILES) {
    track(gltf.loadAsync(`${BASE}characters/${c}.glb`), 'персонажи').then((g) => (a.characters[c] = g));
    track(gltf.loadAsync(`${BASE}characters/${c}_lod.glb`), 'прохожие').then((g) => (a.charactersLod[c] = g));
  }
  for (const p of PROP_FILES) {
    track(gltf.loadAsync(`${BASE}props/${p}.glb`), 'двор').then((g) => (a.props[p] = g.scene));
  }
  for (const t of TEXTURE_SETS) {
    const set = {} as PbrSet;
    a.tex[t] = set;
    track(texLoader.loadAsync(`${BASE}tex/${t}_diff.jpg`), 'текстуры').then((x) => {
      x.colorSpace = THREE.SRGBColorSpace;
      set.map = x;
    });
    track(texLoader.loadAsync(`${BASE}tex/${t}_nor.jpg`), 'текстуры').then((x) => (set.normal = x));
    track(imgLoader.loadAsync(`${BASE}tex/${t}_diff.jpg`), 'текстуры').then((x) => (set.image = x));
    set.rough = null as unknown as THREE.Texture;
  }
  track(new RGBELoader().loadAsync(`${BASE}hdri/winter_evening_2k.hdr`), 'небо').then((h) => {
    h.mapping = THREE.EquirectangularReflectionMapping;
    a.hdr = h;
  });
  await Promise.all(jobs);
  for (const t of TEXTURE_SETS) {
    // Roughness maps are optional; fall back to the material's scalar roughness.
    const r = await texLoader.loadAsync(`${BASE}tex/${t}_rough.jpg`).catch(() => null);
    if (r) a.tex[t].rough = r;
  }
  for (const s of Object.values(a.tex))
    for (const x of [s.map, s.normal, s.rough]) {
      if (!x) continue;
      x.wrapS = x.wrapT = THREE.RepeatWrapping;
      x.anisotropy = 8;
    }
  return a;
}

/** A tiling copy of a PBR set with its own repeat. */
export function pbrMaterial(s: PbrSet, repeatX: number, repeatY: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  const c = (t: THREE.Texture | null) => {
    if (!t) return null;
    const k = t.clone();
    k.repeat.set(repeatX, repeatY);
    k.needsUpdate = true;
    return k;
  };
  return new THREE.MeshStandardMaterial({
    map: c(s.map), normalMap: c(s.normal), roughnessMap: c(s.rough), roughness: 1, metalness: 0, ...extra,
  });
}
