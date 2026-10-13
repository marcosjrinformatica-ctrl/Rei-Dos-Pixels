(function () {
  'use strict';
  const games = window.PixelGames = window.PixelGames || {};
  const C = { floor: '#101932', wall: '#273956', rim: '#39d8fb', mint: '#69ffb2', gold: '#ffd45e', pink: '#ff52ac', red: '#ff6259', violet: '#a27dff' };
  const box = (x, y, z, w, h, d, color, rotation = 0) => ({ x, y, z, w, h, d, color, rotation });
  const orb = (x, y, z, size, color) => ({ x, y, z, w: size, h: size, d: size, color, shape: 'sphere' });
  const key = (x, z) => x + ',' + z;
  const same = (a, b) => a.x === b.x && a.z === b.z;
  const dirs = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
  function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
  function color(skin) {
    if (typeof skin === 'string' && /^#[0-9a-f]{3,8}$/i.test(skin)) return skin;
    if (skin && typeof skin.color === 'string') return skin.color;
    return C.mint;
  }
  function direction(input) {
    const x = Number(input.x) || 0, z = Number(input.z) || 0;
    if (Math.abs(x) > .2 && Math.abs(x) >= Math.abs(z)) return { x: Math.sign(x), z: 0 };
    if (Math.abs(z) > .2) return { x: 0, z: Math.sign(z) };
    if (input.upPressed) return { x: 0, z: -1 };
    if (input.downPressed) return { x: 0, z: 1 };
    if (input.leftPressed) return { x: -1, z: 0 };
    if (input.rightPressed) return { x: 1, z: 0 };
    return null;
  }
  function action(input, previous) {
    return !!input.actionPressed || !!(input.action && !previous) || !!(input.pressed && (input.pressed('Space') || input.pressed(' ')));
  }
  function person(x, z, tint, y = 0, scale = 1) {
    return [box(x, y + .42 * scale, z, .55 * scale, .64 * scale, .45 * scale, tint),
      box(x, y + .91 * scale, z, .43 * scale, .38 * scale, .43 * scale, '#ffe0af'),
      box(x - .16 * scale, y + .1 * scale, z, .19 * scale, .2 * scale, .32 * scale, '#172348'),
      box(x + .16 * scale, y + .1 * scale, z, .19 * scale, .2 * scale, .32 * scale, '#172348')];
  }
  function gridScene(grid, ox, oz, wallColor = C.wall) {
    const rows = grid.length, cols = grid[0].length;
    const scene = [box(0, -.19, 0, cols + .3, .25, rows + .3, C.floor)];
    for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
      if (grid[z][x]) scene.push(box(x - ox, .45, z - oz, .98, .9, .98, wallColor));
      else if ((x + z) % 2 === 0) scene.push(box(x - ox, -.045, z - oz, .98, .03, .98, '#182640'));
    }
    return scene;
  }
  function route(grid, from, to, blocked = () => false) {
    const queue = [from], visited = new Set([key(from.x, from.z)]), previous = new Map();
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n];
      if (same(p, to)) {
        let current = p, parent = previous.get(key(current.x, current.z));
        if (!parent) return null;
        while (parent && !same(parent, from)) { current = parent; parent = previous.get(key(current.x, current.z)); }
        return current;
      }
      for (const d of dirs) {
        const q = { x: p.x + d.x, z: p.z + d.z }, k = key(q.x, q.z);
        if (!grid[q.z] || grid[q.z][q.x] !== 0 || visited.has(k) || blocked(q)) continue;
        visited.add(k); previous.set(k, p); queue.push(q);
      }
    }
    return null;
  }

  games[0] = {
    name: 'Pixel Serpent 3D', description: 'Uma serpente voxel no jardim de energia neon.',
    controls: 'Setas / WASD / direcional: virar. A serpente avança sozinha; não é possível inverter a direção.',
    objective: 'Colete 12 cristais sem atingir as colunas, a borda ou o próprio corpo. Os portais laterais conectam a faixa central. Você tem 3 vidas.',
    camera: { eye: [0, 17, 13], target: [0, 0, 0] },
    create({ skin } = {}) {
      const size = 15, rng = random(811), tint = color(skin);
      const obstacles = [{ x: 4, z: 4 }, { x: 4, z: 5 }, { x: 10, z: 4 }, { x: 10, z: 5 }, { x: 4, z: 10 }, { x: 5, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 9 }];
      const s = { score: 0, lives: 3, progress: 0, target: 12, done: false, won: false, message: 'Colete os 12 cristais dourados.' };
      let body, heading, queued = null, clock = 0, pause = .65, time = 0, food;
      function spawnFood() {
        const free = [];
        for (let z = 1; z < size - 1; z++) for (let x = 1; x < size - 1; x++) if (!body.some(p => p.x === x && p.z === z) && !obstacles.some(p => p.x === x && p.z === z)) free.push({ x, z });
        food = free[Math.floor(rng() * free.length)];
      }
      function reset() { body = [{ x: 7, z: 9 }, { x: 6, z: 9 }, { x: 5, z: 9 }]; heading = { x: 1, z: 0 }; queued = null; clock = 0; pause = .65; spawnFood(); }
      reset();
      s.update = (dt, input) => {
        if (s.done) return;
        time += dt;
        if (pause > 0) { pause -= dt; return; }
        const want = direction(input);
        if (want && !queued && want.x * heading.x + want.z * heading.z === 0) queued = want;
        clock += dt;
        const interval = Math.max(.135, .215 - s.progress * .005);
        if (clock < interval) return;
        clock %= interval;
        if (queued) { heading = queued; queued = null; }
        const next = { x: body[0].x + heading.x, z: body[0].z + heading.z };
        if (next.z === 7 && next.x === 0) next.x = size - 2;
        else if (next.z === 7 && next.x === size - 1) next.x = 1;
        const eat = same(next, food);
        const check = eat ? body : body.slice(0, -1);
        if (next.x <= 0 || next.x >= size - 1 || next.z <= 0 || next.z >= size - 1 || obstacles.some(p => same(p, next)) || check.some(p => same(p, next))) {
          s.lives--; s.message = s.lives ? 'Impacto! Os cristais coletados continuam com você.' : 'A serpente perdeu suas 3 vidas.';
          if (s.lives <= 0) s.done = true; else reset();
          return;
        }
        body.unshift(next);
        if (eat) {
          s.progress++; s.score += 100 + body.length * 5;
          s.message = s.progress + ' / 12 cristais coletados.';
          if (s.progress === 12) { s.done = true; s.won = true; s.score += 600; s.message = 'Jardim restaurado! Todos os 12 cristais foram coletados.'; }
          else spawnFood();
        } else body.pop();
      };
      s.scene = () => {
        const out = [box(0, -.2, 0, 15.2, .3, 15.2, '#101c2f')];
        for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
          if ((x === 0 || x === size - 1) && z === 7) {
            out.push(box(x - 7, .12, 0, .98, .24, .98, C.violet), box(x - 7, .72, -.46, .25, 1.2, .12, C.pink), box(x - 7, .72, .46, .25, 1.2, .12, C.rim), box(x - 7, 1.31, 0, .25, .15, 1, C.violet));
          } else if (x === 0 || z === 0 || x === size - 1 || z === size - 1) {
            out.push(box(x - 7, .36, z - 7, .96, .72, .96, '#285d6b'), box(x - 7, .74, z - 7, .92, .055, .92, C.rim));
          } else if ((x + z) % 2 === 0) out.push(box(x - 7, -.035, z - 7, .98, .02, .98, '#142938'));
        }
        obstacles.forEach(p => out.push(box(p.x - 7, .5, p.z - 7, .9, 1, .9, '#4b4e7d'), box(p.x - 7, 1.03, p.z - 7, .8, .08, .8, C.violet)));
        body.forEach((p, i) => out.push(box(p.x - 7, .33, p.z - 7, .82, .63, .82, i === 0 ? tint : i % 2 ? '#24c99c' : '#279485')));
        const h = body[0], side = { x: -heading.z, z: heading.x };
        for (const sign of [-1, 1]) {
          out.push(box(h.x - 7 + heading.x * .38 + side.x * sign * .22, .55, h.z - 7 + heading.z * .38 + side.z * sign * .22, .15, .14, .15, '#081a26'));
        }
        if (!s.won && food) out.push(orb(food.x - 7, .63 + Math.sin(time * 5) * .1, food.z - 7, .57, C.gold), box(food.x - 7, .07, food.z - 7, .65, .12, .65, '#987339'));
        return out;
      };
      s.debug = () => ({ body: body.map(p => ({ ...p })), heading: { ...heading }, food: { ...food }, obstacles: obstacles.map(p => ({ ...p })), portals: [{ x: 0, z: 7 }, { x: 14, z: 7 }], size, progress: s.progress, lives: s.lives, pause });
      return s;
    }
  };

  function makeMaze() {
    const grid = Array.from({ length: 13 }, () => Array(17).fill(1)), rng = random(418), stack = [{ x: 1, z: 1 }];
    grid[1][1] = 0;
    while (stack.length) {
      const p = stack[stack.length - 1];
      const options = dirs.map(d => ({ x: p.x + 2 * d.x, z: p.z + 2 * d.z, d })).filter(q => q.x > 0 && q.x < 16 && q.z > 0 && q.z < 12 && grid[q.z][q.x]);
      if (!options.length) { stack.pop(); continue; }
      const q = options[Math.floor(rng() * options.length)];
      grid[p.z + q.d.z][p.x + q.d.x] = 0; grid[q.z][q.x] = 0; stack.push({ x: q.x, z: q.z });
    }
    for (let z = 1; z < 12; z++) for (let x = 1; x < 16; x++) {
      if (grid[z][x] && rng() < .18 && ((grid[z][x - 1] === 0 && grid[z][x + 1] === 0) || (grid[z - 1][x] === 0 && grid[z + 1][x] === 0))) grid[z][x] = 0;
    }
    return grid;
  }
  games[1] = {
    name: 'Ghost Byte 3D', description: 'Explore um labirinto com espectros que rastreiam sua posição.',
    controls: 'Setas / WASD / direcional: mover. Espaço / ação: impulso de energia, recarga de 4 segundos.',
    objective: 'Recolha 10 bits de energia e alcance a saída dourada. Desvie dos 3 fantasmas; você tem 3 vidas.',
    camera: { eye: [0, 18, 13], target: [0, 0, 0] },
    create({ skin } = {}) {
      const grid = makeMaze(), tint = color(skin), bitSpawns = [{ x: 3, z: 1 }, { x: 7, z: 1 }, { x: 13, z: 1 }, { x: 1, z: 5 }, { x: 5, z: 5 }, { x: 9, z: 5 }, { x: 15, z: 5 }, { x: 3, z: 9 }, { x: 9, z: 11 }, { x: 15, z: 9 }];
      const bits = new Set(bitSpawns.map(p => key(p.x, p.z))), exit = { x: 15, z: 11 };
      const s = { score: 0, lives: 3, progress: 0, target: 11, done: false, won: false, message: 'Tome os 10 bits de energia e procure a saída dourada.' };
      let player = { x: 1, z: 1 }, ghosts, moveClock = 0, invulnerable = 1.2, dash = 0, cooldown = 0, previousAction = false, time = 0;
      function resetGhosts() { ghosts = [{ x: 15, z: 11, timer: 1.3, color: C.pink }, { x: 15, z: 1, timer: 1.6, color: C.violet }, { x: 1, z: 11, timer: 1.9, color: C.rim }]; }
      resetGhosts();
      function hit() {
        if (invulnerable > 0 || s.done) return;
        s.lives--; s.message = s.lives ? 'Um fantasma tocou você. Energia preservada; volte ao labirinto!' : 'Os fantasmas consumiram suas 3 vidas.';
        if (!s.lives) s.done = true;
        else { player = { x: 1, z: 1 }; resetGhosts(); invulnerable = 2.2; moveClock = 0; }
      }
      s.update = (dt, input) => {
        if (s.done) return;
        time += dt; invulnerable = Math.max(0, invulnerable - dt); dash = Math.max(0, dash - dt); cooldown = Math.max(0, cooldown - dt);
        const fire = action(input, previousAction); previousAction = !!input.action;
        if (fire && cooldown <= 0) { dash = .75; cooldown = 4; invulnerable = Math.max(invulnerable, .75); s.message = 'Impulso ativo! A recarga leva 4 segundos.'; }
        moveClock = Math.max(0, moveClock - dt);
        const d = direction(input);
        if (d && moveClock <= 0) {
          const q = { x: player.x + d.x, z: player.z + d.z };
          if (grid[q.z] && grid[q.z][q.x] === 0) {
            player = q;
            if (bits.delete(key(q.x, q.z))) { s.progress++; s.score += 125; s.message = s.progress === 10 ? 'Todos os bits! Alcance a saída dourada no canto oposto.' : s.progress + ' / 10 bits de energia.'; }
            if (s.progress === 10 && same(player, exit)) { s.progress = 11; s.done = true; s.won = true; s.score += 750; s.message = 'Você escapou com os 10 bits de energia!'; return; }
          }
          moveClock = dash > 0 ? .075 : .145;
        }
        if (ghosts.some(g => same(g, player))) hit();
        if (s.done) return;
        ghosts.forEach((g, i) => {
          g.timer -= dt;
          if (g.timer <= 0) {
            const step = route(grid, g, player);
            if (step) { g.x = step.x; g.z = step.z; }
            g.timer = .42 + i * .065;
          }
        });
        if (ghosts.some(g => same(g, player))) hit();
      };
      s.scene = () => {
        const out = gridScene(grid, 8, 6, '#3e2a68');
        for (const p of bitSpawns) if (bits.has(key(p.x, p.z))) out.push(orb(p.x - 8, .6 + Math.sin(time * 4 + p.x) * .1, p.z - 6, .34, C.rim));
        out.push(box(exit.x - 8, .07, exit.z - 6, .91, .13, .91, s.progress >= 10 ? C.gold : '#6f5840'), box(exit.x - 8, .45, exit.z - 6 + .35, .95, .85, .1, C.gold));
        if (invulnerable <= 0 || Math.floor(time * 10) % 2 === 0) out.push(...person(player.x - 8, player.z - 6, dash > 0 ? C.gold : tint));
        ghosts.forEach((g, i) => {
          const y = .6 + Math.sin(time * 3 + i) * .12;
          out.push(orb(g.x - 8, y + .14, g.z - 6, .72, g.color), box(g.x - 8, y - .15, g.z - 6, .68, .35, .65, g.color));
          out.push(box(g.x - 8 - .17, y + .2, g.z - 6 + .32, .16, .19, .1, '#ffffff'), box(g.x - 8 + .17, y + .2, g.z - 6 + .32, .16, .19, .1, '#ffffff'));
        });
        return out;
      };
      s.debug = () => ({ player: { ...player }, ghosts: ghosts.map(g => ({ x: g.x, z: g.z })), grid: grid.map(r => r.slice()), bits: Array.from(bits), exit: { ...exit }, dashCooldown: cooldown, dashRemaining: dash, moveCooldown: moveClock, progress: s.progress, lives: s.lives });
      return s;
    }
  };

  games[5] = {
    name: 'Bomb Maze 3D', description: 'Demolição tática em uma masmorra voxel com sentinelas.',
    controls: 'Setas / WASD / direcional: mover. Espaço / ação: colocar uma bomba (pavio de 1,8 s e alcance de 3 casas). Afaste-se da cruz de explosão.',
    objective: 'Derrote os 3 guardas e o sentinela de 2 pontos de vida. Depois pegue a relíquia dourada no canto inferior direito.',
    camera: { eye: [0, 15, 12], target: [0, 0, 0] },
    create({ skin } = {}) {
      const cols = 13, rows = 11, rng = random(665), tint = color(skin);
      const grid = Array.from({ length: rows }, (_, z) => Array.from({ length: cols }, (_, x) => x === 0 || x === cols - 1 || z === 0 || z === rows - 1 || (x % 2 === 0 && z % 2 === 0) ? 1 : 0));
      const crates = new Set(), relic = { x: 11, z: 9 };
      for (let z = 1; z < rows - 1; z++) for (let x = 1; x < cols - 1; x++) {
        if (!grid[z][x] && x > 2 && z > 1 && z < 9 && x < 11 && rng() < .42) crates.add(key(x, z));
      }
      [{ x: 7, z: 5 }, { x: 6, z: 5 }, { x: 8, z: 5 }].forEach(p => crates.delete(key(p.x, p.z)));
      const enemies = [{ x: 11, z: 1, hp: 1, timer: 2.3, color: C.pink }, { x: 1, z: 9, hp: 1, timer: 2.6, color: C.pink }, { x: 7, z: 5, hp: 1, timer: 3, color: C.pink }, { x: 11, z: 9, hp: 2, timer: 3.5, color: C.violet }].map(e => ({ ...e, hits: new Set() }));
      const s = { score: 0, lives: 3, progress: 0, target: 5, done: false, won: false, message: 'Coloque uma bomba e recue. O sentinela roxo precisa de 2 explosões.' };
      let player = { x: 1, z: 1 }, bombs = [], blasts = [], nextId = 1, moveClock = 0, invulnerable = 1.3, bombCooldown = 0, previousAction = false, time = 0;
      function isBlocked(p) { return crates.has(key(p.x, p.z)) || bombs.some(b => same(b, p)); }
      function explode(bomb) {
        if (bomb.exploded) return;
        bomb.exploded = true;
        const cells = [{ x: bomb.x, z: bomb.z }];
        for (const d of dirs) for (let step = 1; step <= 3; step++) {
          const p = { x: bomb.x + d.x * step, z: bomb.z + d.z * step }, k = key(p.x, p.z);
          if (!grid[p.z] || grid[p.z][p.x] !== 0) break;
          cells.push(p);
          if (crates.delete(k)) { s.score += 20; break; }
          const chain = bombs.find(b => !b.exploded && same(b, p));
          if (chain) explode(chain);
        }
        blasts.push({ id: bomb.id, cells, life: .58 });
      }
      function hit() {
        if (invulnerable > 0 || s.done) return;
        s.lives--; s.message = s.lives ? 'Atingido! Os inimigos derrotados e as caixas destruídas permanecem.' : 'Você perdeu suas 3 vidas na masmorra.';
        if (!s.lives) s.done = true;
        else { player = { x: 1, z: 1 }; invulnerable = 2.8; moveClock = .3; }
      }
      s.update = (dt, input) => {
        if (s.done) return;
        time += dt; invulnerable = Math.max(0, invulnerable - dt); moveClock = Math.max(0, moveClock - dt); bombCooldown = Math.max(0, bombCooldown - dt);
        const fire = action(input, previousAction); previousAction = !!input.action;
        if (fire && bombCooldown <= 0 && bombs.length < 3 && !bombs.some(b => same(b, player))) {
          bombs.push({ x: player.x, z: player.z, fuse: 1.8, id: nextId++, exploded: false }); bombCooldown = .25;
          s.message = 'Bomba armada: 1,8 segundo para sair da cruz de explosão.';
        }
        const d = direction(input);
        if (d && moveClock <= 0) {
          const q = { x: player.x + d.x, z: player.z + d.z };
          if (grid[q.z] && grid[q.z][q.x] === 0 && !isBlocked(q)) player = q;
          moveClock = .15;
        }
        for (const b of bombs) { b.fuse -= dt; if (b.fuse <= 0) explode(b); }
        bombs = bombs.filter(b => !b.exploded);
        for (const blast of blasts) {
          if (blast.cells.some(p => same(p, player))) hit();
          for (const e of enemies) if (e.hp > 0 && !e.hits.has(blast.id) && blast.cells.some(p => same(p, e))) {
            e.hits.add(blast.id); e.hp--; s.score += e.hp === 0 ? (e.color === C.violet ? 500 : 250) : 100;
            if (e.hp === 0) { s.progress++; s.message = s.progress === 4 ? 'Masmorra liberada! Pegue a relíquia dourada no canto inferior direito.' : s.progress + ' / 4 defensores derrotados.'; }
          }
        }
        blasts.forEach(b => b.life -= dt); blasts = blasts.filter(b => b.life > 0);
        if (s.done) return;
        enemies.forEach((e, i) => {
          if (e.hp <= 0) return;
          e.timer -= dt;
          if (e.timer <= 0) {
            const step = route(grid, e, player, p => isBlocked(p) || blasts.some(b => b.cells.some(c => same(c, p))) || enemies.some(other => other !== e && other.hp > 0 && same(other, p)));
            if (step) { e.x = step.x; e.z = step.z; }
            e.timer = .60 + i * .055;
          }
        });
        if (enemies.some(e => e.hp > 0 && same(e, player))) hit();
        if (s.progress === 4 && same(player, relic)) { s.progress = 5; s.done = true; s.won = true; s.score += 650; s.message = 'Relíquia resgatada! Todos os defensores foram derrotados.'; }
      };
      s.scene = () => {
        const out = gridScene(grid, 6, 5, '#344a63');
        crates.forEach(k => { const [x, z] = k.split(',').map(Number); out.push(box(x - 6, .4, z - 5, .83, .8, .83, '#a76a42'), box(x - 6, .4, z - 5, .88, .13, .87, '#d49a56')); });
        out.push(box(relic.x - 6, .07, relic.z - 5, .9, .14, .9, '#a58236'));
        if (s.progress >= 4) out.push(orb(relic.x - 6, .7 + Math.sin(time * 4) * .1, relic.z - 5, .6, C.gold), box(relic.x - 6, 1.1, relic.z - 5, .58, .15, .58, C.gold));
        else out.push(box(relic.x - 6, .47, relic.z - 5 + .35, .88, .8, .12, '#72623b'));
        if (invulnerable <= 0 || Math.floor(time * 10) % 2 === 0) out.push(...person(player.x - 6, player.z - 5, tint));
        enemies.forEach(e => {
          if (e.hp <= 0) return;
          const sentinel = e.color === C.violet;
          out.push(box(e.x - 6, .43, e.z - 5, .65, .76, .65, e.color), box(e.x - 6, .92, e.z - 5, sentinel ? .82 : .6, .25, .57, '#adb6d5'));
          out.push(box(e.x - 6, .61, e.z - 5 + .34, .42, .12, .06, C.red));
          if (sentinel) for (let i = 0; i < e.hp; i++) out.push(orb(e.x - 6 - .2 + i * .4, 1.25, e.z - 5, .17, C.gold));
        });
        bombs.forEach(b => out.push(orb(b.x - 6, .36, b.z - 5, .58, '#152137'), box(b.x - 6, .71, b.z - 5, .11, .25, .11, Math.sin(time * 24) > 0 ? C.red : C.gold)));
        blasts.forEach(b => b.cells.forEach(p => out.push(box(p.x - 6, .36, p.z - 5, .9, .72 * (b.life / .58) + .15, .9, b.life > .3 ? '#ffeb7b' : '#ff813e'))));
        return out;
      };
      s.debug = () => ({ player: { ...player }, grid: grid.map(r => r.slice()), crates: Array.from(crates), bombs: bombs.map(b => ({ x: b.x, z: b.z, fuse: b.fuse })), blasts: blasts.map(b => ({ cells: b.cells.map(p => ({ ...p })), life: b.life })), enemies: enemies.map(e => ({ x: e.x, z: e.z, hp: e.hp })), relic: { ...relic }, progress: s.progress, lives: s.lives });
      return s;
    }
  };

  games[7] = {
    name: 'Pixel Crossing 3D', description: 'Atravesse avenidas, rios e plataformas de madeira em movimento.',
    controls: 'Setas / WASD / direcional: andar. Espaço / ação: saltar uma faixa para frente. Nos rios, fique sobre os troncos.',
    objective: 'Complete 3 travessias até a plataforma dourada. Carros, água e as bordas consomem uma das suas 4 vidas.',
    camera: { eye: [0, 15, 13], target: [0, 0, 0] },
    create({ skin } = {}) {
      const tint = color(skin), s = { score: 0, lives: 4, progress: 0, target: 3, done: false, won: false, message: 'Travessia 1 / 3. Observe os carros e os troncos antes de avançar.' };
      const lanes = [
        { row: 2, type: 'road', speed: 2, gap: 6.1, width: 1.8, offset: 0, color: C.pink },
        { row: 3, type: 'road', speed: -2.7, gap: 6.6, width: 2.45, offset: 2.5, color: '#ffc264' },
        { row: 5, type: 'road', speed: 3.1, gap: 6, width: 1.8, offset: -3, color: C.violet },
        { row: 7, type: 'river', speed: -1.1, gap: 3.9, width: 2.8, offset: .6 },
        { row: 8, type: 'river', speed: 1.3, gap: 4.3, width: 3.0, offset: -1.6 },
        { row: 10, type: 'river', speed: -.95, gap: 3.7, width: 2.7, offset: .2 }
      ];
      let player = { x: 0, row: 0 }, time = 0, laneTime = 0, moveClock = 0, jump = 0, walkHop = 0, jumpCooldown = 0, invulnerable = .8, previousAction = false, furthest = 0;
      const multiplier = () => 1 + s.progress * .18;
      function positions(lane) {
        const out = [], base = ((lane.offset + laneTime * lane.speed * multiplier()) % lane.gap + lane.gap) % lane.gap;
        for (let i = -4; i <= 4; i++) { const x = base + i * lane.gap; if (x > -8.5 && x < 8.5) out.push(x); }
        return out;
      }
      function reset() { player = { x: 0, row: 0 }; moveClock = .35; jump = 0; walkHop = 0; invulnerable = .8; furthest = 0; }
      function hit(reason) {
        if (s.done) return;
        s.lives--; s.message = s.lives ? reason + ' Volte a tentar esta travessia.' : reason + ' Você perdeu suas 4 vidas.';
        if (s.lives <= 0) s.done = true; else reset();
      }
      s.update = (dt, input) => {
        if (s.done) return;
        time += dt; laneTime += dt;
        // Keep phases bounded without changing lane spacing, even in long sessions.
        if (laneTime > 120) { for (const l of lanes) l.offset = (l.offset + laneTime * l.speed * multiplier()) % l.gap; laneTime = 0; }
        invulnerable = Math.max(0, invulnerable - dt); moveClock = Math.max(0, moveClock - dt); jump = Math.max(0, jump - dt); walkHop = Math.max(0, walkHop - dt); jumpCooldown = Math.max(0, jumpCooldown - dt);
        const fire = action(input, previousAction); previousAction = !!input.action;
        const d = direction(input);
        if (fire && jumpCooldown <= 0 && moveClock <= 0) { player.row = Math.min(12, player.row + 1); jump = .36; jumpCooldown = .72; moveClock = .18; }
        else if (d && moveClock <= 0) {
          if (d.x) player.x += d.x;
          else player.row = Math.max(0, Math.min(12, player.row - d.z));
          moveClock = .18; walkHop = .19;
        }
        if (player.row > furthest) { s.score += (player.row - furthest) * 20; furthest = player.row; }
        if (player.row === 12) {
          const previousSpeed = multiplier();
          s.progress++; s.score += 500;
          if (s.progress === 3) { s.done = true; s.won = true; s.score += 450; s.message = 'Três travessias concluídas! Você chegou à cidade dos pixels.'; }
          else { for (const l of lanes) l.offset = (l.offset + laneTime * l.speed * previousSpeed) % l.gap; laneTime = 0; reset(); s.message = 'Travessia ' + (s.progress + 1) + ' / 3. O tráfego ficou mais rápido.'; }
          return;
        }
        if (Math.abs(player.x) > 5.65) { hit('Você caiu pela borda.'); return; }
        const lane = lanes.find(l => l.row === player.row);
        if (!lane) return;
        const centers = positions(lane);
        if (lane.type === 'river') {
          const log = centers.find(x => Math.abs(x - player.x) <= lane.width / 2 - .15);
          if (log !== undefined) player.x += lane.speed * multiplier() * dt;
          else if (jump <= 0) hit('Você caiu na água.');
        } else if (invulnerable <= 0 && jump <= .12 && centers.some(x => Math.abs(x - player.x) < lane.width / 2 + .24)) hit('Um veículo atingiu você.');
      };
      s.scene = () => {
        const out = [box(0, -.3, 0, 17.4, .45, 13.6, '#123c39')];
        for (let row = 0; row <= 12; row++) {
          const z = 6 - row, lane = lanes.find(l => l.row === row);
          const floorColor = lane ? lane.type === 'road' ? '#273443' : '#176b9a' : row === 12 ? '#9c773d' : s.progress === 1 ? '#24726b' : '#28754a';
          out.push(box(0, -.035, z, lane ? 17.4 : 11.4, .08, .98, floorColor));
          if (lane && lane.type === 'road') {
            for (let x = -5; x <= 5; x += 2) out.push(box(x, .02, z - .38, .8, .025, .045, '#dae8c7'));
            positions(lane).forEach(x => {
              out.push(box(x, .34, z, lane.width, .54, .72, lane.color), box(x - Math.sign(lane.speed) * .15, .75, z, lane.width * .45, .42, .65, '#426580'));
              for (const side of [-1, 1]) for (const wheel of [-1, 1]) out.push(box(x + side * lane.width * .31, .19, z + wheel * .37, .27, .3, .16, '#101521'));
              out.push(box(x + Math.sign(lane.speed) * (lane.width / 2 + .01), .39, z, .045, .13, .55, '#fff3b5'));
            });
          } else if (lane) {
            positions(lane).forEach(x => {
              out.push(box(x, .09, z, lane.width, .29, .82, '#94613c'));
              for (let i = -.25; i <= .25; i += .25) out.push(box(x, .25, z + i, lane.width - .15, .045, .06, '#d39a59'));
            });
          } else if (row !== 12) {
            for (const x of [-5.65, 5.65]) out.push(box(x, .34, z, .45, .65, .65, '#1e6743'), box(x, .75, z, .66, .43, .67, '#59b65d'));
          }
          if (row === 12) for (let x = -5; x <= 5; x += 2) out.push(box(x, .04, z, .8, .1, .83, C.gold));
        }
        out.push(box(-5.4, 1, -6.3, .16, 2, .16, C.gold), box(5.4, 1, -6.3, .16, 2, .16, C.gold), box(0, 1.95, -6.3, 10.9, .18, .2, C.gold));
        const y = jump > 0 ? Math.sin(Math.min(1, jump / .36) * Math.PI) * .65 : Math.sin(walkHop / .19 * Math.PI) * .15;
        if (invulnerable <= 0 || Math.floor(time * 10) % 2 === 0) out.push(...person(player.x, 6 - player.row, tint, y, .83));
        return out;
      };
      s.debug = () => ({ player: { ...player }, lanes: lanes.map(l => ({ ...l, centers: positions(l) })), stage: s.progress + 1, progress: s.progress, lives: s.lives, jump, moveCooldown: moveClock });
      return s;
    }
  };
}());
