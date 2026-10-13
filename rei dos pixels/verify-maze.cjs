const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
global.window = {};
vm.runInThisContext(fs.readFileSync(__dirname + '/games-maze.js', 'utf8'));
const empty = { x: 0, z: 0, action: false };
const dirs = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
const key = p => p.x + ',' + p.z;
const same = (p, q) => p.x === q.x && p.z === q.z;
function idle(s, seconds) { for (let t = 0; t < seconds && !s.done; t += 1 / 240) s.update(1 / 240, empty); }
function path(grid, start, goal, blocked = () => false, portal = false, heading = null) {
  const queue = [{ ...start, route: [], heading }], seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (same(p, goal)) return p.route;
    for (const d of dirs) {
      if (!p.route.length && heading && d.x * heading.x + d.z * heading.z === -1) continue;
      const q = { x: p.x + d.x, z: p.z + d.z };
      if (portal && q.z === 7 && q.x === 0) q.x = 13;
      if (portal && q.z === 7 && q.x === 14) q.x = 1;
      if (!grid[q.z] || grid[q.z][q.x] || blocked(q) || seen.has(key(q))) continue;
      seen.add(key(q)); queue.push({ ...q, route: [...p.route, d] });
    }
  }
  return null;
}
function gridStep(s, d, seconds = .15, extra = {}) { s.update(1 / 240, { ...empty, ...d, ...extra }); idle(s, seconds); }
const results = [];

// The snake solver only changes direction through the public input interface.
{
  const s = window.PixelGames[0].create(); idle(s, .7);
  for (let turns = 0; !s.done && turns < 2500; turns++) {
    const d = s.debug(), grid = Array.from({ length: 15 }, (_, z) => Array.from({ length: 15 }, (_, x) => Number(x < 1 || x > 13 || z < 1 || z > 13)));
    d.obstacles.forEach(p => grid[p.z][p.x] = 1);
    const route = path(grid, d.body[0], d.food, p => d.body.slice(1, -1).some(b => same(b, p)), true, d.heading);
    assert(route && route.length, 'A crystal must have a safe route for this deterministic run');
    const head = key(d.body[0]);
    for (let frame = 0; frame < 100 && key(s.debug().body[0]) === head && !s.done; frame++) s.update(1 / 240, { ...empty, ...route[0] });
  }
  assert(s.won && s.progress === 12, 'Serpent must allow collection of all 12 crystals');
  results.push({ game: 0, result: 'victory', score: s.score, lives: s.lives });
}

// Every generated energy cell and the exit must belong to the connected maze.
{
  const s = window.PixelGames[1].create(), first = s.debug();
  first.bits.forEach(k => { const [x, z] = k.split(',').map(Number); assert.equal(first.grid[z][x], 0); assert(path(first.grid, first.player, { x, z })); });
  assert(path(first.grid, first.player, first.exit));
  for (let turns = 0; !s.done && turns < 4000; turns++) {
    while (s.debug().moveCooldown > 0 && !s.done) s.update(1 / 240, empty);
    const d = s.debug();
    const goals = d.bits.length ? d.bits.map(k => { const [x, z] = k.split(',').map(Number); return { x, z }; }) : [d.exit];
    const blockGhost = p => d.dashRemaining <= 0 && d.dashCooldown > 0 && d.ghosts.some(g => Math.abs(g.x - p.x) + Math.abs(g.z - p.z) <= 1);
    const routes = goals.map(g => path(d.grid, d.player, g, blockGhost)).filter(Boolean).sort((a, b) => a.length - b.length);
    let next = routes[0] && routes[0][0];
    if (!next) {
      const distances = dirs.map(dir => { const p = { x: d.player.x + dir.x, z: d.player.z + dir.z }; return { dir, p, distance: Math.min(...d.ghosts.map(g => Math.abs(g.x - p.x) + Math.abs(g.z - p.z))) }; }).filter(q => d.grid[q.p.z][q.p.x] === 0).sort((a, b) => b.distance - a.distance);
      next = distances[0] && distances[0].dir;
    }
    if (!next) { idle(s, .15); continue; }
    const near = d.ghosts.some(g => Math.abs(g.x - d.player.x) + Math.abs(g.z - d.player.z) < 3);
    gridStep(s, next, (near && d.dashCooldown <= 0) || d.dashRemaining > 0 ? .078 : .146, { actionPressed: near && d.dashCooldown <= 0 });
  }
  assert(s.won && s.progress === 11, 'Ghost must allow collection plus exit');
  results.push({ game: 1, result: 'victory', score: s.score, lives: s.lives });
}

// Bomb tactics choose safe escape cells and use the actual bomb fuse/explosions.
{
  const s = window.PixelGames[5].create();
  const blastCells = (d, b) => {
    const cells = [{ x: b.x, z: b.z }];
    for (const dir of dirs) for (let n = 1; n <= 3; n++) {
      const p = { x: b.x + dir.x * n, z: b.z + dir.z * n };
      if (d.grid[p.z][p.x]) break; cells.push(p); if (d.crates.includes(key(p))) break;
    }
    return cells;
  };
  let flee = null;
  for (let turns = 0; !s.done && turns < 2400; turns++) {
    const d = s.debug(), alive = d.enemies.filter(e => e.hp > 0), blocked = p => d.crates.includes(key(p)) || d.bombs.some(b => same(b, p));
    if (!alive.length) {
      const r = path(d.grid, d.player, d.relic, blocked); assert(r, 'Cleared relic must be reachable'); gridStep(s, r[0] || empty, .155); continue;
    }
    const danger = [...d.bombs.flatMap(b => blastCells(d, b)), ...d.blasts.flatMap(b => b.cells)];
    if (flee && same(flee, d.player)) flee = null;
    if (d.bombs.length || d.blasts.length) {
      if (!flee && (danger.some(p => same(p, d.player)) || alive.some(e => Math.abs(e.x - d.player.x) + Math.abs(e.z - d.player.z) < 5))) {
        let best = null;
        for (let z = 1; z < 10; z++) for (let x = 1; x < 12; x++) {
          const q = { x, z }; if (danger.some(p => same(p, q)) || d.grid[z][x] || blocked(q)) continue;
          const r = path(d.grid, d.player, q, p => blocked(p) || alive.some(e => same(e, p)) || d.blasts.some(b => b.cells.some(c => same(c, p))));
          const value = Math.min(...alive.map(e => Math.abs(e.x - q.x) + Math.abs(e.z - q.z))) - (r ? r.length * .4 : 100);
          if (r && r.length <= 6 && (!best || value > best.value)) best = { q, route: r, value };
        }
        flee = best && best.q;
      }
      const r = flee && path(d.grid, d.player, flee, blocked);
      gridStep(s, r && r[0] || empty, .155); continue;
    }
    const targets = alive.map(e => ({ e, route: path(d.grid, d.player, e, blocked) })).filter(t => t.route).sort((a, b) => a.route.length - b.route.length);
    if (targets.length && targets[0].route.length <= 5) {
      const pending = { x: d.player.x, z: d.player.z }, zone = blastCells(d, pending);
      let escape = null;
      for (let z = 1; z < 10; z++) for (let x = 1; x < 12; x++) {
        const q = { x, z }; if (zone.some(p => same(p, q)) || d.grid[z][x] || blocked(q)) continue;
        const r = path(d.grid, d.player, q, p => blocked(p) || alive.some(e => same(e, p)));
        const value = Math.min(...alive.map(e => Math.abs(e.x - q.x) + Math.abs(e.z - q.z))) - (r ? r.length * .4 : 100);
        if (r && r.length < 8 && (!escape || value > escape.value)) escape = { q, route: r, value };
      }
      if (escape) { flee = escape.q; gridStep(s, escape.route[0], .155, { actionPressed: true }); continue; }
    }
    const nearest = targets[0];
    gridStep(s, nearest && nearest.route[0] || empty, .155);
  }
  assert(s.won && s.progress === 5, 'Bomb must allow four enemy defeats and relic');
  results.push({ game: 5, result: 'victory', score: s.score, lives: s.lives });
}

// Frogger uses a time-expanded search: predict moving logs/cars, then execute inputs.
{
  const s = window.PixelGames[7].create(), step = 46 / 240;
  function nextInput(d) {
    const mult = 1 + (d.stage - 1) * .18, queue = [{ x: d.player.x, row: d.player.row, depth: 0, first: null }], seen = new Set();
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]; if (p.row === 12) return p.first;
      if (p.depth >= 42) continue;
      for (const dir of [{ x: 0, z: -1 }, { x: 0, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }]) {
        const row = Math.max(0, Math.min(12, p.row - dir.z)); let x = p.x + dir.x;
        const lane = d.lanes.find(l => l.row === row), speed = lane ? lane.speed * mult : 0;
        let safe = true;
        for (let frame = 1; frame <= 46; frame += 3) {
          const t = p.depth * step + frame / 240, px = x + (lane && lane.type === 'river' ? speed * frame / 240 : 0);
          if (Math.abs(px) > 5.45) { safe = false; break; }
          if (!lane) continue;
          const base = ((lane.centers[0] + speed * t) % lane.gap + lane.gap) % lane.gap;
          const separation = Math.abs(((px - base + lane.gap * 20 + lane.gap / 2) % lane.gap) - lane.gap / 2);
          if (lane.type === 'road' ? separation < lane.width / 2 + .34 : separation > lane.width / 2 - .25) { safe = false; break; }
        }
        if (!safe) continue;
        if (lane && lane.type === 'river') x += speed * step;
        const k = row + ':' + Math.round(x * 8) + ':' + (p.depth + 1);
        if (seen.has(k)) continue; seen.add(k); queue.push({ x, row, depth: p.depth + 1, first: p.first || dir });
      }
    }
    return empty;
  }
  for (let turns = 0; !s.done && turns < 650; turns++) {
    while (s.debug().moveCooldown > 0 && !s.done) s.update(1 / 240, empty);
    const input = nextInput(s.debug()); gridStep(s, input, 45 / 240);
  }
  assert(s.won && s.progress === 3, 'Crossing must allow all 3 stages with moving hazards');
  results.push({ game: 7, result: 'victory', score: s.score, lives: s.lives });
}

// Losing is finite, scene coordinates remain valid, and long sessions retain lanes.
for (const id of [0, 1, 5, 7]) {
  const s = window.PixelGames[id].create();
  for (let frame = 0; frame < 60000 && !s.done; frame++) {
    const input = id === 5 ? { ...empty, actionPressed: frame % 600 === 0 } : id === 7 ? { ...empty, z: -1 } : empty;
    s.update(1 / 120, input);
  }
  assert(s.done && !s.won && s.lives === 0, 'Game ' + id + ' must permit a genuine loss');
  for (const object of s.scene()) for (const prop of ['x', 'y', 'z', 'w', 'h', 'd']) assert(Number.isFinite(object[prop]), 'Finite 3D geometry ' + id + '/' + prop);
  results.push({ game: id, result: 'loss' });
}
{
  const s = window.PixelGames[7].create(); idle(s, 145);
  for (const l of s.debug().lanes) assert(l.centers.length >= 2 && l.centers.some(x => x > -5.5 && x < 5.5), 'Lane must remain populated after 145 seconds');
}
console.log(JSON.stringify(results, null, 2));
