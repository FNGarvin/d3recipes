import {test} from 'node:test';
import assert from 'node:assert/strict';
import {englishT} from './i18n-harness.mjs';
globalThis.window = {t: englishT};
const {stepsHtml} = await import('./recipe.js');
const names = ['Demon Hunter', 'Barbarian', 'Wizard', 'Witch Doctor', 'Monk', 'Crusader', 'Necromancer'];
const heroes = (cls) => ({cls, name: (c) => names[c]});
const hit = (extra = {}) => ({hope: 12, slot: 'Amulet', route: [['R', 2]], checkpoints: [], root_name: 'Squirt\'s Necklace', name: 'Squirt\'s Necklace', ...extra});
const steps = (html) => [...html.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);

test('the Craft & upgrade step always says which class starts, even when one hero does everything', () => {
  const s = steps(stepsHtml(hit(), [], new Set(), heroes(5)));
  assert.match(s[0], /^Craft &amp; upgrade 12 amulets <b>as Crusader<\/b>|^Craft & upgrade 12 amulets <b>as Crusader<\/b>/);
  assert.doesNotMatch(s[1], /as Crusader/, 'the other steps stay plain when no hand-over happens');
});

test('a hand-over still names the class at every step, and the first step names the crafting class', () => {
  const s = steps(stepsHtml(hit({craft_class: 0, route_class: [5]}), [], new Set(), heroes(5)));
  assert.match(s[0], /as Demon Hunter/);
  assert.match(s[1], /as Crusader/);
});

test('after a hand-over only the steps where the hero changes are named', () => {
  // Crusader crafts and cubes, then a Wizard does the last Reforge
  const h = hit({craft_class: 5, route: [['P', 1], ['R', 1], ['P', 1], ['R', 9], ['R', 1]], route_class: [5, 5, 5, 5, 2]});
  const s = steps(stepsHtml(h, [], new Set(), heroes(5)));
  assert.equal(s.length, 6);
  assert.match(s[0], /as Crusader/, 'the first step names who starts');
  for (const i of [1, 2, 3, 4]) assert.doesNotMatch(s[i], /<b>as /, `step ${i} has the same hero as the one before`);
  assert.match(s[5], /as Wizard/, 'the hand-over step names the new hero');
});

test('a hero who gets the item back is named again', () => {
  const h = hit({craft_class: 5, route: [['R', 1], ['R', 1], ['R', 1]], route_class: [2, 2, 5]});
  const s = steps(stepsHtml(h, [], new Set(), heroes(5)));
  assert.match(s[1], /as Wizard/);
  assert.doesNotMatch(s[2], /<b>as /);
  assert.match(s[3], /as Crusader/);
});
