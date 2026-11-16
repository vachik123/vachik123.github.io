// The forest background: a painting timelapse on arrival, then the finished painting, alive.
// One WebGL layer draws both (the video's frames, then the still). Nothing is drawn around the text: the text
// reads on the painting itself, whose lightest marks are quieted evenly over the whole picture (each keeps its
// color and its place among the lights, the dark paint is hardly touched), just enough for the text to read. The live layer: gusts of wind cross the trees
// (the canopy moves in clumps, leaves flash pale as they turn, a few leaves are blown off), the light drifts,
// now and then a leaf-sized patch trembles, and birds (scripts/birds.js) fly between the branches, sit, hop on
// the lawn, call now and then, leave and come back. With reduced motion, only the still.
(function () {
  "use strict";
  var root = document.querySelector(".forest");
  if (!root) return;
  var still = root.querySelector(".forest-still");
  var video = root.querySelector(".forest-lapse");
  var canvas = root.querySelector(".forest-live");
  var birdCanvas = root.querySelector(".forest-birds");
  var replay = document.querySelector(".forest-replay");
  var soundBtn = document.querySelector(".forest-sound");
  var controls = document.querySelector(".forest-controls");
  // the text rises in as the dark structure finishes (keep in step with pace.py in the painting's project)
  var TEXT_AT = 1.2;
  var toneFrom = 0;                  // the lights are quieted as the text rises (before it, the painting as painted)
  function toneAmt() { return toneFrom ? Math.min(1, (performance.now() - toneFrom) / 900) : 0; }
  function textIn() {
    if (!toneFrom) toneFrom = performance.now();
    document.documentElement.classList.add("text-in");
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var tall = window.matchMedia("(max-aspect-ratio: 85/100)");   // the same test the <picture> uses
  // perches: [u, v, kind] as shares of the painting's width and height
  var VARIANTS = {
    mobile: { lapse: "/assets/forest/mobile.mp4?v=6", canopy: 0.8, edge: [0.815, 0.85], cell: 120, birds: 3, perches: [
      [0.08, 0.8, "branch"], [0.2, 0.815, "branch"], [0.33, 0.82, "branch"], [0.7, 0.815, "branch"], [0.83, 0.8, "branch"],
      [0.95, 0.79, "branch"], [0.15, 0.62, "branch"], [0.85, 0.66, "branch"], [0.1, 0.45, "branch"], [0.9, 0.5, "branch"],
      [0.78, 0.33, "branch"], [0.2, 0.3, "branch"],
      [0.15, 0.852, "hedge"], [0.38, 0.853, "hedge"], [0.62, 0.857, "hedge"], [0.85, 0.855, "hedge"],
      [0.3, 0.93, "ground"], [0.55, 0.95, "ground"], [0.72, 0.92, "ground"]] },
    desk: { lapse: "/assets/forest/desk.mp4?v=6", canopy: 0.75, edge: [0.765, 0.815], cell: 260, birds: 6, perches: [
      [0.045, 0.665, "branch"], [0.09, 0.705, "branch"], [0.14, 0.695, "branch"], [0.2, 0.735, "branch"], [0.275, 0.745, "branch"],
      [0.72, 0.74, "branch"], [0.795, 0.725, "branch"], [0.88, 0.7, "branch"], [0.945, 0.68, "branch"],
      [0.06, 0.42, "branch"], [0.15, 0.3, "branch"], [0.12, 0.56, "branch"], [0.22, 0.5, "branch"], [0.86, 0.36, "branch"],
      [0.93, 0.53, "branch"], [0.8, 0.6, "branch"], [0.95, 0.2, "branch"], [0.3, 0.62, "branch"], [0.68, 0.6, "branch"],
      [0.08, 0.8, "hedge"], [0.18, 0.798, "hedge"], [0.33, 0.8, "hedge"], [0.46, 0.797, "hedge"],
      [0.6, 0.8, "hedge"], [0.69, 0.795, "hedge"], [0.83, 0.8, "hedge"],
      [0.18, 0.9, "ground"], [0.34, 0.93, "ground"], [0.5, 0.91, "ground"], [0.63, 0.95, "ground"], [0.86, 0.92, "ground"]] }
  };
  // the trunks, exactly as painted (from the painting's script, in its own units: x 0..1000, y 0..h): the wind
  // moves only the leaves, never these
  var TRUNK_GEO = {"desk":{"h":625,"trunks":[[[32.1,640.0,24.0],[31.4,609.0,22.8],[29.7,578.0,21.6],[27.3,547.0,20.4],[24.6,516.0,19.2],[22.3,485.0,18.0],[20.8,454.0,16.8],[20.1,423.0,15.6],[20.3,392.0,14.4]],[[114.3,630.0,15.0],[114.7,603.8,14.2],[114.7,577.5,13.5],[114.8,551.2,12.8],[115.6,525.0,12.0],[117.2,498.8,11.2],[119.7,472.5,10.5],[122.7,446.2,9.8],[125.6,420.0,9.0]],[[246.3,590.0,8.0],[244.1,572.0,7.6],[242.3,554.0,7.2],[241.3,536.0,6.8],[241.2,518.0,6.4],[241.9,500.0,6.0],[242.6,482.0,5.6],[243.0,464.0,5.2],[242.5,446.0,4.8]],[[746.1,596.0,9.0],[746.3,577.2,8.6],[747.4,558.5,8.1],[749.3,539.8,7.7],[751.5,521.0,7.2],[753.6,502.2,6.8],[755.0,483.5,6.3],[755.4,464.8,5.8],[755.0,446.0,5.4]],[[915.6,638.0,20.0],[915.0,608.0,19.0],[914.9,578.0,18.0],[914.9,548.0,17.0],[914.3,518.0,16.0],[912.9,488.0,15.0],[910.6,458.0,14.0],[907.6,428.0,13.0],[904.6,398.0,12.0]],[[977.3,628.0,12.0],[980.0,602.5,11.4],[982.3,577.0,10.8],[983.9,551.5,10.2],[984.5,526.0,9.6],[984.4,500.5,9.0],[984.0,475.0,8.4],[983.8,449.5,7.8],[984.5,424.0,7.2]]],"far":[[0.0,502.8,-0.7,467.6,-0.3,432.4,1.5],[3.2,506.4,3.8,469.7,1.2,433.1,2.2],[10.7,505.4,10.1,466.2,9.7,427.0,2.16],[38.1,505.0,36.9,473.1,39.7,441.3,2.39],[44.0,505.8,44.0,469.2,44.8,432.5,1.57],[59.3,503.5,60.2,469.0,60.0,434.4,1.33],[63.0,501.2,63.3,478.8,62.2,456.5,1.29],[85.1,506.3,86.0,472.0,83.8,437.8,2.28],[94.9,505.0,94.9,468.4,95.2,431.7,1.22],[107.7,505.9,108.8,476.8,109.4,447.7,1.6],[111.9,503.1,112.8,462.9,112.3,422.7,2.43],[122.2,504.8,122.4,466.8,121.2,428.8,1.45],[128.9,501.5,128.8,461.6,129.2,421.7,1.47],[183.0,503.7,181.9,471.1,183.8,438.5,2.2],[189.9,502.7,188.9,471.6,191.1,440.4,1.61],[208.9,505.4,207.7,476.1,210.3,447.0,2.32],[211.6,505.3,212.9,471.6,209.7,438.0,1.24],[237.0,503.6,238.0,469.4,238.2,435.1,1.73],[240.2,508.1,241.7,473.5,238.3,438.9,1.96],[250.7,510.2,251.4,488.6,252.2,466.9,2.15],[257.4,509.8,257.7,487.1,255.4,464.5,1.35],[280.5,503.9,281.7,465.1,280.5,426.3,2.29],[317.9,506.4,316.8,466.9,317.1,427.4,2.44],[344.9,507.2,345.9,476.5,343.1,445.8,2.22],[349.0,507.4,349.2,479.4,347.6,451.4,1.65],[367.3,508.8,368.7,470.9,367.0,433.0,1.45],[370.7,508.4,371.2,476.1,369.1,443.7,1.55],[394.5,507.6,394.2,482.0,392.6,456.3,1.46],[400.5,507.3,401.4,483.4,399.6,459.4,1.56],[441.8,506.3,442.4,479.2,442.1,452.1,2.46],[447.3,505.6,447.3,487.1,445.7,468.6,1.93],[467.2,505.6,466.1,477.3,466.9,449.0,1.55],[479.3,504.5,478.9,473.2,480.9,441.9,1.18],[485.6,503.5,484.2,470.8,486.8,438.1,1.32],[492.9,500.7,491.6,471.0,492.9,441.4,1.63],[518.6,507.2,519.1,477.9,517.9,448.6,1.66],[521.6,506.0,521.5,477.7,523.3,449.4,2.22],[571.7,504.1,570.6,485.3,571.2,466.5,2.29],[581.7,506.7,582.5,485.7,583.3,464.7,1.28],[654.3,502.7,653.4,468.0,654.2,433.3,1.34],[658.1,506.1,658.2,471.7,659.7,437.3,1.44],[666.2,507.2,666.8,477.2,664.6,447.1,1.37],[679.6,505.4,680.4,477.2,678.0,449.0,2.14],[694.1,501.3,692.9,469.4,693.9,437.5,1.4],[700.3,500.1,701.3,474.4,699.9,448.7,2.2],[720.8,508.1,721.7,471.3,720.2,434.4,2.07],[729.1,503.2,729.9,474.8,730.6,446.4,1.64],[758.0,504.7,757.1,483.4,758.8,462.1,1.49],[761.5,503.8,760.1,471.5,761.4,439.1,1.19],[774.0,503.3,773.7,475.3,772.5,447.4,2.2],[777.2,506.6,776.5,480.5,777.0,454.4,1.41],[788.6,508.1,787.9,482.5,787.3,456.9,1.97],[801.1,506.0,801.9,487.9,799.4,469.7,1.83],[812.4,506.4,813.4,485.7,813.8,465.1,2.16],[819.1,502.0,818.2,473.4,820.4,444.8,2.39],[838.2,501.3,837.9,466.6,838.7,432.0,1.94],[842.1,504.4,840.7,464.8,842.4,425.2,2.13],[886.5,502.6,885.2,476.8,886.9,451.0,2.0],[890.9,504.4,891.9,469.8,892.7,435.2,2.04],[896.6,500.8,896.8,472.1,896.8,443.4,2.12],[902.3,503.1,902.0,468.9,904.1,434.6,2.28],[911.1,501.1,912.0,474.2,910.5,447.2,1.6],[922.6,507.8,921.4,470.2,921.1,432.6,1.55],[931.1,508.2,931.5,483.0,930.8,457.7,1.57],[937.5,508.4,938.8,487.3,938.5,466.2,1.58],[973.1,501.0,974.4,471.2,974.3,441.4,1.84],[974.2,503.7,973.5,473.1,974.0,442.5,1.72],[989.6,505.8,989.8,471.1,988.3,436.4,1.77],[990.7,505.5,990.8,477.8,991.3,450.1,2.05],[1000.0,507.0,1000.4,483.2,999.3,459.3,1.61]]},"mobile":{"h":2000,"trunks":[[[68.2,2030.0,84.0],[66.7,1961.2,79.8],[63.4,1892.5,75.6],[58.6,1823.8,71.4],[53.2,1755.0,67.2],[48.6,1686.2,63.0],[45.5,1617.5,58.8],[44.3,1548.8,54.6],[44.6,1480.0,50.4]],[[266.6,1930.0,36.0],[266.0,1881.2,34.2],[264.5,1832.5,32.4],[263.1,1783.8,30.6],[263.1,1735.0,28.8],[264.9,1686.2,27.0],[268.5,1637.5,25.2],[273.0,1588.8,23.4],[277.3,1540.0,21.6]],[[770.7,1900.0,30.0],[766.5,1856.2,28.5],[763.3,1812.5,27.0],[761.7,1768.8,25.5],[762.0,1725.0,24.0],[763.6,1681.2,22.5],[765.5,1637.5,21.0],[766.6,1593.8,19.5],[766.0,1550.0,18.0]],[[928.2,2030.0,76.0],[928.9,1960.0,72.2],[931.5,1890.0,68.4],[935.6,1820.0,64.6],[940.6,1750.0,60.8],[945.1,1680.0,57.0],[948.2,1610.0,53.2],[949.5,1540.0,49.4],[949.1,1470.0,45.6]]],"far":[[0.0,1704.7,3.0,1615.1,1.0,1525.5,3.82],[6.6,1710.0,3.9,1627.0,2.7,1543.9,3.87],[22.0,1700.9,21.9,1636.1,19.1,1571.2,3.29],[78.5,1718.2,79.0,1663.7,78.1,1609.2,4.85],[90.5,1708.9,91.1,1649.6,88.6,1590.3,3.4],[122.1,1705.2,122.3,1654.3,119.8,1603.5,4.82],[129.7,1704.3,130.0,1628.2,132.8,1552.1,4.32],[175.2,1710.0,172.8,1630.7,178.6,1551.5,2.38],[195.5,1713.4,194.1,1649.4,198.8,1585.3,3.6],[221.8,1701.1,221.5,1626.8,222.4,1552.4,4.65],[230.4,1701.1,229.9,1624.1,227.3,1547.1,4.87],[251.7,1721.7,250.7,1659.7,253.3,1597.7,2.65],[265.5,1709.7,264.0,1640.2,263.0,1570.7,3.13],[376.9,1712.7,379.0,1636.0,374.8,1559.4,4.49],[391.1,1719.8,390.5,1647.0,389.0,1574.3,3.28],[430.3,1707.5,428.8,1640.4,428.4,1573.3,3.83],[435.8,1702.0,435.1,1633.6,431.9,1565.1,4.08],[488.1,1711.7,490.3,1629.3,485.4,1546.8,3.49],[494.6,1700.8,496.7,1621.4,496.5,1542.0,4.29],[516.2,1708.9,517.8,1647.3,518.6,1585.7,2.43],[530.0,1711.5,531.2,1650.0,532.9,1588.5,3.8],[577.6,1712.4,580.4,1636.7,581.6,1560.9,2.56],[654.7,1703.3,654.6,1660.2,651.8,1617.0,3.35],[710.3,1707.4,711.7,1644.3,713.9,1581.3,3.92],[718.7,1708.7,720.9,1658.5,722.0,1608.2,4.41],[756.3,1711.5,757.4,1635.7,752.6,1559.8,3.33],[763.3,1713.5,762.6,1655.1,763.1,1596.7,4.09],[812.5,1711.1,813.6,1644.3,809.0,1577.4,4.77],[824.7,1704.6,825.7,1634.4,825.0,1564.1,4.45],[909.9,1710.8,908.1,1634.1,911.2,1557.3,4.46],[921.2,1711.2,918.9,1636.8,923.1,1562.3,4.78],[962.1,1700.6,961.0,1651.5,960.3,1602.5,3.0],[987.1,1711.2,986.7,1637.4,987.9,1563.7,4.26],[1000.0,1713.7,998.9,1663.9,1003.5,1614.1,3.04]]}};
  // a mask of the trunks in the painting's units (1 px a unit): white where a trunk is, with a small margin
  function trunkMask(name) {
    var G = TRUNK_GEO[name], c = document.createElement("canvas"), g = c.getContext("2d");
    c.width = 1000; c.height = G.h;
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineJoin = "round";
    G.trunks.forEach(function (pts) {
      var L = [], R = [];
      for (var i = 0; i < pts.length; i++) {
        var o = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
        var dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, w = pts[i][2] * 0.56 + 2;
        L.push([pts[i][0] - dy / l * w, pts[i][1] + dx / l * w]); R.push([pts[i][0] + dy / l * w, pts[i][1] - dx / l * w]);
      }
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (i = 1; i < L.length; i++) g.lineTo(L[i][0], L[i][1]);
      for (i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath(); g.fill();
    });
    G.far.forEach(function (f) {
      g.lineWidth = f[6] + 3;
      g.beginPath(); g.moveTo(f[0], f[1]); g.quadraticCurveTo(f[2] * 2 - (f[0] + f[4]) / 2, f[3] * 2 - (f[1] + f[5]) / 2, f[4], f[5]); g.stroke();
    });
    return c;
  }
  var V = tall.matches ? VARIANTS.mobile : VARIANTS.desk;
  // where the crop is anchored: low, so the trunks, the hedge and the lawn stay in view on any screen shape
  // (keep in step with object-position in the page's CSS)
  var POS = [0.5, 0.8];
  var tmtex = null, tmFor = null;
  var gl = null, prog = null, tex = null, texSrc = "", raf = 0, amp = 0, live = false, last = 0, tNow = 40;
  var mode = "";                     // "lapse": the video's frames; "live": the still, alive; "static": the still, once
  // the wind's clock: it starts 3 s into the timelapse (WIND_AT), while the trees are still filling with dots, and
  // runs on through the live painting
  var WIND_AT = 3.0;
  var liveFrom = 0, srcW = 1, srcH = 1, lastVideoT = -1;
  var flock = null;

  // ---- the wind ----------------------------------------------------------------------------------------------
  // Gusts cross the picture from left to right, one every ten or fifteen seconds. The canopy moves in soft
  // clumps (about 80 CSS pixels each), each with its own strength and delay: it leans with the gust, flutters,
  // springs back and settles; between gusts it barely breathes. The shader moves the painting with the same
  // numbers (the clumps' random values come from one table, given to the shader as a texture), so a bird sitting
  // on a branch moves with its clump.
  var WIND = { period: 12, speed: 0.3, push: 10, idle: 0.7, clump: 80 };
  // the painting is drawn a little larger than the screen, with this much of it (CSS px) past each edge, so the
  // wind (up to about 18 px in a gust, more with the pointer's ripples) always has real paint to move in
  var MARGIN = 32;
  var DAB = 13;                      // the moving pieces of paint: about the size of the painted marks (CSS px)
  var STEPS = 12;                    // the live painting moves 12 times a second
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function rnd1(k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var RT = new Uint8Array(64 * 64 * 4);
  (function () { var a = 7; for (var i = 0; i < RT.length; i++) { a = (a * 1103515245 + 12345) & 0x7fffffff; RT[i] = (a >> 16) & 255; } })();
  // the two gusts that may be moving now: [start, strength, start, strength]
  var GUSTS = [0, 0, 0, 0];
  var G0 = 39.2;                      // the wind's clock starts at 40: the first gust is entering from the left by then
  function gusts(t) {
    var k = Math.floor((t - G0) / WIND.period), j = 0;
    for (var kk = k - 1; kk <= k; kk++) {
      GUSTS[j++] = G0 + kk * WIND.period + (kk > 0 ? rnd1(kk) * 4 : 0);
      GUSTS[j++] = kk < 0 ? 0 : kk === 0 ? 1 : 0.45 + 0.55 * rnd1(kk + 71.3);
    }
    return GUSTS;
  }
  // how far a gust has bent the trees, s seconds after its front passed: lean, hold, let go, spring back
  function gustG(s) {
    if (s <= 0) return 0;
    var g = ss(0, 0.5, s) * (1 - ss(1.4, 3.0, s));
    if (s > 2.2) g -= 0.3 * Math.exp(-(s - 2.2) * 1.3) * Math.sin((s - 2.2) * 4.5);
    return g;
  }
  // the gust at a point across the picture now (0..1), without the clumps' delays: for the blown leaves
  function gustAt(u) {
    var g = 0;
    for (var j = 0; j < 4; j += 2) g += GUSTS[j + 1] * Math.max(0, gustG(tNow - GUSTS[j] - (u + 0.25) / WIND.speed));
    return g;
  }
  // ---- the pointer's wind, clump by clump (the shader has the same numbers) -----------------------------------
  // Not a ring that spreads: a short wake along the pointer's path that dies out within a clump or two. The canopy
  // gives unevenly: whole regions (a few clumps across) are stiff, others loose, and each clump answers late by its
  // own amount, turns the push its own way and sways back and forth a moment before it settles.
  var PP = 9;                         // the pointer's push at full strength, CSS pixels
  function ptrG(a, h) {               // a clump's answer, a seconds after the puff reached it: a push, then a sway
    if (a <= 0) return 0;
    return ss(0, 0.12, a) * Math.exp(-1.8 * a) * Math.cos(a * (6 + 4 * h));
  }
  function ptrEnv(a) { return a <= 0 ? 0 : ss(0, 0.12, a) * Math.exp(-1.8 * a); }
  // the pointer's push on the clump with id (cx, cy), centre (px, py) in image pixels; adds into out [x, y, level]
  function ptrClump(cx, cy, px, py, h, h2, h3, h4, t, out) {
    var co = (((((Math.floor(cy / 3) + 17) % 64) + 64) % 64) * 64 + ((((Math.floor(cx / 3) + 32) % 64) + 64) % 64)) * 4;
    var loose = (0.15 + 0.85 * ss(0.25, 0.85, RT[co] / 255)) * (0.35 + 0.9 * h3);
    if (loose <= 0) return;
    for (var k = 0; k < PUFFS.length; k++) {
      var P = PUFFS[k], age = t - P.t;
      if (age <= 0 || age > 2.6) continue;
      var ddx = px - P.ix, ddy = py - P.iy, d = Math.sqrt(ddx * ddx + ddy * ddy);
      var fall = Math.exp(-(d / P.r) * (d / P.r));
      if (fall < 0.01) continue;
      var a = age - h4 * 0.3 - (d / P.r) * 0.12;
      var dx = P.dx, dy = P.dy;
      if (dx === 0 && dy === 0) { dx = ddx / Math.max(d, 1); dy = ddy / Math.max(d, 1); }
      var an = (h2 - 0.5) * 1.4, ca = Math.cos(an), sa = Math.sin(an);
      var m = P.s * loose * fall;
      var g = ptrG(a, h);
      out[0] += m * g * (ca * dx - sa * dy);
      out[1] += m * g * (sa * dx + ca * dy);
      out[2] += m * ptrEnv(a);
    }
  }

  // the canopy moves, down through the fringe of its lowest leaves (the painted edge rises and falls across the
  // picture, so the movement fades out only below its lowest point); the hedge and the lawn stand still
  function height(v) { var e = V.edge; return (1 - ss(e[0], e[1], v)) * (0.6 + 0.4 * Math.min(1, Math.max(0, 1 - v / e[0]))); }
  // the wind's push at a point of the painting (image pixels ix, iy; C image pixels a clump), in CSS pixels
  var PO = [0, 0, 0];
  function windAt(ix, iy, iw, ih, C, t) {
    var bx = Math.floor(ix / C), by = Math.floor(iy / C), sx = 0, sy = 0, sw = 0;
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
      var cx = bx + i, cy = by + j;
      var o = ((((cy % 64) + 64) % 64) * 64 + (((cx % 64) + 64) % 64)) * 4;
      var h = RT[o] / 255, h2 = RT[o + 1] / 255, h3 = RT[o + 2] / 255, h4 = RT[o + 3] / 255;
      var px = (cx + 0.15 + 0.7 * h) * C, py = (cy + 0.15 + 0.7 * h2) * C;
      var d2 = ((ix - px) * (ix - px) + (iy - py) * (iy - py)) / (C * C);
      var w = Math.exp(-3 * d2);
      var cu = px / iw, dly = (h4 - 0.5) * 0.6, lean = 0;
      for (var g = 0; g < 4; g += 2) {
        var G = gustG(t - GUSTS[g] - (cu + 0.25) / WIND.speed - dly);
        lean += GUSTS[g + 1] * G * (1 + 0.25 * Math.sin(t * (6 + 4 * h) + 6.2832 * h2));
      }
      var ac = 0.6 + 0.8 * h3;
      sx += w * (WIND.push * ac * lean + WIND.idle * Math.sin(t * (0.6 + 0.5 * h) + 6.2832 * h3));
      sy += w * (WIND.push * 0.18 * ac * lean + WIND.idle * 0.6 * Math.sin(t * (0.8 + 0.4 * h2) + 6.2832 * h));
      PO[0] = 0; PO[1] = 0; PO[2] = 0;
      ptrClump(cx, cy, px, py, h, h2, h3, h4, t, PO);
      sx += w * PP * PO[0]; sy += w * PP * PO[1];
      sw += w;
    }
    var k = height(iy / ih) / sw;
    return [sx * k, sy * k];
  }


  // ---- the light of the painting ---------------------------------------------------------------------------------
  // The most light any mark may keep (linear luminance; the marks approach it softly and never pass it), the same
  // everywhere in the picture. Found by stepping it down (0.20, 0.16, 0.13, 0.12) and measuring the contrast of the
  // text against the painting behind it: at 0.12 all the body text (#f4f0e2) and all the muted text (#dfe1cf) is at
  // 4.5:1 or more (WCAG AA), on desktop and phone, at the top of the page and over the lawn at its foot.
  var LT = 0.12;

  // ---- the visitor's hand: the pointer's wind, and the click ---------------------------------------------------
  // Moving the pointer over the painting sends puffs of wind through the trees; a click sends a stronger one out
  // from where it fell, and calls a few birds there.
  var PUFFS = [], puffAt = 0, lastP = null, stir = 0, breeze = 0;
  function puff(x, y, dx, dy, strength) {
    if (!live) return;
    // where it fell on the painting (image pixels), and how far it reaches there: about 70 CSS px, more for a click
    var cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1, sc = Math.max(cw / srcW, ch / srcH);
    var ix = (x - (cw - srcW * sc) * POS[0]) / sc, iy = (y - (ch - srcH * sc) * POS[1]) / sc;
    PUFFS.push({ ix: ix, iy: iy, dx: dx, dy: dy, t: tLive(), s: strength, r: (80 + 50 * Math.min(1, strength)) * (dx === 0 && dy === 0 ? 1.8 : 1) / sc });
    if (PUFFS.length > 8) PUFFS.shift();
    stir = Math.min(1.5, stir + strength * 0.5);
  }
  function tLive() { return (performance.now() - liveFrom) / 1000 + 40.0; }
  window.addEventListener("pointermove", function (e) {
    var now = performance.now();
    if (lastP) {
      var dt = Math.max(1, now - lastP.t), vx = (e.clientX - lastP.x) / dt * 1000, vy = (e.clientY - lastP.y) / dt * 1000;
      var sp = Math.hypot(vx, vy), moved = Math.hypot(e.clientX - (lastP.px || 0), e.clientY - (lastP.py || 0));
      if (sp > 120 && (moved > 28 || now - puffAt > 90)) {
        puffAt = now;
        puff(e.clientX, e.clientY, vx / sp, vy / sp, Math.min(1, Math.max(0.15, sp / 1400)) * (e.pointerType === "touch" ? 0.5 : 1));
        lastP.px = e.clientX; lastP.py = e.clientY;
      }
    }
    lastP = { x: e.clientX, y: e.clientY, t: now, px: lastP ? lastP.px : e.clientX, py: lastP ? lastP.py : e.clientY };
  }, { passive: true });
  document.addEventListener("click", function (e) {
    if (!live || reduce.matches) return;
    if (e.target.closest && e.target.closest("a, button, input, textarea, select, label")) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    puff(e.clientX, e.clientY, 0, 0, 1.3);
    if (flock) flock.summon(e.clientX, e.clientY);
  });
  // how hard the wind blows now, for the sound of the leaves: the gusts across the trees, and the pointer's stir
  function windLevel() {
    if (!live) return 0;
    var g = 0;
    for (var i = 0; i < 5; i++) g += gustAt(0.1 + 0.2 * i);
    // the pointer's stir becomes a breeze that builds over a couple of seconds and fades as slowly, and only ever
    // adds a little: wiggling it never makes the sound jump
    stir = Math.min(1, stir) * 0.9;
    breeze += (stir - breeze) * 0.04;
    return (g / 5) * amp + Math.min(0.18, breeze * 0.3);
  }

  // ---- the arrival -----------------------------------------------------------------------------------------------
  // The timelapse fast-forwards to the dots, the text rises as they begin; then the painting comes alive, the first
  // gust crosses it, the birds fly in on the gust, and once they have landed the controls appear.
  var controlsTimer = 0;
  function showStill() {
    root.classList.remove("is-lapse");
    root.classList.add("is-still");
    textIn();
    startLive();
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function () {
      if (replay) replay.hidden = false;
      if (soundBtn && sound && sound.available()) soundBtn.hidden = false;
      requestAnimationFrame(function () { if (controls) controls.classList.add("is-shown"); });
    }, 3500);
  }

  function watchLapse() {
    if (!root.classList.contains("is-lapse")) return;
    if (video.currentTime >= TEXT_AT) textIn();
    if (video.currentTime >= WIND_AT && !liveFrom) liveFrom = performance.now();   // the wind begins
    if (!liveFrom || video.currentTime < TEXT_AT) requestAnimationFrame(watchLapse);
  }

  function playLapse() {
    clearTimeout(controlsTimer);
    if (controls) controls.classList.remove("is-shown");
    if (replay) replay.hidden = true;
    live = false; liveFrom = 0;
    if (flock) { flock.stop(); flock.reset(); }
    root.classList.remove("is-still");
    root.classList.add("is-lapse");
    if (initGL()) { mode = "lapse"; lastVideoT = -1; loop(); }
    video.currentTime = 0;
    var p = video.play();
    if (p && p.catch) p.catch(showStill);   // autoplay refused: show the finished painting
    requestAnimationFrame(watchLapse);
  }

  // ---- the birds -----------------------------------------------------------------------------------------
  function makeFlock() {
    if (flock || !birdCanvas || !window.ForestBirds) return;
    flock = new window.ForestBirds.Flock(birdCanvas, {
      size: function () { return [birdCanvas.clientWidth, birdCanvas.clientHeight]; },
      unit: function () { return Math.max(24, Math.min(44, Math.min(birdCanvas.clientWidth, birdCanvas.clientHeight) * 0.046)); },
      // a point of the painting on the screen, as object-fit: cover and object-position place it
      map: function (u, v, withSway) {
        var cw = birdCanvas.clientWidth, ch = birdCanvas.clientHeight;
        var iw = still.naturalWidth || 1600, ih = still.naturalHeight || 1000;
        var s = Math.max((cw + 2 * MARGIN) / iw, (ch + 2 * MARGIN) / ih);
        var x = (cw - iw * s) * POS[0] + u * iw * s, y = (ch - ih * s) * POS[1] + v * ih * s;
        if (withSway && live) {
          var o = windAt(u * iw, v * ih, iw, ih, WIND.clump / s, tNow);
          x += o[0] * amp; y += o[1] * amp;
        }
        return [x, y];
      },
      // the gust at a share of the width (0 calm, about 1 at the height of a strong gust) and where the canopy ends
      gust: function (u) { return live ? gustAt(u) * amp : 0; },
      canopy: function () { return V.canopy; },
      // a point of the screen as a point of the painting (no wind)
      unmap: function (x, y) {
        var cw = birdCanvas.clientWidth, ch = birdCanvas.clientHeight;
        var iw = still.naturalWidth || 1600, ih = still.naturalHeight || 1000;
        var s = Math.max((cw + 2 * MARGIN) / iw, (ch + 2 * MARGIN) / ih);
        return [(x - (cw - iw * s) * POS[0]) / (iw * s), (y - (ch - ih * s) * POS[1]) / (ih * s)];
      },
      windLevel: windLevel,
      // the painting's frame: it changes 12 times a second, when the live painting steps
      frame: function () { return live && gl ? tNow : Math.floor(performance.now() / (1000 / 12)); }
    });
    flock.setBirds(V.birds);
    flock.setPerches(V.perches);
    flock.reset();
    if (sound) flock.sound = sound;          // the one sound of the page, there from its first moment
  }

  // ---- the sound ----------------------------------------------------------------------------------------------
  // Made as the page loads: the wind's recordings start to download at once, and the sound starts as soon as the
  // browser lets it (at once on a site the browser already trusts with sound; otherwise at the first tap, click
  // or key, even during the timelapse). The calm wind comes first; the gusts and the birds join when the painting
  // comes alive. On unless the visitor turned it off.
  var sound = null;
  function makeSound() {
    if (!window.ForestBirds || !window.ForestBirds.Sound) return;
    sound = new window.ForestBirds.Sound();
    var stored = null;
    try { stored = localStorage.getItem("forest-birdsong"); } catch (e) {}
    sound.on = stored !== "off";
    if (soundBtn) soundBtn.setAttribute("aria-pressed", sound.on ? "true" : "false");
    if (sound.on) { sound.preload(); sound.unlock(); }       // try at once; a browser may hold it until a gesture
    var unlock = function () { sound.unlock(); };
    ["pointerdown", "keydown", "touchend"].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });
    if (soundBtn) soundBtn.addEventListener("click", function () {
      sound.on = !sound.on;
      soundBtn.setAttribute("aria-pressed", sound.on ? "true" : "false");
      try { localStorage.setItem("forest-birdsong", sound.on ? "on" : "off"); } catch (e) {}
      if (sound.on) { sound.preload(); sound.unlock(); } else sound.hush();
    });
    // the wind's strength for the sound, ten times a second: the gusts and the pointer once the painting is alive,
    // still air before
    setInterval(function () { if (!document.hidden) sound.wind(windLevel(), windPanNow()); }, 100);
  }
  // where across the picture the wind is now (-1 left .. 1 right; 0 when it is still)
  function windPanNow() {
    if (!live) return 0;
    var sum = 0, at = 0;
    for (var i = 0; i < 5; i++) { var u = 0.1 + 0.2 * i, g = gustAt(u) * amp; sum += g; at += g * u; }
    return sum > 0.02 ? (at / sum) * 2 - 1 : 0;
  }

  // ---- the WebGL layer -----------------------------------------------------------------------------------------
  var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  var FS = [
    "precision highp float;",
    "const float DARKEN = 0.1;",
    "uniform sampler2D tex; uniform vec2 res; uniform vec2 img; uniform float t; uniform float amp;",
    "uniform float canopy; uniform vec2 edge; uniform vec2 pos; uniform float dab; uniform float pxr;",
    "uniform sampler2D rnd; uniform vec4 gst; uniform float clump; uniform float push; uniform float idle; uniform float speed;",
    "uniform float lt; uniform float tone; uniform float marg;",
    "uniform vec4 pf[8]; uniform vec4 pa[8]; uniform float pp; uniform sampler2D tmk;",
    "vec2 WP; float PG;",
    "float h21(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }",
    "float vn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }",
    "float ss(float a, float b, float x){ float k = clamp((x - a) / (b - a), 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }",
    // the wind, as windAt() in forest.js
    "float gustG(float s){ if (s <= 0.0) return 0.0; float g = ss(0.0, 0.5, s) * (1.0 - ss(1.4, 3.0, s));",
    "  if (s > 2.2) g -= 0.3 * exp(-(s - 2.2) * 1.3) * sin((s - 2.2) * 4.5); return g; }",
    "float height(float v){ return (1.0 - ss(edge.x, edge.y, v)) * (0.6 + 0.4 * clamp(1.0 - v / edge.x, 0.0, 1.0)); }",
    // the pointer's wind, as ptrClump() in forest.js
    "float ptrE(float a){ return a <= 0.0 ? 0.0 : ss(0.0, 0.12, a) * exp(-1.8 * a); }",
    "vec2 wind(vec2 ip, float C){",
    "  vec2 b = floor(ip / C); vec2 sum = vec2(0.0); float sw = 0.0; vec2 sp = vec2(0.0); float sg = 0.0;",
    "  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {",
    "    vec2 cid = b + vec2(float(i), float(j));",
    "    vec4 r = texture2D(rnd, (mod(cid, 64.0) + 0.5) / 64.0);",
    "    vec2 pc = (cid + 0.15 + 0.7 * r.xy) * C;",
    "    vec2 dd = (ip - pc) / C; float w = exp(-3.0 * dot(dd, dd));",
    "    float cu = pc.x / img.x, dly = (r.w - 0.5) * 0.6;",
    "    float fl = 1.0 + 0.25 * sin(t * (6.0 + 4.0 * r.x) + 6.2832 * r.y);",
    "    float lean = gst.y * gustG(t - gst.x - (cu + 0.25) / speed - dly) * fl + gst.w * gustG(t - gst.z - (cu + 0.25) / speed - dly) * fl;",
    "    float ac = 0.6 + 0.8 * r.z;",
    "    sum += w * vec2(push * ac * lean + idle * sin(t * (0.6 + 0.5 * r.x) + 6.2832 * r.z),",
    "                    push * 0.18 * ac * lean + idle * 0.6 * sin(t * (0.8 + 0.4 * r.y) + 6.2832 * r.x));",
    "    float loose = (0.15 + 0.85 * ss(0.25, 0.85, texture2D(rnd, (mod(floor(cid / 3.0) + vec2(32.0, 17.0), 64.0) + 0.5) / 64.0).x)) * (0.35 + 0.9 * r.z);",
    "    if (loose > 0.0) for (int k = 0; k < 8; k++) {",
    "      vec4 q = pf[k]; vec4 a4 = pa[k]; float age = t - a4.x;",
    "      if (a4.y > 0.0 && age > 0.0 && age < 2.6) {",
    "        vec2 dd2 = pc - q.xy; float d = length(dd2);",
    "        float fall = exp(-(d / a4.z) * (d / a4.z));",
    "        float a = age - r.w * 0.3 - (d / a4.z) * 0.12;",
    "        vec2 dir = (q.z == 0.0 && q.w == 0.0) ? dd2 / max(d, 1.0) : q.zw;",
    "        float an = (r.y - 0.5) * 1.4; float ca = cos(an), sa = sin(an);",
    "        float m = a4.y * loose * fall; float e = ptrE(a);",
    "        sp += w * m * e * cos(a * (6.0 + 4.0 * r.x)) * vec2(ca * dir.x - sa * dir.y, sa * dir.x + ca * dir.y);",
    "        sg += w * m * e;",
    "      }",
    "    }",
    "    sw += w;",
    "  }",
    "  float hh = height(ip.y / img.y);",
    "  WP = sp / sw * hh * pp; PG = sg / sw * hh;",
    "  return sum / sw * hh;",
    "}",
    "void main(){",
    "  float s = max((res.x + 2.0 * marg) / img.x, (res.y + 2.0 * marg) / img.y);",   // a margin of paint past each edge
    "  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);",
    "  vec2 ip = (frag - (res - img * s) * pos) / s;",               // this pixel in image pixels, as object-position crops
    "  vec2 uv0 = ip / img;",
    "  float leafy = 1.0 - ss(edge.x, edge.y, uv0.y);",
    "  vec2 W = wind(ip, clump / s) * amp;",                          // the wind here (device px): smooth, clump by clump
    // the visitor's pointer: its wake, clump by clump (wind() above); only some dabs answer it, each by its own amount
    "  vec2 Wp = WP * amp; float pg = PG * amp;",
    "  float gp0 = (gst.y * max(0.0, gustG(t - gst.x - (uv0.x + 0.25) / speed)) + gst.w * max(0.0, gustG(t - gst.z - (uv0.x + 0.25) / speed))) * amp;",
    "  float gp = gp0 + pg;",
    // The wind doesn't stretch the paint: the canopy moves as separate dabs. Each dab-shaped piece (about the size of
    // the painted marks, mostly upright like the leaves) takes the wind its own way and is drawn whole, crisp-edged,
    // over its neighbours; in a gust each also jigs a little. The clock steps 12 times a second (forest.js), so
    // the leaves move as if repainted frame by frame.
    "  float dc = dab / s;",
    "  vec2 dq = ip / dc; vec2 db = floor(dq);",
    "  float bz = -1.0; vec2 off = W; float fh = 1.0, fh2 = 0.0, fh3 = 0.0;",
    "  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {",
    "    vec2 id = db + vec2(float(i), float(j));",
    "    float h1 = h21(id), h2 = h21(id + 19.1), h3 = h21(id + 37.7), h4 = h21(id + 53.3);",
    "    vec2 cc = id + 0.5 + (vec2(h1, h2) - 0.5) * 0.8;",
    "    float an = 1.5708 + (h3 - 0.5) * 2.2;",
    "    vec2 d = dq - cc; d = vec2(cos(an) * d.x + sin(an) * d.y, -sin(an) * d.x + cos(an) * d.y);",
    "    float e = length(d / vec2(0.95 + 0.3 * h4, 0.55 + 0.15 * h1));",
    "    if (e < 1.0 && h4 > bz) {",
    "      bz = h4;",
    "      vec2 jig = vec2(sin(t * (5.0 + 4.0 * h1) + 6.2832 * h3), cos(t * (4.0 + 5.0 * h2) + 6.2832 * h1));",
    "      float h5 = h21(id + 71.9);",
    "      float give = ss(h5 - 0.2, h5 + 0.2, pg * 1.6);",           // a light touch moves a few dabs, a strong one most
    "      off = W * (0.45 + 1.1 * h2) + Wp * (0.3 + 1.4 * h1) * give + jig * (gp - pg + pg * give) * 1.6 * pxr;",
    "      fh = h1; fh2 = h2; fh3 = h3;",
    "    }",
    "  }",
    "  off *= leafy;",
    // the trunks never move: paint on a trunk stays where it is, and a moving piece of leaves never takes up a trunk
    "  float tm = max(texture2D(tmk, uv0).r, texture2D(tmk, (ip - off / s) / img).r);",
    "  float still = smoothstep(0.35, 0.65, tm);",
    "  off *= 1.0 - still;",
    "  off /= max(1.0, length(off) / marg);",                       // never farther than the margin: no smeared edges
    "  ip -= off / s;",
    "  vec2 uv = ip / img;",
    "  vec3 col = texture2D(tex, ip / img).rgb;",
    // dappled light drifting slowly across the leaves and the lawn
    "  vec2 lq = uv * vec2(3.2, 3.2 * img.y / img.x);",
    "  float dl = vn(lq + vec2(t * 0.011, t * 0.006)) * 0.65 + vn(lq * 2.3 - vec2(t * 0.007, t * 0.013)) * 0.35;",
    "  float l = (dl - 0.5) * 0.075 * amp;",
    "  col *= 1.0 + l;",
    "  col += vec3(0.012, 0.01, 0.0) * max(l, 0.0) * 8.0;",
    // as a gust passes, a dab now and then turns over and flashes pale, the whole dab at once
    "  float pulse = pow(max(0.0, sin(t * (4.0 + 5.0 * fh2) + 6.2832 * fh3)), 8.0);",
    "  float lum = dot(col, vec3(0.3, 0.55, 0.15));",
    "  float flash = (1.0 - still) * step(fh, 0.3) * step(0.0, bz) * pulse * clamp(gp, 0.0, 1.0) * leafy * smoothstep(0.06, 0.25, lum);",
    "  col = mix(col, vec3(lum) * 1.45 + vec3(0.04, 0.06, 0.07), 0.6 * flash);",
    "  {",
    // only the light marks are quieted: each keeps its color and its place among the lights (a soft knee: nothing
    // goes above lt, linear luminance), the dark paint is hardly touched; no blur, no overlay
    "    float Lc = dot(pow(max(col, vec3(0.0001)), vec3(2.2)), vec3(0.2126, 0.7152, 0.0722));",
    "    float Lp = lt * (1.0 - exp(-Lc / lt));",
    "    float k = pow(Lp / max(Lc, 0.0001), 0.4545);",
    "    col *= mix(1.0, k, tone);",
    "  }",
    "  col *= 1.0 - DARKEN * tone;",                                   // and the whole painting a little darker
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");


  function newTex(unit, filter) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  var glFailed = false;
  // without WebGL the lights can't be quieted mark by mark: the painting is evenly darkened instead
  function plain() { document.documentElement.classList.add("forest-plain"); }
  function initGL() {
    if (gl) return true;
    if (glFailed) return false;
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) { glFailed = true; plain(); return false; }
    var sh = function (type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; glFailed = true; plain(); return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    newTex(1, gl.NEAREST);                                       // the clumps' random values (the table windAt() reads)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, RT);
    tmtex = newTex(3, gl.LINEAR);                                // the trunks' mask
    tex = newTex(0, gl.LINEAR);                                  // the painting: the video's frame, or the still
    return true;
  }
  // the painting's texture: the video's newest frame, or the still once it has loaded
  function feed() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (mode === "lapse") {
      if (video.readyState < 2 || !video.videoWidth) return texSrc === "video";
      if (video.currentTime !== lastVideoT || texSrc !== "video") {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        lastVideoT = video.currentTime; texSrc = "video"; srcW = video.videoWidth; srcH = video.videoHeight;
        return 2;
      }
      return true;
    }
    if (!still.complete || !still.naturalWidth) return texSrc !== "video" && texSrc !== "";
    if (texSrc !== still.currentSrc) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, still);
      texSrc = still.currentSrc; srcW = still.naturalWidth; srcH = still.naturalHeight;
      return 2;
    }
    return true;
  }

  function startLive() {
    makeFlock();
    if (!initGL()) { if (flock) flock.start(); return false; }
    mode = "live"; live = true; last = 0;
    if (!liveFrom) liveFrom = performance.now();               // (the wind's clock runs on from the timelapse)
    loop();
    if (flock) flock.start();
    return true;
  }

  function size() {
    if (!gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function loop() { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); }

  // draw one frame of the painting
  function draw(now) {
    var fed = feed();
    if (!fed) return false;
    size();
    if (liveFrom && (mode === "live" || mode === "lapse")) {
      var t = (now - liveFrom) / 1000;
      amp = Math.min(1, t / 1.2);                // the wind comes in over a second, while the dots are still landing
      amp = amp * amp * (3 - 2 * amp);
      var tq = Math.floor((t + 40.0) * STEPS) / STEPS;   // the leaves move in steps, as if repainted frame by frame
      if (tq === tNow && fed !== 2 && amp >= 1) return true;
      tNow = tq;
    } else { amp = 0; tNow = 40.0; if (fed !== 2 && mode === "lapse" && toneAmt() >= 1) return true; }
    var dpr = canvas.width / Math.max(1, canvas.clientWidth);
    var U = function (n) { return gl.getUniformLocation(prog, n); };
    gl.uniform1i(U("tex"), 0);
    gl.uniform2f(U("res"), canvas.width, canvas.height);
    gl.uniform2f(U("img"), srcW, srcH);
    gl.uniform1f(U("t"), tNow);
    gl.uniform1f(U("amp"), amp);
    gl.uniform1f(U("canopy"), V.canopy);
    gl.uniform2f(U("edge"), V.edge[0], V.edge[1]);
    gl.uniform1f(U("dab"), DAB * dpr);
    gl.uniform1f(U("pxr"), dpr);
    gl.uniform2f(U("pos"), POS[0], POS[1]);
    var G = gusts(tNow);
    gl.uniform1i(U("rnd"), 1);
    gl.uniform4f(U("gst"), G[0], G[1], G[2], G[3]);
    gl.uniform1f(U("clump"), WIND.clump * dpr);
    gl.uniform1f(U("push"), WIND.push * dpr);
    gl.uniform1f(U("idle"), WIND.idle * dpr);
    gl.uniform1f(U("speed"), WIND.speed);
    gl.uniform1f(U("lt"), LT);
    gl.uniform1f(U("marg"), MARGIN * dpr);
    if (tmFor !== V) {
      tmFor = V;
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tmtex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, trunkMask(V === VARIANTS.mobile ? "mobile" : "desk"));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    }
    gl.uniform1i(U("tmk"), 3);
    var pf = new Float32Array(32), pa = new Float32Array(32);
    for (var i = 0; i < PUFFS.length; i++) {
      var P = PUFFS[i];
      pf[i * 4] = P.ix; pf[i * 4 + 1] = P.iy; pf[i * 4 + 2] = P.dx; pf[i * 4 + 3] = P.dy;
      pa[i * 4] = P.t; pa[i * 4 + 1] = P.s; pa[i * 4 + 2] = P.r;
    }
    gl.uniform4fv(U("pf"), pf);
    gl.uniform4fv(U("pa"), pa);
    gl.uniform1f(U("pp"), PP * dpr);
    gl.uniform1f(U("tone"), toneAmt());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!root.classList.contains("gl-on")) root.classList.add("gl-on");   // shown only once it has drawn
    return true;
  }

  function frame(now) {
    if (mode !== "live" && mode !== "lapse") return;
    raf = requestAnimationFrame(frame);
    if (now - last < (V === VARIANTS.mobile ? 33 : 16)) return;   // a phone draws the painting at about 30 a second
    last = now;
    draw(now);
  }

  // reduced motion: the still, drawn once (and again when the page changes size)
  function drawStatic() {
    if (!gl) return;
    if (!draw(performance.now())) still.addEventListener("load", drawStatic, { once: true });
  }

  window.addEventListener("resize", function () { if (mode === "static") drawStatic(); else last = 0; });

  // the screen changed shape (a phone turned, a window dragged narrow): change to the other composition
  function switchVariant() {
    var next = tall.matches ? VARIANTS.mobile : VARIANTS.desk;
    if (next === V) return;
    V = next;
    if (flock) { flock.setBirds(V.birds); flock.setPerches(V.perches); }
    if (root.classList.contains("is-lapse")) {
      var f = video.duration ? video.currentTime / video.duration : 0;
      video.src = V.lapse;
      video.addEventListener("loadedmetadata", function () {
        video.currentTime = f * video.duration;
        var p = video.play(); if (p && p.catch) p.catch(showStill);
      }, { once: true });
      video.load();
    }
    // the <picture> loads the other painting; feed() takes it up as the texture once it is there
    if (mode === "static") still.addEventListener("load", drawStatic, { once: true });
  }
  if (tall.addEventListener) tall.addEventListener("change", switchVariant);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { cancelAnimationFrame(raf); if (flock) flock.pause(); if (sound) sound.hush(); }
    else {
      if (mode === "live" || mode === "lapse") loop();
      if (live && flock) flock.start();
      if (sound) sound.wake();
    }
  });

  // ---- start -----------------------------------------------------------------------------------------------------
  if (reduce.matches) {
    root.classList.add("is-still");
    textIn(); toneFrom = performance.now() - 1000;
    if (initGL()) { mode = "static"; drawStatic(); }
  } else {
    makeSound();
    video.addEventListener("ended", showStill);
    video.addEventListener("error", showStill);
    video.src = V.lapse;
    video.load();
    playLapse();
    if (replay) replay.addEventListener("click", playLapse);
  }
  reduce.addEventListener && reduce.addEventListener("change", function (e) {
    if (e.matches) {
      video.pause(); live = false; cancelAnimationFrame(raf);
      if (flock) flock.stop();
      if (sound) sound.hush();
      root.classList.remove("is-lapse"); root.classList.add("is-still"); if (replay) replay.hidden = true;
      textIn();
      if (initGL()) { mode = "static"; drawStatic(); }
    }
  });
})();
