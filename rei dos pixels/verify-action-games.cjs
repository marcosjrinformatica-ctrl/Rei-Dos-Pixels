/* Run: node verify-action-games.cjs
 * All scenarios use public input/update only. debug() returns read-only copies;
 * neither the bots nor tests alter score, health, positions or enemy state.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let seed = 71;
const seededMath = Object.create(Math);
seededMath.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const context = vm.createContext({ window: {}, Math: seededMath });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'games-action.js'), 'utf8'), context);
const definitions = context.window.PixelGames;
const IDS = [2, 3, 4, 6, 8, 9];
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const steer = (from, to) => clamp((to - from) * 5, -1, 1);
function reflection(x, limit) {
  while (x > limit || x < -limit) x = x > limit ? limit * 2 - x : -limit * 2 - x;
  return x;
}
function blankInput() {
  return { x: 0, z: 0, action: false, actionPressed: false, leftPressed: false, rightPressed: false, upPressed: false, downPressed: false };
}
function create(id) {
  seed = 71;
  return definitions[id].create({ skin: '#00f5ff' });
}

function shooterBot(d, input, time, finalGame) {
  const p = d.player;
  const targets = d.enemies.slice().sort((a, b) => b.z - a.z || Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
  const target = d.boss || targets[0];
  const frequency = finalGame ? .9 : .85;
  let aim = target ? target.x : p.x;
  if (target && !d.boss) aim = target.base + Math.sin((time + (p.z - target.z) / 16) * frequency + target.phase) * 1.6;
  if (d.boss) aim = Math.sin((time + (p.z - target.z) / 16) * .72) * 5.5;
  let dodge = 0;
  for (const shot of d.hostile) {
    const eta = (p.z - shot.z) / shot.vz;
    if (eta > 0 && eta < .5 && Math.abs(shot.x + shot.vx * eta - p.x) < 1.1) dodge = p.x > shot.x ? 1 : -1;
  }
  input.x = dodge || steer(p.x, aim);
  input.z = steer(p.z, finalGame ? 3 : 3.6);
}

function winningInput(id, session, frame) {
  const d = session.debug(), input = blankInput(), time = frame / 60;
  input.action = true;
  input.actionPressed = frame % 12 === 0;

  if (id === 2) {
    if (d.mode === 'upgrade') {
      // Pick double shot, rapid fire, then one shield, using the game's selector.
      const desired = d.wave === 1 ? 0 : d.wave === 2 ? 1 : 2;
      if (d.selection !== desired) { input.rightPressed = true; input.actionPressed = false; }
    } else shooterBot(d, input, time, false);
  }

  if (id === 3) {
    const p = d.paddle, b = d.ball;
    let target = d.ready ? 0 : b.x;
    if (!d.ready && b.vz > 0) {
      // Project wall bounces to the front of the paddle; offset it to aim uphill.
      const arrival = Math.max(0, (p.z - .6 - b.z) / b.vz);
      const impact = reflection(b.x + b.vx * arrival, 7.45);
      const brick = d.bricks.slice().sort((a, b) => b.z - a.z || Math.abs(a.x - impact) - Math.abs(b.x - impact))[0];
      const aim = d.boss ? d.boss.x : brick ? brick.x : 0;
      const dz = p.z - (d.boss ? d.boss.z : -5), dx = aim - impact;
      const offset = clamp(dx / Math.sqrt(dx * dx + dz * dz) / .83, -.7, .7);
      target = impact - offset * p.w / 2;
    }
    input.x = clamp((target - p.x) * 8, -1, 1);
    input.actionPressed = frame % 60 === 0;
  }

  if (id === 4) {
    const lanes = [-4, 0, 4], p = d.player;
    const costs = lanes.map((x, index) => {
      let cost = Math.abs(index - d.lane) * .4;
      for (const car of d.traffic) if (car.z > p.z - 12 && car.z < p.z + 2.4 && Math.abs(x - car.x) < 1.8) cost += 100;
      for (const coin of d.pickups) if (coin.z < p.z && coin.z > p.z - 10 && Math.abs(coin.x - x) < .5) cost -= .2;
      return cost;
    });
    const wanted = costs.indexOf(Math.min(...costs));
    input.x = Math.sign(wanted - d.lane);
  }

  if (id === 6) {
    const p = d.player;
    const target = d.boss || d.enemies.slice().sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (target) {
      let dx = target.x - p.x, dz = target.z - p.z;
      if (target.state === 'tell') { dx = -dx; dz = -dz; }
      else if (d.boss && Math.hypot(dx, dz) < 2.6) { dx = 0; dz = 0; }
      input.x = clamp(dx * 2, -1, 1); input.z = clamp(dz * 2, -1, 1);
    }
    for (const blast of d.blasts) if (Math.abs(distance(blast, p) - blast.r) < 1.1) {
      input.x = clamp((p.x - blast.x) * 2, -1, 1);
      input.z = clamp((p.z - blast.z) * 2, -1, 1);
    }
    if (session.lives < 4 && d.heals.length) {
      const heal = d.heals.slice().sort((a, b) => distance(a, p) - distance(b, p))[0];
      input.x = steer(p.x, heal.x); input.z = steer(p.z, heal.z);
    }
  }

  if (id === 8) {
    const p = d.player, b = d.ball;
    let target = b.x;
    if (b.vz > 0) {
      const arrival = Math.max(0, (p.z - .64 - b.z) / b.vz);
      const impact = reflection(b.x + b.vx * arrival, 7.2);
      target = impact - (impact > 0 ? 1.1 : -1.1);
    } else if (d.ready) target = frame % 300 < 150 ? -3 : 3;
    input.x = steer(p.x, target);
  }

  if (id === 9) {
    const p = d.player;
    if (d.phase === 1) shooterBot(d, input, time, true);
    else if (d.phase === 2) {
      const crystal = d.crystals.slice().sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (crystal) { input.x = steer(p.x, crystal.x); input.z = steer(p.z, crystal.z); }
      input.actionPressed = true;
    } else {
      const boss = d.boss, dx = boss.x - p.x, dz = boss.z - p.z;
      if (boss.state === 'tell') { input.x = clamp(-dx * 2, -1, 1); input.z = clamp(-dz * 2, -1, 1); }
      else if (Math.hypot(dx, dz) > 2.7) { input.x = clamp(dx * 2, -1, 1); input.z = clamp(dz * 2, -1, 1); }
    }
  }
  return input;
}

function validateScene(s, label) {
  const objects = s.scene();
  assert.ok(Array.isArray(objects) && objects.length > 10, `${label}: volumetric scene`);
  for (const object of objects) {
    for (const key of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(object[key]), `${label}: finite ${key}`);
    for (const key of ['w', 'h', 'd']) assert.ok(object[key] > 0, `${label}: positive ${key}`);
    assert.match(object.color, /^#[0-9a-f]{6}$/i, `${label}: valid color`);
    if (object.rotation !== undefined) assert.ok(Number.isFinite(object.rotation), `${label}: finite rotation`);
  }
  assert.ok(objects.some(o => o.h > .5), `${label}: actual height in 3D`);
}
function resultSnapshot(s) {
  return JSON.stringify({ score: s.score, lives: s.lives, progress: s.progress, target: s.target, done: s.done, won: s.won, message: s.message, debug: s.debug() });
}
function immutableAfterFinish(s, label) {
  const before = resultSnapshot(s);
  for (let i = 0; i < 120; i++) s.update(1 / 60, { ...blankInput(), action: true, actionPressed: true, x: 1, z: 1 });
  assert.equal(resultSnapshot(s), before, `${label}: finished sessions are immutable`);
}

let checks = 0;
for (const id of IDS) {
  const s = create(id), label = definitions[id].name;
  validateScene(s, label + ' initial');
  const copy = s.debug();
  if (copy.player) { const original = s.debug().player.x; copy.player.x = 999; assert.equal(s.debug().player.x, original, `${label}: debug copy`); }
  const phases = new Set();
  let frame = 0, previousProgress = 0;
  for (; frame < 60 * 360 && !s.done; frame++) {
    const d = s.debug();
    phases.add(d.phase || d.mode || d.wave || 'race');
    s.update(1 / 60, winningInput(id, s, frame));
    assert.ok(s.progress >= previousProgress, `${label}: objective progress cannot go backwards`);
    assert.ok(s.progress <= s.target, `${label}: objective counts cannot overflow`);
    previousProgress = s.progress;
    if (frame % 60 === 0) validateScene(s, label + ' live');
  }
  assert.ok(s.done && s.won, `${label}: physical input bot must complete challenge (${s.message})`);
  assert.equal(s.progress, s.target, `${label}: exact objective at victory`);
  assert.ok(s.score > 0 && s.lives > 0, `${label}: earned score and surviving health`);
  if (id === 2) assert.ok(phases.has('upgrade') && phases.has('boss'), 'Invaders: upgrade and boss reached');
  if (id === 9) assert.ok(phases.has(1) && phases.has(2) && phases.has(3), 'King: every proof reached');
  if (id === 4) assert.ok(frame / 60 > 25 && frame / 60 <= 46, 'Turbo: plausible running duration');
  validateScene(s, label + ' victory'); immutableAfterFinish(s, label);
  checks++;
  console.log(`PASS vitória ${label}: ${(frame / 60).toFixed(2)}s, ${s.score} pontos, ${s.lives} vidas, ${s.progress}/${s.target}`);
}

for (const id of IDS) {
  const s = create(id), label = definitions[id].name;
  let frame = 0;
  for (; frame < 60 * 180 && !s.done; frame++) {
    const input = blankInput();
    // Launch the two ball games, then deliberately abandon their interceptions.
    if (id === 3 || id === 8) { input.action = true; input.x = -1; }
    s.update(1 / 60, input);
  }
  assert.ok(s.done && !s.won && s.lives === 0, `${label}: failed play must produce defeat`);
  validateScene(s, label + ' defeat'); immutableAfterFinish(s, label);
  checks++;
  console.log(`PASS derrota ${label}: ${(frame / 60).toFixed(2)}s, ${s.progress}/${s.target}`);
}

// Three driving directions settle in actual lanes instead of safe intermediate gaps.
for (const direction of [-1, 0, 1]) {
  const s = create(4);
  for (let frame = 0; frame < 50; frame++) s.update(1 / 60, { ...blankInput(), x: direction });
  const d = s.debug();
  assert.ok([-4, 0, 4].includes(d.player.x), 'Turbo: car must settle in one of three lanes');
  assert.equal(d.player.x, [-4, 0, 4][d.lane], 'Turbo: lane and physical position agree');
}
checks++;
console.log(`PASS ${checks} cenários: seis vitórias, seis derrotas, faixas; geometria finita e resultado estável.`);
