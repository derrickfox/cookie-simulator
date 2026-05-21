// AI_CHANGE:
// Tool: Codex
// Model: GPT-5
// Timestamp: 2026-05-21T17:10:13-04:00
// Purpose: Adds scenario checks for the cookie food-science model.
// Reason: The simulator needs executable proof that directional changes remain plausible as formulas are tuned.

import { DEFAULT_RECIPE, evaluateCookie } from '../src/cookieScienceModel.js';

const baseline = evaluateCookie(DEFAULT_RECIPE);

function scenario(name, recipe, checks) {
  const result = evaluateCookie({ ...DEFAULT_RECIPE, ...recipe });
  for (const check of checks) {
    check(result, baseline);
  }
  return { name, result };
}

function assertGreater(actual, expected, message) {
  if (!(actual > expected)) {
    throw new Error(`${message}: expected ${actual.toFixed(4)} > ${expected.toFixed(4)}`);
  }
}

function assertLess(actual, expected, message) {
  if (!(actual < expected)) {
    throw new Error(`${message}: expected ${actual.toFixed(4)} < ${expected.toFixed(4)}`);
  }
}

const scenarios = [
  scenario('higher oven temp', { ovenTemp: 400 }, [
    (r, b) => assertGreater(r.moistureLoss, b.moistureLoss, 'hotter oven should increase moisture loss'),
    (r, b) => assertLess(r.moisturePct, b.moisturePct, 'hotter oven should not make the cookie wetter'),
    (r, b) => assertGreater(r.browningScore, b.browningScore, 'hotter oven should increase browning'),
    (r, b) => assertGreater(r.crispness, b.crispness, 'hotter oven should increase crispness'),
  ]),
  scenario('longer bake time', { cookTime: 18 }, [
    (r, b) => assertGreater(r.moistureLoss, b.moistureLoss, 'longer bake should increase moisture loss'),
    (r, b) => assertLess(r.moisturePct, b.moisturePct, 'longer bake should reduce final moisture'),
    (r, b) => assertGreater(r.browningScore, b.browningScore, 'longer bake should brown more'),
    (r, b) => assertGreater(r.crispness, b.crispness, 'longer bake should crisp more'),
  ]),
  scenario('soda replaced by powder', { bakingSoda: 0, bakingPowder: 1 }, [
    (r, b) => assertLess(r.pHScore, b.pHScore, 'baking powder should not alkalize like baking soda'),
    (r, b) => assertLess(r.browningScore, b.browningScore, 'powder swap should brown less than soda baseline'),
    (r, b) => assertGreater(r.heightIn, b.heightIn, 'baking powder should contribute lift/rise'),
  ]),
  scenario('more baking soda', { bakingSoda: 1.75 }, [
    (r, b) => assertGreater(r.pHScore, b.pHScore, 'more soda should raise alkalinity'),
    (r, b) => assertGreater(r.browningScore, b.browningScore, 'more soda should increase browning'),
    (r, b) => assertGreater(r.diameterIn, b.diameterIn, 'more soda should loosen spread in this model'),
  ]),
  scenario('more butter', { butter: 18 }, [
    (r, b) => assertGreater(r.diameterIn, b.diameterIn, 'more butter should spread more'),
    (r, b) => assertGreater(r.moisturePct, b.moisturePct, 'more butter should retain/tenderize moisture'),
    (r, b) => assertLess(r.crispness, b.crispness, 'more butter should reduce dry crispness at equal bake'),
  ]),
  scenario('melted butter', { butterState: 2 }, [
    (r, b) => assertGreater(r.diameterIn, b.diameterIn, 'melted butter should spread more than softened'),
    (r, b) => assertLess(r.heightIn, b.heightIn, 'melted butter should finish flatter than softened'),
  ]),
  scenario('more brown sugar', { brownSugar: 1.25, whiteSugar: 0.25 }, [
    (r, b) => assertGreater(r.moisturePct, b.moisturePct, 'more brown sugar should retain more moisture'),
    (r, b) => assertGreater(r.chewiness, b.chewiness, 'more brown sugar should increase chewiness'),
    (r, b) => assertLess(r.crispness, b.crispness, 'more brown sugar should reduce crispness'),
  ]),
  scenario('more white sugar', { brownSugar: 0.25, whiteSugar: 1 }, [
    (r, b) => assertGreater(r.diameterIn, b.diameterIn, 'more white sugar should spread more'),
    (r, b) => assertGreater(r.crispness, b.crispness, 'more white sugar should crisp more'),
    (r, b) => assertLess(r.chewiness, b.chewiness, 'more white sugar should chew less than brown-heavy dough'),
    (r, b) => assertLess(r.moisturePct, b.moisturePct, 'more white sugar should retain less moisture'),
  ]),
  scenario('chilled dough', { chillTime: 24, doughTemp: 40 }, [
    (r, b) => assertLess(r.diameterIn, b.diameterIn, 'chilled dough should spread less'),
    (r, b) => assertGreater(r.heightIn, b.heightIn, 'chilled dough should finish taller'),
    (r, b) => assertLess(r.moistureLoss, b.moistureLoss, 'chilled dough should dry more slowly at equal bake'),
  ]),
  scenario('larger thicker cookie', { cookieSize: 3.2 }, [
    (r, b) => assertGreater(r.diameterIn, b.diameterIn, 'larger dough should produce a wider cookie'),
    (r, b) => assertGreater(r.heightIn, b.heightIn, 'larger dough should produce a thicker cookie'),
    (r, b) => assertGreater(r.centerSoftness, b.centerSoftness, 'larger cookie should keep a softer center'),
    (r, b) => assertGreater(r.edgeCenterGradient, b.edgeCenterGradient, 'larger cookie should have a stronger edge-center gradient'),
  ]),
];

console.table(
  scenarios.map(({ name, result }) => ({
    scenario: name,
    diameter: result.diameterIn.toFixed(2),
    height: result.heightIn.toFixed(2),
    moisture: result.moisturePct.toFixed(1),
    browning: result.browningScore.toFixed(2),
    crispness: result.crispness.toFixed(2),
    chewiness: result.chewiness.toFixed(2),
    pH: result.pHScore.toFixed(2),
    center: result.centerTexture,
    edge: result.edgeTexture,
  })),
);

console.log('All science scenario checks passed.');
