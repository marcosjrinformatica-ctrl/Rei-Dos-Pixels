/* Original, softly voiced piano loop and game-specific animated emblems. */
(() => {
  'use strict';
  let context, master, timer, next = 0, step = 0, enabled = false, unlocked = false;
  const chords = [[48,55,60,64,67,72,67,64],[45,52,57,60,64,69,64,60],[41,48,53,57,60,65,60,57],[43,50,55,59,62,67,62,59]];
  function note(midi, at, strength) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    // Decaying partials recreate a rounded piano hammer and a soft sustained body.
    [1,2,3,4].forEach((partial, i) => {
      const voice = context.createOscillator(), envelope = context.createGain();
      voice.type = 'sine'; voice.frequency.value = frequency * partial;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(strength * [1,.25,.09,.025][i], at + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + 2.8 / (1 + i * .45));
      voice.connect(envelope); envelope.connect(master);
      voice.start(at); voice.stop(at + 3);
      voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
    });
  }
  function schedule() {
    if (!context || context.state !== 'running') return;
    while (next < context.currentTime + .25) {
      const chord = chords[Math.floor(step / 8) % chords.length];
      note(chord[step % 8], next, step % 8 === 0 ? .13 : .085);
      if (step % 8 === 0) note(chord[0] - 12, next, .08);
      step++; next += .48;
    }
  }
  async function sync() {
    if (!enabled || !unlocked || document.hidden) {
      clearInterval(timer); timer = null;
      if (context?.state === 'running') await context.suspend();
      return;
    }
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)();
        master = context.createGain(); master.gain.value = .4;
        const compressor = context.createDynamicsCompressor();
        master.connect(compressor); compressor.connect(context.destination);
      }
      await context.resume();
      if (!enabled || document.hidden) { await context.suspend(); return; }
      if (!timer) { next = context.currentTime + .06; schedule(); timer = setInterval(schedule, 100); }
    } catch { /* A browser without audio still runs all games. */ }
  }
  window.ArcadeMusic = { setEnabled(value) { enabled = !!value; void sync(); } };
  function unlock(event) { if (!event.isTrusted) return; unlocked = true; void sync(); }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => void sync());
  window.addEventListener('pagehide', () => { clearInterval(timer); timer = null; void context?.suspend(); });
  window.addEventListener('pageshow', () => void sync());

  const themes = [
    ['serpent','#69ffb2','DESPERTE A SERPENTE','<path d="M25 65H65V45H40V25H84"/><rect x="77" y="17" width="20" height="18" rx="4"/><circle cx="90" cy="22" r="2" fill="#071120"/>'],
    ['ghost','#ff52ac','OS FANTASMAS DESPERTARAM','<path d="M30 78V44a30 30 0 0 1 60 0v34L80 70 70 78 60 70 50 78 40 70Z"/><path d="M46 41v10m28-10v10" stroke="#071120"/>'],
    ['ship','#00f5ff','INICIANDO LANÇAMENTO','<path d="m60 15 14 34 26 23-33-6-7 17-7-17-33 6 26-23Z"/><path d="M50 84v12m20-12v12"/>'],
    ['bricks','#ffd600','ERGUENDO O REINO','<path d="M22 20h25v14H22zm30 0h25v14H52zm30 0h20v14H82zM30 40h25v14H30zm30 0h30v14H60zM38 87h44"/><circle cx="66" cy="69" r="7"/>'],
    ['turbo','#00f5ff','AQUECENDO OS MOTORES','<path d="m38 24 44 0 8 26v30H30V50Zm4 8-5 19h46l-5-19Z"/><path d="M38 65h9m26 0h9M40 86v8m40-8v8M16 30v40m88-30v40"/>'],
    ['bomb','#ff7a00','ACENDENDO O PAVIO','<circle cx="57" cy="61" r="27"/><path d="M60 34V23q24 7 25-8M82 9l9-5m-3 13h13"/>'],
    ['sword','#ff52ac','O GUERREIRO SE LEVANTA','<path d="m76 13 13 13-39 43-13-13ZM28 52l30 30M40 71 23 88m-7-6 13 13"/>'],
    ['crossing','#69ffb2','PREPARE O PRIMEIRO SALTO','<path d="M15 80h25m20-20h25m10-23h15"/><path d="m34 54 10-14 13 2 7 13-14 13Z"/><circle cx="49" cy="29" r="9"/>'],
    ['arena','#00f5ff','ATIVANDO A ARENA','<path d="m60 12 34 20v40L60 92 26 72V32Z"/><circle cx="60" cy="52" r="20"/><path d="M60 22v17m0 26v17M30 52h17m26 0h17"/>'],
    ['crown','#ffd600','O TRONO AGUARDA','<path d="m22 30 23 17 15-28 15 28 23-17-10 47H32ZM32 86h56"/><circle cx="60" cy="61" r="5"/>']
  ];
  window.ArcadePresentation = {
    show(id, phase, won = false) {
      const overlay = document.getElementById('gameOverlay');
      if (!overlay) return;
      const theme = themes[id] || themes[0];
      const mode = phase === 'finished' ? (won ? 'victory' : 'out') : ['intro','countdown'].includes(phase) ? 'in' : 'idle';
      const key = id + ':' + mode;
      if (overlay.dataset.presentation === key) return;
      overlay.dataset.presentation = key;
      overlay.style.setProperty('--game-tint', theme[1]);
      overlay.querySelector('.game-emblem')?.remove();
      if (mode === 'idle') return;
      const emblem = document.createElement('div');
      emblem.className = 'game-emblem ' + theme[0] + ' ' + mode;
      emblem.setAttribute('aria-hidden','true');
      emblem.innerHTML = '<svg viewBox="0 0 120 110" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' + theme[3] + '</svg><span></span>';
      overlay.prepend(emblem);
    },
    ready(id) { return themes[id]?.[2] || 'PREPARE-SE'; },
    clear() { const overlay = document.getElementById('gameOverlay'); if (overlay) { delete overlay.dataset.presentation; overlay.querySelector('.game-emblem')?.remove(); } }
  };
})();
