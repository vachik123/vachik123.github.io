// Links marked as a reader marks a page: on hover (or keyboard focus) a link is annotated by hand, in a warm coral
// pencil. A short link is circled: a loose, tilted loop that overshoots where it began. A longer one (or one that
// wraps) is underlined with a quick stroke and a shorter stroke back beneath it. The mark is drawn in at the pace
// of a quick hand (off at once, slowing as it finishes), light where the pencil lands, heavier in
// the middle, flicking off at the end, with the grain of the pencil along it. It is drawn 12 times a second like
// the painting, a touch differently every other frame while it stays. It sits on a layer under the text. When
// the pointer leaves, it fades. With reduced motion the mark is there at once and holds still.
(function () {
  "use strict";
  var cv = document.querySelector(".link-paint");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var STEP = 1000 / 12, OUT = 260;
  var INK = [239, 150, 128];                 // coral: the complement of the painting's greens, near its pink dabs
  var items = [], raf = 0, frameAt = -1, frameN = 0, seedN = 1;

  function rng(seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function hand(t) { return 1 - Math.pow(1 - t, 2.4); }   // the pencil sets off at once and slows as it finishes

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // a loose circle round the box: tilted, a little lopsided, overshooting its start
  function circle(r, R) {
    var cx = (r.left + r.right) / 2 + (R() - 0.5) * 3, cy = (r.top + r.bottom) / 2 + 1 + (R() - 0.5) * 2;
    var rx = r.width / 2 + 9 + R() * 5, ry = r.height / 2 + 5 + R() * 3;
    var tilt = (R() - 0.5) * 0.2, a0 = -2.2 - R() * 0.7, sweep = 6.2832 + 0.7 + R() * 0.6;
    var w1 = R() * 6.28, w2 = R() * 6.28, n = 72, pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, a = a0 + sweep * t;
      // it starts a little inside and spirals out past its start; the hand pushes the loop out of round
      var k = 0.93 + 0.17 * t + 0.05 * Math.sin(a * 2 + w1) + 0.03 * Math.sin(a * 3 + w2);
      var x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    return [pts];
  }
  // an underline: one stroke along, and a shorter stroke back, a little lower
  function underline(r, R) {
    var y = r.bottom + 1 + R() * 1.5, x0 = r.left - 3 - R() * 3, x1 = r.right + 2 + R() * 5;
    var lift = (R() - 0.4) * 3, n = Math.max(8, Math.ceil((x1 - x0) / 5)), a = [], b = [];
    var ph = R() * 6.28, ph2 = R() * 6.28, bow = 0.8 + R() * 1.8, bow2 = 0.6 + R() * 1.4;
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = x0 + (x1 - x0) * t;
      a.push([x, y - lift * t + bow * Math.sin(t * Math.PI) + 0.6 * Math.sin(t * 5 + ph)]);
    }
    var bx0 = x1 - 4 - R() * 6, bx1 = x0 + (x1 - x0) * (0.2 + R() * 0.25), by = y + 3.5 + R() * 1.5;
    for (i = 0; i <= n; i++) {
      var u = i / n;
      b.push([bx0 + (bx1 - bx0) * u, by - lift * (1 - u) * 0.6 + bow2 * Math.sin(u * Math.PI) + 0.5 * Math.sin(u * 4 + ph2) + u * 1.2]);
    }
    return [a, b];
  }

  // a pencil line along pts, drawn up to prog: light where it lands, heavier through the middle, flicking off
  function pencil(pts, prog, alpha, seed, boil) {
    var n = pts.length - 1, B = rng(seed * 131 + boil * 17 + 5), R = rng(seed * 7 + 11);
    var J = []; for (var i = 0; i <= n; i++) J.push([(B() - 0.5) * 0.7, (B() - 0.5) * 0.7]);
    var upto = prog * n, m = Math.floor(upto), L = [], Rt = [];
    if (upto < 0.5) return;
    var at = function (i) {
      if (i <= m) return pts[i];
      var f = upto - m, p = pts[m], q = pts[Math.min(n, m + 1)];
      return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    };
    var last = Math.min(n, m + (upto > m ? 1 : 0));
    for (i = 0; i <= last; i++) {
      var t = Math.min(i, upto) / n, p0 = at(i), o = at(Math.max(0, i - 1)), q0 = at(Math.min(last, i + 1));
      var dx = q0[0] - o[0], dy = q0[1] - o[1], l = Math.hypot(dx, dy) || 1;
      var press = (0.4 + 0.6 * ss(0, 0.2, t)) * (1 - 0.75 * ss(0.78, 1, t)) * (0.85 + 0.15 * Math.sin(t * 13 + seed));
      var w = 0.45 + 1.0 * press;
      var x = p0[0] + J[i][0] * 0.6, y = p0[1] + J[i][1] * 0.6;
      L.push([x - dy / l * w, y + dx / l * w]); Rt.push([x + dy / l * w, y - dx / l * w]);
    }
    ctx.fillStyle = "rgba(" + INK[0] + "," + INK[1] + "," + INK[2] + "," + alpha + ")";
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (i = Rt.length - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
    ctx.closePath(); ctx.fill();
    // the grain: two fine broken strokes along the line, a hair to either side
    for (var g = 0; g < 2; g++) {
      var side = g ? 1 : -1, pen = false;
      ctx.strokeStyle = "rgba(" + (INK[0] + 10) + "," + (INK[1] + 20) + "," + (INK[2] + 20) + "," + (alpha * 0.45) + ")";
      ctx.lineWidth = 0.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      for (i = 0; i <= n && i <= upto; i++) {
        if (R() < 0.18) { pen = false; continue; }
        var o = pts[Math.max(0, i - 1)], q2 = pts[Math.min(n, i + 1)];
        var dx = q2[0] - o[0], dy = q2[1] - o[1], l = Math.hypot(dx, dy) || 1;
        var x = pts[i][0] - dy / l * side * 1.0 + J[i][0], y = pts[i][1] + dx / l * side * 1.0 + J[i][1];
        if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // the marks for one link, worked out once (from its boxes on the page) and redrawn as the page scrolls
  function plan(it) {
    var rects = it.a.getClientRects(), sy = window.scrollY, R = rng(it.seed), marks = [];
    var circled = rects.length === 1 && rects[0].width < 190;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.width < 1) continue;
      var box = { left: r.left, right: r.right, top: r.top + sy, bottom: r.bottom + sy, width: r.width, height: r.height };
      var strokes = circled ? circle(box, R) : underline(box, R);
      for (var k = 0; k < strokes.length; k++) marks.push(strokes[k]);
    }
    it.marks = marks; it.sy = sy;
    // time for each stroke, by its length: a hand moves at about 600 px a second, the stroke back a little faster
    it.durs = marks.map(function (m, k) {
      var L = 0; for (var j = 1; j < m.length; j++) L += Math.hypot(m[j][0] - m[j - 1][0], m[j][1] - m[j - 1][1]);
      return Math.max(90, L / (circled ? 1.3 : (k % 2 ? 1.5 : 1.1)));
    });
  }

  function paint(it, now) {
    if (!it.marks) plan(it);
    if (it.until && now > it.until && !it.out) it.out = now;
    var fade = it.out ? Math.max(0, 1 - (now - it.out) / OUT) : 1;
    if (reduce.matches && it.out) fade = 0;
    if (fade <= 0) return false;
    var since = now - it.t0, boil = reduce.matches ? 0 : Math.floor(frameN / 2), dy = -window.scrollY;
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(0, dy);
    var t = 0;
    for (var k = 0; k < it.marks.length; k++) {
      var p = reduce.matches ? 1 : hand(Math.min(1, Math.max(0, (since - t) / it.durs[k])));
      t += it.durs[k] + 25;                    // the pencil lifts for a moment between strokes
      if (p <= 0) break;
      pencil(it.marks[k], p, 0.92, it.seed * 3 + k, boil);
    }
    ctx.restore();
    return true;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    var f = Math.floor(now / STEP);
    if (f === frameAt) return;
    frameAt = f; frameN++;
    size();
    ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    items = items.filter(function (it) { return paint(it, now); });
    if (!items.length) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight); }
  }
  function kick() { frameAt = -1; if (!raf) raf = requestAnimationFrame(loop); }

  function enter(a) {
    for (var i = 0; i < items.length; i++) if (items[i].a === a) { if (items[i].out) { items[i].out = 0; } return; }
    items.push({ a: a, t0: performance.now() - 45, out: 0, seed: seedN++ * 7919 });   // something shows at once
    a.classList.add("is-painted");
    kick();
  }
  function leave(a) {
    a.classList.remove("is-painted");
    for (var i = 0; i < items.length; i++) if (items[i].a === a && !items[i].out) items[i].out = performance.now();
    kick();
  }
  var links = document.querySelectorAll(".wrap a");
  for (var i = 0; i < links.length; i++) {
    (function (a) {
      a.addEventListener("mouseenter", function () { enter(a); });
      a.addEventListener("mouseleave", function () { if (document.activeElement !== a) leave(a); });
      a.addEventListener("focus", function () { enter(a); });
      a.addEventListener("blur", function () { leave(a); });
    })(links[i]);
  }
  window.addEventListener("scroll", kick, { passive: true });
  // a click on the painting: a small circle drawn round the spot, as if to say "here", gone again in a moment
  window.ForestLinks = {
    markAt: function (x, y) {
      var sy = window.scrollY, seed = seedN++ * 7919, R = rng(seed);
      var box = { left: x - 9, right: x + 9, top: y - 6 + sy, bottom: y + 6 + sy, width: 18, height: 12 };
      var marks = circle(box, R);
      var it = { a: null, t0: performance.now(), out: 0, seed: seed, marks: marks, durs: [reduce.matches ? 1 : 300] };
      it.until = it.t0 + 900;
      items.push(it);
      kick();
    }
  };
  window.addEventListener("resize", function () { items.forEach(function (it) { if (it.a) it.marks = null; }); kick(); });
})();
