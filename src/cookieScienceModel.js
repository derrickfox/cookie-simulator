// AI_CHANGE:
// Tool: Codex
// Model: GPT-5
// Timestamp: 2026-05-21T17:10:13-04:00
// Purpose: Adds an evidence-backed, tunable cookie science model for recipe outcomes.
// Reason: The original visual heuristic did not explicitly model pH, moisture loss,
//   dough temperature, baking powder, pan transfer, crispness, chewiness, or edge-center texture.

export const MAX_CHIPS = 56;

export const DEFAULT_RECIPE = {
  flour: 2.25,
  flourProtein: 10.5,
  butter: 12,
  butterState: 1,
  brownSugar: 0.75,
  whiteSugar: 0.5,
  eggs: 2,
  vanilla: 2,
  bakingSoda: 1,
  bakingPowder: 0,
  salt: 0.75,
  chocolateChips: 1,
  doughTemp: 68,
  chillTime: 0,
  cookieSize: 1.6,
  ovenTemp: 350,
  cookTime: 12,
  panHeat: 1,
};

export const SCIENCE_MODEL_CONFIG = {
  grams: {
    flourCup: 125,
    brownSugarCup: 210,
    whiteSugarCup: 200,
    butterTbsp: 14.2,
    egg: 50,
    vanillaTsp: 4.2,
    sodaTsp: 4.6,
    powderTsp: 4,
    saltTsp: 6,
  },
  waterFractions: {
    butter: 0.16,
    egg: 0.74,
    vanilla: 0.65,
    brownSugar: 0.02,
  },
  panTransfer: {
    0: 0.88, // insulated or light parchment-heavy setup
    1: 1, // light aluminum sheet
    2: 1.15, // dark or high-transfer steel
  },
  butterStateFlow: {
    0: -0.18, // chilled/firm butter flows later
    1: 0, // softened butter
    2: 0.2, // melted butter flows before starch/protein set
  },
};

const BASELINE = computeRecipeMass(DEFAULT_RECIPE);
const BASE_BROWN_RATIO = BASELINE.brownSugarG / BASELINE.sugarG;

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smooth(t) {
  return t * t * (3 - 2 * t);
}

function computeRecipeMass(recipe) {
  const g = SCIENCE_MODEL_CONFIG.grams;
  const flourG = recipe.flour * g.flourCup;
  const butterG = recipe.butter * g.butterTbsp;
  const brownSugarG = recipe.brownSugar * g.brownSugarCup;
  const whiteSugarG = recipe.whiteSugar * g.whiteSugarCup;
  const sugarG = brownSugarG + whiteSugarG;
  const eggG = recipe.eggs * g.egg;
  const vanillaG = recipe.vanilla * g.vanillaTsp;
  const leavenerG = recipe.bakingSoda * g.sodaTsp + recipe.bakingPowder * g.powderTsp;
  const saltG = recipe.salt * g.saltTsp;
  const doughG = flourG + butterG + sugarG + eggG + vanillaG + leavenerG + saltG;
  const waterG =
    butterG * SCIENCE_MODEL_CONFIG.waterFractions.butter +
    eggG * SCIENCE_MODEL_CONFIG.waterFractions.egg +
    vanillaG * SCIENCE_MODEL_CONFIG.waterFractions.vanilla +
    brownSugarG * SCIENCE_MODEL_CONFIG.waterFractions.brownSugar;

  return {
    flourG,
    butterG,
    brownSugarG,
    whiteSugarG,
    sugarG,
    eggG,
    vanillaG,
    leavenerG,
    saltG,
    doughG,
    waterG,
  };
}

function labelDoneness(centerDoneness, edgeDoneness, moistureRemaining) {
  if (centerDoneness < 0.32 && moistureRemaining > 0.42) return 'underbaked dough';
  if (centerDoneness < 0.54) return 'soft & gooey';
  if (edgeDoneness < 0.86) return 'golden chewy';
  if (edgeDoneness < 1.04) return 'crunchy edge';
  return 'overbaked';
}

function labelSpread(spreadScore) {
  if (spreadScore > 0.78) return 'puddle spread';
  if (spreadScore > 0.56) return 'wide & flat';
  if (spreadScore > 0.33) return 'balanced shape';
  return 'cakey rise';
}

function labelTexture(crispness, chewiness) {
  if (crispness > 0.68 && chewiness < 0.36) return 'snappy crisp';
  if (chewiness > 0.62 && crispness < 0.48) return 'chewy center';
  if (crispness > 0.55 && chewiness > 0.5) return 'crisp edge, chewy middle';
  if (crispness < 0.34 && chewiness > 0.46) return 'soft bend';
  return 'classic cookie bite';
}

function labelCenterTexture(softness) {
  if (softness > 0.72) return 'gooey';
  if (softness > 0.5) return 'soft';
  if (softness > 0.32) return 'set';
  return 'firm';
}

function labelEdgeTexture(crispness) {
  if (crispness > 0.72) return 'snappy';
  if (crispness > 0.5) return 'crisp';
  if (crispness > 0.32) return 'set';
  return 'tender';
}

function flavorNotes({ pHScore, brownRatio, burn, butterRatio, saltRatio }) {
  const notes = [];
  if (pHScore > 0.78) notes.push('alkaline snap');
  if (brownRatio > 0.68) notes.push('molasses-toffee');
  if (butterRatio > 1.18) notes.push('buttery tender');
  if (saltRatio > 1.25) notes.push('salt-forward');
  if (burn > 0.35) notes.push('bitter edge');
  return notes;
}

export function evaluateCookie(recipeInput) {
  const recipe = { ...DEFAULT_RECIPE, ...recipeInput };
  const mass = computeRecipeMass(recipe);

  const flourRatio = mass.flourG / BASELINE.flourG;
  const butterRatio = mass.butterG / BASELINE.butterG;
  const sugarRatio = mass.sugarG / BASELINE.sugarG;
  const eggRatio = recipe.eggs / DEFAULT_RECIPE.eggs;
  const saltRatio = Math.max(0, recipe.salt / DEFAULT_RECIPE.salt);
  const brownRatio = mass.brownSugarG / Math.max(1, mass.sugarG);
  const whiteRatio = mass.whiteSugarG / Math.max(1, mass.sugarG);
  const sodaRatio = recipe.bakingSoda / Math.max(0.01, DEFAULT_RECIPE.bakingSoda);
  const powderTsp = recipe.bakingPowder;
  const chipLoad = clamp(recipe.chocolateChips / 1.4, 0.12, 1.55);
  const visibleChipLoad = clamp(chipLoad, 0, 1);
  const sizeRatio = clamp(recipe.cookieSize / DEFAULT_RECIPE.cookieSize, 0.5, 2.4);
  const sizeLag = 1 + Math.max(0, sizeRatio - 1) * 0.34;
  const surfaceAreaIndex = clamp(1 / Math.sqrt(sizeRatio), 0.68, 1.28);
  const panTransfer = SCIENCE_MODEL_CONFIG.panTransfer[Math.round(recipe.panHeat)] ?? 1;
  const panDelta = panTransfer - 1;

  const heatIndex = clamp((recipe.ovenTemp - 275) / 175, 0, 1.35);
  const timeIndex = clamp((recipe.cookTime - 5) / 19, 0, 1.35);
  const chillEffect = clamp(recipe.chillTime / 24, 0, 1);
  const effectiveDoughTemp = clamp(recipe.doughTemp - chillEffect * 24, 34, 90);
  const doughWarmth = clamp((effectiveDoughTemp - 38) / 50, 0, 1);

  // Time, temperature, and pan transfer are the main bake drivers. Larger dough
  // pieces lag behind because their center has less surface area per unit mass.
  const thermalLoad = clamp(
    (heatIndex * 0.52 + timeIndex * 0.58 + heatIndex * timeIndex * 0.32 + panDelta * 0.12) / sizeLag -
      chillEffect * 0.04,
    0,
    1.35,
  );

  const waterRatio = mass.waterG / BASELINE.waterG;
  const formulaMoisture = clamp(
    0.5 +
      (waterRatio - 1) * 0.42 +
      (brownRatio - BASE_BROWN_RATIO) * 0.12 +
      (butterRatio - 1) * 0.06,
    0,
    1.2,
  );

  const proteinDelta = (recipe.flourProtein - DEFAULT_RECIPE.flourProtein) / 2.5;
  const proteinIndex = clamp((recipe.flourProtein - 8) / 5, 0, 1);
  const flourAbsorption = clamp((flourRatio - 1) * 0.38 + proteinDelta * 0.14, -0.32, 0.58);

  // Sodium bicarbonate is treated as both gas source and pH source. Baking powder
  // contributes gas but includes acids, so it does not raise pH the way soda does.
  const leaveningGas = clamp(recipe.bakingSoda * 0.28 + powderTsp * 0.36 + eggRatio * 0.08, 0, 1.2);
  const pHScore = clamp(0.42 + recipe.bakingSoda * 0.22 - powderTsp * 0.07 - brownRatio * 0.06, 0.08, 1);

  const butterStateFlow = SCIENCE_MODEL_CONFIG.butterStateFlow[Math.round(recipe.butterState)] ?? 0;
  const fatFlowScore = clamp(
    0.46 +
      (butterRatio - 1) * 0.36 +
      butterStateFlow +
      (doughWarmth - 0.56) * 0.28 -
      chillEffect * 0.18,
    0,
    1.15,
  );

  const sugarFlowScore = clamp(0.42 + (sugarRatio - 1) * 0.28 + whiteRatio * 0.24 + brownRatio * 0.03, 0, 1.15);

  const structureScore = clamp(
    0.48 +
      (flourRatio - 1) * 0.34 +
      proteinDelta * 0.18 +
      (eggRatio - 1) * 0.14 +
      recipe.salt * 0.03 +
      leaveningGas * 0.08 +
      powderTsp * 0.05 -
      (sugarRatio - 1) * 0.06,
    0,
    1.25,
  );

  const highHeatSetPenalty = clamp((heatIndex - 0.55) * 0.18 + panDelta * 0.1, -0.07, 0.2);

  // Spread is the race between fat/sugar flow and structure setting. Cold dough
  // and high-protein flour slow spread; melted butter and white sugar encourage it.
  const spreadScore = clamp(
    0.18 +
      fatFlowScore * 0.38 +
      sugarFlowScore * 0.3 +
      formulaMoisture * 0.14 +
      heatIndex * 0.08 -
      structureScore * 0.34 -
      chillEffect * 0.18 -
      chipLoad * 0.025 -
      highHeatSetPenalty -
      flourAbsorption * 0.2 +
      (pHScore - 0.6) * 0.12 +
      (sizeRatio - 1) * 0.12,
    0,
    1,
  );

  // Moisture loss increases with heat/time/pan transfer and surface area. Brown
  // sugar and larger cookies retain more center moisture in this simplified model.
  const moistureLoss = clamp(
    (0.12 + thermalLoad * 0.68 + heatIndex * timeIndex * 0.13 + panDelta * 0.08) * surfaceAreaIndex -
      formulaMoisture * 0.11 -
      chillEffect * 0.04,
    0,
    1.12,
  );

  const moistureRemaining = clamp(
    0.25 +
      formulaMoisture * 0.62 +
      brownRatio * 0.08 +
      Math.max(0, sizeRatio - 1) * 0.14 -
      moistureLoss * 0.55,
    0,
    1,
  );

  const drySurface = clamp(moistureLoss * 0.85 + thermalLoad * 0.3 - formulaMoisture * 0.2, 0, 1);

  // Browning follows the evidence-backed drivers: heat/time, dry surface, pH,
  // sugar chemistry, egg proteins, and heat transfer. Moist dough delays browning.
  const browningScore = clamp(
    0.08 +
      thermalLoad * 0.62 +
      drySurface * 0.28 +
      pHScore * 0.22 +
      (sugarRatio - 1) * 0.12 +
      brownRatio * 0.08 +
      eggRatio * 0.04 +
      panDelta * 0.08 -
      formulaMoisture * 0.08,
    0,
    1.4,
  );

  const edgeDoneness = clamp(browningScore + heatIndex * 0.13 + timeIndex * 0.08 + panDelta * 0.12, 0, 1.5);
  const centerDoneness = clamp(
    browningScore * 0.72 + thermalLoad * 0.22 - Math.max(0, sizeRatio - 1) * 0.18 + panDelta * 0.03,
    0,
    1.25,
  );
  const edgeCenterGradient = clamp(edgeDoneness - centerDoneness + Math.max(0, sizeRatio - 1) * 0.1, 0, 1);

  const crispness = clamp(
    0.1 +
      moistureLoss * 0.48 +
      edgeDoneness * 0.28 +
      whiteRatio * 0.15 +
      panDelta * 0.08 -
      moistureRemaining * 0.35 -
      brownRatio * 0.08 +
      (surfaceAreaIndex - 1) * 0.08,
    0,
    1,
  );

  const chewiness = clamp(
    0.12 +
      moistureRemaining * 0.56 +
      brownRatio * 0.22 +
      proteinIndex * 0.08 +
      eggRatio * 0.06 +
      butterRatio * 0.05 -
      crispness * 0.22 -
      thermalLoad * 0.05,
    0,
    1,
  );

  const riseScore = clamp(
    0.31 +
      leaveningGas * 0.52 +
      structureScore * 0.24 -
      spreadScore * 0.38 -
      thermalLoad * 0.08 +
      powderTsp * 0.06 -
      Math.max(0, sodaRatio - 1.4) * 0.03 +
      Math.max(0, sizeRatio - 1) * 0.06,
    0,
    1,
  );

  const burn = clamp((edgeDoneness - 1.02) * 2.35, 0, 1);
  const radiusBase = lerp(1.08, 2.68, smooth(spreadScore));
  const heightBase = lerp(0.27, 0.94, smooth(riseScore));
  const sizeRadiusScale = Math.sqrt(sizeRatio);
  const sizeHeightScale = Math.pow(sizeRatio, 0.35);
  const centerSoftness = clamp(moistureRemaining * 0.6 + (1 - centerDoneness) * 0.45 + Math.max(0, sizeRatio - 1) * 0.16, 0, 1);
  const edgeCrispness = clamp(crispness * 0.65 + edgeDoneness * 0.25 + panDelta * 0.08, 0, 1);

  return {
    radiusX: radiusBase * sizeRadiusScale,
    radiusZ: radiusBase * (0.98 + Math.sin(recipe.eggs * 1.3) * 0.015) * sizeRadiusScale,
    height: heightBase * sizeHeightScale,
    bake: browningScore,
    edgeBake: edgeDoneness,
    burn,
    chipCount: Math.round(lerp(6, MAX_CHIPS - 2, Math.pow(visibleChipLoad, 2.25))),
    chipScale: lerp(0.12, 0.152, visibleChipLoad),
    gloss: clamp(0.04 + moistureRemaining * 0.16 + butterRatio * 0.03 - browningScore * 0.12, 0, 0.2),
    roughness: clamp(0.54 + browningScore * 0.18 + moistureLoss * 0.12 + burn * 0.1 - moistureRemaining * 0.04, 0.48, 0.96),
    doneness: labelDoneness(centerDoneness, edgeDoneness, moistureRemaining),
    spreadWord: labelSpread(spreadScore),
    textureWord: labelTexture(crispness, chewiness),
    edgeTexture: labelEdgeTexture(edgeCrispness),
    centerTexture: labelCenterTexture(centerSoftness),
    diameterIn: lerp(2.35, 5.75, smooth(spreadScore)) * sizeRadiusScale,
    heightIn: lerp(0.3, 1.12, smooth(riseScore)) * sizeHeightScale,
    moisturePct: lerp(3.2, 16.5, moistureRemaining),
    crispness,
    chewiness,
    moistureLoss,
    moistureRemaining,
    pHScore,
    browningScore,
    centerDoneness,
    edgeDoneness,
    edgeCenterGradient,
    centerSoftness,
    edgeCrispness,
    flavorNotes: flavorNotes({ pHScore, brownRatio, burn, butterRatio, saltRatio }),
    science: {
      heatIndex,
      timeIndex,
      thermalLoad,
      effectiveDoughTemp,
      formulaMoisture,
      drySurface,
      fatFlowScore,
      sugarFlowScore,
      structureScore,
      leaveningGas,
      spreadScore,
      riseScore,
      flourAbsorption,
      panTransfer,
      surfaceAreaIndex,
      sizeRatio,
    },
  };
}
