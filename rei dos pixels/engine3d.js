/* Rei dos Pixels — renderizador WebGL 3D e ciclo de vida compartilhado. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalize = a => { const length = Math.hypot(...a) || 1; return a.map(v => v / length); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((total, value, i) => total + value * b[i], 0);

  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), inverse = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * inverse, -1, 0, 0, 2 * far * near * inverse, 0]);
  }
  function lookAt(eye, target) {
    const back = normalize(eye.map((v, i) => v - target[i]));
    const right = normalize(cross([0, 1, 0], back)), up = cross(back, right);
    return new Float32Array([right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0, -dot(right, eye), -dot(up, eye), -dot(back, eye), 1]);
  }
  const colors = new Map();
  function colorRGB(color) {
    if (Array.isArray(color)) return color.map(v => v > 1 ? v / 255 : v).slice(0, 3);
    const key = String(color || '#00f5ff');
    if (colors.has(key)) return colors.get(key);
    let result;
    if (/^#[0-9a-f]{3}$/i.test(key)) result = [...key.slice(1)].map(v => parseInt(v + v, 16) / 255);
    else if (/^#[0-9a-f]{6,8}$/i.test(key)) result = [1, 3, 5].map(i => parseInt(key.slice(i, i + 2), 16) / 255);
    else if (/^rgba?\(/.test(key)) result = (key.match(/[\d.]+/g) || []).slice(0, 3).map(v => Number(v) / 255);
    else result = ({ white: [1, 1, 1], black: [0, 0, 0], red: [1, 0, 0], cyan: [0, 1, 1], gold: [1, .84, 0], green: [.2, 1, .1] })[key] || [0, .96, 1];
    colors.set(key, result); return result;
  }

  class NeonRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { alpha: false, antialias: true, depth: true, preserveDrawingBuffer: true });
      if (!this.gl) throw new Error('Este navegador não disponibilizou WebGL. Ative a aceleração gráfica ou abra o site em um navegador com WebGL para jogar em 3D.');
      this.lost = false; this.disposed = false; this.objectCount = 0;
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; if (runtime.id !== null) showError('A conexão com a placa gráfica foi interrompida. Recarregue a página para voltar ao arcade.'); });
      this.initialize();
    }
    initialize() {
      const gl = this.gl;
      this.instancing = gl.getExtension('ANGLE_instanced_arrays');
      const vertex = `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute vec3 aInstancePosition;
        attribute vec3 aInstanceSize;
        attribute vec3 aInstanceColor;
        attribute vec3 aInstanceParams;
        uniform mat4 uProjection;
        uniform mat4 uView;
        uniform vec3 uPosition;
        uniform vec3 uSize;
        uniform float uRotation;
        uniform vec3 uColor;
        uniform float uGlow;
        uniform float uFlat;
        uniform float uInstanced;
        varying vec3 vNormal;
        varying vec3 vWorld;
        varying vec3 vColor;
        varying float vGlow;
        varying float vFlat;
        void main() {
          vec3 size = mix(uSize, aInstanceSize, uInstanced);
          vec3 position = mix(uPosition, aInstancePosition, uInstanced);
          float angle = mix(uRotation, aInstanceParams.x, uInstanced);
          vColor = mix(uColor, aInstanceColor, uInstanced);
          vGlow = mix(uGlow, aInstanceParams.y, uInstanced);
          vFlat = mix(uFlat, aInstanceParams.z, uInstanced);
          float c = cos(angle), s = sin(angle);
          mat3 rotation = mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
          vWorld = rotation * (aPosition * size) + position;
          vNormal = normalize(rotation * (aNormal / max(size, vec3(0.001))));
          gl_Position = uProjection * uView * vec4(vWorld, 1.0);
        }`;
      const fragment = `
        precision mediump float;
        uniform vec3 uEye;
        varying vec3 vNormal;
        varying vec3 vWorld;
        varying vec3 vColor;
        varying float vGlow;
        varying float vFlat;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 light = normalize(vec3(-0.4, 1.0, 0.5));
          vec3 viewDirection = normalize(uEye - vWorld);
          float diffuse = max(dot(normal, light), 0.0);
          float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
          float specular = pow(max(dot(normal, normalize(light + viewDirection)), 0.0), 28.0);
          vec3 material = vColor * (0.33 + 0.66 * diffuse + vGlow * 0.2);
          material += vec3(0.3, 0.45, 0.6) * specular * 0.24 + vColor * rim * 0.18;
          material = mix(material, vColor, vFlat);
          float fog = clamp(1.0 - exp(-length(uEye - vWorld) * 0.009), 0.0, 0.65);
          gl_FragColor = vec4(mix(material, vec3(0.018, 0.023, 0.065), fog), 1.0);
        }`;
      const compile = (type, source) => {
        const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error('Erro ao preparar o renderizador 3D: ' + error); }
        return shader;
      };
      const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
      this.program = gl.createProgram(); gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('O navegador não conseguiu inicializar o programa gráfico 3D.');
      this.attributes = { position: gl.getAttribLocation(this.program, 'aPosition'), normal: gl.getAttribLocation(this.program, 'aNormal') };
      this.instanceAttributes = ['Position', 'Size', 'Color', 'Params'].map(name => gl.getAttribLocation(this.program, 'aInstance' + name));
      this.instanceBuffer = gl.createBuffer();
      this.uniforms = {};
      ['Projection', 'View', 'Position', 'Size', 'Rotation', 'Color', 'Eye', 'Glow', 'Flat', 'Instanced'].forEach(name => this.uniforms[name] = gl.getUniformLocation(this.program, 'u' + name));
      this.cube = this.makeCube(); this.sphere = this.makeSphere(); this.edges = this.makeEdges();
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.clearColor(.018, .023, .065, 1);
    }
    makeMesh(vertices, normals, indices, mode) {
      const gl = this.gl;
      const upload = (target, data) => { const buffer = gl.createBuffer(); gl.bindBuffer(target, buffer); gl.bufferData(target, data, gl.STATIC_DRAW); return buffer; };
      return { positions: upload(gl.ARRAY_BUFFER, new Float32Array(vertices)), normals: upload(gl.ARRAY_BUFFER, new Float32Array(normals)), indices: upload(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices)), count: indices.length, mode: mode || gl.TRIANGLES };
    }
    makeCube() {
      const p = [], n = [], indices = [];
      const faces = [
        [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5], [0, 0, 1]],
        [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5], [0, 0, -1]],
        [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5], [0, 1, 0]],
        [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [0, -1, 0]],
        [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [1, 0, 0]],
        [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], [-1, 0, 0]]
      ];
      faces.forEach((face, index) => { face.slice(0, 4).forEach(vertex => { p.push(...vertex); n.push(...face[4]); }); const start = index * 4; indices.push(start, start + 1, start + 2, start, start + 2, start + 3); });
      return this.makeMesh(p, n, indices);
    }
    makeSphere() {
      const p = [], n = [], indices = [], rows = 14, columns = 20;
      for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
        const phi = row / rows * Math.PI, theta = col / columns * Math.PI * 2;
        const normal = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
        p.push(...normal.map(v => v * .5)); n.push(...normal);
      }
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
      return this.makeMesh(p, n, indices);
    }
    makeEdges() {
      const p = [-.5, -.5, -.5, .5, -.5, -.5, .5, .5, -.5, -.5, .5, -.5, -.5, -.5, .5, .5, -.5, .5, .5, .5, .5, -.5, .5, .5];
      const indices = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
      return this.makeMesh(p, p.map((v, i) => i % 3 === 1 ? 1 : 0), indices, this.gl.LINES);
    }
    bind(mesh) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions); gl.enableVertexAttribArray(this.attributes.position); gl.vertexAttribPointer(this.attributes.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals); gl.enableVertexAttribArray(this.attributes.normal); gl.vertexAttribPointer(this.attributes.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    }
    object(object, outline = false) {
      const gl = this.gl, u = this.uniforms;
      gl.uniform1f(u.Instanced, 0);
      const dimensions = [Math.max(.003, finite(object.w, 1)), Math.max(.003, finite(object.h, 1)), Math.max(.003, finite(object.d, 1))];
      const color = colorRGB(object.color);
      gl.uniform3fv(u.Position, [finite(object.x), finite(object.y, .5), finite(object.z)]);
      gl.uniform3fv(u.Size, dimensions); gl.uniform1f(u.Rotation, finite(object.rotation));
      gl.uniform3fv(u.Color, color); gl.uniform1f(u.Glow, Math.max(...color) - Math.min(...color)); gl.uniform1f(u.Flat, object.emissive ? .6 : 0);
      const mesh = object.shape === 'sphere' ? this.sphere : this.cube;
      this.bind(mesh); gl.drawElements(mesh.mode, mesh.count, gl.UNSIGNED_SHORT, 0); this.drawCalls++;
      if (outline && object.shape !== 'sphere' && dimensions[1] > .17 && Math.max(...dimensions) < 9) {
        gl.uniform3fv(u.Size, dimensions.map(v => v * 1.003)); gl.uniform3fv(u.Color, color.map(v => Math.min(1, v * 1.2 + .07))); gl.uniform1f(u.Flat, .85);
        this.bind(this.edges); gl.drawElements(gl.LINES, this.edges.count, gl.UNSIGNED_SHORT, 0); this.drawCalls++;
      }
    }
    batch(objects, mesh, outline = false) {
      if (!objects.length) return;
      const gl = this.gl, data = new Float32Array(objects.length * 12);
      objects.forEach((object, i) => {
        const color = colorRGB(object.color), factor = outline ? 1.003 : 1, offset = i * 12;
        data.set([finite(object.x), finite(object.y, .5), finite(object.z),
          Math.max(.003, finite(object.w, 1)) * factor, Math.max(.003, finite(object.h, 1)) * factor, Math.max(.003, finite(object.d, 1)) * factor,
          ...color.map(v => outline ? Math.min(1, v * 1.2 + .07) : v),
          finite(object.rotation), Math.max(...color) - Math.min(...color), outline ? .85 : object.emissive ? .6 : 0], offset);
      });
      this.bind(mesh); gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      this.instanceAttributes.forEach((attribute, i) => {
        gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 48, i * 12); this.instancing.vertexAttribDivisorANGLE(attribute, 1);
      });
      gl.uniform1f(this.uniforms.Instanced, 1);
      this.instancing.drawElementsInstancedANGLE(mesh.mode, mesh.count, gl.UNSIGNED_SHORT, 0, objects.length); this.drawCalls++;
    }
    render(objects = [], camera = {}) {
      if (this.lost || this.disposed) return;
      const gl = this.gl, u = this.uniforms;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
      const eye = camera.eye || [0, 20, 20], target = camera.target || [0, 0, 0];
      gl.uniformMatrix4fv(u.Projection, false, perspective(finite(camera.fov, 54) * Math.PI / 180, this.canvas.width / this.canvas.height, .1, 180));
      gl.uniformMatrix4fv(u.View, false, lookAt(eye, target)); gl.uniform3fv(u.Eye, eye);
      const safeObjects = Array.isArray(objects) ? objects.filter(Boolean) : [];
      this.objectCount = safeObjects.length; this.drawCalls = 0;
      let radius = 12;
      safeObjects.forEach(object => radius = Math.max(radius, Math.abs(finite(object.x)) + finite(object.w, 1) / 2, Math.abs(finite(object.z)) + finite(object.d, 1) / 2));
      radius = clamp(Math.ceil(radius) + 2, 14, 36);
      const environment = [{ x: 0, y: -.55, z: 0, w: radius * 2, h: .12, d: radius * 2, color: '#080d25' }];
      for (let i = -radius; i <= radius; i += 2) {
        const centerLine = i === 0;
        environment.push({ x: i, y: -.482, z: 0, w: .025, h: .014, d: radius * 2, color: centerLine ? '#16607a' : '#182d50', emissive: true });
        environment.push({ x: 0, y: -.482, z: i, w: radius * 2, h: .014, d: .025, color: centerLine ? '#51205e' : '#182d50', emissive: true });
      }
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
      if (this.instancing) {
        this.batch([...environment, ...safeObjects.filter(object => object.shape !== 'sphere')], this.cube);
        this.batch(safeObjects.filter(object => object.shape === 'sphere'), this.sphere);
        this.batch(safeObjects.filter(object => object.shape !== 'sphere' && finite(object.h, 1) > .17 && Math.max(finite(object.w, 1), finite(object.h, 1), finite(object.d, 1)) < 9), this.edges, true);
        this.instanceAttributes.forEach(attribute => { this.instancing.vertexAttribDivisorANGLE(attribute, 0); gl.disableVertexAttribArray(attribute); });
      } else { environment.forEach(object => this.object(object)); safeObjects.forEach(object => this.object(object, true)); }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      [this.cube, this.sphere, this.edges].forEach(mesh => { this.gl.deleteBuffer(mesh.positions); this.gl.deleteBuffer(mesh.normals); this.gl.deleteBuffer(mesh.indices); });
      this.gl.deleteBuffer(this.instanceBuffer);
      this.gl.deleteProgram(this.program);
    }
  }

  const runtime = { id: null, definition: null, session: null, renderer: null, phase: 'closed', elapsed: 0, countdown: 0, lastTime: 0, frame: 0, awarded: false, topView: false, error: null };
  const heldKeys = new Set(), touchKeys = new Map(), pressedKeys = new Set();
  const canonical = key => {
    const value = String(key).toLowerCase();
    if ([' ', 'space', 'spacebar'].includes(value)) return 'space';
    if (/^key[a-z]$/.test(value)) return value.slice(3);
    return value;
  };
  const keyDown = key => heldKeys.has(canonical(key)) || [...touchKeys.values()].includes(canonical(key));
  const keyPressed = key => pressedKeys.has(canonical(key));
  const anyDown = keys => keys.some(keyDown), anyPressed = keys => keys.some(keyPressed);
  const input = {
    x: 0, z: 0, action: false, actionPressed: false, upPressed: false, downPressed: false, leftPressed: false, rightPressed: false,
    pressed: keyPressed, down: keyDown
  };
  function readInput() {
    input.x = Number(anyDown(['arrowright', 'd'])) - Number(anyDown(['arrowleft', 'a']));
    input.z = Number(anyDown(['arrowdown', 's'])) - Number(anyDown(['arrowup', 'w']));
    input.action = anyDown(['space', 'enter']); input.actionPressed = anyPressed(['space', 'enter']);
    input.upPressed = anyPressed(['arrowup', 'w']); input.downPressed = anyPressed(['arrowdown', 's']);
    input.leftPressed = anyPressed(['arrowleft', 'a']); input.rightPressed = anyPressed(['arrowright', 'd']);
    return input;
  }
  function clearInput() {
    heldKeys.clear(); touchKeys.clear(); pressedKeys.clear(); readInput();
    document.querySelectorAll('[data-dir], #action').forEach(button => button.classList.remove('held'));
  }
  function setText(id, value) {
    const element = byId(id), text = String(value);
    // Preserve live-region announcements and avoid rebuilding unchanged HUD text
    // on every animation frame.
    if (element && element.textContent !== text) element.textContent = text;
  }
  function overlay(title, detail, buttonLabel) {
    const element = byId('gameOverlay'); if (element) element.hidden = false;
    window.ArcadePresentation?.show(runtime.id, runtime.phase, runtime.session?.won);
    setText('gameMessage', title); setText('gameDetail', detail || '');
    const button = byId('restart'); if (button) { button.hidden = !buttonLabel; if (buttonLabel) button.textContent = buttonLabel; }
  }
  function hideOverlay() { if (byId('gameOverlay')) byId('gameOverlay').hidden = true; }
  function showError(message) {
    runtime.phase = 'error'; runtime.error = message; clearInput();
    overlay('3D INDISPONÍVEL', message);
    if (byId('pause')) byId('pause').disabled = true;
  }
  function getRenderer() {
    if (!runtime.renderer) runtime.renderer = new NeonRenderer(byId('canvas'));
    return runtime.renderer;
  }
  function getCamera(definition = runtime.definition, top = runtime.topView) {
    const camera = definition?.camera || { eye: [0, 20, 20], target: [0, 0, 0] };
    if (!top) return camera;
    const target = camera.target || [0, 0, 0], eye = camera.eye || [0, 20, 20];
    const distance = Math.hypot(...eye.map((v, i) => v - target[i]));
    return { ...camera, eye: [target[0], target[1] + Math.max(18, distance * .96), target[2] + .1], target };
  }
  function updateHUD() {
    const session = runtime.session; if (!session) return;
    setText('score', Math.max(0, Math.floor(finite(session.score))).toLocaleString('pt-BR'));
    const best = typeof window.getArcadeBest === 'function' ? window.getArcadeBest(runtime.id) : 0;
    setText('best', Math.max(0, Math.floor(finite(best))).toLocaleString('pt-BR'));
    setText('lives', session.lives === undefined ? '—' : String(Math.max(0, Math.ceil(finite(session.lives)))));
    const target = finite(session.target), progress = finite(session.progress);
    setText('gameObjective', `${runtime.definition.objective || ''}${target > 0 ? ' · ' + Math.min(progress, target) + ' / ' + target : ''}`);
    setText('gameStatus', session.message || (runtime.phase === 'playing' ? 'PARTIDA EM ANDAMENTO' : ''));
    setText('pause', runtime.phase === 'paused' ? '▶ CONTINUAR' : 'Ⅱ PAUSAR');
    if (byId('pause')) byId('pause').disabled = !['playing', 'paused'].includes(runtime.phase);
  }
  function endRun() {
    if (runtime.awarded) return;
    runtime.awarded = true; runtime.phase = 'finished'; clearInput();
    const session = runtime.session;
    document.dispatchEvent(new CustomEvent('arcade-result', { detail: { id: runtime.id, score: Math.max(0, Math.floor(finite(session.score))), won: Boolean(session.won), duration: Math.floor(runtime.elapsed) } }));
    overlay(session.won ? 'DESAFIO CONQUISTADO!' : 'GAME OVER', session.message || `${Math.floor(finite(session.score)).toLocaleString('pt-BR')} PONTOS · ${session.won ? 'FRAGMENTO CONQUISTADO' : 'TENTE NOVAMENTE PARA CONQUISTAR O FRAGMENTO'}`, '▶ JOGAR NOVAMENTE');
    updateHUD();
  }
  function drawFrame() {
    if (runtime.session && runtime.renderer && !runtime.renderer.lost) runtime.renderer.render(runtime.session.scene(), getCamera());
  }
  function loop(now) {
    runtime.frame = 0;
    if (!byId('gameDialog')?.open || runtime.phase === 'closed') return;
    const realDelta = runtime.lastTime ? clamp((now - runtime.lastTime) / 1000, 0, 1) : 0;
    runtime.lastTime = now;
    try {
      if (runtime.phase === 'countdown' && !document.hidden) {
        runtime.countdown -= realDelta;
        if (runtime.countdown <= 0) { runtime.phase = 'playing'; clearInput(); hideOverlay(); }
        else overlay(String(Math.ceil(runtime.countdown)), 'PREPARE-SE');
      }
      if (runtime.phase === 'playing' && !document.hidden) {
        // A slow graphics frame uses several small physics steps rather than
        // stretching the game clock. Each step stays at or below 40 ms.
        let remaining = Math.min(realDelta, .2);
        do {
          const delta = Math.min(remaining, .04);
          runtime.elapsed += delta; runtime.session.update(delta, readInput());
          pressedKeys.clear(); remaining -= delta;
          if (runtime.session.done) { endRun(); break; }
        } while (remaining > .00001 && runtime.phase === 'playing');
      }
      pressedKeys.clear();
      drawFrame(); updateHUD();
    } catch (error) { console.error('Rei dos Pixels / jogo 3D', error); showError('Não foi possível continuar esta partida. Reabra a máquina para tentar novamente.'); }
    if (['playing', 'countdown'].includes(runtime.phase) && !document.hidden) runtime.frame = requestAnimationFrame(loop);
  }
  function ensureLoop() { if (!runtime.frame) { runtime.lastTime = 0; runtime.frame = requestAnimationFrame(loop); } }
  function newSession() {
    const skin = typeof window.getArcadeSkin === 'function' ? window.getArcadeSkin() : '#39ff14';
    runtime.session = runtime.definition.create({ skin });
    if (!runtime.session || typeof runtime.session.update !== 'function' || typeof runtime.session.scene !== 'function') throw new Error('Definição de jogo inválida.');
    runtime.elapsed = 0; runtime.awarded = false; runtime.error = null;
  }
  let launchGeneration=0;
  function open(id) {
    launchGeneration++;
    window.cancelArcadeRun?.();
    const definition = window.PixelGames?.[id];
    if (!definition) { showError('Esta máquina não foi carregada. Recarregue a página.'); return false; }
    cancelAnimationFrame(runtime.frame); runtime.frame = 0; clearInput();
    runtime.id = Number(id); runtime.definition = definition; runtime.phase = 'intro'; runtime.topView = false;
    const dialog = byId('gameDialog'); if (!dialog.open) dialog.showModal();
    setText('gameTitle', definition.name.toUpperCase()); setText('gameMachine', 'MÁQUINA ' + String(Number(id) + 1).padStart(2, '0') + ' · 3D');
    setText('gameControls', (definition.controls || 'WASD / SETAS para mover · ESPAÇO para ação') + ' · P para pausar');
    setText('action', definition.actionLabel || 'AÇÃO'); setText('viewToggle', '◈ VISTA AÉREA');
    try {
      const renderer = getRenderer(); renderer.canvas.width = 960; renderer.canvas.height = 600;
      newSession(); drawFrame(); updateHUD();
      overlay(window.ArcadePresentation?.ready(id) || 'PLAYER 1 READY', definition.description || definition.objective, '▶ JOGAR'); return true;
    } catch (error) { showError(error.message); return false; }
  }
  async function restart() {
    if (!runtime.definition || runtime.renderer?.lost) return;
    let generation;
    try {
      const id=runtime.id;
      if (runtime.phase==='preparing') return;
      generation=++launchGeneration;
      runtime.phase='preparing';clearInput();overlay('PREPARANDO PARTIDA','Conectando ao fliperama…');updateHUD();
      if(typeof window.prepareArcadeRun==='function')await window.prepareArcadeRun(id);
      if(!byId('gameDialog')?.open||runtime.id!==id||generation!==launchGeneration)return;
      clearInput(); newSession(); runtime.phase = 'countdown'; runtime.countdown = 3;
      overlay('3', 'PREPARE-SE'); updateHUD(); drawFrame(); ensureLoop();
    } catch (error) {if(generation!==launchGeneration)return;runtime.phase='intro';overlay('NÃO FOI POSSÍVEL INICIAR',error.message,'▶ TENTAR NOVAMENTE');updateHUD(); }
  }
  function pause() {
    if (runtime.phase === 'playing') { runtime.phase = 'paused'; cancelAnimationFrame(runtime.frame); runtime.frame = 0; clearInput(); overlay('PAUSADO', 'Pressione P ou CONTINUAR para voltar à partida.'); }
    else if (runtime.phase === 'paused') { runtime.phase = 'playing'; clearInput(); runtime.lastTime = 0; hideOverlay(); ensureLoop(); }
    updateHUD();
  }
  function stop() {
    launchGeneration++;
    window.cancelArcadeRun?.();
    cancelAnimationFrame(runtime.frame); runtime.frame = 0; runtime.phase = 'closed'; clearInput(); window.ArcadePresentation?.clear();
  }
  function close() { byId('gameDialog')?.close(); stop(); }
  function preview(id) {
    if (byId('gameDialog')?.open) return null;
    const definition = window.PixelGames?.[id]; if (!definition) return null;
    let renderer;
    try {
      renderer = getRenderer();
      const width = renderer.canvas.width, height = renderer.canvas.height;
      try {
        renderer.canvas.width = 480; renderer.canvas.height = 300;
        const session = definition.create({ skin: typeof window.getArcadeSkin === 'function' ? window.getArcadeSkin() : '#39ff14' });
        renderer.render(session.scene(), getCamera(definition, false));
        return renderer.canvas.toDataURL('image/webp', .86);
      } finally { renderer.canvas.width = width; renderer.canvas.height = height; }
    } catch (error) { console.warn('Prévia 3D indisponível:', error.message); return null; }
  }
  function snapshot() {
    return { id: runtime.id, phase: runtime.phase, score: finite(runtime.session?.score), lives: runtime.session?.lives, progress: runtime.session?.progress, target: runtime.session?.target, done: Boolean(runtime.session?.done), won: Boolean(runtime.session?.won), duration: runtime.elapsed, webgl: Boolean(runtime.renderer && !runtime.renderer.lost), objects: runtime.renderer?.objectCount || 0, drawCalls: runtime.renderer?.drawCalls || 0, instancing: Boolean(runtime.renderer?.instancing), framePending: Boolean(runtime.frame), input: { x: input.x, z: input.z, action: input.action }, error: runtime.error };
  }
  window.Arcade3D = { open, restart, pause, close, preview, snapshot, get current() { return runtime.session; }, get renderer() { return runtime.renderer; } };

  function bindControls() {
    byId('restart')?.addEventListener('click', restart); byId('pause')?.addEventListener('click', pause);
    byId('gameDialog')?.addEventListener('close', stop);
    byId('viewToggle')?.addEventListener('click', () => { runtime.topView = !runtime.topView; setText('viewToggle', runtime.topView ? '◈ VISTA PERSPECTIVA' : '◈ VISTA AÉREA'); drawFrame(); });
    const directions = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
    document.querySelectorAll('[data-dir], #action').forEach(button => {
      button.addEventListener('pointerdown', event => {
        if (runtime.phase !== 'playing') return;
        event.preventDefault(); const key = directions[button.dataset.dir] || 'space';
        touchKeys.set(event.pointerId, key); pressedKeys.add(key); button.classList.add('held'); button.setPointerCapture?.(event.pointerId);
      });
      const release = event => { touchKeys.delete(event.pointerId); button.classList.remove('held'); };
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });
  }
  document.addEventListener('keydown', event => {
    if (!byId('gameDialog')?.open || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    const key = canonical(event.key);
    const button = event.target.closest('button');
    if (button && ['space', 'enter'].includes(key) && button.id !== 'action' && !button.dataset.dir) {
      // Visible controls retain native keyboard activation. A hidden restart
      // button can retain focus after starting, so it must not restart a run.
      if (!button.hidden && button.offsetParent !== null) return;
      event.preventDefault();
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'space', 'enter', 'p'].includes(key)) event.preventDefault();
    if (key === 'p') { if (!event.repeat) pause(); return; }
    if (key === 'enter' && ['intro', 'finished'].includes(runtime.phase)) { if (!event.repeat) restart(); return; }
    if (runtime.phase !== 'playing') return;
    if (!heldKeys.has(key)) pressedKeys.add(key); heldKeys.add(key);
  });
  document.addEventListener('keyup', event => heldKeys.delete(canonical(event.key)));
  window.addEventListener('blur', () => { clearInput(); if (runtime.phase === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (runtime.phase === 'playing') pause(); } else if (runtime.phase === 'countdown') ensureLoop(); runtime.lastTime = 0; });
  window.addEventListener('pagehide', () => { stop(); runtime.renderer?.dispose(); });
  window.addEventListener('pageshow', event => {if(event.persisted&&runtime.renderer?.disposed){runtime.renderer=null;if(byId('gameDialog')?.open)open(runtime.id);}});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindControls, { once: true }); else bindControls();
})();

