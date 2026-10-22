/* Corso Racing · Lights Out
   One scroll-scrubbed film: every reel reads a 0..1 progress from a smoothed
   scroll position, so the whole thing plays backward when you scroll up. */
(() => {
  'use strict';

  // Set to the team inbox once it exists (e.g. 'team@corso.racing'); until then the
  // partner reel says inquiries open soon.
  const CONTACT_EMAIL = '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t * t * (3 - 2 * t);
  const out3 = t => 1 - Math.pow(1 - t, 3);
  const fx4 = v => v.toFixed(4);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  // ------------------------------------------------------------ film grain
  (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const x = c.getContext('2d');
    const d = x.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
  })();

  // ------------------------------------------------------------ scenes
  const scenes = $$('.scene').map((el, i) => ({
    el, i, id: el.id, name: el.dataset.reel, stage: $('.stage', el), top: 0, h: 1, p: 0, on: false,
  }));
  const byId = Object.fromEntries(scenes.map(s => [s.id, s]));
  let vh = innerHeight, vw = innerWidth, maxY = 1;

  const strip = $('#strip');
  const frames = $$('.frame', strip);
  let stripTravel = 0;

  const racingLine = $('#racingLine');
  const trackDone = $('#trackDone');
  const carDot = $('#carDot');
  const eventItems = $$('#events li');
  const marks = eventItems.map(li => +li.dataset.at);
  let lineLen = 0, cps = [];

  function measure() {
    vh = innerHeight; vw = innerWidth;
    scenes.forEach(s => { s.top = s.el.offsetTop; s.h = s.el.offsetHeight; });
    maxY = Math.max(1, document.documentElement.scrollHeight - vh);
    stripTravel = Math.max(0, strip.scrollWidth - vw);
    lineLen = racingLine.getTotalLength();
    if (!cps.length) buildCheckpoints();
    buildScrub();
  }

  function buildCheckpoints() {
    const g = $('#checkpoints');
    const ns = 'http://www.w3.org/2000/svg';
    cps = marks.map((m, i) => {
      const pt = racingLine.getPointAtLength(m * lineLen);
      const cp = document.createElementNS(ns, 'g');
      cp.setAttribute('class', 'cp');
      cp.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      cp.innerHTML = `<circle r="17"></circle><text y="5">${i + 1}</text>`;
      g.appendChild(cp);
      return cp;
    });
  }

  // ------------------------------------------------------------ per-reel choreography
  const set = (el, k, v) => el.style.setProperty(k, typeof v === 'number' ? fx4(v) : v);
  const specRows = scene => $$('.specs li', scene);
  const m1 = $('.machine.m1'), m2 = $('.machine.m2');
  const m1rows = specRows(m1), m2rows = specRows(m2);
  const pillars = $$('.pillar');
  const spots = $$('.spots li');
  const credits = $('#credits');
  const final = $('.final');
  const lensVideo = $('#lensVideo');
  const vfTc = $('#vfTc');
  let lensReady = false, lensWanted = false;

  const REELS = {
    lights(p, st) {
      const wipe = ease(seg(p, .05, .36));
      set(st, '--wipe', wipe);
      set(st, '--streak', Math.sin(Math.PI * wipe) * .95);
      set(st, '--zp', 1.04 + .14 * ease(p));
      set(st, '--zc', 1.04 + .22 * ease(p));
      set(st, '--xc', (-3 + 6 * ease(p)).toFixed(3) + '%');
      const exit = ease(seg(p, .5, .78));
      set(st, '--hx', exit);
      set(st, '--sub', ease(seg(p, .16, .3)) * (1 - exit));
      set(st, '--chip', ease(seg(p, .32, .42)) * (1 - seg(p, .82, .9)));
      set(st, '--cue', 1 - seg(p, 0, .04));
      set(st, '--out', ease(seg(p, .86, 1)));
    },
    arms(p, st) {
      set(st, '--in', out3(seg(p, 0, .1)));
      const beats = [[.04, .12, .3, .36], [.36, .44, .6, .66], [.66, .74, 2, 3]];
      $$('.beat', st).forEach((b, i) => {
        const [a, b2, c, d] = beats[i];
        set(b, '--o', ease(seg(p, a, b2)) * (1 - ease(seg(p, c, d))));
      });
      const fade = 1 - seg(p, .56, .62);
      set(st, '--n1', ease(seg(p, .1, .2)) * fade);
      set(st, '--n2', ease(seg(p, .18, .28)) * fade);
      set(st, '--n3', ease(seg(p, .26, .36)) * fade);
      set(st, '--sep', seg(p, .4, .62));
      set(st, '--m', ease(seg(p, .62, .8)));
      set(st, '--sl', out3(seg(p, .7, .92)));
    },
    crew(p, st) {
      const x = -stripTravel * ease(seg(p, .08, .94));
      set(st, '--sx', x.toFixed(1) + 'px');
      const mid = vw / 2;
      frames.forEach(f => {
        const c = f.offsetLeft + f.offsetWidth / 2 + x;
        const lit = 1 - clamp(Math.abs(c - mid) / (vw * .55));
        f.style.setProperty('--lit', (.55 + .45 * lit).toFixed(3));
      });
    },
    machines(p, st) {
      const enter = out3(seg(p, 0, .12));
      const swap = ease(seg(p, .46, .58));
      set(m1, '--a', enter * (1 - swap));
      set(m1, '--mx', ((1 - enter) * 18 - swap * 26).toFixed(2) + 'vw');
      set(m1, '--gx', (-p * 14).toFixed(2) + 'vw');
      set(m1, '--ms', 1 + .05 * seg(p, 0, .5));
      m1rows.forEach((li, i) => set(li, '--r', out3(seg(p, .08 + i * .045, .16 + i * .045))));
      set(m2, '--a', swap);
      set(m2, '--mx', ((1 - swap) * 26).toFixed(2) + 'vw');
      set(m2, '--gx', ((1 - p) * 14).toFixed(2) + 'vw');
      set(m2, '--ms', 1 + .05 * seg(p, .5, 1));
      m2rows.forEach((li, i) => set(li, '--r', out3(seg(p, .58 + i * .05, .66 + i * .05))));
    },
    season(p) {
      const lap = seg(p, .04, .96);
      const pt = racingLine.getPointAtLength(lap * lineLen);
      carDot.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      trackDone.style.setProperty('--done', fx4(1 - lap));
      let active = -1;
      marks.forEach((m, i) => { if (lap >= m - .015) active = i; });
      eventItems.forEach((li, i) => {
        li.classList.toggle('on', i === active);
        li.classList.toggle('past', i < active);
        cps[i] && cps[i].classList.toggle('on', i === active);
        cps[i] && cps[i].classList.toggle('past', i < active);
      });
    },
    tulsa(p, st) {
      set(st, '--z', 1.02 + .18 * ease(p));
      set(st, '--t', out3(seg(p, .08, .3)) * (1 - ease(seg(p, .88, 1))));
      set(st, '--ts', out3(seg(p, .26, .42)));
    },
    lens(p, st) {
      set(st, '--vf', out3(seg(p, 0, .3)));
      set(st, '--lc', out3(seg(p, .18, .38)));
      set(st, '--fz', 1 + .08 * Math.sin(p * 40));
      lensWanted = p > .04 && p < .985;
      if (lensWanted && lensVideo.preload === 'none') { lensVideo.preload = 'auto'; lensVideo.load(); }
      if (lensReady) set(st, '--still', 1 - out3(seg(p, .22, .36)));
      const t = lensReady && !lensVideo.paused ? lensVideo.currentTime : p * 41;
      vfTc.textContent = timecode(t);
    },
    program(p, st) {
      set(st, '--z', 1.12 - .08 * ease(p));
      set(st, '--a', out3(seg(p, .04, .2)));
      pillars.forEach((el, i) => set(el, '--r', out3(seg(p, .16 + i * .1, .32 + i * .1))));
    },
    partner(p, st) {
      set(st, '--a', out3(seg(p, .04, .22)));
      spots.forEach((el, i) => set(el, '--r', out3(seg(p, .2 + i * .08, .3 + i * .08))));
    },
    finish(p, st) {
      set(st, '--z', 1 + .12 * ease(p));
      const roll = seg(p, .02, .7);
      const ch = credits.offsetHeight;
      set(st, '--cy', (vh * 1.02 - roll * (ch + vh * 1.1)).toFixed(1) + 'px');
      const f = out3(seg(p, .7, .86));
      set(st, '--f', f);
      set(st, '--dark', f);
      final.classList.toggle('live', f > .5);
    },
  };

  // per-reel letterbox height (as a share of the viewport) and FX intensity
  const LOOK = {
    lights: [.085, 1], arms: [0, .12], crew: [0, .25], machines: [0, .35], season: [0, .15],
    tulsa: [.07, 1], lens: [0, .08], program: [0, .3], partner: [0, .15], finish: [.07, .55],
  };

  // ------------------------------------------------------------ HUD
  const reelNo = $('#reelNo'), reelName = $('#reelName'), reelOf = $('#reelOf');
  const tcEl = $('#tc'), mphEl = $('#mph'), scrubFill = $('#scrubFill'), scrub = $('#scrub');
  let current = -1, scrubBtns = [];
  const pad2 = n => String(n | 0).padStart(2, '0');
  function timecode(sec) {
    const f = Math.floor((sec % 1) * 24);
    return `00:${pad2(sec / 60)}:${pad2(sec % 60)}:${pad2(f)}`;
  }
  function buildScrub() {
    scrubBtns.forEach(b => b.remove());
    scrubBtns = scenes.map(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.label = s.name;
      b.setAttribute('aria-label', 'Jump to ' + s.name);
      b.style.left = (s.top / maxY * 100).toFixed(2) + '%';
      b.addEventListener('click', () => jump(s.top + 2));
      scrub.appendChild(b);
      return b;
    });
    $('.hud-bottom').removeAttribute('aria-hidden');
  }
  function jump(y) { scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' }); }

  // ------------------------------------------------------------ FX: clay and light streaks
  const fx = (() => {
    const cv = $('#fx');
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1;
    const parts = [];
    let level = 0;
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(kind) {
      const z = Math.random();
      parts.push(kind === 'streak'
        ? { kind, x: w + Math.random() * w * .3, y: h * (.15 + Math.random() * .75), z, len: 80 + z * 260, red: Math.random() < .45 }
        : { kind, x: w * (.4 + Math.random() * .7), y: h * (.45 + Math.random() * .6), z, r: .6 + z * 2.6, vy: -(.4 + Math.random() * 2.6), life: 1 });
    }
    function step(speed, target) {
      level += (target - level) * .05;
      const fast = clamp(speed / 36);
      const rate = level * (.5 + fast * 3.5);
      if (!reduced) {
        for (let i = 0; i < rate * 2.2; i++) if (Math.random() < .6) spawn('clay');
        if (Math.random() < level * fast * 1.4) spawn('streak');
      }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        const v = (2 + speed * .9) * (.4 + q.z * 1.6);
        if (q.kind === 'streak') {
          q.x -= v * 3.2;
          const g = ctx.createLinearGradient(q.x, 0, q.x + q.len, 0);
          const c = q.red ? '225,6,0' : '245,243,239';
          g.addColorStop(0, `rgba(${c},${(.5 * level).toFixed(3)})`);
          g.addColorStop(1, `rgba(${c},0)`);
          ctx.strokeStyle = g; ctx.lineWidth = .6 + q.z * 1.6;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + q.len, q.y); ctx.stroke();
          if (q.x + q.len < 0) parts.splice(i, 1);
        } else {
          q.x -= v; q.y += q.vy; q.vy += .05; q.life -= .012;
          ctx.fillStyle = `rgba(${200 + q.z * 40 | 0},${70 + q.z * 40 | 0},${30 + q.z * 20 | 0},${(q.life * .7 * level).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
          if (q.life <= 0 || q.x < -10 || q.y > h + 10) parts.splice(i, 1);
        }
      }
      if (parts.length > 700) parts.splice(0, parts.length - 700);
    }
    return { resize, step };
  })();

  // ------------------------------------------------------------ engine sound (Web Audio)
  const engine = (() => {
    let ac = null, nodes = null, on = false;
    function build() {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const master = ac.createGain(); master.gain.value = 0;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp).connect(ac.destination);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 4;
      const shaper = ac.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); }
      shaper.curve = curve;
      const body = ac.createGain(); body.gain.value = .5;
      const pulse = ac.createGain(); pulse.gain.value = .6;              // firing pulses
      const o1 = ac.createOscillator(); o1.type = 'sawtooth';
      const o2 = ac.createOscillator(); o2.type = 'square'; o2.detune.value = 9;
      const o3 = ac.createOscillator(); o3.type = 'sawtooth';
      const g3 = ac.createGain(); g3.gain.value = .3;
      const lfo = ac.createOscillator(); lfo.type = 'square';
      const lfoAmt = ac.createGain(); lfoAmt.gain.value = .4;
      lfo.connect(lfoAmt).connect(pulse.gain);
      o1.connect(body); o2.connect(body); o3.connect(g3).connect(body);
      body.connect(pulse).connect(shaper).connect(lp).connect(master);
      // wind/roost bed
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .7;
      const ng = ac.createGain(); ng.gain.value = 0;
      noise.connect(bp).connect(ng).connect(master);
      [o1, o2, o3, lfo, noise].forEach(n => n.start());
      nodes = { master, lp, o1, o2, o3, lfo, ng, bp };
      update(0);
    }
    function update(s) {           // s: 0 (idle) .. 1 (flat out)
      if (!nodes || !on) return;
      const t = ac.currentTime, f = 36 + s * 150;
      nodes.o1.frequency.setTargetAtTime(f, t, .07);
      nodes.o2.frequency.setTargetAtTime(f * 1.5, t, .07);
      nodes.o3.frequency.setTargetAtTime(f * 2.01, t, .07);
      nodes.lfo.frequency.setTargetAtTime(f / 2, t, .07);
      nodes.lp.frequency.setTargetAtTime(380 + s * 2800, t, .1);
      nodes.ng.gain.setTargetAtTime(.015 + s * .12, t, .15);
      nodes.bp.frequency.setTargetAtTime(600 + s * 1800, t, .15);
    }
    async function toggle() {
      on = !on;
      if (on && !ac) build();
      if (ac && ac.state === 'suspended') await ac.resume();
      if (nodes) nodes.master.gain.setTargetAtTime(on ? .32 : 0, ac.currentTime, .2);
      store.set('cr-sound', on ? '1' : '0');
      return on;
    }
    return { toggle, update, get on() { return on; } };
  })();

  const soundBtn = $('#soundBtn'), soundLbl = $('#soundLbl');
  soundBtn.addEventListener('click', async () => {
    const on = await engine.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundLbl.textContent = on ? 'SOUND ON' : 'SOUND OFF';
  });

  // ------------------------------------------------------------ film modal
  const modal = $('#modal'), modalVideo = $('#modalVideo');
  let lastFocus = null;
  function openFilm() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    lensVideo.pause();
    modalVideo.preload = 'auto';
    const p = modalVideo.play();
    if (p && p.catch) p.catch(() => {});
    $('#modalX').focus();
  }
  function closeFilm() {
    modalVideo.pause();
    modal.hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  $('#playFilm').addEventListener('click', openFilm);
  $$('[data-play-film]').forEach(b => b.addEventListener('click', openFilm));
  $('#modalX').addEventListener('click', closeFilm);
  modal.addEventListener('click', e => { if (e.target === modal) closeFilm(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeFilm(); });

  // the viewfinder joins the film where the car comes in, not on the start lights
  lensVideo.addEventListener('loadeddata', () => { lensReady = true; try { lensVideo.currentTime = 5.2; } catch (e) { /* not seekable yet */ } }, { once: true });

  // ------------------------------------------------------------ partner contact
  if (CONTACT_EMAIL) {
    $('#contactSlot').innerHTML = `<a class="btn" href="mailto:${CONTACT_EMAIL}?subject=Corso%20Racing%20partnership">Talk partnerships <span>${CONTACT_EMAIL}</span></a>`;
  }

  // ------------------------------------------------------------ the loop
  let sy = scrollY, vel = 0, mph = 0, barNow = 0;
  function frame() {
    const y = scrollY;
    const prev = sy;
    sy += (y - sy) * (reduced ? 1 : .13);
    if (Math.abs(y - sy) < .2) sy = y;
    vel = sy - prev;

    let cur = 0;
    for (const s of scenes) {
      const visible = sy + vh > s.top - 50 && sy < s.top + s.h + 50;
      if (sy + vh * .5 >= s.top) cur = s.i;
      if (!visible) { if (s.on) { s.on = false; } continue; }
      s.on = true;
      const p = clamp((sy - s.top) / Math.max(1, s.h - vh));
      s.p = p;
      REELS[s.id] && REELS[s.id](p, s.stage);
    }

    // lens video only plays while its reel is on screen
    if (byId.lens.on && lensWanted && modal.hidden) { if (lensVideo.paused) { const pr = lensVideo.play(); if (pr && pr.catch) pr.catch(() => {}); } }
    else if (!lensVideo.paused) lensVideo.pause();

    if (cur !== current) {
      current = cur;
      const s = scenes[cur];
      reelNo.textContent = pad2(cur + 1);
      reelName.textContent = s.name;
      reelOf.textContent = `REEL ${pad2(cur + 1)}/${pad2(scenes.length)}`;
      scrubBtns.forEach((b, i) => b.classList.toggle('on', i <= cur));
    }
    const s = scenes[cur];
    const look = LOOK[s.id] || [0, .2];
    // letterbox: hold during the opening, close up as the hero rolls on
    let barT = look[0];
    if (s.id === 'lights') barT *= 1 - seg(s.p, .55, .9);
    if (s.id === 'finish') barT *= seg(s.p, .1, .3);
    barNow += (barT * vh - barNow) * .1;
    document.documentElement.style.setProperty('--bar', barNow.toFixed(1) + 'px');

    const speed = Math.abs(vel);
    mph += (Math.min(140, speed * 1.6) - mph) * .12;
    mphEl.textContent = String(Math.round(mph)).padStart(3, '0');
    tcEl.textContent = timecode(sy / maxY * 240);
    scrubFill.style.setProperty('--prog', (sy / maxY * 100).toFixed(2) + '%');
    fx.step(speed, look[1]);
    engine.update(clamp(mph / 110));
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ boot: the start lights
  const loader = $('#loader');
  const lamps = $$('.lights i', loader);
  const pct = $('#loadPct');
  let lit = 0, started = false;
  const fast = reduced || params.has('at');

  function light(n) {
    while (lit < Math.min(5, n)) lamps[lit++].classList.add('on');
    pct.textContent = String(Math.round(lit / 5 * 100)).padStart(2, '0');
  }
  function decode(src) {
    return new Promise(res => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = src;
      if (im.decode) im.decode().then(res, res);
    });
  }
  function lightsOut() {
    if (started) return;
    started = true;
    light(5);
    setTimeout(() => {
      loader.classList.add('out');
      setTimeout(() => {
        document.body.classList.remove('is-loading');
        document.body.classList.add('loaded');
        loader.classList.add('gone');
        reviewHook();
      }, fast ? 50 : 900);
    }, fast ? 0 : 650);
  }
  function reviewHook() {        // ?at=reelId,progress for review screenshots
    const at = params.get('at');
    if (!at) return;
    const [id, p] = at.split(',');
    const s = byId[id];
    if (!s) return;
    const y = s.top + (+p || 0) * (s.h - vh);
    scrollTo(0, y);
    sy = y;
  }

  document.body.classList.add('is-loading');
  measure();
  fx.resize();
  requestAnimationFrame(frame);

  const jobs = [
    decode($('#lights .plate img').currentSrc || $('#lights .plate img').src),
    decode($('#lights .car:not(.streak) img').currentSrc || 'assets/img/hero.webp'),
    decode('assets/logo/emblem.webp'),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ];
  let done = 0;
  const t0 = performance.now();
  jobs.forEach(j => j.then(() => {
    done++;
    // the lamps never run ahead of the clock: at most one per 380ms
    const wait = fast ? 0 : Math.max(0, (done * 380) - (performance.now() - t0));
    setTimeout(() => light(done + (done === jobs.length ? 1 : 0)), wait);
    if (done === jobs.length) setTimeout(lightsOut, fast ? 0 : Math.max(450, 5 * 380 - (performance.now() - t0)));
  }));
  setTimeout(lightsOut, 7000);   // never hold the page hostage

  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { measure(); fx.resize(); }, 120); });
  addEventListener('load', measure);
})();
