(function () {
  'use strict';
  const games = window.PixelGames ||= {};
  const C = { cyan: '#00f5ff', pink: '#ff20b9', gold: '#ffd600', green: '#39ff88', purple: '#7d4cff', white: '#e4fbff', red: '#ff4e66', dark: '#10152c', floor: '#0b1830' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const unit = (x, z) => { const n = Math.hypot(x, z) || 1; return { x: x / n, z: z / n }; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const box = (x, y, z, w, h, d, color, rotation = 0) => ({ x, y, z, w, h, d, color, rotation });
  const sphere = (x, y, z, size, color) => ({ x, y, z, w: size, h: size, d: size, color, shape: 'sphere' });
  const hitBox = (p, b, rx = 0, rz = rx) => Math.abs(p.x - b.x) < b.w / 2 + rx && Math.abs(p.z - b.z) < b.d / 2 + rz;
  function floor(out, w, d, color = C.floor, accent = C.cyan) {
    out.push(box(0, -.45, 0, w, .6, d, color));
    out.push(box(-w / 2, -.05, 0, .12, .13, d, accent), box(w / 2, -.05, 0, .12, .13, d, accent));
    out.push(box(0, -.05, -d / 2, w, .13, .12, accent), box(0, -.05, d / 2, w, .13, .12, accent));
  }
  function grid(out, w, d, spacing = 2, color = '#17304a') {
    for (let x = -w / 2 + spacing; x < w / 2; x += spacing) out.push(box(x, -.12, 0, .025, .04, d, color));
    for (let z = -d / 2 + spacing; z < d / 2; z += spacing) out.push(box(0, -.12, z, w, .04, .025, color));
  }
  function ring(out, x, z, radius, color, y = .04, segments = 18) {
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments;
      out.push(box(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius, .18, .1, .36, color, -a));
    }
  }
  function ship(out, x, z, color, scale = 1, enemy = false) {
    const s = scale;
    out.push(box(x, .6 * s, z, .62 * s, .65 * s, 1.45 * s, color));
    out.push(box(x, 1.03 * s, z + .15 * s, .45 * s, .42 * s, .5 * s, C.dark));
    out.push(box(x - .66 * s, .34 * s, z + .32 * s, .85 * s, .32 * s, .75 * s, enemy ? C.purple : C.white));
    out.push(box(x + .66 * s, .34 * s, z + .32 * s, .85 * s, .32 * s, .75 * s, enemy ? C.purple : C.white));
    out.push(box(x, .54 * s, z + (enemy ? -.85 : .85) * s, .37 * s, .3 * s, .25 * s, enemy ? C.red : C.cyan));
  }
  function robot(out, x, z, color, scale = 1, facing = 0, crown = false) {
    const s = scale;
    out.push(box(x, 1.05 * s, z, .8 * s, .85 * s, .6 * s, color, facing));
    out.push(box(x, 1.78 * s, z, .66 * s, .6 * s, .64 * s, C.white, facing));
    out.push(box(x, 1.8 * s, z + .34 * s, .43 * s, .16 * s, .09 * s, C.dark, facing));
    out.push(box(x - .3 * s, .28 * s, z, .26 * s, .58 * s, .4 * s, C.dark));
    out.push(box(x + .3 * s, .28 * s, z, .26 * s, .58 * s, .4 * s, C.dark));
    out.push(box(x - .59 * s, 1.1 * s, z, .25 * s, .68 * s, .3 * s, color), box(x + .59 * s, 1.1 * s, z, .25 * s, .68 * s, .3 * s, color));
    if (crown) {
      out.push(box(x, 2.17 * s, z, .85 * s, .17 * s, .72 * s, C.gold));
      for (let i = -1; i <= 1; i++) out.push(box(x + i * .31 * s, 2.4 * s, z, .16 * s, .37 * s, .2 * s, C.gold));
    }
  }
  function car(out, x, z, color, truck = false) {
    const length = truck ? 3 : 2.3;
    out.push(box(x, .6, z, 1.3, .7, length, color));
    out.push(box(x, 1.16, z + .1, truck ? 1.24 : .95, truck ? 1.5 : .45, truck ? 1.95 : .98, truck ? '#4e5789' : C.dark));
    out.push(box(x, 1.38, z - .25, .77, .12, .46, C.cyan));
    for (const dx of [-.69, .69]) for (const dz of [-.7, .7]) out.push(box(x + dx, .28, z + dz, .21, .45, .48, '#050813'));
    out.push(box(x - .4, .59, z - length / 2 - .025, .25, .17, .09, C.white), box(x + .4, .59, z - length / 2 - .025, .25, .17, .09, C.white));
    out.push(box(x, .64, z + length / 2 + .025, .85, .13, .07, C.red));
  }
  function effects() {
    const particles = [];
    return {
      burst(x, z, color, amount = 8) {
        for (let i = 0; i < amount; i++) { const a = rand(0, Math.PI * 2); particles.push({ x, z, y: .8, vx: Math.cos(a) * rand(2, 5), vz: Math.sin(a) * rand(2, 5), vy: rand(2, 5), t: .6, color }); }
      },
      update(dt) { for (const p of particles) { p.t -= dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= dt * 9; } for (let i = particles.length - 1; i >= 0; i--) if (particles[i].t <= 0) particles.splice(i, 1); },
      draw(out) { for (const p of particles) out.push(box(p.x, Math.max(.1, p.y), p.z, .15, .15, .15, p.color)); }
    };
  }
  function session(lives, target) {
    return { score: 0, lives, progress: 0, target, done: false, won: false, message: '', finish(won, text) { this.done = true; this.won = won; this.message = text; } };
  }
  function motion(p, dt, input, speed, xmin, xmax, zmin, zmax) {
    const n = Math.max(1, Math.hypot(input.x || 0, input.z || 0));
    p.x = clamp(p.x + (input.x || 0) / n * dt * speed, xmin, xmax);
    p.z = clamp(p.z + (input.z || 0) / n * dt * speed, zmin, zmax);
  }

  // Três formações, três decisões de melhoria e uma nave-chefe.
  games[2] = {
    name: 'Neon Invaders',
    description: 'Defenda a estação orbital em três ondas. Escolha uma melhoria após cada onda e destrua a nave comandante.',
    controls: 'WASD / setas: pilotar · Segure ESPAÇO: disparar · Melhorias: ← → e ESPAÇO para confirmar.',
    objective: 'Vença 3 ondas e destrua o comandante para conquistar o fragmento.',
    actionLabel: 'DISPARAR',
    camera: { eye: [0, 19, 18], target: [0, 0, 0], fov: 45 },
    create({ skin = C.cyan } = {}) {
      const s = session(4, 46), fx = effects(), player = { x: 0, z: 7 };
      let t = 0, wave = 1, mode = 'wave', invulnerable = 0, fire = 0, enemyFire = .8, selection = 0, choiceDelay = 0, kills = 0;
      let double = false, rapid = false, enemies = [], shots = [], hostile = [], boss = null;
      const choices = ['DISPARO DUPLO', 'TIRO ACELERADO', 'ESCUDO: +1 VIDA'];
      function spawnWave() {
        enemies = [];
        const columns = wave + 3;
        for (let row = 0; row < 3; row++) for (let col = 0; col < columns; col++) {
          const base = (col - (columns - 1) / 2) * 2;
          enemies.push({ base, x: base + Math.sin(row * .6) * 1.6, z: -7.7 + row * 1.7, hp: wave === 3 && row === 0 ? 2 : 1, phase: row * .6, color: row === 0 ? C.pink : row === 1 ? C.purple : C.cyan });
        }
        // O progresso conta os 45 invasores e o comandante, sem pontos de exemplo.
        s.target = 12 + 15 + 18 + 1;
        mode = 'wave'; enemyFire = .8;
      }
      spawnWave();
      function damage() {
        if (invulnerable > 0 || s.done) return;
        s.lives--; invulnerable = 1.6; fx.burst(player.x, player.z, C.red);
        if (s.lives <= 0) s.finish(false, 'Estação perdida. Tente novas melhorias e desvie dos disparos vermelhos.');
      }
      s.update = (dt, input) => {
        if (s.done) return;
        dt = clamp(dt, 0, .05); t += dt; fx.update(dt); invulnerable = Math.max(0, invulnerable - dt);
        if (mode === 'upgrade') {
          choiceDelay -= dt;
          if (input.leftPressed || input.upPressed) selection = (selection + 2) % 3;
          if (input.rightPressed || input.downPressed) selection = (selection + 1) % 3;
          s.message = `MELHORIA ${selection + 1}/3: ${choices[selection]} · ← → escolher · ESPAÇO confirmar`;
          if (input.actionPressed && choiceDelay <= 0) {
            if (selection === 0) double = true;
            if (selection === 1) rapid = true;
            if (selection === 2) s.lives = Math.min(6, s.lives + 1);
            if (wave < 3) { wave++; spawnWave(); } else { mode = 'boss'; boss = { x: 0, z: -6.9, hp: 24 }; enemyFire = 1.1; }
            shots = []; hostile = []; player.x = 0; player.z = 7;
          }
          return;
        }
        motion(player, dt, input, 7, -7.6, 7.6, 3, 8.6);
        fire -= dt; enemyFire -= dt;
        if (input.action && fire <= 0) {
          fire = rapid ? .15 : .25;
          for (const dx of double ? [-.35, .35] : [0]) shots.push({ x: player.x + dx, z: player.z - .9 });
        }
        for (const e of enemies) e.x = e.base + Math.sin(t * .85 + e.phase) * 1.6;
        if (boss) boss.x = Math.sin(t * .72) * 5.5;
        if (enemyFire <= 0) {
          enemyFire = mode === 'boss' ? .65 : 1.1 - wave * .12;
          if (boss) {
            for (const dx of [-1, 0, 1]) hostile.push({ x: boss.x + dx * .8, z: boss.z + 1, vx: dx * 1.8, vz: 6.4 });
          } else if (enemies.length) {
            const e = enemies[Math.floor(Math.random() * enemies.length)];
            const aim = unit(player.x - e.x, player.z - e.z);
            hostile.push({ x: e.x, z: e.z + .6, vx: aim.x * 3, vz: Math.max(3.7, aim.z * (4.7 + wave * .45)) });
          }
        }
        for (let i = shots.length - 1; i >= 0; i--) {
          const b = shots[i]; b.z -= dt * 16;
          let hit = false;
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (Math.abs(b.x - e.x) < .78 && Math.abs(b.z - e.z) < .7) {
              e.hp--; hit = true; s.score += 30;
              if (e.hp <= 0) { enemies.splice(j, 1); kills++; s.score += 100; fx.burst(e.x, e.z, e.color); }
              break;
            }
          }
          if (!hit && boss && Math.abs(b.x - boss.x) < 2.1 && Math.abs(b.z - boss.z) < 1.6) {
            boss.hp--; s.score += 60; hit = true; fx.burst(b.x, b.z, C.gold, 3);
            if (boss.hp <= 0) { boss.hp = 0; fx.burst(boss.x, boss.z, C.gold, 24); kills++; s.score += 1500; s.progress = kills; s.finish(true, 'Comandante destruído! A estação está segura. Fragmento de Neon Invaders conquistado.'); return; }
          }
          if (hit || b.z < -11) shots.splice(i, 1);
        }
        for (let i = hostile.length - 1; i >= 0; i--) {
          const b = hostile[i]; b.x += b.vx * dt; b.z += b.vz * dt;
          if (Math.abs(b.x - player.x) < .65 && Math.abs(b.z - player.z) < .85) { hostile.splice(i, 1); damage(); }
          else if (b.z > 11 || Math.abs(b.x) > 10) hostile.splice(i, 1);
        }
        s.progress = kills;
        if (s.done) return;
        if (mode === 'wave' && !enemies.length) { mode = 'upgrade'; selection = 0; choiceDelay = .4; hostile = []; shots = []; }
        s.message = mode === 'boss' ? `COMANDANTE · ${boss.hp}/24 blindagem · Segure ESPAÇO e desvie` : `ONDA ${wave}/3 · ${enemies.length} invasores · ${double ? 'Duplo' : 'Simples'} / ${rapid ? 'Rápido' : 'Normal'}`;
      };
      s.scene = () => {
        const out = []; floor(out, 17, 20, '#071029', C.cyan); grid(out, 17, 20, 2, '#102f50');
        for (let i = 0; i < 18; i++) out.push(sphere(Math.sin(i * 4.3) * 12, .3 + (i % 3) * .6, Math.cos(i * 2.2) * 11, .09, i % 2 ? C.white : C.cyan));
        ship(out, player.x, player.z, invulnerable > 0 && Math.floor(t * 12) % 2 ? C.white : skin);
        for (const e of enemies) ship(out, e.x, e.z, e.color, .72, true);
        if (boss) {
          ship(out, boss.x, boss.z, C.gold, 2.2, true);
          out.push(box(boss.x, 1.75, boss.z, 1.2, .5, 1.1, C.pink));
          for (let i = 0; i < boss.hp; i++) out.push(box(-5.75 + i * .5, .22, -9.2, .38, .16, .27, C.gold));
        }
        for (const b of shots) out.push(box(b.x, .7, b.z, .15, .18, .6, C.green));
        for (const b of hostile) out.push(sphere(b.x, .7, b.z, .38, C.red));
        if (mode === 'upgrade') for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 4.8, color = i === selection ? C.gold : C.purple;
          out.push(box(x, .6, -1.3, 3.7, 1.2, 3.7, '#1e2144'), box(x, 1.24, -1.3, 3.7, .1, 3.7, color));
          if (i === 0) { out.push(box(x - .55, 2.2, -1.3, .35, 1.3, .35, C.green), box(x + .55, 2.2, -1.3, .35, 1.3, .35, C.green)); }
          if (i === 1) for (let j = 0; j < 3; j++) out.push(box(x, 1.65 + j * .45, -1.3, 1.7 - j * .4, .22, .45, C.cyan));
          if (i === 2) { out.push(box(x, 2.1, -1.3, .45, 1.6, .5, C.green), box(x, 2.1, -1.3, 1.6, .45, .5, C.green)); }
          if (i === selection) ring(out, x, -1.3, 2.1, C.gold);
        }
        fx.draw(out); return out;
      };
      s.debug = () => ({ wave, mode, player: { ...player }, enemies: enemies.map(e => ({ ...e })), boss: boss && { ...boss }, shots: shots.map(b => ({ ...b })), hostile: hostile.map(b => ({ ...b })), selection, double, rapid });
      s.message = 'ONDA 1/3 · Segure ESPAÇO para disparar.';
      return s;
    }
  };

  // Breakout em uma quadra volumétrica, seguido pelo núcleo real móvel.
  games[3] = {
    name: 'Brick Kingdom',
    description: 'Rebata o orbe de energia, desmonte a muralha de 28 blocos e vença o núcleo real. Pulsos vermelhos encolhem a raquete; o poder de ampliação protege contra eles.',
    controls: '← → / A D: mover raquete · ESPAÇO: lançar a bola / alargar a raquete por 3 segundos.',
    objective: 'Destrua os 28 blocos e acerte o núcleo real 10 vezes.',
    actionLabel: 'LANÇAR / PODER',
    camera: { eye: [0, 19, 18], target: [0, 0, -1], fov: 45 },
    create({ skin = C.gold } = {}) {
      const s = session(4, 38), fx = effects(), paddle = { x: 0, z: 7.5, w: 2.8, d: .55 }, ball = { x: 0, z: 6.8, vx: 0, vz: 0 };
      let t = 0, ready = true, readyDelay = 0, boost = 0, jam = 0, cooldown = 0, invul = 0, destroyed = 0, collisionDelay = 0, boss = null, bossFire = 1.8;
      const bricks = [], pulses = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) bricks.push({ x: (c - 3) * 2.02, z: -7.4 + r * 1.52, w: 1.83, d: 1.17, hp: r === 0 ? 2 : 1, color: [C.gold, C.pink, C.purple, C.cyan][r] });
      function resetBall() { ready = true; readyDelay = .5; ball.x = paddle.x; ball.z = paddle.z - .9; ball.vx = 0; ball.vz = 0; }
      function damage() {
        if (invul > 0 || s.done) return;
        s.lives--; invul = 1.5; fx.burst(paddle.x, paddle.z, C.red); resetBall();
        if (s.lives <= 0) s.finish(false, 'O castelo resistiu. Mire os rebotes pelas laterais da raquete.');
      }
      s.update = (dt, input) => {
        if (s.done) return;
        dt = clamp(dt, 0, .05); t += dt; fx.update(dt);
        boost = Math.max(0, boost - dt); jam = Math.max(0, jam - dt); cooldown = Math.max(0, cooldown - dt); invul = Math.max(0, invul - dt); collisionDelay -= dt; readyDelay -= dt;
        paddle.w = boost > 0 ? 4.4 : jam > 0 ? 1.8 : 2.8;
        paddle.x = clamp(paddle.x + (input.x || 0) * dt * 9, -7.8 + paddle.w / 2, 7.8 - paddle.w / 2);
        if (ready) {
          ball.x = paddle.x; ball.z = paddle.z - .9;
          if (input.action && readyDelay <= 0) { ready = false; ball.vx = 2.4; ball.vz = -8.4; }
        } else {
          if (input.actionPressed && cooldown <= 0) { boost = 3; jam = 0; cooldown = 9; paddle.w = 4.4; }
          const prev = { x: ball.x, z: ball.z };
          ball.x += ball.vx * dt; ball.z += ball.vz * dt;
          if (ball.x < -7.45 || ball.x > 7.45) { ball.x = clamp(ball.x, -7.45, 7.45); ball.vx = -ball.vx; }
          if (ball.z < -9.25) { ball.z = -9.25; ball.vz = Math.abs(ball.vz); }
          if (ball.vz > 0 && hitBox(ball, paddle, .3)) {
            ball.z = paddle.z - .6;
            const speed = Math.min(12, Math.hypot(ball.vx, ball.vz) + .18);
            const ratio = clamp((ball.x - paddle.x) / (paddle.w / 2), -.9, .9);
            ball.vx = ratio * speed * .83 + (input.x || 0) * .6;
            ball.vz = -Math.sqrt(Math.max(12, speed * speed - ball.vx * ball.vx));
            s.score += 5;
          }
          if (collisionDelay <= 0) for (let i = bricks.length - 1; i >= 0; i--) {
            const b = bricks[i];
            if (hitBox(ball, b, .28)) {
              const side = Math.abs(prev.x - b.x) > b.w / 2 + .2;
              if (side) ball.vx = -ball.vx; else ball.vz = -ball.vz;
              ball.x = prev.x; ball.z = prev.z; collisionDelay = .065; b.hp--; s.score += 50;
              if (b.hp <= 0) { bricks.splice(i, 1); destroyed++; s.score += 100; fx.burst(b.x, b.z, b.color); }
              break;
            }
          }
          if (boss && collisionDelay <= 0 && dist(ball, boss) < 1.75) {
            const n = unit(ball.x - boss.x, ball.z - boss.z), dot = ball.vx * n.x + ball.vz * n.z;
            ball.vx -= 2 * dot * n.x; ball.vz -= 2 * dot * n.z;
            ball.x = boss.x + n.x * 1.83; ball.z = boss.z + n.z * 1.83;
            boss.hp--; collisionDelay = .15; s.score += 150; fx.burst(boss.x, boss.z, C.gold);
            if (boss.hp <= 0) { s.score += 1000; s.progress = 38; s.finish(true, 'Muralha destruída e núcleo vencido! Fragmento de Brick Kingdom conquistado.'); }
          }
          if (ball.z > 10.3) damage();
        }
        if (!bricks.length && !boss) { boss = { x: 0, z: -6.3, hp: 10 }; pulses.length = 0; }
        if (boss) {
          boss.x = Math.sin(t * .8) * 4.3; bossFire -= dt;
          if (bossFire <= 0) { bossFire = 2.2; pulses.push({ x: boss.x, z: boss.z + 1.7 }); }
        }
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i]; p.z += dt * 4.1;
          if (hitBox(p, paddle, .25)) {
            pulses.splice(i, 1);
            if (boost > 0) { s.score += 25; fx.burst(paddle.x, paddle.z, C.cyan, 5); }
            else { jam = 1.6; fx.burst(paddle.x, paddle.z, C.red, 5); }
          }
          else if (p.z > 11) pulses.splice(i, 1);
        }
        s.progress = destroyed + (boss ? 10 - boss.hp : 0);
        if (!s.done) s.message = ready ? 'ESPAÇO: lançar · ← → para mirar a posição inicial' : `${boss ? `NÚCLEO REAL ${boss.hp}/10` : `MURALHA: ${bricks.length} blocos`} · ${boost > 0 ? 'RAQUETE AMPLIADA: PROTEGIDA' : jam > 0 ? 'INTERFERÊNCIA: RAQUETE ENCOLHIDA' : cooldown > 0 ? `Poder em ${Math.ceil(cooldown)}s` : 'ESPAÇO: ampliar raquete'}`;
      };
      s.scene = () => {
        const out = []; floor(out, 16, 20, '#17142f', C.gold); grid(out, 16, 20, 2, '#342845');
        for (const x of [-8.4, 8.4]) for (const z of [-9, -3, 3, 9]) {
          out.push(box(x, 1.15, z, .8, 2.6, .9, '#28223d'), box(x, 2.65, z, 1.1, .35, 1.1, C.gold));
          for (const dx of [-.35, .35]) out.push(box(x + dx, 2.99, z, .25, .35, .8, C.gold));
        }
        for (const b of bricks) {
          out.push(box(b.x, .65, b.z, b.w, 1.3, b.d, b.hp > 1 ? C.white : b.color));
          out.push(box(b.x, 1.36, b.z, b.w * .76, .1, b.d * .74, b.color));
        }
        out.push(box(paddle.x, .5, paddle.z, paddle.w, .65, .65, invul > 0 ? C.white : skin), box(paddle.x, .9, paddle.z, paddle.w * .8, .14, .45, C.cyan));
        out.push(sphere(ball.x, .66, ball.z, .6, C.white));
        if (boss) {
          out.push(sphere(boss.x, 1.55, boss.z, 2.8, C.purple), sphere(boss.x, 1.58, boss.z, 1.7, C.gold));
          out.push(box(boss.x, 3.05, boss.z, 1.6, .22, 1.1, C.gold));
          for (let i = -1; i <= 1; i++) out.push(box(boss.x + i * .6, 3.38, boss.z, .26, .45, .32, C.gold));
          ring(out, boss.x, boss.z, 2.1, C.pink);
          for (let i = 0; i < boss.hp; i++) out.push(box(-3.6 + i * .8, .15, -9.4, .6, .16, .3, C.gold));
        }
        for (const p of pulses) out.push(sphere(p.x, .5, p.z, .6, C.red));
        fx.draw(out); return out;
      };
      s.debug = () => ({ paddle: { ...paddle }, ball: { ...ball }, ready, boost, jam, cooldown, bricks: bricks.map(b => ({ ...b })), boss: boss && { ...boss }, pulses: pulses.map(p => ({ ...p })) });
      s.message = 'ESPAÇO: lançar a bola · Use a raquete para rebater.';
      return s;
    }
  };

  games[4] = {
    name: 'Turbo Pixel 99',
    description: 'Corra 1.800 metros pelo circuito neon, desvie do tráfego e colete moedas. O nitro acelera a corrida, mas exige mais reflexos.',
    controls: '← → / A D: trocar entre 3 faixas · ↑ ↓ / W S: posição na pista · Segure ESPAÇO: nitro · Cerca de 45 segundos sem nitro.',
    objective: 'Cruze os 1.800 metros com pelo menos uma vida.',
    actionLabel: 'NITRO',
    camera: { eye: [0, 16, 18], target: [0, 0, -2] },
    create({ skin = C.cyan } = {}) {
      const s = session(3, 1800), fx = effects(), player = { x: 0, z: 6 };
      let t = 0, distance = 0, nitro = 100, spawn = 1, invul = 0, scenery = 0, coins = 0, passed = 0, lastLane = 1, lane = 1, steeringDelay = 0;
      const traffic = [], pickups = [], lanes = [-4, 0, 4];
      s.update = (dt, input) => {
        if (s.done) return;
        dt = clamp(dt, 0, .05); t += dt; fx.update(dt); invul = Math.max(0, invul - dt);
        const boosting = !!input.action && nitro > 2;
        nitro = clamp(nitro + dt * (boosting ? -32 : 14), 0, 100);
        const speed = boosting ? 62 : 40, scroll = boosting ? 15.5 : 10;
        distance += dt * speed; scenery = (scenery + dt * scroll) % 8;
        // A troca termina em uma faixa: não existe corredor permanentemente seguro entre carros.
        steeringDelay = Math.max(0, steeringDelay - dt);
        if (steeringDelay <= 0 && Math.abs(input.x || 0) > .35) {
          lane = clamp(lane + (input.x > 0 ? 1 : -1), 0, 2);
          steeringDelay = .55;
        }
        const steeringSpeed = boosting ? 10 : 9;
        player.x += clamp(lanes[lane] - player.x, -dt * steeringSpeed, dt * steeringSpeed);
        player.z = clamp(player.z + (input.z || 0) * dt * 3.8, 2.7, 7.6);
        spawn -= dt;
        if (spawn <= 0) {
          spawn = rand(.95, 1.35);
          let lane = Math.floor(Math.random() * 3);
          if (lane === lastLane && Math.random() > .45) lane = (lane + 1) % 3;
          lastLane = lane;
          traffic.push({ x: lanes[lane], z: -13, w: 1.5, d: Math.random() > .7 ? 3 : 2.3, color: [C.pink, C.gold, C.purple][lane] });
          const safe = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
          if (Math.random() > .25) for (let i = 0; i < 2; i++) pickups.push({ x: lanes[safe], z: -13 - i * 1.9 });
        }
        for (let i = traffic.length - 1; i >= 0; i--) {
          const other = traffic[i]; other.z += dt * scroll;
          if (invul <= 0 && hitBox(player, other, .64, 1.06)) {
            s.lives--; invul = 1.75; nitro = Math.max(0, nitro - 25); traffic.splice(i, 1); fx.burst(player.x, player.z, C.red, 12);
            if (s.lives <= 0) { s.finish(false, `Carro danificado aos ${Math.floor(distance)} m. Use as faixas livres e guarde nitro para as retas.`); return; }
          } else if (other.z > 12) { traffic.splice(i, 1); passed++; s.score += 25; }
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i]; p.z += dt * scroll;
          if (Math.abs(p.x - player.x) < .9 && Math.abs(p.z - player.z) < 1.2) { pickups.splice(i, 1); coins++; s.score += 100; nitro = Math.min(100, nitro + 8); fx.burst(p.x, p.z, C.gold, 4); }
          else if (p.z > 12) pickups.splice(i, 1);
        }
        s.progress = Math.min(1800, Math.floor(distance));
        s.message = `${s.progress}/1.800 m · NITRO ${Math.floor(nitro)}% · ${coins} moedas · ${boosting ? 'TURBO ATIVO' : 'Segure ESPAÇO para acelerar'}`;
        if (distance >= 1800) { s.score += 1800 + s.lives * 300; s.finish(true, `Chegada! ${coins} moedas coletadas e ${passed} veículos ultrapassados. Fragmento de Turbo Pixel 99 conquistado.`); }
      };
      s.scene = () => {
        const out = []; floor(out, 12, 24, '#111529', C.pink);
        for (const x of [-2, 2]) for (let z = -13; z < 12; z += 4) out.push(box(x, -.09, z + scenery % 4, .09, .05, 1.5, C.gold));
        out.push(box(-6.3, .18, 0, .45, .65, 25, '#402554'), box(6.3, .18, 0, .45, .65, 25, '#402554'));
        for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
          const z = -15 + i * 8 + scenery;
          out.push(box(side * (8.6 + i % 2 * 1.3), 1.8 + (i % 3) * .5, z, 3, 4 + i % 3, 3.5, i % 2 ? '#232647' : '#20283e'));
          for (let k = 0; k < 3; k++) out.push(box(side * (7.03 + i % 2 * 1.3), 1 + k * .9, z, .06, .3, 2.3, side < 0 ? C.cyan : C.pink));
          out.push(box(side * 6.8, 2.5, z - 1.5, .16, 5, .16, '#30445c'), box(side * 6.25, 5, z - 1.5, 1.25, .15, .2, C.white));
        }
        car(out, player.x, player.z, invul > 0 && Math.floor(t * 12) % 2 ? C.white : skin);
        if (nitro > 2) for (let i = 0; i < 2; i++) if (s.message.includes('TURBO ATIVO')) out.push(box(player.x + (i ? .35 : -.35), .35, player.z + 1.55, .28, .25, .8 + Math.sin(t * 35) * .2, C.cyan));
        for (const other of traffic) car(out, other.x, other.z, other.color, other.d === 3);
        for (const p of pickups) out.push(box(p.x, .7, p.z, .5, .7, .18, C.gold, t * 2.5));
        for (let i = 0; i < 10; i++) out.push(box(-4.6 + i * 1.02, .1, 10.6, .8, .13, .36, nitro >= (i + 1) * 10 ? C.cyan : '#293549'));
        if (distance > 1600) {
          const z = -11 + (distance - 1600) / 200 * 17;
          out.push(box(-6, 2.9, z, .3, 6, .3, C.gold), box(6, 2.9, z, .3, 6, .3, C.gold), box(0, 5.7, z, 12.2, .6, .4, C.gold));
          for (let x = -5; x <= 5; x++) out.push(box(x, 5.7, z + .25, .65, .6, .08, x % 2 ? C.dark : C.white));
        }
        fx.draw(out); return out;
      };
      s.debug = () => ({ player: { ...player }, lane, steeringDelay, distance, nitro, traffic: traffic.map(o => ({ ...o })), pickups: pickups.map(p => ({ ...p })), coins, passed, invul });
      s.message = '1.800 metros até a chegada · Segure ESPAÇO para usar nitro.';
      return s;
    }
  };

  // RPG curto: combos, experiência, inimigos com antecipação de golpes e chefe.
  games[6] = {
    name: 'Dungeon Fighter 2000',
    description: 'Lute em três ondas na masmorra. Encadeie três golpes para um ataque pesado, ganhe experiência e derrote o guardião.',
    controls: 'WASD / setas: andar · Segure ESPAÇO: combos corpo a corpo · Pegue os orbes verdes para recuperar vida.',
    objective: 'Vença 15 combatentes em 3 ondas e derrote o guardião.',
    actionLabel: 'COMBO',
    camera: { eye: [0, 20, 19], target: [0, .3, 0] },
    create({ skin = C.pink } = {}) {
      const s = session(5, 16), fx = effects(), player = { x: 0, z: 5, fx: 0, fz: -1 };
      let t = 0, wave = 1, kills = 0, xp = 0, attack = 0, swing = 0, combo = 0, sinceStrike = 5, invul = 0, waveWait = 0, level = 1;
      let enemies = [], boss = null;
      const heals = [], blasts = [];
      function spawnWave() {
        enemies = [];
        for (let i = 0; i < wave + 3; i++) {
          const a = Math.PI * 2 * i / (wave + 3);
          enemies.push({ x: Math.cos(a) * 6.5, z: Math.sin(a) * 6.5, hp: wave < 2 ? 2 : 3, state: 'walk', timer: rand(.2, .8), color: i % 2 ? C.purple : C.red, speed: 1.35 + wave * .19, aimX: 0, aimZ: 0 });
        }
      }
      spawnWave();
      function damage() {
        if (invul > 0 || s.done) return;
        s.lives--; invul = 1.25; fx.burst(player.x, player.z, C.red, 10);
        if (s.lives <= 0) s.finish(false, 'O guardião venceu. Desvie dos círculos vermelhos antes de contra-atacar.');
      }
      function killEnemy(index) {
        const e = enemies[index]; enemies.splice(index, 1); kills++; xp += 25; s.score += 200; fx.burst(e.x, e.z, e.color);
        if (kills % 3 === 0) heals.push({ x: e.x, z: e.z });
        const newLevel = 1 + Math.floor(xp / 100);
        if (newLevel > level) { level = newLevel; s.lives = Math.min(6, s.lives + 1); fx.burst(player.x, player.z, C.green); }
      }
      s.update = (dt, input) => {
        if (s.done) return;
        dt = clamp(dt, 0, .05); t += dt; fx.update(dt); attack -= dt; swing = Math.max(0, swing - dt); sinceStrike += dt; invul = Math.max(0, invul - dt);
        motion(player, dt, input, 5, -7.3, 7.3, -7.3, 7.3);
        if (Math.hypot(input.x || 0, input.z || 0) > .1) { const d = unit(input.x || 0, input.z || 0); player.fx = d.x; player.fz = d.z; }
        if (input.action && attack <= 0) {
          combo = sinceStrike < .9 ? combo % 3 + 1 : 1; sinceStrike = 0; attack = combo === 3 ? .52 : .32; swing = .22;
          const damageValue = 1 + (combo === 3 ? 1 : 0) + (level >= 3 ? 1 : 0);
          for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i], d = unit(e.x - player.x, e.z - player.z);
            if (dist(e, player) < 2.5 && d.x * player.fx + d.z * player.fz > -.2) {
              e.hp -= damageValue; e.x = clamp(e.x + d.x * .85, -7.5, 7.5); e.z = clamp(e.z + d.z * .85, -7.5, 7.5); e.state = 'stun'; e.timer = .38; s.score += 20;
              if (e.hp <= 0) killEnemy(i); else fx.burst(e.x, e.z, C.gold, 3);
            }
          }
          const bossDirection = boss && unit(boss.x - player.x, boss.z - player.z);
          if (boss && dist(boss, player) < 3.15 && bossDirection.x * player.fx + bossDirection.z * player.fz > -.2) {
            boss.hp -= damageValue; s.score += 45; fx.burst(boss.x, boss.z, C.gold, 4);
            if (boss.hp <= 0) { kills++; xp += 150; s.score += 1800; s.progress = 16; s.finish(true, `Guardião vencido com ${xp} XP de combate! Fragmento de Dungeon Fighter conquistado.`); return; }
          }
        }
        for (const e of enemies) {
          e.timer -= dt;
          if (e.state === 'walk') {
            const d = unit(player.x - e.x, player.z - e.z);
            e.x += d.x * e.speed * dt; e.z += d.z * e.speed * dt;
            if (dist(e, player) < 1.6 && e.timer <= 0) { e.state = 'tell'; e.timer = .6; e.aimX = player.x; e.aimZ = player.z; }
          } else if (e.state === 'tell' && e.timer <= 0) {
            if (Math.hypot(player.x - e.aimX, player.z - e.aimZ) < 1.25 && dist(e, player) < 2.1) damage();
            e.state = 'rest'; e.timer = .9;
          } else if ((e.state === 'rest' || e.state === 'stun') && e.timer <= 0) { e.state = 'walk'; e.timer = .3; }
        }
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
          const a = enemies[i], b = enemies[j], distance = dist(a, b);
          if (distance < 1 && distance > .001) { const d = unit(a.x - b.x, a.z - b.z), push = dt * .8; a.x += d.x * push; a.z += d.z * push; b.x -= d.x * push; b.z -= d.z * push; }
        }
        for (let i = heals.length - 1; i >= 0; i--) if (dist(heals[i], player) < .9) { s.lives = Math.min(6, s.lives + 1); s.score += 20; fx.burst(heals[i].x, heals[i].z, C.green); heals.splice(i, 1); }
        if (!enemies.length && !boss) {
          if (waveWait === 0) waveWait = 1.7;
          waveWait -= dt;
          if (waveWait <= 0) {
            waveWait = 0;
            if (wave < 3) { wave++; spawnWave(); }
            else boss = { x: 0, z: -5, hp: 24, state: 'walk', timer: 1.3, shock: 3.5, aimX: 0, aimZ: 0 };
          }
        }
        if (boss) {
          boss.timer -= dt; boss.shock -= dt;
          if (boss.state === 'walk') {
            const d = unit(player.x - boss.x, player.z - boss.z);
            boss.x += d.x * dt * (boss.hp < 12 ? 1.65 : 1.2); boss.z += d.z * dt * (boss.hp < 12 ? 1.65 : 1.2);
            if (dist(boss, player) < 3.25 && boss.timer <= 0) { boss.state = 'tell'; boss.timer = .82; boss.aimX = player.x; boss.aimZ = player.z; }
          } else if (boss.state === 'tell' && boss.timer <= 0) {
            if (Math.hypot(player.x - boss.aimX, player.z - boss.aimZ) < 2) damage();
            fx.burst(boss.aimX, boss.aimZ, C.red); boss.state = 'rest'; boss.timer = 1.1;
          } else if (boss.state === 'rest' && boss.timer <= 0) { boss.state = 'walk'; boss.timer = .4; }
          if (boss.shock <= 0) { boss.shock = 5; blasts.push({ x: boss.x, z: boss.z, r: 0, life: 2.6 }); }
        }
        for (let i = blasts.length - 1; i >= 0; i--) {
          const b = blasts[i]; b.life -= dt; b.r += dt * 4;
          if (Math.abs(dist(player, b) - b.r) < .45) damage();
          if (b.life <= 0) blasts.splice(i, 1);
        }
        s.progress = kills;
        if (!s.done) s.message = `${boss ? `GUARDIÃO ${Math.max(0, boss.hp)}/24 · Fuja dos círculos vermelhos` : waveWait > 0 ? 'Próxima onda chegando…' : `ONDA ${wave}/3 · ${enemies.length} adversários`} · LV ${level} · ${xp} XP · COMBO ${combo}/3`;
      };
      s.scene = () => {
        const out = []; floor(out, 17, 17, '#201329', C.pink);
        for (let x = -7; x <= 7; x += 2) for (let z = -7; z <= 7; z += 2) out.push(box(x, -.1, z, 1.86, .08, 1.86, (x + z) % 4 ? '#33263c' : '#281c34'));
        for (const x of [-8.7, 8.7]) for (const z of [-7, -2, 3, 7]) { out.push(box(x, 1.8, z, .75, 3.8, .9, '#342440'), sphere(x, 3.9, z, .35, C.pink)); }
        robot(out, player.x, player.z, invul > 0 && Math.floor(t * 11) % 2 ? C.white : skin, .85, Math.atan2(player.fx, player.fz));
        if (swing > 0) {
          const angle = Math.atan2(player.fx, player.fz) + (1 - swing / .22) * 1.2 - .6;
          out.push(box(player.x + Math.sin(angle) * 1.3, .9, player.z + Math.cos(angle) * 1.3, .24, .24, 2.5, combo === 3 ? C.gold : C.cyan, angle));
          ring(out, player.x, player.z, 1.9, combo === 3 ? C.gold : C.cyan, .14, 10);
        }
        for (const e of enemies) {
          robot(out, e.x, e.z, e.state === 'stun' ? C.white : e.color, .82);
          for (let i = 0; i < e.hp; i++) out.push(box(e.x - .35 + i * .35, 2.1, e.z, .23, .11, .16, C.red));
          if (e.state === 'tell') ring(out, e.aimX, e.aimZ, 1.25, C.red);
        }
        if (boss) {
          robot(out, boss.x, boss.z, boss.state === 'tell' ? C.red : C.purple, 1.65, 0, true);
          if (boss.state === 'tell') ring(out, boss.aimX, boss.aimZ, 2, C.red);
          for (let i = 0; i < boss.hp; i++) out.push(box(-5.7 + i * .5, .16, -8.1, .36, .15, .28, C.gold));
        }
        for (const h of heals) { out.push(sphere(h.x, .7 + Math.sin(t * 3) * .15, h.z, .65, C.green)); ring(out, h.x, h.z, .6, C.green, .02, 8); }
        for (const b of blasts) ring(out, b.x, b.z, b.r, C.red, .28, 30);
        fx.draw(out); return out;
      };
      s.debug = () => ({ wave, waveWait, player: { ...player }, enemies: enemies.map(e => ({ ...e })), boss: boss && { ...boss }, kills, xp, level, combo, heals: heals.map(h => ({ ...h })), blasts: blasts.map(b => ({ ...b })) });
      s.message = 'ONDA 1/3 · Ataque na direção em que estiver andando.';
      return s;
    }
  };

  games[8] = {
    name: 'Cyber Arena',
    description: 'Dispute um duelo de rebotes contra a defesa da arena. Mude o ângulo da bola pelas pontas da raquete e use energia para acelerar o ataque.',
    controls: 'WASD / setas: mover raquete · ESPAÇO: sacar · Segure ESPAÇO no rebote para consumir energia e dar um tiro carregado.',
    objective: 'Marque 5 gols antes da defesa da arena.',
    actionLabel: 'SACAR / CARGA',
    camera: { eye: [0, 19, 18], target: [0, 0, 0], fov: 45 },
    create({ skin = C.cyan } = {}) {
      const s = session(5, 5), fx = effects(), player = { x: 0, z: 7.8, w: 3, d: .58 }, ai = { x: 0, z: -8, w: 2.5, d: .58 }, ball = { x: 0, z: 6.8, vx: 0, vz: 0 };
      let t = 0, playerGoals = 0, aiGoals = 0, ready = true, serveDelay = 0, energy = 100, empowered = 0, aiWide = 0, playerWide = 0, itemTime = 6, item = null, lastHit = 'player', rally = 0;
      function goal(playerWon) {
        if (playerWon) { playerGoals++; s.score += 300; fx.burst(ball.x, -9.5, C.gold, 20); }
        else { aiGoals++; fx.burst(ball.x, 9.5, C.red, 15); }
        s.lives = 5 - aiGoals; s.progress = playerGoals; energy = Math.min(100, energy + 20);
        if (playerGoals >= 5) { s.score += 1000; s.finish(true, `Vitória por 5 a ${aiGoals}! Fragmento de Cyber Arena conquistado.`); }
        else if (aiGoals >= 5) s.finish(false, `A defesa venceu por 5 a ${playerGoals}. Acerte a bola pelas pontas da raquete para abrir os ângulos.`);
        else { ready = true; serveDelay = .65; ball.vx = 0; ball.vz = 0; rally = 0; item = null; }
      }
      s.update = (dt, input) => {
        if (s.done) return;
        dt = clamp(dt, 0, .05); t += dt; fx.update(dt); empowered = Math.max(0, empowered - dt); playerWide = Math.max(0, playerWide - dt); aiWide = Math.max(0, aiWide - dt); serveDelay -= dt;
        energy = Math.min(100, energy + dt * 5);
        player.w = playerWide > 0 ? 4.4 : 3; ai.w = aiWide > 0 ? 3.6 : 2.5;
        player.x = clamp(player.x + (input.x || 0) * dt * 8.6, -7.5 + player.w / 2, 7.5 - player.w / 2);
        player.z = clamp(player.z + (input.z || 0) * dt * 3, 6.5, 8.25);
        const aim = ready ? 0 : ball.x + Math.sin(t * 2.2) * .5;
        const aiSpeed = ball.vz < 0 ? 4.4 : 2.2;
        ai.x = clamp(ai.x + clamp(aim - ai.x, -dt * aiSpeed, dt * aiSpeed), -7.5 + ai.w / 2, 7.5 - ai.w / 2);
        if (ready) {
          ball.x = player.x; ball.z = player.z - .9;
          if (input.action && serveDelay <= 0) { ready = false; ball.vx = (player.x >= 0 ? -1 : 1) * 2.6; ball.vz = -7.7; lastHit = 'player'; }
        } else {
          ball.x += ball.vx * dt; ball.z += ball.vz * dt;
          if (Math.abs(ball.x) > 7.2) { ball.x = clamp(ball.x, -7.2, 7.2); ball.vx = -ball.vx; }
          if (ball.vz > 0 && hitBox(ball, player, .29)) {
            ball.z = player.z - .64;
            let speed = Math.min(12.5, Math.hypot(ball.vx, ball.vz) + .25);
            if (input.action && energy >= 30) { speed = Math.min(14.5, speed * 1.3); energy -= 30; empowered = 2; fx.burst(ball.x, ball.z, C.cyan, 5); }
            ball.vx = clamp((ball.x - player.x) / (player.w / 2) * speed * .87 + (input.x || 0) * 1.1, -speed * .91, speed * .91);
            ball.vz = -Math.sqrt(Math.max(10, speed * speed - ball.vx * ball.vx));
            lastHit = 'player'; rally++; s.score += 10; energy = Math.min(100, energy + 6);
          }
          if (ball.vz < 0 && hitBox(ball, ai, .29)) {
            ball.z = ai.z + .64;
            const speed = Math.min(12, Math.hypot(ball.vx, ball.vz) + .1);
            ball.vx = (ball.x - ai.x) / (ai.w / 2) * speed * .55 + Math.sin(t * 1.3) * 1.2;
            ball.vx = clamp(ball.vx, -speed * .85, speed * .85);
            ball.vz = Math.sqrt(Math.max(10, speed * speed - ball.vx * ball.vx)); lastHit = 'ai'; empowered = 0;
          }
          if (ball.z < -10) { goal(true); if (s.done) return; }
          else if (ball.z > 10) { goal(false); if (s.done) return; }
          itemTime -= dt;
          if (itemTime <= 0 && !item) { itemTime = 8; item = { x: rand(-4.5, 4.5), z: rand(-2, 2), life: 8 }; }
          if (item) {
            item.life -= dt;
            if (dist(item, ball) < .85) { if (lastHit === 'player') { playerWide = 6; energy = Math.min(100, energy + 25); s.score += 50; } else aiWide = 4; fx.burst(item.x, item.z, C.gold); item = null; }
            else if (item.life <= 0) item = null;
          }
        }
        if (!s.done) s.message = `${playerGoals} × ${aiGoals} · ENERGIA ${Math.floor(energy)}% · ${ready ? 'ESPAÇO: sacar' : playerWide > 0 ? 'RAQUETE AMPLIADA: bônus coletado' : empowered > 0 ? 'REBOTE CARREGADO!' : `${rally} rebotes · Acerte pelas pontas para mudar o ângulo`}`;
      };
      s.scene = () => {
        const out = []; floor(out, 16, 21, '#081f2c', C.cyan); grid(out, 16, 21, 2, '#13404b');
        for (let x = -7; x < 8; x += 1) out.push(box(x, -.08, 0, .42, .07, .12, C.cyan));
        for (const z of [-10.4, 10.4]) {
          out.push(box(-7.8, 1.5, z, .25, 3.2, .25, z < 0 ? C.pink : C.cyan), box(7.8, 1.5, z, .25, 3.2, .25, z < 0 ? C.pink : C.cyan), box(0, 3, z, 15.8, .2, .25, z < 0 ? C.pink : C.cyan));
        }
        for (const x of [-8.7, 8.7]) for (let z = -8; z <= 8; z += 4) { out.push(box(x, .9, z, .55, 2, .6, '#213b50'), sphere(x, 2.2 + Math.sin(t * 2 + z) * .12, z, .42, C.purple)); }
        out.push(box(player.x, .55, player.z, player.w, .65, .7, skin), box(player.x, .95, player.z, player.w * .75, .18, .4, inputGlow()));
        out.push(box(ai.x, .55, ai.z, ai.w, .65, .7, C.pink), box(ai.x, .95, ai.z, ai.w * .75, .18, .4, C.white));
        out.push(sphere(ball.x, .7, ball.z, empowered > 0 ? .82 : .62, empowered > 0 ? C.cyan : C.white));
        if (empowered > 0) out.push(box(ball.x, .7, ball.z + .8, .28, .28, 1, C.purple));
        if (item) { out.push(sphere(item.x, .75 + Math.sin(t * 3) * .18, item.z, 1, C.gold)); ring(out, item.x, item.z, .9, C.gold, .08, 12); }
        for (let i = 0; i < 5; i++) {
          out.push(box(-5.8 + i * .8, .22, 10, .55, .22, .35, i < playerGoals ? C.gold : '#284459'));
          out.push(box(2.6 + i * .8, .22, -10, .55, .22, .35, i < aiGoals ? C.pink : '#284459'));
        }
        for (let i = 0; i < 10; i++) out.push(box(-3.15 + i * .7, .11, 9.3, .52, .13, .3, energy >= (i + 1) * 10 ? C.cyan : '#193445'));
        fx.draw(out); return out;
      };
      function inputGlow() { return empowered > 0 ? C.gold : C.white; }
      s.debug = () => ({ player: { ...player }, ai: { ...ai }, ball: { ...ball }, playerGoals, aiGoals, ready, energy, rally, item: item && { ...item }, empowered, playerWide });
      s.message = '0 × 0 · Primeiro a 5 · ESPAÇO: sacar.';
      return s;
    }
  };

  // O desafio final reúne tiro, travessia com coleta e um combate corpo a corpo.
  games[9] = {
    name: 'King of Pixels',
    description: 'Entre no trono com seus nove fragmentos. Supere os sentinelas, reúna seis cristais sob as lâminas e enfrente o monarca digital.',
    controls: 'WASD / setas: mover · ESPAÇO: disparar na prova 1; toque para dar dash na prova 2; segure para atacar na prova 3.',
    objective: 'Complete as três provas: 8 sentinelas, 6 cristais e o monarca.',
    actionLabel: 'ATACAR / DASH',
    camera: { eye: [0, 19, 18], target: [0, .4, 0], fov: 45 },
    create({ skin = C.gold } = {}) {
      const s = session(5, 32), fx = effects(), player = { x: 0, z: 6, fx: 0, fz: -1 };
      let t = 0, phase = 1, phaseTime = 0, fire = 0, enemyFire = 1, invul = 0, sentinels = 0, collected = 0, dash = 0, dashCooldown = 0, swing = 0, boss = null;
      const shots = [], hostile = [], enemies = [], crystals = [], blades = [];
      for (let i = 0; i < 8; i++) {
        const base = (i % 4 - 1.5) * 3, shift = Math.floor(i / 4) * .9;
        enemies.push({ base, x: base + Math.sin(shift) * 1.6, z: -6.8 + Math.floor(i / 4) * 2.5, hp: 2, phase: shift });
      }
      function nextPhase() {
        phase++; phaseTime = 0; player.x = 0; player.z = 6; shots.length = 0; hostile.length = 0; fire = .5; invul = 1.5; s.lives = Math.min(6, s.lives + 1);
        if (phase === 2) {
          for (const [x, z] of [[-5, -5], [5, -5], [0, -6.5], [-5, 3], [5, 3], [0, 0]]) crystals.push({ x, z });
          for (let i = 0; i < 3; i++) blades.push({ x: 0, z: -4 + i * 4, shift: i * 2.1 });
        } else if (phase === 3) { blades.length = 0; boss = { x: 0, z: -4.8, hp: 18, state: 'walk', timer: .9, fire: 2.5, aimX: 0, aimZ: 0 }; }
      }
      function damage() {
        if (invul > 0 || dash > 0 || s.done) return;
        s.lives--; invul = 1.4; fx.burst(player.x, player.z, C.red, 12);
        if (s.lives <= 0) s.finish(false, `O trono resistiu na prova ${phase}/3. Leia os ataques anunciados e tente novamente.`);
      }
      s.update = (dt, input) => {
        if (s.done) return;
        dt = clamp(dt, 0, .05); t += dt; phaseTime += dt; fx.update(dt); fire -= dt; invul = Math.max(0, invul - dt); dashCooldown = Math.max(0, dashCooldown - dt); dash = Math.max(0, dash - dt); swing = Math.max(0, swing - dt);
        if (Math.hypot(input.x || 0, input.z || 0) > .1) { const d = unit(input.x || 0, input.z || 0); player.fx = d.x; player.fz = d.z; }
        if (phase === 2 && input.actionPressed && dashCooldown <= 0) { dash = .22; dashCooldown = 1.7; }
        motion(player, dt, input, phase === 1 ? 6 : 5.3, -7.3, 7.3, phase === 1 ? 1.5 : -7.3, 7.5);
        if (dash > 0) { player.x = clamp(player.x + player.fx * dt * 10, -7.3, 7.3); player.z = clamp(player.z + player.fz * dt * 10, -7.3, 7.5); }
        if (phase === 1) {
          if (input.action && fire <= 0) { fire = .18; shots.push({ x: player.x, z: player.z - .9 }); }
          for (const e of enemies) e.x = e.base + Math.sin(t * .9 + e.phase) * 1.6;
          enemyFire -= dt;
          if (enemyFire <= 0 && enemies.length) {
            enemyFire = .72;
            const e = enemies[Math.floor(Math.random() * enemies.length)], d = unit(player.x - e.x, player.z - e.z);
            hostile.push({ x: e.x, z: e.z + .7, vx: d.x * 5.3, vz: d.z * 5.3 });
          }
          for (let i = shots.length - 1; i >= 0; i--) {
            const b = shots[i]; b.z -= dt * 16; let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
              const e = enemies[j];
              if (Math.abs(b.x - e.x) < .85 && Math.abs(b.z - e.z) < .8) {
                e.hp--; s.score += 50; hit = true;
                if (e.hp <= 0) { enemies.splice(j, 1); sentinels++; s.score += 200; fx.burst(e.x, e.z, C.purple, 10); }
                break;
              }
            }
            if (hit || b.z < -11) shots.splice(i, 1);
          }
          if (!enemies.length) nextPhase();
        } else if (phase === 2) {
          for (const b of blades) b.x = Math.sin(phaseTime * 1.5 + b.shift) * 6.5;
          for (const b of blades) if (Math.abs(player.x - b.x) < 1 && Math.abs(player.z - b.z) < .65) damage();
          for (let i = crystals.length - 1; i >= 0; i--) {
            if (dist(player, crystals[i]) < .92) { fx.burst(crystals[i].x, crystals[i].z, C.gold); crystals.splice(i, 1); collected++; s.score += 200; }
          }
          if (!crystals.length) nextPhase();
        } else {
          if (input.action && fire <= 0) {
            fire = .38; swing = .22;
            if (dist(player, boss) < 3.2) {
              boss.hp -= boss.state === 'rest' ? 2 : 1; boss.hp = Math.max(0, boss.hp); s.score += 80; fx.burst(boss.x, boss.z, C.gold, 4);
              if (boss.hp <= 0) { s.score += 3000; s.progress = 32; s.finish(true, 'O monarca caiu. As três provas foram vencidas: você é o REI DOS PIXELS!'); return; }
            }
          }
          boss.timer -= dt; boss.fire -= dt;
          if (boss.state === 'walk') {
            const d = unit(player.x - boss.x, player.z - boss.z);
            boss.x += d.x * dt * (boss.hp < 8 ? 1.7 : 1.3); boss.z += d.z * dt * (boss.hp < 8 ? 1.7 : 1.3);
            if (dist(player, boss) < 3.7 && boss.timer <= 0) { boss.state = 'tell'; boss.timer = .78; boss.aimX = player.x; boss.aimZ = player.z; }
          } else if (boss.state === 'tell' && boss.timer <= 0) {
            if (Math.hypot(player.x - boss.aimX, player.z - boss.aimZ) < 2.25) damage();
            fx.burst(boss.aimX, boss.aimZ, C.red, 14); boss.state = 'rest'; boss.timer = 1.1;
          } else if (boss.state === 'rest' && boss.timer <= 0) { boss.state = 'walk'; boss.timer = .35; }
          if (boss.fire <= 0) {
            boss.fire = 3.3;
            const a = Math.atan2(player.x - boss.x, player.z - boss.z);
            for (const offset of [-.36, 0, .36]) hostile.push({ x: boss.x, z: boss.z, vx: Math.sin(a + offset) * 5.1, vz: Math.cos(a + offset) * 5.1 });
          }
        }
        for (let i = hostile.length - 1; i >= 0; i--) {
          const b = hostile[i]; b.x += b.vx * dt; b.z += b.vz * dt;
          if (dist(player, b) < .65) { hostile.splice(i, 1); damage(); }
          else if (Math.abs(b.x) > 10 || Math.abs(b.z) > 11) hostile.splice(i, 1);
        }
        s.progress = sentinels + collected + (boss ? 18 - boss.hp : 0);
        if (!s.done) s.message = phase === 1 ? `PROVA 1/3 · ${sentinels}/8 sentinelas · Segure ESPAÇO para disparar` : phase === 2 ? `PROVA 2/3 · ${collected}/6 cristais · ${dashCooldown > 0 ? `Dash em ${dashCooldown.toFixed(1)}s` : 'ESPAÇO: dash na direção do movimento'}` : `PROVA 3/3 · MONARCA ${boss.hp}/18 · ${boss.state === 'tell' ? 'SAIA DO CÍRCULO VERMELHO!' : boss.state === 'rest' ? 'CONTRA-ATAQUE! Dano dobrado.' : 'Aproxime-se e segure ESPAÇO'}`;
      };
      s.scene = () => {
        const out = []; floor(out, 17, 18, '#201626', C.gold); grid(out, 17, 18, 2, '#453440');
        out.push(box(0, -.08, 0, 3.2, .09, 16, '#552647'));
        for (const x of [-8.4, 8.4]) for (const z of [-8, -3, 2, 7]) {
          out.push(box(x, 1.9, z, .75, 4, .85, '#3b294c'), box(x, 4, z, 1.15, .3, 1.2, C.gold), sphere(x, 4.4, z, .5, C.purple));
        }
        out.push(box(0, .5, -9.2, 4.6, 1, 1.2, '#4b2c54'), box(0, 1.5, -9.6, 3.2, 2.2, .5, C.gold));
        for (let i = -1; i <= 1; i++) out.push(box(i * 1.1, 2.9, -9.6, .42, .75, .45, C.gold));
        if (phase === 1) ship(out, player.x, player.z, invul > 0 ? C.white : skin);
        else robot(out, player.x, player.z, invul > 0 && Math.floor(t * 11) % 2 ? C.white : skin, .9, Math.atan2(player.fx, player.fz), true);
        for (const e of enemies) ship(out, e.x, e.z, e.hp === 2 ? C.purple : C.pink, .95, true);
        for (const b of shots) out.push(box(b.x, .7, b.z, .18, .2, .6, C.gold));
        for (const b of hostile) out.push(sphere(b.x, .75, b.z, .45, C.red));
        for (const c of crystals) { out.push(box(c.x, 1 + Math.sin(t * 3 + c.x) * .18, c.z, .75, 1.2, .75, C.gold, t)); ring(out, c.x, c.z, .85, C.gold, .06, 10); }
        for (const b of blades) {
          out.push(box(0, -.02, b.z, 14.5, .08, .14, '#722c50'));
          out.push(box(b.x, .63, b.z, 2, .35, .35, C.red, t * 5), box(b.x, .63, b.z, .35, .35, 2, C.red, t * 5), sphere(b.x, .65, b.z, .65, C.white));
        }
        if (dash > 0) ring(out, player.x, player.z, 1.2, C.cyan, .15, 12);
        if (boss) {
          robot(out, boss.x, boss.z, boss.state === 'tell' ? C.red : boss.state === 'rest' ? C.pink : C.purple, 1.8, 0, true);
          out.push(box(boss.x - 1.3, 1.8, boss.z, .35, .35, 3.3, C.gold, -.3));
          if (boss.state === 'tell') ring(out, boss.aimX, boss.aimZ, 2.25, C.red, .11, 24);
          for (let i = 0; i < boss.hp; i++) out.push(box(-5.1 + i * .6, .15, -8.4, .45, .18, .3, C.gold));
        }
        if (swing > 0) { const a = Math.atan2(player.fx, player.fz) + (1 - swing / .22) * 1.6 - .8; out.push(box(player.x + Math.sin(a) * 1.4, 1, player.z + Math.cos(a) * 1.4, .27, .27, 2.8, C.gold, a)); }
        fx.draw(out); return out;
      };
      s.debug = () => ({ phase, phaseTime, player: { ...player }, enemies: enemies.map(e => ({ ...e })), shots: shots.map(b => ({ ...b })), hostile: hostile.map(b => ({ ...b })), crystals: crystals.map(c => ({ ...c })), blades: blades.map(b => ({ ...b })), boss: boss && { ...boss }, sentinels, collected, dashCooldown });
      s.message = 'PROVA 1/3 · Derrube os oito sentinelas do trono.';
      return s;
    }
  };
})();
