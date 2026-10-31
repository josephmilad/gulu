/**
 * Build the light phone versions of the game's models and textures into public/assets/m/.
 * Textures are scaled down (characters, people and cars to 512 px, props to 256 px) and the
 * small scenery loses its normal/roughness maps, which a phone screen cannot show anyway.
 *
 *   mkdir /tmp/gt && cd /tmp/gt && npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp@0.33
 *   GT_DIR=/tmp/gt node tools/mobile_assets.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(path.join(process.env.GT_DIR || process.cwd(), 'package.json'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { prune, dedup } = req('@gltf-transform/functions');
const sharp = req('sharp');

const SRC = 'public/assets';
const OUT = 'public/assets/m';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function shrinkImage(buf, mime, max) {
  const img = sharp(buf);
  const meta = await img.metadata();
  if (Math.max(meta.width ?? 0, meta.height ?? 0) <= max) return buf;
  const r = img.resize({ width: max, height: max, fit: 'inside' });
  return mime === 'image/png' ? r.png({ compressionLevel: 9 }).toBuffer() : r.jpeg({ quality: 80 }).toBuffer();
}

async function glb(rel, max, keepDetailMaps) {
  const doc = await io.read(path.join(SRC, rel));
  const root = doc.getRoot();
  if (!keepDetailMaps) {
    for (const m of root.listMaterials()) {
      m.setNormalTexture(null);
      m.setOcclusionTexture(null);
      m.setMetallicRoughnessTexture(null);
    }
  }
  await doc.transform(prune(), dedup());
  for (const t of root.listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    t.setImage(await shrinkImage(Buffer.from(img), t.getMimeType(), max));
  }
  const out = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await io.write(out, doc);
  const a = fs.statSync(path.join(SRC, rel)).size, b = fs.statSync(out).size;
  console.log(rel.padEnd(42), (a / 1e6).toFixed(1).padStart(6), '→', (b / 1e6).toFixed(1), 'MB');
}

const list = (dir) => fs.readdirSync(path.join(SRC, dir)).filter((f) => f.endsWith('.glb')).map((f) => `${dir}/${f}`);

for (const f of list('characters')) if (!f.includes('_lod')) await glb(f, 512, true);
for (const f of list('characters/npc')) await glb(f, 512, false);
for (const f of list('vehicles')) await glb(f, 512, false);
for (const f of list('props')) await glb(f, f.includes('garages') || f.includes('bus_stop') || f.includes('kiosk') ? 512 : 256, false);

fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });
for (const f of fs.readdirSync(path.join(SRC, 'tex'))) {
  if (!f.endsWith('.jpg')) continue;
  const buf = await sharp(path.join(SRC, 'tex', f)).resize({ width: 512, height: 512, fit: 'inside' }).jpeg({ quality: 82 }).toBuffer();
  fs.writeFileSync(path.join(OUT, 'tex', f), buf);
}
console.log('textures done');
