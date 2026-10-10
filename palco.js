/* Palco: canvas de composição com zoom/pan, réguas, guias, grade, alinhamento magnético,
   seleção, arrastar, redimensionar, girar (mouse e toque) e pinça para zoom. */
(function () {
  'use strict';
  const SMS = window.SMS, S = SMS.S, R = SMS.Render, C = SMS.Cmd, UI = SMS.UI, $ = (id) => document.getElementById(id);
  const St = SMS.Stage = { view: { zoom: 1, px: 0, py: 0 }, opts: { grid: false, gridSize: 40, guides: true, rulers: true, snap: true, safe: false, clean: false, tool: 'select', multi: false } };
  const V = St.view, O = St.opts;
  let vp, stage, sctx, ov, octx, rx, ry, wrap, area, hud, dpr = 1, vw = 0, vh = 0, q = 1, dirty = true, fitted = false, spaceDown = false;
  let userZoomed = false, snapLines = [], marquee = null, guidePrev = null, infoText = '';
  const pointers = new Map();
  let gesture = null;

  /* ---------- coordenadas ---------- */
  const toProj = (e) => { const r = vp.getBoundingClientRect(); return { x: (e.clientX - r.left - V.px) / V.zoom, y: (e.clientY - r.top - V.py) / V.zoom, sx: e.clientX - r.left, sy: e.clientY - r.top }; };
  St.invalidate = () => { dirty = true; };

  St.layout = () => {
    const r = vp.getBoundingClientRect(); vw = Math.max(1, r.width); vh = Math.max(1, r.height); dpr = Math.min(3, window.devicePixelRatio || 1);
    ov.width = Math.round(vw * dpr); ov.height = Math.round(vh * dpr);
    const rxr = rx.getBoundingClientRect(), ryr = ry.getBoundingClientRect(); rx.width = Math.round(rxr.width * dpr); rx.height = Math.round(rxr.height * dpr); ry.width = Math.round(ryr.width * dpr); ry.height = Math.round(ryr.height * dpr);
    if (!fitted || !userZoomed) { St.fit(); fitted = true; } else applyView();
  };
  St.fit = () => {
    userZoomed = false;
    const { width: W, height: H } = S.project.settings, pad = UI.isMobile() ? 10 : 36;
    V.zoom = SMS.clamp(Math.min((vw - pad * 2) / W, (vh - pad * 2) / H), 0.02, 8); V.px = (vw - W * V.zoom) / 2; V.py = (vh - H * V.zoom) / 2; applyView();
  };
  St.zoomTo = (z, cx, cy) => {
    userZoomed = true;
    z = SMS.clamp(z, 0.05, 8); if (cx == null) { cx = vw / 2; cy = vh / 2; }
    const px = (cx - V.px) / V.zoom, py = (cy - V.py) / V.zoom; V.zoom = z; V.px = cx - px * z; V.py = cy - py * z; applyView();
  };
  function applyView() {
    const { width: W, height: H } = S.project.settings;
    wrap.style.left = V.px + 'px'; wrap.style.top = V.py + 'px'; wrap.style.width = W * V.zoom + 'px'; wrap.style.height = H * V.zoom + 'px';
    let k = SMS.clamp(V.zoom * dpr, 0.25, 2); k = Math.min(k, Math.sqrt(4.2e6 / (W * H))); k = Math.round(k * 20) / 20; k = Math.max(0.2, k);
    const nw = Math.max(1, Math.round(W * k)), nh = Math.max(1, Math.round(H * k));
    if (stage.width !== nw || stage.height !== nh) { stage.width = nw; stage.height = nh; } q = k;
    SMS.emit('view'); dirty = true;
  }
  St.apply = applyView;

  /* ---------- desenho ---------- */
  let lastT = -1, lastVer = -1;
  function loop() {
    requestAnimationFrame(loop);
    if (SMS.exporting) return;
    if (dirty || S.playing || (S.ver !== lastVer) || S.T !== lastT) {
      const P = S.project; if (!P) return;
      R.frame(sctx, P, S.T, { scale: q, playing: S.playing, placeholders: !S.playing && !SMS.exporting });
      lastT = S.T; lastVer = S.ver; dirty = false; drawOverlay(); drawRulers();
    }
  }
  const sceneAndLocal = () => ({ sc: SMS.scene(), lt: SMS.localT() });
  function elementBox(el, sc, lt) {
    const ev = R.evalEl(el, sc, lt), z = V.zoom, a = ev.rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const cx = V.px + ev.x * z, cy = V.py + ev.y * z, hw = Math.abs(ev.w * ev.sx) * z / 2, hh = Math.abs(ev.h * ev.sy) * z / 2;
    const pt = (lx, ly) => [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
    return { ev, cx, cy, hw, hh, a, pt, corners: [pt(-hw, -hh), pt(hw, -hh), pt(hw, hh), pt(-hw, hh)] };
  }
  const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  function handlePositions(b) { const hs = HANDLES.map(h => b.pt(h[0] * b.hw, h[1] * b.hh)); hs.push(b.pt(0, -b.hh - 32)); return hs; }
  function drawOverlay() {
    octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, vw, vh);
    const P = S.project, W = P.settings.width, H = P.settings.height, z = V.zoom, X = (x) => V.px + x * z, Y = (y) => V.py + y * z;
    if (S.playing || SMS.exporting || O.clean) return;
    octx.lineWidth = 1;
    if (O.grid && O.gridSize * z >= 5) {
      octx.strokeStyle = 'rgba(255,255,255,.12)'; octx.beginPath();
      for (let x = 0; x <= W; x += O.gridSize) { octx.moveTo(Math.round(X(x)) + .5, Y(0)); octx.lineTo(Math.round(X(x)) + .5, Y(H)); }
      for (let y = 0; y <= H; y += O.gridSize) { octx.moveTo(X(0), Math.round(Y(y)) + .5); octx.lineTo(X(W), Math.round(Y(y)) + .5); }
      octx.stroke();
    }
    if (O.safe) {
      octx.strokeStyle = 'rgba(255,212,0,.5)'; octx.setLineDash([6, 5]); octx.strokeRect(X(W * .05), Y(H * .05), W * .9 * z, H * .9 * z);
      if (H > W * 1.5) { octx.strokeStyle = 'rgba(255,90,77,.55)'; octx.strokeRect(X(0), Y(H * .13), W * z, H * .69 * z); } octx.setLineDash([]);
    }
    if (O.guides) {
      octx.strokeStyle = 'rgba(44,196,255,.9)'; octx.beginPath();
      P.guides.v.forEach(g => { octx.moveTo(Math.round(X(g)) + .5, 0); octx.lineTo(Math.round(X(g)) + .5, vh); });
      P.guides.h.forEach(g => { octx.moveTo(0, Math.round(Y(g)) + .5); octx.lineTo(vw, Math.round(Y(g)) + .5); }); octx.stroke();
    }
    if (guidePrev) { octx.strokeStyle = 'rgba(44,196,255,.9)'; octx.beginPath(); if (guidePrev.t === 'v') { octx.moveTo(guidePrev.s + .5, 0); octx.lineTo(guidePrev.s + .5, vh); } else { octx.moveTo(0, guidePrev.s + .5); octx.lineTo(vw, guidePrev.s + .5); } octx.stroke(); }
    const { sc, lt } = sceneAndLocal(), items = SMS.expandGroups(S.sel).map(SMS.findItem).filter(r => r && !r.audio && r.sceneIdx === S.sceneIdx).map(r => r.item);
    items.forEach(el => {
      const b = elementBox(el, sc, lt); if (!b.ev.active && el.visible === false) return;
      octx.strokeStyle = el.locked ? 'rgba(255,255,255,.5)' : '#ffd400'; octx.lineWidth = 1.5; octx.setLineDash(el.locked ? [4, 4] : []); octx.beginPath();
      b.corners.forEach((c, i) => i ? octx.lineTo(c[0], c[1]) : octx.moveTo(c[0], c[1])); octx.closePath(); octx.stroke(); octx.setLineDash([]);
    });
    if (items.length === 1 && S.sel.length === 1 && !items[0].locked) {
      const b = elementBox(items[0], sc, lt), hs = handlePositions(b), top = b.pt(0, -b.hh);
      octx.strokeStyle = '#ffd400'; octx.lineWidth = 1; octx.beginPath(); octx.moveTo(top[0], top[1]); octx.lineTo(hs[8][0], hs[8][1]); octx.stroke();
      const sz = UI.isMobile() ? 9 : 6;
      hs.forEach((p, i) => { octx.fillStyle = i === 8 ? '#ffd400' : '#fff'; octx.strokeStyle = '#000'; octx.lineWidth = 1.2; octx.beginPath(); if (i === 8) octx.arc(p[0], p[1], sz, 0, 7); else octx.rect(p[0] - sz / 1.5, p[1] - sz / 1.5, sz * 1.33, sz * 1.33); octx.fill(); octx.stroke(); });
      const e = b.ev; infoText = 'X ' + Math.round(e.x) + '  Y ' + Math.round(e.y) + '  ' + Math.round(e.w * e.sx) + '×' + Math.round(e.h * e.sy) + '  ∠' + Math.round(e.rot) + '°';
      if (gesture && gesture.type !== 'pan') { octx.font = '600 11px ui-monospace,Menlo,monospace'; const tw = octx.measureText(infoText).width + 12, ix = SMS.clamp(b.cx - tw / 2, 4, vw - tw - 4), iy = Math.min(vh - 22, Math.max(...b.corners.map(c => c[1])) + 10); octx.fillStyle = 'rgba(0,0,0,.8)'; octx.fillRect(ix, iy, tw, 18); octx.fillStyle = '#ffd400'; octx.fillText(infoText, ix + 6, iy + 13); }
    }
    snapLines.forEach(l => { octx.strokeStyle = '#ffd400'; octx.lineWidth = 1; octx.setLineDash([5, 4]); octx.beginPath(); if (l.x != null) { octx.moveTo(Math.round(X(l.x)) + .5, 0); octx.lineTo(Math.round(X(l.x)) + .5, vh); } else { octx.moveTo(0, Math.round(Y(l.y)) + .5); octx.lineTo(vw, Math.round(Y(l.y)) + .5); } octx.stroke(); octx.setLineDash([]); });
    if (marquee) { const x = Math.min(marquee.x0, marquee.x1), y = Math.min(marquee.y0, marquee.y1); octx.fillStyle = 'rgba(255,212,0,.1)'; octx.strokeStyle = '#ffd400'; octx.setLineDash([4, 3]); octx.fillRect(x, y, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0)); octx.strokeRect(x, y, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0)); octx.setLineDash([]); }
  }
  function drawRulers() {
    if (!O.rulers || UI.isMobile()) return;
    const z = V.zoom, steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], step = steps.find(s => s * z >= 60) || 1000;
    [['x', rx], ['y', ry]].forEach(([ax, cv]) => {
      const c = cv.getContext('2d'), len = ax === 'x' ? cv.width : cv.height, thick = ax === 'x' ? cv.height : cv.width;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#9a9a9a'; c.strokeStyle = '#555'; c.font = '9px ui-monospace,monospace'; const off = ax === 'x' ? V.px : V.py, lenCss = len / dpr, thCss = thick / dpr;
      const t0 = Math.floor(-off / z / step) * step, t1 = Math.ceil((lenCss - off) / z / step) * step;
      c.beginPath();
      for (let t = t0; t <= t1; t += step) {
        const p = Math.round(off + t * z) + .5;
        if (ax === 'x') { c.moveTo(p, thCss); c.lineTo(p, thCss - 9); c.fillText(String(t), p + 3, 9); } else { c.moveTo(thCss, p); c.lineTo(thCss - 9, p); c.save(); c.translate(9, p - 3); c.rotate(-Math.PI / 2); c.fillText(String(t), 0, 0); c.restore(); }
        for (let m = 1; m < 5; m++) { const pm = Math.round(off + (t + step * m / 5) * z) + .5; if (ax === 'x') { c.moveTo(pm, thCss); c.lineTo(pm, thCss - 4); } else { c.moveTo(thCss, pm); c.lineTo(thCss - 4, pm); } }
      }
      c.stroke();
    });
  }

  /* ---------- interação ---------- */
  function hitHandle(p) {
    if (S.sel.length !== 1) return -1; const r = SMS.findItem(S.sel[0]); if (!r || r.audio || r.item.locked || r.sceneIdx !== S.sceneIdx) return -1;
    const { sc, lt } = sceneAndLocal(), b = elementBox(r.item, sc, lt), hs = handlePositions(b), tol = gesture && gesture.touch ? 22 : (UI.isMobile() ? 22 : 11);
    let best = -1, bd = 1e9; hs.forEach((h, i) => { const d = Math.hypot(h[0] - p.sx, h[1] - p.sy); if (d < tol && d < bd) { bd = d; best = i; } }); return best;
  }
  function hitElement(p) {
    const { sc, lt } = sceneAndLocal(), arr = sc.elements;
    for (let i = arr.length - 1; i >= 0; i--) {
      const el = arr[i]; if (el.locked || el.visible === false) continue;
      const ev = R.evalEl(el, sc, lt); if (!ev.active) continue; const tol = 14 / V.zoom, e2 = Object.assign({}, ev, { w: Math.max(ev.w, tol * 2 / Math.max(.01, Math.abs(ev.sx))), h: Math.max(ev.h, tol * 2 / Math.max(.01, Math.abs(ev.sy))) });
      if (R.hit(e2, p.x, p.y)) return el;
    } return null;
  }
  function hitGuide(p) {
    if (!O.guides) return null; const P = S.project, tol = 6;
    for (let i = 0; i < P.guides.v.length; i++) if (Math.abs(V.px + P.guides.v[i] * V.zoom - p.sx) < tol) return { t: 'v', i };
    for (let i = 0; i < P.guides.h.length; i++) if (Math.abs(V.py + P.guides.h[i] * V.zoom - p.sy) < tol) return { t: 'h', i };
    return null;
  }
  function snapCandidates(excl) {
    const P = S.project, W = P.settings.width, H = P.settings.height, xs = [0, W / 2, W], ys = [0, H / 2, H], { sc, lt } = sceneAndLocal();
    if (O.guides) { xs.push(...P.guides.v); ys.push(...P.guides.h); }
    sc.elements.forEach(e => { if (excl.has(e.id) || e.visible === false) return; const ev = R.evalEl(e, sc, lt); if (!ev.active) return; const b = C.aabb(e, sc, lt); xs.push(b.l, b.cx, b.r); ys.push(b.t, b.cy, b.b); });
    return { xs, ys };
  }
  function snapMove(bb, dx, dy, cand, e) {
    snapLines = []; if (!O.snap || e.altKey) return { dx, dy };
    const th = 7 / V.zoom; let bestX = null, bestY = null;
    const tryAxis = (edges, list, grid) => {
      let best = null;
      edges.forEach(ed => {
        list.forEach(t => { const d = t - ed; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; });
        if (O.grid && grid) { const t = Math.round(ed / O.gridSize) * O.gridSize, d = t - ed; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
      }); return best;
    };
    bestX = tryAxis([bb.l + dx, bb.cx + dx, bb.r + dx], cand.xs, true); bestY = tryAxis([bb.t + dy, bb.cy + dy, bb.b + dy], cand.ys, true);
    if (bestX) { dx += bestX.d; snapLines.push({ x: bestX.t }); } if (bestY) { dy += bestY.d; snapLines.push({ y: bestY.t }); }
    return { dx, dy };
  }

  function onDown(e) {
    vp.focus({ preventScroll: true });
    if (e.pointerType === 'mouse' && e.button === 2) return;
    try { vp.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { startPinch(); return; } if (pointers.size > 2) return;
    if (S.playing) return;
    const p = toProj(e), touch = e.pointerType === 'touch';
    if (e.button === 1 || O.tool === 'hand' || spaceDown) { gesture = { type: 'pan', sx: p.sx, sy: p.sy, px: V.px, py: V.py }; vp.style.cursor = 'grabbing'; return; }
    gesture = { type: null, touch, p0: p, t0: performance.now(), moved: false };
    const hh = hitHandle(p);
    if (hh >= 0) { startHandle(hh, p); return; }
    const g = hitGuide(p); if (g) { gesture = { type: 'guide', g, touch }; return; }
    const el = hitElement(p);
    if (el) {
      const additive = e.shiftKey || e.ctrlKey || e.metaKey || O.multi;
      let ids = SMS.expandGroups([el.id]);
      if (additive) { const cur = new Set(S.sel); const all = ids.every(i => cur.has(i)); ids.forEach(i => all ? cur.delete(i) : cur.add(i)); SMS.setSelection(Array.from(cur)); if (all) { gesture = null; return; } }
      else if (!S.sel.includes(el.id)) SMS.setSelection(ids);
      startMove(p); gesture.hitId = el.id;
    } else {
      if (!additive0(e) && !touch) SMS.setSelection([]);
      if (touch) { gesture = { type: 'pan', sx: p.sx, sy: p.sy, px: V.px, py: V.py, tap: true, touch, t0: performance.now(), moved: false }; }
      else { gesture = { type: 'marquee', touch }; marquee = { x0: p.sx, y0: p.sy, x1: p.sx, y1: p.sy, base: additive0(e) ? S.sel.slice() : [] }; }
    }
    dirty = true;
  }
  const additive0 = (e) => e.shiftKey || e.ctrlKey || e.metaKey || O.multi;
  function startMove(p) {
    const { sc, lt } = sceneAndLocal(), ids = SMS.expandGroups(S.sel), items = ids.map(SMS.findItem).filter(r => r && !r.audio && r.sceneIdx === S.sceneIdx && !r.item.locked).map(r => r.item);
    if (!items.length) { gesture = null; return; }
    const bbs = items.map(el => C.aabb(el, sc, lt)), bb = { l: Math.min(...bbs.map(b => b.l)), r: Math.max(...bbs.map(b => b.r)), t: Math.min(...bbs.map(b => b.t)), b: Math.max(...bbs.map(b => b.b)) }; bb.cx = (bb.l + bb.r) / 2; bb.cy = (bb.t + bb.b) / 2;
    gesture = { type: 'move', p0: p, items, starts: items.map((el, i) => ({ el, x: bbs[i].ev.x, y: bbs[i].ev.y })), bb, cand: snapCandidates(new Set(items.map(i => i.id))), moved: false, touch: gesture && gesture.touch };
  }
  function startHandle(h, p) {
    const el = SMS.findItem(S.sel[0]).item, { sc, lt } = sceneAndLocal(), ev = R.evalEl(el, sc, lt);
    gesture = { type: h === 8 ? 'rotate' : 'resize', h, el, ev, p0: p, touch: gesture && gesture.touch, rot0: ev.rot, lastA: Math.atan2(p.y - ev.y, p.x - ev.x), accA: 0 };
  }
  function onMove(e) {
    const prev = pointers.get(e.pointerId); if (prev) { prev.x = e.clientX; prev.y = e.clientY; }
    const p = toProj(e); hud.textContent = Math.round(p.x) + ', ' + Math.round(p.y) + '  ·  ' + Math.round(V.zoom * 100) + '%';
    if (pointers.size === 2 && gesture && gesture.type === 'pinch') { updatePinch(); return; }
    if (!gesture) return;
    const g = gesture;
    if (g.type === 'pan') { const dx = p.sx - g.sx, dy = p.sy - g.sy; if (Math.hypot(dx, dy) > 4) g.moved = true; V.px = g.px + dx; V.py = g.py + dy; applyView(); return; }
    if (g.type === 'marquee') { marquee.x1 = p.sx; marquee.y1 = p.sy; updateMarquee(); dirty = true; return; }
    if (g.type === 'guide') { const P = S.project; if (g.t0 == null) g.t0 = 1; P.guides[g.g.t === 'v' ? 'v' : 'h'][g.g.i] = Math.round(g.g.t === 'v' ? p.x : p.y); SMS.touch(); return; }
    if (g.type === 'move') {
      let dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (!g.moved) { if (Math.hypot(dx, dy) * V.zoom < 3) return; g.moved = true; }
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const s = snapMove(g.bb, dx, dy, g.cand, e); dx = s.dx; dy = s.dy;
      g.starts.forEach(o => { C.setProp(o.el, 'x', Math.round((o.x + dx) * 10) / 10); C.setProp(o.el, 'y', Math.round((o.y + dy) * 10) / 10); });
      SMS.touch(); return;
    }
    if (g.type === 'rotate') {
      const a = Math.atan2(p.y - g.ev.y, p.x - g.ev.x); let d = a - g.lastA; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; g.accA += d; g.lastA = a;
      let r = g.rot0 + g.accA * 180 / Math.PI; const sn = Math.round(r / 15) * 15; if (e.shiftKey || Math.abs(r - sn) < 2.5) r = sn;
      C.setProp(g.el, 'rotation', Math.round(r * 10) / 10); SMS.touch(); return;
    }
    if (g.type === 'resize') { doResize(g, p, e); SMS.touch(); }
  }
  function doResize(g, p, e) {
    const ev = g.ev, el = g.el, hv = HANDLES[g.h], a = -ev.rot * Math.PI / 180, dx = p.x - ev.x, dy = p.y - ev.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    const vw0 = Math.max(1, Math.abs(ev.w * ev.sx)), vh0 = Math.max(1, Math.abs(ev.h * ev.sy)), hw0 = vw0 / 2, hh0 = vh0 / 2;
    let nw = vw0, nh = vh0; const sym = e.altKey;
    if (hv[0]) nw = sym ? 2 * hv[0] * lx : hv[0] * lx + hw0; if (hv[1]) nh = sym ? 2 * hv[1] * ly : hv[1] * ly + hh0;
    const lock = el.lockRatio || e.shiftKey;
    if (lock) { if (hv[0] && hv[1]) { const k = Math.max(nw / vw0, nh / vh0); nw = vw0 * k; nh = vh0 * k; } else if (hv[0]) nh = vh0 * nw / vw0; else nw = vw0 * nh / vh0; }
    nw = Math.max(8, nw); nh = Math.max(8, nh);
    let cx = 0, cy = 0; if (!sym) { cx = hv[0] ? -hv[0] * hw0 + hv[0] * nw / 2 : 0; cy = hv[1] ? -hv[1] * hh0 + hv[1] * nh / 2 : 0; if (lock && !hv[0]) cx = 0; if (lock && !hv[1]) cy = 0; }
    const ar = ev.rot * Math.PI / 180, X = ev.x + cx * Math.cos(ar) - cy * Math.sin(ar), Y = ev.y + cx * Math.sin(ar) + cy * Math.cos(ar);
    C.setProp(el, 'w', Math.round(nw / Math.abs(ev.sx || 1) * 10) / 10); C.setProp(el, 'h', Math.round(nh / Math.abs(ev.sy || 1) * 10) / 10);
    C.setProp(el, 'x', Math.round(X * 10) / 10); C.setProp(el, 'y', Math.round(Y * 10) / 10);
  }
  function updateMarquee() {
    const m = marquee, { sc, lt } = sceneAndLocal(), x0 = (Math.min(m.x0, m.x1) - V.px) / V.zoom, x1 = (Math.max(m.x0, m.x1) - V.px) / V.zoom, y0 = (Math.min(m.y0, m.y1) - V.py) / V.zoom, y1 = (Math.max(m.y0, m.y1) - V.py) / V.zoom;
    const ids = m.base.slice(); sc.elements.forEach(el => { if (el.locked || el.visible === false) return; const b = C.aabb(el, sc, lt); if (!b.ev.active) return; if (b.r >= x0 && b.l <= x1 && b.b >= y0 && b.t <= y1) ids.push(el.id); });
    SMS.setSelection(SMS.expandGroups(ids));
  }
  let lastTap = { t: 0, id: null };
  function onUp(e) {
    pointers.delete(e.pointerId); const g = gesture;
    if (g && g.type === 'pinch') { if (pointers.size < 2) gesture = null; return; }
    if (!g) return;
    if (g.type === 'pan') { vp.style.cursor = ''; if (g.tap && !g.moved && performance.now() - g.t0 < 400) SMS.setSelection([]); }
    else if (g.type === 'marquee') marquee = null;
    else if (g.type === 'guide') { const p = toProj(e), r = vp.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) S.project.guides[g.g.t].splice(g.g.i, 1); SMS.changed('guide'); }
    else if (g.type === 'move') {
      if (g.moved) SMS.changed('move');
      else if (g.hitId) { const now = performance.now(); if (lastTap.id === g.hitId && now - lastTap.t < 380) { const el = SMS.findItem(g.hitId).item; if (el.type === 'text') SMS.emit('edit-text', el.id); lastTap = { t: 0, id: null }; } else lastTap = { t: now, id: g.hitId }; }
    } else if (g.type === 'resize' || g.type === 'rotate') SMS.changed(g.type);
    snapLines = []; gesture = null; dirty = true;
  }
  /* pinça */
  function startPinch() {
    if (gesture && ['move', 'resize', 'rotate'].includes(gesture.type)) SMS.changed();
    const pts = Array.from(pointers.values()), r = vp.getBoundingClientRect(), mx = (pts[0].x + pts[1].x) / 2 - r.left, my = (pts[0].y + pts[1].y) / 2 - r.top;
    gesture = { type: 'pinch', d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, z0: V.zoom, ox: (mx - V.px) / V.zoom, oy: (my - V.py) / V.zoom }; marquee = null; snapLines = [];
  }
  function updatePinch() {
    const pts = Array.from(pointers.values()), r = vp.getBoundingClientRect(), mx = (pts[0].x + pts[1].x) / 2 - r.left, my = (pts[0].y + pts[1].y) / 2 - r.top, d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    V.zoom = SMS.clamp(gesture.z0 * d / gesture.d0, 0.05, 8); V.px = mx - gesture.ox * V.zoom; V.py = my - gesture.oy * V.zoom; applyView();
  }
  function onWheel(e) {
    e.preventDefault(); const r = vp.getBoundingClientRect();
    if (e.shiftKey && !e.ctrlKey) { V.px -= e.deltaY; applyView(); return; }
    St.zoomTo(V.zoom * Math.pow(1.0016, -e.deltaY * (e.deltaMode === 1 ? 16 : 1)), e.clientX - r.left, e.clientY - r.top);
  }

  /* guias vindas das réguas */
  function rulerDrag(axis) {
    return (e) => {
      e.preventDefault(); const el = e.currentTarget; el.setPointerCapture(e.pointerId); const t = axis === 'x' ? 'h' : 'v';
      const mv = (ev) => { const r = vp.getBoundingClientRect(); guidePrev = { t, s: t === 'h' ? ev.clientY - r.top : ev.clientX - r.left }; dirty = true; };
      const up = (ev) => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); const r = vp.getBoundingClientRect(); guidePrev = null;
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) { const v = Math.round(t === 'h' ? (ev.clientY - r.top - V.py) / V.zoom : (ev.clientX - r.left - V.px) / V.zoom); S.project.guides[t].push(v); O.guides = true; SMS.changed('guide'); }
        dirty = true;
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); mv(e);
    };
  }

  /* ---------- barra de ferramentas ---------- */
  function buildTools() {
    const bar = $('stageTools'), T = (o) => { const b = UI.btn(Object.assign({ cls: 'sm icon' }, o)); bar.append(b); return b; };
    const sel = T({ icon: 'cursor', title: 'Selecionar (V)', on: () => setTool('select') }), hand = T({ icon: 'hand', title: 'Mover a área de trabalho (H)', on: () => setTool('hand') });
    const multi = T({ icon: 'layers', title: 'Selecionar vários (toque para adicionar à seleção)', on: () => { O.multi = !O.multi; sync(); } });
    bar.append(SMS.h('span', { class: 'sep' }));
    T({ icon: 'zout', title: 'Reduzir zoom (-)', on: () => St.zoomTo(V.zoom / 1.25) }); const zl = SMS.h('button', { class: 'btn sm', type: 'button', title: 'Zoom 100%', onclick: () => St.zoomTo(1 / dpr * dpr), text: '100%' }); bar.append(zl);
    T({ icon: 'zin', title: 'Aumentar zoom (+)', on: () => St.zoomTo(V.zoom * 1.25) }); T({ icon: 'fit', title: 'Ajustar à tela (0)', on: () => St.fit() });
    bar.append(SMS.h('span', { class: 'sep' }));
    const grid = T({ icon: 'grid', title: 'Grade (G)', on: () => { O.grid = !O.grid; UI.setPref('grid', O.grid); sync(); dirty = true; } });
    const snap = SMS.h('button', { class: 'btn sm', type: 'button', title: 'Ímã: alinhar a guias, bordas e centros', text: 'Ímã', onclick: () => { O.snap = !O.snap; UI.setPref('snap', O.snap); sync(); } }); bar.append(snap);
    const guides = SMS.h('button', { class: 'btn sm hide-m', type: 'button', title: 'Mostrar/ocultar guias. Arraste das réguas para criar.', text: 'Guias', onclick: () => { O.guides = !O.guides; sync(); dirty = true; } }); bar.append(guides);
    const clr = SMS.h('button', { class: 'btn sm hide-m', type: 'button', title: 'Remover todas as guias', text: '✕ guias', onclick: () => { S.project.guides = { v: [], h: [] }; SMS.changed(); } }); bar.append(clr);
    const rul = SMS.h('button', { class: 'btn sm hide-m', type: 'button', title: 'Réguas', text: 'Réguas', onclick: () => { O.rulers = !O.rulers; UI.setPref('rulers', O.rulers); sync(); St.layout(); } }); bar.append(rul);
    const safe = SMS.h('button', { class: 'btn sm', type: 'button', title: 'Margens de segurança (títulos e interface de Stories)', text: 'Segura', onclick: () => { O.safe = !O.safe; sync(); dirty = true; } }); bar.append(safe);
    const clean = SMS.h('button', { class: 'btn sm', type: 'button', title: 'Visualização limpa: esconde alças e guias', text: 'Limpo', onclick: () => { O.clean = !O.clean; sync(); dirty = true; } }); bar.append(clean);
    T({ icon: 'full', title: 'Tela cheia', on: () => St.fullscreen() });
    function sync() {
      sel.classList.toggle('on', O.tool === 'select'); hand.classList.toggle('on', O.tool === 'hand'); multi.classList.toggle('on', O.multi); grid.classList.toggle('on', O.grid); snap.classList.toggle('on', O.snap);
      guides.classList.toggle('on', O.guides); rul.classList.toggle('on', O.rulers); safe.classList.toggle('on', O.safe); clean.classList.toggle('on', O.clean);
      area.classList.toggle('norulers', !O.rulers); vp.classList.toggle('hand', O.tool === 'hand');
    }
    function setTool(t) { O.tool = t; sync(); }
    St.syncTools = sync; St.setTool = setTool; St.zoomLabel = zl; sync();
    SMS.on('view', () => { zl.textContent = Math.round(V.zoom * 100) + '%'; });
  }
  St.fullscreen = () => {
    const el = area; const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const rq = el.requestFullscreen || el.webkitRequestFullscreen; if (rq) { rq.call(el).catch(() => SMS.emit('toast', { msg: 'Este navegador não permitiu tela cheia.', type: 'warn' })); } else SMS.emit('toast', { msg: 'Tela cheia não é suportada aqui.', type: 'warn' });
  };

  St.init = () => {
    vp = $('viewport'); stage = $('stage'); sctx = stage.getContext('2d'); ov = $('overlay'); octx = ov.getContext('2d'); rx = $('rulerX'); ry = $('rulerY'); wrap = $('stageWrap'); area = $('stageArea'); hud = $('hud');
    O.grid = UI.pref('grid', false); O.snap = UI.pref('snap', true); O.rulers = UI.pref('rulers', true); O.gridSize = UI.pref('gridSize', 40);
    document.documentElement.style.setProperty('--ck', UI.pref('checker', 16) + 'px');
    buildTools();
    vp.addEventListener('pointerdown', onDown); vp.addEventListener('pointermove', onMove); vp.addEventListener('pointerup', onUp); vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('wheel', onWheel, { passive: false }); vp.addEventListener('contextmenu', e => e.preventDefault());
    vp.addEventListener('dblclick', (e) => { const el = hitElement(toProj(e)); if (el && el.type === 'text') SMS.emit('edit-text', el.id); });
    rx.addEventListener('pointerdown', rulerDrag('x')); ry.addEventListener('pointerdown', rulerDrag('y'));
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target || {}).tagName || '')) { if (!spaceDown) { spaceDown = true; vp.classList.add('hand'); } } });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; vp.classList.toggle('hand', O.tool === 'hand'); } });
    new ResizeObserver(() => St.layout()).observe(vp); document.addEventListener('fullscreenchange', () => { setTimeout(() => { St.layout(); St.fit(); }, 80); $('fsPlay').hidden = !document.fullscreenElement; });
    window.addEventListener('orientationchange', () => setTimeout(() => { St.layout(); St.fit(); }, 250));
    SMS.on('change', () => { dirty = true; }); SMS.on('selection', () => { dirty = true; }); SMS.on('time', () => { dirty = true; }); SMS.on('media:loaded', () => { dirty = true; }); SMS.on('media:frame', () => { dirty = true; });
    SMS.on('project:loaded', () => { fitted = false; setTimeout(() => { St.layout(); }, 0); }); SMS.on('canvas', () => { St.fit(); });
    if (document.fonts) document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { dirty = true; });
    St.layout(); requestAnimationFrame(loop);
  };
  St.canvas = () => stage;
})();
