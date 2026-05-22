// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.7
// Timestamp: 2026-05-21T15:18:00-04:00
// Purpose: Full rewrite of the cookie simulator's 3D scene and recipe model so slider changes
//   produce dramatic, visible differences in shape, color, and chip distribution, and so the
//   cookie itself looks high resolution rather than low-poly.
// Reason: The previous version used a coarse cylinder with stick-like "cracks" and dodecahedron
//   chips, and the bake model produced subtle visual changes that the user couldn't see.

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RotateCcw, RotateCw, Thermometer, Timer, Wheat, Droplets, Cookie, Milk, Sparkles, Flame } from 'lucide-react';
import * as THREE from 'three';
import './styles.css';
import { DEFAULT_RECIPE, MAX_CHIPS, evaluateCookie } from './cookieScienceModel.js';

// AI_CHANGE:
// Tool: Codex
// Model: GPT-5
// Timestamp: 2026-05-21T17:10:13-04:00
// Purpose: Connects the UI to the dedicated cookie science model and exposes new process controls.
// Reason: Food-science variables such as baking powder, flour protein, butter state,
//   dough chilling, dough size, and pan transfer need to affect simulator outcomes.
const defaults = DEFAULT_RECIPE;

const controls = [
  { key: 'flour', label: 'Flour', min: 1.25, max: 3.25, step: 0.25, unit: 'cups', icon: Wheat },
  { key: 'flourProtein', label: 'Flour protein', min: 8, max: 13, step: 0.25, unit: '%', icon: Wheat },
  { key: 'butter', label: 'Butter', min: 6, max: 18, step: 1, unit: 'tbsp', icon: Droplets },
  {
    key: 'butterState',
    label: 'Butter state',
    min: 0,
    max: 2,
    step: 1,
    unit: '',
    icon: Droplets,
    options: ['chilled', 'softened', 'melted'],
  },
  { key: 'brownSugar', label: 'Brown sugar', min: 0.25, max: 1.5, step: 0.25, unit: 'cups', icon: Sparkles },
  { key: 'whiteSugar', label: 'White sugar', min: 0.25, max: 1.25, step: 0.25, unit: 'cups', icon: Sparkles },
  { key: 'eggs', label: 'Eggs', min: 0, max: 4, step: 0.5, unit: '', icon: Milk },
  { key: 'vanilla', label: 'Vanilla', min: 0, max: 6, step: 0.5, unit: 'tsp', icon: Droplets },
  { key: 'bakingSoda', label: 'Baking soda', min: 0, max: 2, step: 0.25, unit: 'tsp', icon: Sparkles },
  { key: 'bakingPowder', label: 'Baking powder', min: 0, max: 2, step: 0.25, unit: 'tsp', icon: Sparkles },
  { key: 'salt', label: 'Salt', min: 0, max: 1.5, step: 0.25, unit: 'tsp', icon: Sparkles },
  { key: 'chocolateChips', label: 'Chocolate chips', min: 0.25, max: 2, step: 0.25, unit: 'cups', icon: Cookie },
  { key: 'doughTemp', label: 'Dough temp', min: 38, max: 85, step: 1, unit: 'F', icon: Thermometer },
  { key: 'chillTime', label: 'Chill/rest', min: 0, max: 48, step: 1, unit: 'hr', icon: Timer },
  { key: 'cookieSize', label: 'Dough size', min: 0.8, max: 3.5, step: 0.1, unit: 'oz', icon: Cookie },
  { key: 'ovenTemp', label: 'Oven temp', min: 275, max: 450, step: 5, unit: 'F', icon: Thermometer },
  { key: 'cookTime', label: 'Cook time', min: 5, max: 24, step: 0.5, unit: 'min', icon: Timer },
  {
    key: 'panHeat',
    label: 'Pan heat',
    min: 0,
    max: 2,
    step: 1,
    unit: '',
    icon: Flame,
    options: ['insulated', 'aluminum', 'dark steel'],
  },
];

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-05-21T20:25:00-04:00
// Purpose: Builds procedural picnic-check and wood textures for the serving table scene.
// Reason: Restores the open picnic-table setting after the enclosed kitchen blocked camera
//   movement at several orbit angles.
function createPicnicClothTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const squares = 10;
  const sq = size / squares;

  for (let row = 0; row < squares; row += 1) {
    for (let col = 0; col < squares; col += 1) {
      const even = (row + col) % 2 === 0;
      ctx.fillStyle = even ? '#fff8f2' : '#c62828';
      ctx.fillRect(col * sq, row * sq, sq + 1, sq + 1);
    }
  }

  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = hash1(i * 0.017) * 14 - 7;
    image.data[i] = clamp(image.data[i] + n, 0, 255);
    image.data[i + 1] = clamp(image.data[i + 1] + n * 0.8, 0, 255);
    image.data[i + 2] = clamp(image.data[i + 2] + n * 0.6, 0, 255);
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.5, 3.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWoodTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8f5a2d';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 42; i += 1) {
    const y = hash1(i * 2.7) * size;
    const w = 2 + hash1(i + 4) * 5;
    ctx.fillStyle = `rgba(${Math.round(70 + hash1(i + 8) * 40)}, ${Math.round(38 + hash1(i + 12) * 24)}, ${Math.round(16 + hash1(i + 16) * 18)}, 0.18)`;
    ctx.fillRect(0, y, size, w);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-05-21T20:25:00-04:00
// Purpose: Renders a picnic table with checkered cloth, wood top, and ceramic plate.
// Reason: Keeps the cookie grounded on an open set so users can orbit freely without walls
//   or cabinets clipping the camera view.
function PicnicTableSetting() {
  const clothTexture = useMemo(() => createPicnicClothTexture(), []);
  const woodTexture = useMemo(() => createWoodTexture(), []);

  return (
    <group>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[13.5, 0.22, 13.5]} />
        <meshStandardMaterial map={woodTexture} color={'#9a6435'} roughness={0.82} metalness={0} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.046, 0]} receiveShadow>
        <planeGeometry args={[13.2, 13.2, 1, 1]} />
        <meshStandardMaterial map={clothTexture} roughness={0.92} metalness={0} />
      </mesh>

      {[
        [-5.4, -0.34, -5.4],
        [5.4, -0.34, -5.4],
        [-5.4, -0.34, 5.4],
        [5.4, -0.34, 5.4],
      ].map(([x, y, z]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 1.05, 0.34]} />
          <meshStandardMaterial map={woodTexture} color={'#7a4d28'} roughness={0.88} metalness={0} />
        </mesh>
      ))}

      <group position={[0, -0.015, 0]}>
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[3.35, 3.45, 0.07, 72]} />
          <meshStandardMaterial color={'#f3eee6'} roughness={0.34} metalness={0.04} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} castShadow receiveShadow>
          <torusGeometry args={[3.18, 0.075, 16, 96]} />
          <meshStandardMaterial color={'#ebe4da'} roughness={0.3} metalness={0.05} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} receiveShadow>
          <circleGeometry args={[3.12, 72]} />
          <meshStandardMaterial color={'#faf7f2'} roughness={0.28} metalness={0.03} />
        </mesh>
      </group>
    </group>
  );
}

function topSurfaceY(u) {
  const k = u / 0.86;
  return u < 0.86 ? 0.96 - 0.45 * k * k - 0.08 * Math.pow(k, 4) : 0.96 - 0.45 - 0.08;
}

function formatValue(value, control) {
  if (control.options) return control.options[Math.round(value)] ?? value;
  const unit = control.unit;
  if (!unit) return value;
  if (unit === 'cups' || unit === 'tsp') {
    const whole = Math.floor(value);
    const quarter = Math.round((value - whole) * 4);
    const fraction = ['', '1/4', '1/2', '3/4'][quarter] || '';
    if (whole && fraction) return `${whole} ${fraction}`;
    if (fraction) return fraction;
    return whole;
  }
  if (unit === 'oz') return value.toFixed(1);
  if (unit === '%') return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return value;
}

function unitLabel(unit, value) {
  if (unit === 'cups' && value <= 1) return 'cup';
  return unit;
}

// Cookie color: pale dough -> golden -> deep brown -> burnt. Returns THREE.Color.
// Burn-end stays a warm coffee brown rather than near-black, otherwise the dark base
// reads as a grey plastic blob once any specular highlight hits it.
function bakeColor(bake, burn) {
  // Warm, food-photography palette: default bake should land at familiar
  // chocolate-chip-cookie golden tan, with darker stops reserved for true overbake.
  const c0 = new THREE.Color('#f5d89c'); // raw dough
  const c1 = new THREE.Color('#e7b873'); // light golden
  const c2 = new THREE.Color('#c88742'); // classic chocolate-chip-cookie brown
  const c3 = new THREE.Color('#88421d'); // deep toasted brown
  const c4 = new THREE.Color('#542611'); // overbaked

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-05-21T18:11:54-04:00
  // Purpose: Calibrates the visual browning scale so the default recipe reads as average.
  // Reason: The science model labeled the default as golden/chewy, but the material color
  //   looked slightly overcooked for an everyday chocolate chip cookie.
  const t = clamp(bake - 0.12, 0, 1.4);
  let color;
  if (t < 0.4) color = c0.clone().lerp(c1, t / 0.4);
  else if (t < 0.75) color = c1.clone().lerp(c2, (t - 0.4) / 0.35);
  else if (t < 1.05) color = c2.clone().lerp(c3, (t - 0.75) / 0.3);
  else color = c3.clone().lerp(c4, (t - 1.05) / 0.35);

  if (burn > 0) {
    const ash = new THREE.Color('#2c1407');
    color.lerp(ash, burn * 0.2);
  }
  return color;
}

// Build a deterministic, high-resolution cookie geometry at unit dimensions
// (radius = 1, peak height = 1). The mesh group scales this to physical size.
// Bakes vertex colors so the rim is naturally darker than the center.
function buildCookieGeometry() {
  const aSeg = 320; // angular
  const rSeg = 96; // radial rings
  const positions = [];
  const colors = [];
  const indices = [];

  // Deterministic per-angle outline wobble (cookies aren't perfect circles).
  const outline = (theta) =>
    1 +
    Math.sin(theta * 3 + 0.3) * 0.022 +
    Math.sin(theta * 7 - 1.1) * 0.018 +
    Math.sin(theta * 13 + 2.4) * 0.012;

  // 2-D value-noise-ish surface bump. Larger than before — these create the
  // craggy nooks and crannies that catch directional light and stop the cookie
  // from reading as a smooth plastic disc.
  const surface = (x, z) =>
    Math.sin(x * 5.2 + Math.sin(z * 3.1) * 1.7) * 0.018 +
    Math.sin(z * 6.4 - Math.sin(x * 2.8) * 1.6 + 0.7) * 0.016 +
    Math.sin(x * 19.5 + z * 15.4 - 1.3) * 0.01 +
    Math.sin(x * 54.6 - z * 47.4 + 1.2) * 0.005;

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-05-21T16:43:19-04:00
  // Purpose: Moves all cookie texture into the main mesh with deeper puffs and dimples.
  // Reason: Separate tan bump meshes looked like extra chips; stronger mesh displacement
  //   creates visible high and low points without introducing fake toppings.
  const doughLumps = Array.from({ length: 92 }, (_, i) => {
    const angle = hash1(i * 4.7 + 1) * Math.PI * 2;
    const r = 0.12 + Math.sqrt(hash1(i * 3.1 + 2)) * 0.74;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      radius: 0.07 + hash1(i + 8) * 0.23,
      height: (hash1(i + 15) - 0.46) * 0.25,
    };
  });

  const surfacePores = Array.from({ length: 142 }, (_, i) => {
    const angle = hash1(i * 8.1 + 3) * Math.PI * 2;
    const r = 0.1 + Math.sqrt(hash1(i * 4.3 + 4)) * 0.78;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      radius: 0.024 + hash1(i + 19) * 0.078,
      depth: 0.026 + hash1(i + 27) * 0.07,
      shade: 0.025 + hash1(i + 31) * 0.07,
    };
  });

  const toastPatches = Array.from({ length: 36 }, (_, i) => {
    const angle = hash1(i * 6.9 + 10) * Math.PI * 2;
    const r = 0.12 + Math.sqrt(hash1(i * 5.2 + 11)) * 0.76;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      radius: 0.06 + hash1(i + 41) * 0.17,
      shade: (hash1(i + 53) - 0.34) * 0.085,
    };
  });

  const doughTextureAt = (x, z, u) => {
    let lift = 0;
    let shade = 0;
    for (const lump of doughLumps) {
      const dx = x - lump.x;
      const dz = z - lump.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < lump.radius) {
        const t = 1 - d / lump.radius;
        const falloff = t * t * (3 - 2 * t);
        lift += lump.height * falloff;
        shade -= lump.height * 0.24 * falloff;
      }
    }

    for (const pore of surfacePores) {
      const dx = x - pore.x;
      const dz = z - pore.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < pore.radius) {
        const t = 1 - d / pore.radius;
        const falloff = t * t;
        lift -= pore.depth * falloff;
        shade += pore.shade * falloff;
      }
    }

    for (const patch of toastPatches) {
      const dx = x - patch.x;
      const dz = z - patch.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < patch.radius) {
        const t = 1 - d / patch.radius;
        shade += patch.shade * t * t * (3 - 2 * t);
      }
    }

    const rimFade = smooth(clamp((0.9 - u) / 0.18, 0, 1));
    return { lift: lift * rimFade * 1.22, shade: shade * rimFade };
  };

  // u in [0, 1] is the radial parameter. The profile starts with a soft dome on top
  // (u in [0, 0.86]), then curls down a quarter-circle edge into the bottom seam.
  const profile = (u) => {
    if (u < 0.86) {
      const k = u / 0.86;
      // Slight superellipse for a fuller dome.
      const r = Math.sin(k * Math.PI * 0.5) * 0.95;
      const y = 0.96 - 0.45 * k * k - 0.08 * Math.pow(k, 4);
      return { r, y };
    }
    const k = (u - 0.86) / 0.14;
    const phi = k * Math.PI * 0.5;
    const shoulderY = 0.96 - 0.45 - 0.08;
    return {
      r: 0.95 + 0.05 * Math.sin(phi),
      y: shoulderY * (1 - Math.sin(phi)) + 0.05 * (1 - Math.cos(phi)),
    };
  };

  // Build top + edge ring layer.
  for (let i = 0; i <= rSeg; i += 1) {
    const u = i / rSeg;
    const { r: r0, y: y0 } = profile(u);
    for (let j = 0; j < aSeg; j += 1) {
      const theta = (j / aSeg) * Math.PI * 2;
      const wob = outline(theta);
      const r = r0 * wob;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      // Surface bumpiness fades toward the rim curl.
      const texture = doughTextureAt(x, z, u);
      const bump = (u < 0.84 ? surface(x, z) : surface(x, z) * 0.2) + texture.lift;
      const y = y0 + bump;

      positions.push(x, y, z);

      // Vertex color: warm dough multiplier with darker edges. The center is
      // intentionally lighter than the original craggy mesh so the default recipe
      // reads like an average chocolate chip cookie, not an overbaked one.
      // AI_CHANGE:
      // Tool: Codex
      // Model: GPT-5
      // Timestamp: 2026-05-21T18:11:54-04:00
      // Purpose: Lightens the baked-in vertex color multipliers for the default cookie surface.
      // Reason: Material hue alone was not enough because the vertex colors were multiplying
      //   the dough into a darker, overcooked-looking brown.
      const rimT = smooth(clamp((u - 0.55) / 0.45, 0, 1));
      const baseR = lerp(0.82, 0.58, rimT);
      const baseG = lerp(0.78, 0.48, rimT);
      const baseB = lerp(0.68, 0.34, rimT);
      const speckle =
        Math.sin(x * 11.7 + z * 8.3) * 0.45 +
        Math.sin(x * 23.1 - z * 17.9 + 1.7) * 0.34 +
        Math.sin(x * 43.4 + z * 39.2 - 0.4) * 0.2;
      const tint = speckle * 0.075 - texture.shade;
      const cr = clamp(baseR + tint * 1.05, 0, 1);
      const cg = clamp(baseG + tint * 0.88, 0, 1);
      const cb = clamp(baseB + tint * 0.62, 0, 1);
      colors.push(cr, cg, cb);
    }
  }

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-05-21T16:25:47-04:00
  // Purpose: Winds the cookie's top triangles toward the camera so the dough surface renders.
  // Reason: The reversed triangle order made the top face disappear via backface culling,
  //   leaving the canvas background visible where the cookie surface should have been.
  for (let i = 0; i < rSeg; i += 1) {
    for (let j = 0; j < aSeg; j += 1) {
      const a = i * aSeg + j;
      const b = i * aSeg + ((j + 1) % aSeg);
      const c = (i + 1) * aSeg + j;
      const d = (i + 1) * aSeg + ((j + 1) % aSeg);
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-05-21T16:25:47-04:00
  // Purpose: Restores a closed underside using duplicated rim vertices with separate normals.
  // Reason: Claude removed the bottom face while debugging lighting, which let the scene
  //   background show through the hollow cookie and read as a pale overlay across the model.
  const bottomY = 0.02;
  const sideBottomStart = positions.length / 3;
  for (let j = 0; j < aSeg; j += 1) {
    const theta = (j / aSeg) * Math.PI * 2;
    const wob = outline(theta);
    positions.push(Math.cos(theta) * wob, bottomY, Math.sin(theta) * wob);
    colors.push(0.42, 0.25, 0.14);
  }

  for (let j = 0; j < aSeg; j += 1) {
    const topA = rSeg * aSeg + j;
    const topB = rSeg * aSeg + ((j + 1) % aSeg);
    const bottomA = sideBottomStart + j;
    const bottomB = sideBottomStart + ((j + 1) % aSeg);
    indices.push(topA, topB, bottomA);
    indices.push(topB, bottomB, bottomA);
  }

  const bottomRingStart = positions.length / 3;
  for (let j = 0; j < aSeg; j += 1) {
    const theta = (j / aSeg) * Math.PI * 2;
    const wob = outline(theta);
    positions.push(Math.cos(theta) * wob, bottomY, Math.sin(theta) * wob);
    colors.push(0.34, 0.19, 0.1);
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, bottomY, 0);
  colors.push(0.34, 0.19, 0.1);

  for (let j = 0; j < aSeg; j += 1) {
    indices.push(bottomCenter, bottomRingStart + j, bottomRingStart + ((j + 1) % aSeg));
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// AI_CHANGE:
// Tool: Codex
// Model: GPT-5
// Timestamp: 2026-05-21T16:36:09-04:00
// Purpose: Uses farthest-point chip placement for even coverage as chip count changes.
// Reason: The previous golden-angle sequence still created visible chip clusters, especially
//   around the upper-left quadrant of the default cookie.
function buildChipBases() {
  const candidates = Array.from({ length: 180 }, (_, i) => {
    const angle = hash1(i * 9.17 + 2.3) * Math.PI * 2;
    const r = 0.14 + Math.sqrt(hash1(i * 5.41 + 6.2)) * 0.66;
    return { angle, u: r };
  });

  const selected = [{ angle: 0.45, u: 0.46 }];
  while (selected.length < MAX_CHIPS) {
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const cx = Math.cos(candidate.angle) * candidate.u;
      const cz = Math.sin(candidate.angle) * candidate.u;
      const minDist = selected.reduce((closest, placed) => {
        const px = Math.cos(placed.angle) * placed.u;
        const pz = Math.sin(placed.angle) * placed.u;
        const dx = cx - px;
        const dz = cz - pz;
        return Math.min(closest, Math.sqrt(dx * dx + dz * dz));
      }, Infinity);
      const edgePenalty = Math.max(0, candidate.u - 0.68) * 0.45;
      const score = minDist - edgePenalty + hash1(selected.length * 13.7 + candidate.u) * 0.01;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    selected.push(best);
  }

  const bases = [];
  for (let i = 0; i < MAX_CHIPS; i += 1) {
    const selectedChip = selected[i];
    const u = selectedChip.u;
    const theta = selectedChip.angle;

    // Match the same outline wobble used by the cookie geometry so chips ride the rim.
    const wob =
      1 +
      Math.sin(theta * 3 + 0.3) * 0.022 +
      Math.sin(theta * 7 - 1.1) * 0.018 +
      Math.sin(theta * 13 + 2.4) * 0.012;

    const r = u * wob;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    // Top-surface height at this radius, matching the profile in buildCookieGeometry.
    const yTop = topSurfaceY(u);

    bases.push({
      x,
      z,
      yLocal: yTop,
      tilt: hash1(i + 0.13) * 0.35 - 0.18,
      rot: theta * 1.3 + hash1(i + 0.77) * 6.28,
      scaleVar: 0.85 + hash1(i + 1.91) * 0.35,
    });
  }
  return bases;
}

// One animated mesh + instanced chips. Each frame eases the visible state toward `target`.
// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-05-21T19:10:00-04:00
// Purpose: Drives cookie-only levitation, spin, and gravity fall when auto-rotate toggles.
// Reason: The scene should stay still on the picnic table while only the cookie performs
//   a magical lift-and-spin act and then lands back on the plate with believable bounce.
const COOKIE_REST_Y = 0;
const LEVITATE_HEIGHT = 0.52;
const SPIN_RATE = 0.11;
const GRAVITY = 14.5;
const BOUNCE = 0.38;
const BOUNCE_FRICTION = 0.72;

function CookieMesh({ target, autoRotate }) {
  const motionRef = useRef();
  const squashRef = useRef();
  const groupRef = useRef();
  const matRef = useRef();
  const chipsRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const geometry = useMemo(() => buildCookieGeometry(), []);
  const chipBases = useMemo(() => buildChipBases(), []);

  // Per-chip current state, lerped toward target each frame.
  const chipState = useRef(
    chipBases.map(() => ({ scale: 0 })),
  );

  const anim = useRef({
    mode: autoRotate ? 'levitate' : 'rest',
    y: 0,
    vy: 0,
    ry: 0,
    ryVel: 0,
    levitateT: 0,
    squash: 1,
    bobPhase: 0,
    tiltX: 0,
    tiltZ: 0,
  });

  useEffect(() => {
    const state = anim.current;
    if (autoRotate) {
      if (state.mode === 'rest' || state.mode === 'fall') {
        state.mode = 'levitate';
        state.levitateT = 0;
        state.vy = 0;
      }
      return;
    }

    if (state.mode === 'levitate' || state.mode === 'spin') {
      state.mode = 'fall';
      state.vy = 0;
      state.ryVel = SPIN_RATE * 0.55;
    }
  }, [autoRotate]);

  const targetColor = useMemo(() => bakeColor(target.bake, target.burn), [target.bake, target.burn]);

  useFrame((_, dtRaw) => {
    // Clamp dt so big tab-switch pauses don't snap things.
    const dt = Math.min(0.05, dtRaw);
    const k = 1 - Math.exp(-dt * 7);
    const a = anim.current;
    const motion = motionRef.current;
    const squash = squashRef.current;

    if (motion) {
      if (a.mode === 'levitate') {
        a.levitateT = Math.min(1, a.levitateT + dt / 0.9);
        const ease = 1 - Math.pow(1 - a.levitateT, 3);
        a.y = lerp(COOKIE_REST_Y, LEVITATE_HEIGHT, ease);
        a.tiltX = Math.sin(a.levitateT * Math.PI * 4) * 0.045 * (1 - a.levitateT);
        a.tiltZ = Math.sin(a.levitateT * Math.PI * 3 + 0.6) * 0.035 * (1 - a.levitateT);
        if (a.levitateT >= 1) {
          a.mode = 'spin';
          a.bobPhase = 0;
          a.tiltX = 0;
          a.tiltZ = 0;
        }
      } else if (a.mode === 'spin') {
        a.bobPhase += dt * 2.2;
        a.y = LEVITATE_HEIGHT + Math.sin(a.bobPhase) * 0.035;
        a.ry += SPIN_RATE * dt;
        a.tiltX = 0;
        a.tiltZ = 0;
      } else if (a.mode === 'fall') {
        a.vy -= GRAVITY * dt;
        a.y += a.vy * dt;
        a.ry += a.ryVel * dt;
        a.ryVel *= Math.exp(-dt * 2.4);
        const fallTilt = clamp(-a.vy / 3.2, 0, 1);
        a.tiltX = Math.sin(a.ry * 2.1) * 0.07 * fallTilt;
        a.tiltZ = Math.cos(a.ry * 1.7) * 0.055 * fallTilt;

        if (a.y <= COOKIE_REST_Y) {
          a.y = COOKIE_REST_Y;
          if (Math.abs(a.vy) > 0.35) {
            a.vy = -a.vy * BOUNCE;
            a.ryVel *= BOUNCE_FRICTION;
            a.squash = 0.78;
          } else {
            a.vy = 0;
            a.ryVel = 0;
            a.mode = 'rest';
            a.tiltX = 0;
            a.tiltZ = 0;
          }
        }
      } else {
        a.y = COOKIE_REST_Y;
        a.ryVel = 0;
        a.tiltX = lerp(a.tiltX, 0, 1 - Math.exp(-dt * 10));
        a.tiltZ = lerp(a.tiltZ, 0, 1 - Math.exp(-dt * 10));
      }

      a.squash = lerp(a.squash, 1, 1 - Math.exp(-dt * 9));
      motion.position.y = a.y;
      motion.rotation.y = a.ry;
      motion.rotation.x = a.tiltX;
      motion.rotation.z = a.tiltZ;

      if (squash) {
        const spread = 1 + (1 - a.squash) * 0.08;
        squash.scale.set(spread, a.squash, spread);
      }
    }

    const g = groupRef.current;
    if (g) {
      g.scale.x += (target.radiusX - g.scale.x) * k;
      g.scale.y += (target.height - g.scale.y) * k;
      g.scale.z += (target.radiusZ - g.scale.z) * k;
    }

    if (matRef.current) {
      matRef.current.color.lerp(targetColor, k);
      matRef.current.roughness = lerp(matRef.current.roughness, target.roughness, k);
    }

    if (chipsRef.current && g) {
      const rx = g.scale.x;
      const ry = g.scale.y;
      const rz = g.scale.z;
      const targetChipScale = target.chipScale;

      for (let i = 0; i < MAX_CHIPS; i += 1) {
        const base = chipBases[i];
        const state = chipState.current[i];
        const wantScale = i < target.chipCount ? targetChipScale * base.scaleVar : 0;
        state.scale += (wantScale - state.scale) * k;

        // AI_CHANGE:
        // Tool: Codex
        // Model: GPT-5
        // Timestamp: 2026-05-21T16:25:47-04:00
        // Purpose: Seats chips slightly above the repaired cookie surface.
        // Reason: Once the top face was no longer culled, the old placement buried
        //   most chips inside the dough even though the readout counted them as visible.
        dummy.position.set(
          base.x * rx,
          base.yLocal * ry + state.scale * 0.22,
          base.z * rz,
        );
        dummy.rotation.set(base.tilt, base.rot, 0);
        dummy.scale.setScalar(Math.max(state.scale, 0.0001));
        dummy.updateMatrix();
        chipsRef.current.setMatrixAt(i, dummy.matrix);
      }
      chipsRef.current.instanceMatrix.needsUpdate = true;
    }

  });

  // Chip geometry: a wide flattened dome — the way a chip looks once it has half-melted
  // into the dough. Reads as "chocolate chip" instead of "dark pebble".
  const chipGeometry = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Flatten vertically (chips read as wider than tall) and slightly round the top.
      pos.setY(i, y * 0.55);
      // Mild taper near the top so chips have a soft tip, not a hard pinch.
      if (y > 0.55) {
        const t = (y - 0.55) / 0.45;
        const taper = lerp(1, 0.78, t);
        pos.setX(i, x * taper);
        pos.setZ(i, z * taper);
      }
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group ref={motionRef}>
      <group ref={squashRef}>
        <group ref={groupRef}>
          <mesh geometry={geometry} castShadow receiveShadow>
            {/* Pure dielectric, fairly rough — that's how baked dough should read.
                metalness > 0 was tinting the cookie with cool light reflections from
                the rim light, washing the warm browns into grey. */}
            <meshStandardMaterial
              ref={matRef}
              vertexColors
              color={'#d28a45'}
              roughness={0.78}
              metalness={0}
            />
          </mesh>
        </group>
        {/* Chips don't cast shadows: with many of them clustered, the cumulative shadow
            blanket darkens the visible cookie surface into a brown void. They still
            receive shadows so the cookie's silhouette reads against them. */}
        <instancedMesh ref={chipsRef} args={[chipGeometry, undefined, MAX_CHIPS]} receiveShadow>
          <meshStandardMaterial color={'#3a1a08'} roughness={0.55} metalness={0} />
        </instancedMesh>
      </group>
    </group>
  );
}

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-05-21T20:25:00-04:00
// Purpose: Hosts the open picnic-table set and cookie animation with an unobstructed camera rig.
// Reason: Reverts the enclosed kitchen so orbit and pan stay clear at side-on viewing angles.
function Scene({ target, autoRotate }) {
  return (
    <Canvas
      camera={{ position: [0, 5.8, 7.8], fov: 42, far: 100 }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <color attach="background" args={['#d9c7a8']} />

      <ambientLight intensity={0.34} color={'#fff2dc'} />
      <directionalLight
        position={[2, 10, 3]}
        intensity={1.05}
        color={'#fff0cf'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
      <directionalLight position={[-3, 0.5, 4]} intensity={0.2} color={'#ffd28a'} />
      <directionalLight position={[-1, 4, -6]} intensity={0.16} color={'#e0d4c4'} />

      <Suspense fallback={null}>
        <PicnicTableSetting />
        <CookieMesh target={target} autoRotate={autoRotate} />
      </Suspense>

      {/* AI_CHANGE:
          Tool: Cursor | Model: Composer | Timestamp: 2026-05-21T19:45:00-04:00
          Purpose: Allows horizon-level orbit and table-plane pan for accurate height checks.
          Reason: Users need a side-on view parallel to the picnic table to compare cookie height. */}
      <OrbitControls
        enablePan
        screenSpacePanning={false}
        minDistance={5}
        maxDistance={16}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={[0, 0.28, 0]}
      />
    </Canvas>
  );
}

function Slider({ control, value, onChange }) {
  const Icon = control.icon;
  return (
    <label className="control-row">
      <span className="control-title">
        <Icon size={17} aria-hidden="true" />
        <span>{control.label}</span>
      </span>
      <span className="value">
        {formatValue(value, control)}
        {control.unit && <small>{unitLabel(control.unit, value)}</small>}
      </span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onInput={(event) => onChange(control.key, Number(event.currentTarget.value))}
        onChange={(event) => onChange(control.key, Number(event.target.value))}
      />
    </label>
  );
}

function RotationToggle({ enabled, onChange }) {
  return (
    <label className="rotation-toggle">
      <span className="rotation-toggle-label">
        <RotateCw size={16} aria-hidden="true" />
        Auto rotate
      </span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label="Toggle cookie rotation"
      />
      <span className="rotation-toggle-track" aria-hidden="true">
        <span className="rotation-toggle-thumb" />
      </span>
    </label>
  );
}

function App() {
  const [recipe, setRecipe] = useState(defaults);
  const [autoRotate, setAutoRotate] = useState(true);
  const target = useMemo(() => evaluateCookie(recipe), [recipe]);

  const setParam = (key, value) => setRecipe((current) => ({ ...current, [key]: value }));

  const burnish = target.burn > 0.4;

  return (
    <main className="app-shell">
      <aside className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Bake lab</p>
            <h1>Cookie Simulator</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => setRecipe(defaults)} aria-label="Reset recipe">
            <RotateCcw size={18} />
          </button>
        </div>
        <div className={`meter${burnish ? ' burnt' : ''}`}>
          <span>{target.doneness}</span>
          <strong>{target.spreadWord}</strong>
          <span>{target.textureWord}</span>
          {burnish && (
            <span className="warn">
              <Flame size={13} /> burnt edge
            </span>
          )}
          {target.flavorNotes.includes('alkaline snap') && (
            <span className="warn">
              <Sparkles size={13} /> soda bite
            </span>
          )}
        </div>
        <div className="controls">
          {controls.map((control) => (
            <Slider key={control.key} control={control} value={recipe[control.key]} onChange={setParam} />
          ))}
        </div>
      </aside>
      <section className="stage">
        <Scene target={target} autoRotate={autoRotate} />
        <div className="stage-controls">
          <RotationToggle enabled={autoRotate} onChange={setAutoRotate} />
        </div>
        <div className="readout" aria-live="polite">
          <span>Diameter {target.diameterIn.toFixed(1)} in</span>
          <span>Height {target.heightIn.toFixed(2)} in</span>
          <span>Moisture {target.moisturePct.toFixed(1)}%</span>
          <span>Crisp {Math.round(target.crispness * 100)}%</span>
          <span>Center {target.centerTexture}</span>
          <span>Edge {target.edgeTexture}</span>
          <span>{target.chipCount} visible chips</span>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
