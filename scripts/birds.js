// Birds in the forest: a few white birds and a blue one that fly between the branches, sit for a while,
// hop on the lawn, leave and come back. Each bird is drawn every frame from painted strokes in its own
// frame of reference: a body, a head, a tail fan, and two wings of separate feathers that beat in 3D and are
// projected to the screen. forest.js gives the module the perches and a map from the painting to the screen.
(function () {
  "use strict";
  var TAU = Math.PI * 2;

  function rng(seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ss(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // colors: base, the shade under the body, the deep shade, highlights, the feather tips, beak, eye, legs
  var PAL = {
    white: { base: [236, 233, 222], shade: [170, 184, 192], deep: [112, 132, 146], light: [255, 252, 242],
             tip: [150, 166, 180], beak: [206, 168, 92], eye: [28, 30, 34], leg: [150, 128, 104] },
    blue:  { base: [62, 96, 172], shade: [38, 58, 122], deep: [22, 34, 80], light: [128, 158, 218],
             tip: [36, 56, 124], beak: [52, 52, 60], eye: [14, 14, 18], leg: [70, 70, 80] }
  };
  // the birds' colors are quieted like the painting's lights (a soft knee in linear luminance), a little brighter
  // than its brightest marks, so a white bird reads as white in the painting and not as a light on top of it
  var BIRD_LT = 0.2;
  function toneC(c) {
    var lin = c.map(function (v) { return Math.pow(v / 255, 2.2); });
    var L = Math.max(1e-4, 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]);
    var k = Math.pow(BIRD_LT * (1 - Math.exp(-L / BIRD_LT)) / L, 1 / 2.2);
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  Object.keys(PAL).forEach(function (n) { Object.keys(PAL[n]).forEach(function (k) { PAL[n][k] = toneC(PAL[n][k]); }); });
  function col(c, k, a, d) {
    d = d || 0;
    return "rgba(" + Math.round(clamp(c[0] * k + d, 0, 255)) + "," + Math.round(clamp(c[1] * k + d, 0, 255)) + "," +
      Math.round(clamp(c[2] * k + d, 0, 255)) + "," + (a == null ? 1 : a) + ")";
  }

  // a tapered stroke from (x0, y0) to (x1, y1): w0 wide at the start, w1 at the middle, a point at the end
  function feather(ctx, x0, y0, x1, y1, w0, w1) {
    var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1e-6;
    var nx = -dy / l, ny = dx / l;
    var mx = x0 + dx * 0.45, my = y0 + dy * 0.45;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
    ctx.quadraticCurveTo(mx + nx * w1 * 1.3, my + ny * w1 * 1.3, x1, y1);
    ctx.quadraticCurveTo(mx - nx * w1 * 1.3, my - ny * w1 * 1.3, x0 - nx * w0, y0 - ny * w0);
    ctx.closePath();
    ctx.fill();
  }

  // ---- song ---------------------------------------------------------------------------------------------------
  // Each bird has a voice: a pitch, and three motifs made at random once (rising and falling chirps, a trill, or,
  // for the blue bird, slurred whistles). A song is one to three motifs, each a little sharp or flat. A note is
  // { t, dur, f0, f1 (Hz, swept), vib (Hz), vd (Hz deep), amp }.
  function Voice(kind, r) {
    this.kind = kind;
    this.base = kind === "blue" ? 1900 + r() * 700 : 2900 + r() * 1400;
    this.motifs = [];
    for (var m = 0; m < 3; m++) this.motifs.push(this.motif(r));
  }
  Voice.prototype.motif = function (r) {
    var notes = [], t = 0, i, n = 2 + Math.floor(r() * 4), f0, f1, dur;
    if (this.kind === "blue") {                                       // slurred whistles, tee-yoo
      for (i = 0; i < n; i++) {
        f0 = this.base * (0.85 + 0.35 * r()); f1 = f0 * (0.7 + 0.6 * r()); dur = 0.11 + 0.18 * r();
        notes.push({ t: t, dur: dur, f0: f0, f1: f1, vib: r() < 0.4 ? 7 + r() * 9 : 0, vd: f0 * 0.025, amp: 0.75 + 0.25 * r() });
        t += dur + 0.04 + 0.08 * r();
      }
    } else if (r() < 0.35) {                                          // a trill
      var f = this.base * (0.9 + 0.3 * r()), m = 6 + Math.floor(r() * 8), d = 0.032 + 0.02 * r(), gap = 0.022 + 0.02 * r();
      var drift = (r() - 0.5) * 0.3;
      for (i = 0; i < m; i++) {
        f0 = f * (1 + drift * i / m); f1 = f0 * (1.2 + 0.12 * r());
        notes.push({ t: t, dur: d, f0: f0, f1: f1, vib: 0, vd: 0, amp: 0.55 + 0.45 * Math.sin(Math.PI * (i + 0.5) / m) });
        t += d + gap;
      }
    } else {                                                          // chirps that rise or fall
      for (i = 0; i < n; i++) {
        f0 = this.base * (0.75 + 0.5 * r());
        f1 = r() < 0.6 ? f0 * (1.3 + 0.4 * r()) : f0 * (0.55 + 0.2 * r());
        dur = 0.05 + 0.1 * r();
        notes.push({ t: t, dur: dur, f0: f0, f1: f1, vib: r() < 0.3 ? 30 + r() * 30 : 0, vd: f0 * 0.03, amp: 0.7 + 0.3 * r() });
        t += dur + 0.05 + 0.12 * r();
      }
    }
    return notes;
  };
  Voice.prototype.chirp = function (r) {
    var m = this.motifs[Math.floor(r() * this.motifs.length)], p = 0.96 + 0.08 * r();
    var trill = m.length > 5, k = trill ? 3 + Math.floor(r() * 3) : 1 + Math.floor(r() * Math.min(3, m.length));
    var out = [];
    for (var j = 0; j < Math.min(k, m.length); j++) {
      var n = m[j];
      out.push({ t: n.t, dur: n.dur, f0: n.f0 * p, f1: n.f1 * p, vib: n.vib, vd: n.vd, amp: n.amp });
    }
    return out;
  };
  Voice.prototype.song = function (r, short) {
    var out = [], t = 0, k = short ? 1 : 1 + Math.floor(r() * 3);
    for (var i = 0; i < k; i++) {
      var m = this.motifs[Math.floor(r() * this.motifs.length)], p = 0.96 + 0.08 * r();
      for (var j = 0; j < m.length; j++) {
        var n = m[j];
        out.push({ t: t + n.t, dur: n.dur, f0: n.f0 * p, f1: n.f1 * p, vib: n.vib, vd: n.vd, amp: n.amp });
      }
      var last = m[m.length - 1];
      t += last.t + last.dur + 0.18 + 0.25 * r();
    }
    return out;
  };

  // the synthesizer: sine voices with a soft second harmonic, swept, with vibrato where a note has it; panned to
  // where the bird is, into a little room of reverb. A browser lets it sound only after the visitor taps or types.
  var MASTER = 0.09;                 // quiet: a background, not a feature
  function Sound() { this.ctx = null; this.on = true; }
  Sound.prototype.available = function () { return !!(window.AudioContext || window.webkitAudioContext); };
  Sound.prototype.unlock = function () {
    if (!this.on || !this.available()) return;
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      var c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = MASTER;
      this.master.connect(c.destination);
      var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      this.bus = hp;
      var dry = c.createGain(); dry.gain.value = 1;
      var wet = c.createGain(); wet.gain.value = 0.22;
      var rev = c.createConvolver();
      var len = Math.floor(c.sampleRate * 1.4), ir = c.createBuffer(2, len, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch), a = 12345 + ch * 777;
        for (var i = 0; i < len; i++) { a = (a * 1103515245 + 12345) & 0x7fffffff; d[i] = ((a / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 3); }
      }
      rev.buffer = ir;
      hp.connect(dry); dry.connect(this.master);
      hp.connect(rev); rev.connect(wet); wet.connect(this.master);
      this.makeWind();
    }
    var self = this;
    this.master.gain.setTargetAtTime(MASTER, this.ctx.currentTime, 0.04);
    // a browser starts the sound a moment after it is asked: if it was muted in that moment, it stays silent
    if (this.ctx.state === "suspended") this.ctx.resume().then(function () { if (!self.on) self.ctx.suspend(); }, function () {});
  };
  // the speaker button: off fades the sound out at once and stops it; on brings it back
  Sound.prototype.setOn = function (on) {
    this.on = on;
    if (on) { this.preload(); this.unlock(); return; }
    if (!this.ctx) return;
    var c = this.ctx, self = this;
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(function () { if (!self.on) c.suspend(); }, 200);
  };
  // The wind in the leaves, recorded: two seamless loops cut from Joseph Sardin's recordings "Wind in the Trees"
  // (BigSoundBank #0904, the forest of Rambouillet) and "Wind in shrub" (#0907), both CC0, blended, the rumble
  // taken out and the leaves brought forward. A calm loop is always there, soft; a gust loop swells in as a gust
  // crosses the trees, and moves across with it. When nothing stirs the leaves, the wind is silent. The files are fetched as the page loads (preload), so the wind can
  // start the moment the browser lets the sound play.
  var WIND_LOOPS = { calm: [1.0, 31.0], gust: [1.0, 25.0] };   // where each file's seamless loop begins and ends (s)
  function windFile(n) { return fetch("/assets/forest/wind-" + n + ".mp3?v=2").then(function (r) { return r.arrayBuffer(); }); }
  Sound.prototype.preload = function () {
    if (this.files || !this.available()) return;
    this.files = {};
    for (var n in WIND_LOOPS) this.files[n] = windFile(n);
  };
  Sound.prototype.makeWind = function () {
    var c = this.ctx, self = this;
    this.windOut = c.createGain(); this.windOut.gain.value = 1; this.windOut.connect(this.master);
    this.calmG = c.createGain(); this.calmG.gain.value = 0; this.calmG.connect(this.windOut);
    this.gustG = c.createGain(); this.gustG.gain.value = 0;
    if (c.createStereoPanner) { this.windPan = c.createStereoPanner(); this.gustG.connect(this.windPan); this.windPan.connect(this.windOut); }
    else this.gustG.connect(this.windOut);
    Object.keys(WIND_LOOPS).forEach(function (n) {
      ((self.files && self.files[n]) || windFile(n)).then(function (b) {
        return new Promise(function (res, rej) { c.decodeAudioData(b, res, rej); });
      }).then(function (buf) {
        var L = WIND_LOOPS[n], s = c.createBufferSource();
        s.buffer = buf; s.loop = true; s.loopStart = L[0]; s.loopEnd = Math.min(L[1], buf.duration);
        s.connect(n === "calm" ? self.calmG : self.gustG);
        s.start(0, L[0] + Math.random() * (s.loopEnd - L[0]));
      }).catch(function () {});
    });
    this.lv = 0;
  };
  // how hard the wind blows now (0 still .. about 1 at the height of a strong gust) and where across the picture
  // the gust is (-1 left .. 1 right); called about 10 times a second
  Sound.prototype.wind = function (level, pan) {
    if (!this.ready() || !this.calmG) return;
    var now = this.ctx.currentTime, target = clamp(level, 0, 1.2);
    this.lv += (target - this.lv) * (target > this.lv ? 0.15 : 0.09);     // swells within a second, dies over about two
    var g = Math.min(1, this.lv / 0.45);                                // a strong gust brings the level to about half
    this.calmG.gain.setTargetAtTime(0.32 * ss(0.02, 0.35, g), now, 0.5); // silent when nothing stirs the leaves
    this.gustG.gain.setTargetAtTime(1.25 * ss(0.04, 1, g), now, 0.7);   // and a gust sweeps through them
    if (this.windPan) this.windPan.pan.setTargetAtTime(clamp(pan || 0, -0.6, 0.6) * g, now, 0.8);
  };
  Sound.prototype.wake = function () { if (this.on && this.ctx && this.ctx.state === "suspended") this.ctx.resume(); };
  Sound.prototype.hush = function () { if (this.ctx && this.ctx.state !== "closed") this.ctx.suspend(); };
  Sound.prototype.ready = function () { return this.on && this.ctx && this.ctx.state === "running"; };
  Sound.prototype.play = function (notes, pan, vol, delay) {
    var c = this.ctx, t0 = c.currentTime + delay, out = c.createGain(), end = 0;
    out.gain.value = vol;
    if (c.createStereoPanner) { var pn = c.createStereoPanner(); pn.pan.value = pan; out.connect(pn); pn.connect(this.bus); }
    else out.connect(this.bus);
    notes.forEach(function (n) {
      var t = t0 + n.t, e = t + n.dur, a = Math.min(0.012, n.dur * 0.25);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(n.amp, t + a);
      g.gain.setValueAtTime(n.amp, Math.max(t + a, e - n.dur * 0.45));
      g.gain.exponentialRampToValueAtTime(0.0001, e);
      g.connect(out);
      [[1, 1], [2, 0.12]].forEach(function (hv) {
        var o = c.createOscillator(), og = c.createGain();
        o.frequency.setValueAtTime(n.f0 * hv[0], t);
        o.frequency.exponentialRampToValueAtTime(n.f1 * hv[0], e);
        if (n.vib) {
          var l = c.createOscillator(), lg = c.createGain();
          l.frequency.value = n.vib; lg.gain.value = n.vd * hv[0];
          l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(e + 0.02);
        }
        og.gain.value = hv[1];
        o.connect(og); og.connect(g); o.start(t); o.stop(e + 0.02);
      });
      end = Math.max(end, n.t + n.dur);
    });
    setTimeout(function () { out.disconnect(); }, (delay + end + 2) * 1000);
  };

  // ---- one bird -------------------------------------------------------------------------------------------
  function Bird(kind, seed, scale) {
    this.kind = kind; this.p = PAL[kind]; this.scale = scale;
    var r = rng(seed); this.r = r;
    // fixed painterly variation, so the strokes never flicker
    this.v = []; for (var i = 0; i < 64; i++) this.v.push(r());
    this.hz = kind === "blue" ? 4.4 + r() * 0.8 : 3.4 + r() * 0.7;   // wing beats a second
    this.state = "off"; this.timer = 0; this.face = 1; this.pitch = 0; this.phase = r();
    this.open = 0; this.at = null; this.u = -0.2; this.v0 = 0.3; this.head = 0; this.tail = 0;
    this.glide = false; this.hopT = 0; this.hop = null; this.peck = 0;
    this.voice = new Voice(kind, r); this.song = null; this.beak = 0; this.singing = 0;
    this.landed = false;
  }

  // the projection of a point of the bird in 3D: z comes toward the viewer, seen a little from below
  function pr(x, y, z) { return [x + 0.16 * z, y + 0.4 * z]; }

  // a wing: zs = 1 the near wing, -1 the far wing. phi: how high the wing is raised (0 level, pi/2 straight up);
  // ext: how far it is spread; bend: how far the hand is swept back
  Bird.prototype.wing = function (ctx, zs, phi, ext, bend, open) {
    var P = this.p, V = this.v;
    var k = zs > 0 ? 1 : 0.78;                                      // the far wing in shadow
    var sx = -0.06, dy = -Math.sin(phi), dz = Math.cos(phi) * zs;
    var n = Math.hypot(sx, dy, dz);
    var d = [sx / n, dy / n, dz / n];
    var hx = d[0] - bend, hn = Math.hypot(hx, d[1], d[2]);
    var dh = [hx / hn, d[1] / hn, d[2] / hn];
    var S = [0.06, -0.1, 0.05 * zs];
    var Ls = 1.3 * ext * open;
    var W = [S[0] + d[0] * 0.45 * Ls, S[1] + d[1] * 0.45 * Ls, S[2] + d[2] * 0.45 * Ls];
    var T = [W[0] + dh[0] * 0.55 * Ls, W[1] + dh[1] * 0.55 * Ls, W[2] + dh[2] * 0.55 * Ls];
    var N = 13, bases = [], tips = [];
    for (var i = 0; i < N; i++) {
      var u = (i + 0.5) / N, b;
      if (u < 0.45) b = [S[0] + d[0] * u * Ls, S[1] + d[1] * u * Ls, S[2] + d[2] * u * Ls];
      else { var f = (u - 0.45) * Ls; b = [W[0] + dh[0] * f, W[1] + dh[1] * f, W[2] + dh[2] * f]; }
      var m = ss(0.5, 1, u) * 0.8;
      var cx = lerp(-1, dh[0], m), cy = lerp(0.1, dh[1], m), cz = lerp(0, dh[2], m), cn = Math.hypot(cx, cy, cz);
      var len = (0.36 + 0.26 * ss(0.4, 1, u)) * (0.55 + 0.45 * ext) * open * (0.9 + 0.2 * V[i]);
      bases.push(pr(b[0], b[1], b[2]));
      tips.push(pr(b[0] + cx / cn * len, b[1] + cy / cn * len, b[2] + cz / cn * len));
    }
    var pS = pr(S[0], S[1], S[2]), pW = pr(W[0], W[1], W[2]), pT = pr(T[0], T[1], T[2]);
    // the wing's body, under the feathers
    ctx.fillStyle = col(P.base, k * 0.86);
    ctx.beginPath(); ctx.moveTo(pS[0], pS[1]); ctx.lineTo(pW[0], pW[1]); ctx.lineTo(pT[0], pT[1]);
    for (i = N - 1; i >= 0; i--) ctx.lineTo(tips[i][0], tips[i][1]);
    ctx.closePath(); ctx.fill();
    // the feathers, from the body out; each a loaded stroke, its tip in the cooler color
    for (i = 0; i < N; i++) {
      var t = i / (N - 1), vv = V[i + 12];
      var bx0 = bases[i][0], by0 = bases[i][1], tx = tips[i][0], ty = tips[i][1];
      ctx.fillStyle = col(P.shade, k * 0.9, 0.7);
      feather(ctx, bx0, by0 + 0.012, tx, ty + 0.015, 0.045, 0.06);
      ctx.fillStyle = col(P.base, k * (0.9 + 0.12 * vv) * lerp(1, 0.94, t));
      feather(ctx, bx0, by0, tx, ty, 0.038, 0.052);
      ctx.fillStyle = col(P.light, k, 0.55 + 0.3 * V[i + 36]);
      feather(ctx, bx0, by0 - 0.008, lerp(bx0, tx, 0.62), lerp(by0, ty, 0.62) - 0.008, 0.018, 0.022);
      var mx = lerp(bx0, tx, 0.55), my = lerp(by0, ty, 0.55);
      ctx.fillStyle = col(t > 0.45 ? P.tip : P.shade, k * (0.95 + 0.1 * V[i + 24]), 0.7);
      feather(ctx, mx, my, tx, ty, 0.02, 0.028);
    }
    // the coverts along the leading edge: short light dabs
    ctx.fillStyle = col(P.light, k, 0.9);
    for (i = 0; i < 6; i++) {
      var q = (i + 0.3) / 6, ax = lerp(pS[0], pW[0], q), ay = lerp(pS[1], pW[1], q);
      var bx = lerp(bases[Math.min(N - 1, i)][0], tips[Math.min(N - 1, i)][0], 0.3);
      var by = lerp(bases[Math.min(N - 1, i)][1], tips[Math.min(N - 1, i)][1], 0.3);
      feather(ctx, ax, ay, lerp(ax, bx, 0.8), lerp(ay, by, 0.8), 0.03, 0.035);
    }
    ctx.strokeStyle = col(P.light, k, 0.85); ctx.lineWidth = 0.035; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pS[0], pS[1]); ctx.quadraticCurveTo(pW[0], pW[1], lerp(pW[0], pT[0], 0.6), lerp(pW[1], pT[1], 0.6)); ctx.stroke();
  };

  // the folded wing of a sitting bird, laid along its side
  Bird.prototype.folded = function (ctx, a) {
    var P = this.p, V = this.v, ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * a;
    ctx.fillStyle = col(P.base, 0.96);
    ctx.beginPath(); ctx.moveTo(0.16, -0.12);
    ctx.quadraticCurveTo(-0.05, -0.2, -0.6, -0.02);
    ctx.quadraticCurveTo(-0.2, 0.06, 0.12, -0.02);
    ctx.closePath(); ctx.fill();
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      ctx.fillStyle = col(t > 0.4 ? P.tip : P.shade, 0.95 + 0.1 * V[i + 30], 0.8);
      feather(ctx, lerp(-0.05, -0.2, t), lerp(-0.1, -0.04, t), -0.62 + 0.04 * t, -0.02 + 0.015 * t, 0.025, 0.03);
    }
    ctx.fillStyle = col(P.light, 1, 0.9);
    for (i = 0; i < 4; i++) feather(ctx, 0.12 - i * 0.07, -0.12 + i * 0.012, 0.02 - i * 0.07, -0.07 + i * 0.01, 0.03, 0.03);
    ctx.globalAlpha = ga;
  };

  Bird.prototype.tailfan = function (ctx, spread, droop) {
    var P = this.p, V = this.v;
    for (var i = 0; i < 5; i++) {
      var a = Math.PI + droop + (i - 2) * 0.09 * spread;
      var l = 0.42 + 0.04 * V[i + 40];
      ctx.fillStyle = col(i % 2 ? P.base : P.shade, 0.92 + 0.1 * V[i + 44]);
      feather(ctx, -0.3, -0.02, -0.3 + Math.cos(a) * l, -0.02 + Math.sin(a) * l, 0.04, 0.045);
    }
  };

  Bird.prototype.body = function (ctx) {
    var P = this.p, V = this.v;
    ctx.fillStyle = col(P.base, 1);
    ctx.beginPath(); ctx.ellipse(-0.03, -0.04, 0.37, 0.145, -0.12, 0, TAU); ctx.fill();
    // the neck, joining the body to the head
    ctx.beginPath(); ctx.moveTo(0.14, -0.15); ctx.quadraticCurveTo(0.3, -0.24, 0.42, -0.2);
    ctx.lineTo(0.38, -0.08); ctx.quadraticCurveTo(0.26, -0.02, 0.14, 0.04); ctx.closePath(); ctx.fill();
    // the shade along the belly, the light along the back: a few loaded strokes
    ctx.fillStyle = col(P.shade, 1, 0.75);
    feather(ctx, 0.24, 0.0, -0.36, 0.02, 0.05, 0.06);
    ctx.fillStyle = col(P.deep, 1, 0.35);
    feather(ctx, 0.1, 0.06, -0.3, 0.04, 0.025, 0.03);
    ctx.fillStyle = col(P.light, 1, 0.9);
    feather(ctx, 0.2, -0.13, -0.3, -0.1, 0.03, 0.04);
    feather(ctx, 0.05 + 0.05 * V[50], -0.15, -0.16, -0.13, 0.02, 0.025);
  };

  Bird.prototype.headpart = function (ctx, tilt) {
    var P = this.p;
    ctx.save(); ctx.translate(0.36, -0.2); ctx.rotate(tilt);
    ctx.fillStyle = col(P.base, 1);
    ctx.beginPath(); ctx.arc(0, -0.02, 0.105, 0, TAU); ctx.fill();
    ctx.fillStyle = col(P.light, 1, 0.9);
    feather(ctx, -0.06, -0.08, 0.07, -0.08, 0.02, 0.03);
    ctx.fillStyle = col(P.shade, 1, 0.55);
    feather(ctx, -0.06, 0.05, 0.06, 0.05, 0.015, 0.025);
    var o = this.beak;
    // the throat swells as the bird sings
    if (this.singing > 0.01) {
      ctx.fillStyle = col(P.base, 0.97);
      ctx.beginPath(); ctx.ellipse(0.0, 0.07, 0.07 + 0.03 * o, 0.05 + 0.025 * o, 0.3, 0, TAU); ctx.fill();
    }
    // the bill: the upper half, and the lower half hinged at the gape, opening with each note
    var la = o * 0.55;
    if (o > 0.02) {
      ctx.fillStyle = "rgba(58,30,32,0.95)";
      ctx.beginPath(); ctx.moveTo(0.08, -0.01); ctx.lineTo(0.25, -0.012);
      ctx.lineTo(0.08 + Math.cos(la) * 0.16, -0.005 + Math.sin(la) * 0.16); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = col(P.beak, 0.86);
    ctx.save(); ctx.translate(0.08, -0.005); ctx.rotate(la);
    ctx.beginPath(); ctx.moveTo(0, -0.008); ctx.quadraticCurveTo(0.09, -0.004, 0.16, 0.0); ctx.lineTo(0, 0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = col(P.beak, 1);
    ctx.beginPath(); ctx.moveTo(0.085, -0.045); ctx.quadraticCurveTo(0.17, -0.03, 0.26, -0.012 + 0.012 * (1 - o)); ctx.lineTo(0.08, -0.006); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col(P.eye, 1);
    ctx.beginPath(); ctx.arc(0.035, -0.035, 0.019, 0, TAU); ctx.fill();
    ctx.restore();
  };

  // draw the bird at (x, y) on the screen, its body length L pixels
  Bird.prototype.draw = function (ctx, x, y, L) {
    var P = this.p, fly = this.open;
    ctx.save();
    ctx.translate(x, y); ctx.scale(this.face * L, L); ctx.rotate(this.pitch);
    // wing pose
    var phi, ext, bend;
    if (this.glide) { phi = 0.25 + 0.05 * Math.sin(this.phase * TAU); ext = 1; bend = 0.2; }
    else {
      var c = Math.cos(this.phase * TAU), s = Math.sin(this.phase * TAU);
      phi = (35 + 62 * c) * Math.PI / 180;
      ext = 0.8 + 0.2 * Math.max(0, s);
      bend = 0.12 + 0.65 * Math.max(0, -s);
      if (this.flare) { phi = (70 + 28 * c) * Math.PI / 180; ext = 0.9; bend = 0.3; }
    }
    if (fly > 0.02) this.wing(ctx, -1, phi, ext, bend, fly);          // the far wing, behind the body
    if (fly < 0.98) {                                                // the legs of a sitting bird
      ctx.strokeStyle = col(P.leg, 1, 1 - fly); ctx.lineWidth = 0.028; ctx.lineCap = "round";
      ctx.save(); ctx.rotate(-this.pitch);
      ctx.beginPath(); ctx.moveTo(0.0, 0.05); ctx.lineTo(-0.01, 0.2); ctx.moveTo(0.07, 0.05); ctx.lineTo(0.07, 0.2);
      ctx.moveTo(-0.07, 0.2); ctx.lineTo(0.06, 0.2); ctx.moveTo(0.0, 0.2); ctx.lineTo(0.14, 0.2); ctx.stroke();
      ctx.restore();
    }
    this.tailfan(ctx, this.flare ? 2.2 : 1 + this.tail, fly > 0.5 ? 0.05 : 0.45 + 0.15 * this.tail);
    this.body(ctx);
    this.headpart(ctx, this.head - (fly > 0.5 ? 0 : this.pitch * 0.6) + this.peck - 0.32 * this.singing - 0.06 * this.beak);
    if (fly < 0.98) this.folded(ctx, 1 - fly);
    if (fly > 0.02) this.wing(ctx, 1, phi, ext, bend, fly);           // the near wing, over the body
    ctx.restore();
  };

  // ---- the flock --------------------------------------------------------------------------------------------
  // view: { map(u, v) -> [x, y] in CSS pixels (with the sway), size() -> [w, h], unit() -> pixels a bird is long }
  // perches: [{u, v, kind: "branch" | "hedge" | "ground"}] in shares of the painting
  function Flock(canvas, view) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.view = view;
    this.birds = []; this.perches = []; this.running = false; this.last = 0; this.t = 0;
    this.leaves = []; this.lr = rng(977);
    this.sound = new Sound();
  }
  // a bird sings: the song is heard (if the visitor has birdsong on) and seen (the bill opens with each note)
  Flock.prototype.sing = function (b, short) {
    var notes = b.voice.chirp(b.r), end = 0, delay = 0.04;
    for (var i = 0; i < notes.length; i++) end = Math.max(end, notes[i].t + notes[i].dur);
    b.song = { start: performance.now() / 1000 + delay, notes: notes, end: end };
    if (this.sound.ready()) {
      var q = this.view.map(b.u, b.v0, false), w = this.view.size()[0];
      var pan = Math.max(-1, Math.min(1, q[0] / w * 2 - 1)) * 0.75;
      var away = b.state === "off";                                   // a bird out of the picture: farther off
      this.sound.play(notes, away ? (b.u < 0.5 ? -0.85 : 0.85) : pan, (0.55 + 0.4 * b.scale) * 0.63 * (away ? 0.6 : 1), delay);   // the calls sit inside the rustle
    }
  };
  // the bill and the head follow the song: open on each note, the head lifted while it lasts
  Flock.prototype.songPose = function (b, dt) {
    var o = 0;
    if (b.song) {
      var tau = performance.now() / 1000 - b.song.start;
      if (tau > b.song.end + 0.1) b.song = null;
      // the birds are drawn 12 times a second: a note is shown if it sounded at any time since the last frame
      else for (var i = 0; i < b.song.notes.length; i++) {
        var n = b.song.notes[i];
        if (n.t < tau && n.t + n.dur > tau - 1 / 12) {
          var tm = Math.min(Math.max(tau, n.t + 0.001), n.t + n.dur - 0.001);
          o = Math.max(o, Math.pow(Math.sin(Math.PI * (tm - n.t) / n.dur), 0.6) * (0.55 + 0.45 * n.amp));
          o = Math.max(o, 0.6 + 0.4 * n.amp);
        }
      }
    }
    b.beak = o;
    b.singing = lerp(b.singing, b.song ? 1 : 0, Math.min(1, dt * 6));
  };

  // ---- leaves blown off by the gusts --------------------------------------------------------------------------
  var LEAF = [[34, 74, 60], [62, 112, 66], [140, 164, 66], [46, 104, 104], [164, 136, 70], [52, 70, 120]].map(toneC);
  Flock.prototype.stepLeaves = function (dt) {
    var view = this.view, r = this.lr, sz = view.size(), unit = view.unit();
    if (!view.gust) return;
    var rate = sz[0] > 700 ? 12 : 6;                                   // leaves a second at the height of a strong gust
    for (var k = 0; k < 3; k++) {
      var u = r(), v = 0.04 + r() * (view.canopy() - 0.06);
      var g = view.gust(u);
      if (g > 0.05 && r() < rate * dt * g / 3 && this.leaves.length < 48) {
        var q = view.map(u, v, true);
        this.leaves.push({ x: q[0], y: q[1], vx: 10, vy: 0, a: r() * 6.28, spin: (r() - 0.5) * 8, ph: r(), fr: 1.4 + r() * 1.8,
          c: LEAF[Math.floor(r() * LEAF.length)], s: unit * (0.22 + 0.12 * r()),
          rest: view.map(u, 0.88 + r() * 0.1, false)[1], life: 0, fade: 1 });
      }
    }
    for (var i = this.leaves.length - 1; i >= 0; i--) {
      var L = this.leaves[i];
      L.life += dt;
      if (L.y < L.rest) {
        var gl = view.gust(Math.min(1, Math.max(0, L.x / sz[0])));
        L.vx += ((25 + 190 * gl) - L.vx) * Math.min(1, dt * 1.6);
        L.vy += ((30 - 25 * gl + 22 * Math.sin(L.life * 3 + L.ph * 6)) - L.vy) * Math.min(1, dt * 2);
        L.x += L.vx * dt; L.y += L.vy * dt;
        L.a += L.spin * dt; L.ph += L.fr * dt;
      } else { L.fade -= dt / 3; L.ph = 0.0; }                            // on the lawn: it lies flat, then fades
      if (L.fade <= 0 || L.x > sz[0] + 30 || L.life > 14) this.leaves.splice(i, 1);
    }
  };
  Flock.prototype.drawLeaves = function (ctx) {
    for (var i = 0; i < this.leaves.length; i++) {
      var L = this.leaves[i], f = Math.cos(L.ph * TAU);
      ctx.save();
      ctx.translate(L.x, L.y); ctx.rotate(L.a); ctx.scale(1, Math.max(0.12, Math.abs(f)));
      ctx.globalAlpha = Math.max(0, Math.min(1, L.fade)) * Math.min(1, L.life * 4);
      var k = f > 0 ? 1 : 1.35;                                         // the underside is paler
      ctx.fillStyle = col(L.c, k, 1, f > 0 ? 0 : 18);
      feather(ctx, -L.s * 0.5, 0, L.s * 0.5, 0, L.s * 0.2, L.s * 0.28);
      ctx.fillStyle = col(L.c, 1.5, 0.55, 20);
      feather(ctx, -L.s * 0.35, -L.s * 0.05, L.s * 0.3, -L.s * 0.06, L.s * 0.06, L.s * 0.08);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };
  Flock.prototype.setPerches = function (list) {
    this.perches = list.map(function (p) { return { u: p[0], v: p[1], kind: p[2], who: null }; });
    // birds that sat on the old perches fly in again
    this.birds.forEach(function (b) { b.state = "off"; b.at = null; b.timer = 1 + b.r() * 4; });
  };
  Flock.prototype.setBirds = function (n) {
    var kinds = n >= 5 ? ["white", "white", "blue", "white", "white", "blue"] : ["white", "blue", "white", "white"];
    this.birds = [];
    for (var i = 0; i < n; i++) {
      var b = new Bird(kinds[i % kinds.length], 101 + i * 37, 0.82 + 0.3 * ((i * 0.618) % 1));
      b.timer = 0.1 + i * 0.22 + b.r() * 0.2;                        // they come in together, on the first gust
      b.slot = i;
      this.birds.push(b);
    }
  };
  Flock.prototype.free = function (b, kinds) {
    var out = [];
    for (var i = 0; i < this.perches.length; i++) {
      var p = this.perches[i];
      if (!p.who && !p.temp && p !== b.at && (!kinds || kinds.indexOf(p.kind) >= 0)) out.push(p);
    }
    return out;
  };
  Flock.prototype.path = function (u0, v0, u1, v1) {
    var sz = this.view.size(), dist = Math.hypot((u1 - u0) * sz[0], (v1 - v0) * sz[1]);
    var lift = Math.min(0.18, 0.04 + dist / sz[1] * 0.25);
    return { pts: [[u0, v0], [lerp(u0, u1, 0.25), v0 - lift - 0.03], [lerp(u0, u1, 0.75), v1 - lift * 0.8], [u1, v1]], dist: dist };
  };
  // choose where to go next: mostly a perch nearby, now and then the lawn, sometimes away out of the picture
  Flock.prototype.choose = function (b) {
    var r = b.r();
    if (b.state !== "off" && r < 0.12) return null;
    var kinds = r < 0.3 ? ["ground"] : r < 0.4 ? ["hedge"] : ["branch"];
    var list = this.free(b, kinds);
    if (!list.length) list = this.free(b, null);
    if (!list.length) return null;
    var wsum = 0, ws = [];
    for (var i = 0; i < list.length; i++) {
      var d = Math.hypot(list[i].u - b.u, (list[i].v - b.v0) * 0.8);
      var w = 1 / (0.12 + d); w *= w;
      ws.push(w); wsum += w;
    }
    var x = b.r() * wsum;
    for (i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
    return list[list.length - 1];
  };
  // a flight from where the bird is to a perch (or out of the picture), as a curve in shares of the painting
  Flock.prototype.fly = function (b, to) {
    var u0 = b.u, v0 = b.v0, P = null;
    // called away in mid-flight: the perch it was going to is free again
    if (b.state === "fly" && b.dest && b.dest !== to && b.dest.who === b) this.release(b.dest);
    if (to) { P = this.path(u0, v0, to.u, to.v); to.who = b; }
    else P = this.path(u0, v0, u0 < 0.5 ? -0.12 : 1.12, 0.1 + b.r() * 0.4);   // away, out of the picture
    if (b.at) { this.release(b.at); b.at = null; }
    b.path = P.pts;
    b.dur = clamp(P.dist / (190 + 70 * b.r()), 0.9, 6);
    b.inFlight = b.state === "off";               // coming in from outside the picture: already flying, no take-off
    b.tt = 0; b.dest = to; b.state = "fly"; b.glide = false;
    b.glideAt = b.r() < 0.6 ? 0.35 + b.r() * 0.2 : 2;
  };

  Flock.prototype.release = function (p) {
    p.who = null;
    if (p.temp) { var i = this.perches.indexOf(p); if (i >= 0) this.perches.splice(i, 1); }
  };
  // a click: the nearest few birds come to the spot and stay a little while (on the lawn if it fell on the lawn,
  // in the leaves if it fell in the trees), and the first to arrive calls
  Flock.prototype.summon = function (x, y) {
    var view = this.view, sz = view.size(), uv = view.unmap(x, y), self = this;
    if (!uv) return;
    var ground = uv[1] > view.canopy() + 0.06;
    var n = Math.min(this.birds.length, sz[0] > 700 ? 4 : 3), unit = view.unit();
    var near = this.birds.slice().sort(function (a, b) {
      var qa = view.map(a.u, a.v0, false), qb = view.map(b.u, b.v0, false);
      return Math.hypot(qa[0] - x, qa[1] - y) - Math.hypot(qb[0] - x, qb[1] - y);
    }).slice(0, n);
    near.forEach(function (b, i) {
      var a = i / n * 6.2832 + self.lr() * 0.8, rr = (i ? 1.6 + self.lr() * 1.2 : 0.4) * unit;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * (ground ? 0.35 : 0.8);
      var q = view.unmap(px, py);
      var p = { u: q[0], v: q[1], kind: ground ? "ground" : "branch", who: null, temp: true };
      self.perches.push(p);
      if (b.state === "off") { b.u = x < sz[0] / 2 ? -0.1 : 1.1; b.v0 = 0.1 + self.lr() * 0.3; b.entered = true; }
      self.fly(b, p);
      b.summoned = true;
    });
    this.summonCall = true;
  };

  function bez(p, t) {
    var a = 1 - t;
    return [a * a * a * p[0][0] + 3 * a * a * t * p[1][0] + 3 * a * t * t * p[2][0] + t * t * t * p[3][0],
            a * a * a * p[0][1] + 3 * a * a * t * p[1][1] + 3 * a * t * t * p[2][1] + t * t * t * p[3][1]];
  }

  // the calls: one bird at a time, every four to ten seconds (a few in every half minute), mostly a bird that
  // is sitting, sometimes one in flight; if none is in the picture, one just out of it
  Flock.prototype.calls = function () {
    var now = performance.now() / 1000, r = this.lr;
    if (!this.nextCall) this.nextCall = now + 2.5;
    if (now < this.nextCall) return;
    this.nextCall = now + 4 + 6 * r();
    var pick = function (list) { return list.length ? list[Math.floor(r() * list.length)] : null; };
    var free = this.birds.filter(function (b) { return !b.song; });
    var sitting = free.filter(function (b) { return b.state === "sit" || b.state === "ground"; });
    var flying = free.filter(function (b) { return b.state === "fly"; });
    var b = (r() < 0.8 ? pick(sitting) : null) || pick(flying) || pick(sitting) || pick(free);
    if (b) this.sing(b, true);
  };
  // where across the picture the wind is now, for the sound (-1 left .. 1 right; 0 when it is still)
  Flock.prototype.windPan = function () {
    if (!this.view.gust) return 0;
    var sum = 0, at = 0;
    for (var i = 0; i < 5; i++) { var u = 0.1 + 0.2 * i, g = this.view.gust(u); sum += g; at += g * u; }
    return sum > 0.02 ? (at / sum) * 2 - 1 : 0;
  };
  Flock.prototype.step = function (dt) {
    var self = this;
    this.calls();
    this.birds.forEach(function (b) {
      b.timer -= dt;
      self.songPose(b, dt);
      if (b.state === "off") {
        if (b.timer <= 0) {
          // in from the left (the first time, close together, on the first gust) or from either side
          var first = !b.entered, side = first || b.r() < 0.5 ? -0.12 : 1.12;
          if (first) side = -0.035;                 // the first time, from just outside the edge: in at once
          b.u = side + (side < 0 ? -1 : 1) * 0.02 * b.r();
          b.v0 = first ? 0.14 + 0.06 * b.slot + 0.04 * b.r() : 0.08 + b.r() * 0.35;
          var to = self.choose(b);
          if (to) { self.fly(b, to); b.entered = true; } else b.timer = 2;
        }
        return;
      }
      if (b.state === "fly") {
        b.tt += dt / b.dur;
        var t = clamp(b.tt, 0, 1);
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // away from rest and back to rest
        if (b.inFlight) e = 1 - (1 - t) * (1 - t);                       // in at full speed, slowing only to land
        e = lerp(t, e, 0.65);
        var q = bez(b.path, e);
        var q2 = bez(b.path, Math.min(1, e + 0.01));
        b.u = q[0]; b.v0 = q[1];
        b.open = Math.min(1, b.open + dt * 5);
        var landing = b.dest && t > 0.82;
        b.flare = landing;
        b.glide = !landing && t > b.glideAt && t < b.glideAt + 0.3;
        if (!b.glide) b.phase = (b.phase + dt * b.hz * (landing ? 1.5 : 1)) % 1;
        var sz = self.view.size();
        var vx = (q2[0] - q[0]) * sz[0], vy = (q2[1] - q[1]) * sz[1];
        if (Math.abs(vx) > 0.02) b.face = vx > 0 ? 1 : -1;
        var want = landing ? -0.45 : clamp(Math.atan2(vy, Math.abs(vx) + 1e-6) * 0.6, -0.5, 0.5);
        b.pitch = lerp(b.pitch, want, Math.min(1, dt * 6));
        if (t >= 1) {
          if (!b.dest) { b.state = "off"; b.timer = 4 + b.r() * 9; b.open = 0; return; }
          b.at = b.dest; b.state = b.dest.kind === "ground" ? "ground" : "sit";
          b.timer = (b.state === "ground" ? 5 : 6) + b.r() * 12;
          if (b.dest.temp) {
            b.timer = 6 + b.r() * 5;
            if (self.summonCall) { self.summonCall = false; self.sing(b, true); }
          }
          b.flare = false; b.glide = false; b.hop = null; b.look = 1 + b.r() * 2;
          b.landed = true;
        }
        return;
      }
      // sitting on a branch, the hedge or the lawn
      b.open = Math.max(0, b.open - dt * 4);
      b.pitch = lerp(b.pitch, b.state === "ground" ? -0.15 : -0.4, Math.min(1, dt * 5));
      b.look -= dt;
      if (b.look <= 0) {                                               // turn the head, flick the tail, face about
        var r = b.r();
        if (r < 0.3) b.face = -b.face;
        b.headTo = (b.r() - 0.5) * 0.5; b.flick = 0.25;
        b.look = 0.8 + b.r() * 2.5;
      }
      b.head = lerp(b.head, b.headTo || 0, Math.min(1, dt * 8));
      b.flick = Math.max(0, (b.flick || 0) - dt);
      b.tail = Math.sin(b.flick * 40) * b.flick * 2;
      if (b.state === "ground") {
        if (!b.hop && b.r() < dt * 0.9) {                                // a hop along the lawn, or a peck
          if (b.r() < 0.6) { var du = (b.r() - 0.5) * 0.05; b.hop = { u0: b.at.u, u1: clamp(b.at.u + du, 0.02, 0.98), t: 0 }; b.face = du > 0 ? 1 : -1; }
          else b.peckT = 0.45;
        }
        if (b.hop) { b.hop.t += dt / 0.28; if (b.hop.t >= 1) { b.at.u = b.hop.u1; b.hop = null; } }
        b.peckT = Math.max(0, (b.peckT || 0) - dt);
        b.peck = b.peckT > 0 ? Math.sin(b.peckT / 0.45 * Math.PI) * 0.9 : 0;
        b.u = b.hop ? lerp(b.hop.u0, b.hop.u1, b.hop.t) : b.at.u;
      } else { b.u = b.at.u; b.peck = 0; }
      b.v0 = b.at.v;
      if (b.timer <= 0 && !b.song) { var nx = self.choose(b); self.fly(b, nx); b.phase = 0.5; }
    });
  };

  function hash(a, b, c) { var x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); }
  Flock.prototype.render = function () {
    var self = this;
    var ctx = this.ctx, c = this.c;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var unit = this.view.unit(), view = this.view;
    this.drawLeaves(ctx);
    // the farther (higher) birds first, so the nearer ones pass over them
    var order = this.birds.slice().sort(function (a, b) { return a.v0 - b.v0; });
    order.forEach(function (b) {
      if (b.state === "off") return;
      var L = unit * b.scale;
      var q = view.map(b.u, b.v0, b.state !== "fly");
      var y = q[1];
      if (b.state === "sit" || b.state === "ground") {
        y -= 0.2 * L;                                                    // the feet on the perch
        if (b.hop) y -= Math.sin(b.hop.t * Math.PI) * 0.3 * L;
      } else if (!b.glide) y -= Math.sin(b.phase * TAU) * 0.05 * L;     // the body lifts on each down beat
      var k = Math.floor((self.frameN || 0) / 2), bi = self.birds.indexOf(b);
      var j1 = hash(k, bi, 1) - 0.5, j2 = hash(k, bi, 2) - 0.5, j3 = hash(k, bi, 3) - 0.5;
      ctx.save(); ctx.translate(q[0] + j1 * 0.03 * L, y + j2 * 0.03 * L); ctx.rotate(j3 * 0.03);
      b.draw(ctx, 0, 0, L);
      ctx.restore();
    });
  };

  Flock.prototype.start = function () {
    var self = this;
    if (this.running) return;
    this.running = true; this.last = 0;
    // the birds and the leaves live on smoothly but are drawn in steps, on the painting's own 12-a-second clock
    // (view.frame), so they move like the leaves in the wind, as if repainted frame by frame
    var tick = function (now) {
      if (!self.running) return;
      self.raf = requestAnimationFrame(tick);
      var dt = self.last ? Math.min(0.05, (now - self.last) / 1000) : 0;
      self.last = now;
      self.step(dt);
      self.stepLeaves(dt);
      var f = self.view.frame ? self.view.frame() : Math.floor(now / (1000 / 12));
      if (f !== self.frameAt) { self.frameAt = f; self.frameN = (self.frameN || 0) + 1; self.render(); }
    };
    this.raf = requestAnimationFrame(tick);
  };
  Flock.prototype.stop = function () {
    this.running = false; cancelAnimationFrame(this.raf);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.c.width, this.c.height);
  };
  Flock.prototype.pause = function () { this.running = false; cancelAnimationFrame(this.raf); };
  Flock.prototype.reset = function () {
    this.leaves = []; this.nextCall = 0;
    this.perches.forEach(function (p) { p.who = null; });
    var i = 0;
    this.birds.forEach(function (b) {
      b.state = "off"; b.at = null; b.open = 0; b.song = null; b.entered = false; b.landed = false;
      b.timer = 0.1 + (i++) * 0.22 + b.r() * 0.2;
    });
  };

  window.ForestBirds = { Flock: Flock, Bird: Bird, Sound: Sound };
})();
