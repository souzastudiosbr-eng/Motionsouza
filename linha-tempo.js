/* Linha do tempo: régua, cenas (arrastar para reordenar, puxar a borda para mudar a duração),
   clipes dos elementos (mover, aparar, dividir), keyframes arrastáveis, faixas de áudio com forma de onda,
   cursor de reprodução e barra de transporte. */
(function () {
  'use strict';
  const SMS = window.SMS, S = SMS.S, A = SMS.Anim, C = SMS.Cmd, UI = SMS.UI, h = SMS.h, $ = (id) => document.getElementById(id);
  const TL = SMS.Timeline = { pps: 80 };
  let inner, scroller, playhead, tctl = {}, pending = 0;
  const LW = () => parseInt(getComputedStyle($('app')).getPropertyValue('--lw')) || 124;
  const fq = (t) => Math.round(t * SMS.fps()) / SMS.fps();

  function drag(e, onMove, onEnd) {
    e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY; let moved = false;
    const mv = (ev) => { if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return; moved = true; onMove(ev.clientX - x0, ev, ev.clientY - y0); };
    const up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (onEnd) onEnd(ev, moved); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  const seekX = (clientX) => { const r = scroller.getBoundingClientRect(); return Math.max(0, (clientX - r.left + scroller.scrollLeft - LW()) / TL.pps); };

  TL.schedule = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; render(); }); };

  function selectClip(e, id) {
    const additive = e.shiftKey || e.ctrlKey || e.metaKey || SMS.Stage.opts.multi;
    if (additive) { const cur = new Set(S.sel); if (cur.has(id)) cur.delete(id); else SMS.expandGroups([id]).forEach(i => cur.add(i)); SMS.setSelection(Array.from(cur)); }
    else if (!S.sel.includes(id)) SMS.setSelection(SMS.expandGroups([id]));
  }
  function snapTimes(cands, vals, th) {
    let best = null; vals.forEach(v => cands.forEach(c => { const d = c - v; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best))) best = d; })); return best || 0;
  }

  function clipDrag(e, el, scene, si, mode) {
    selectClip(e, el.id); if (el.locked) return;
    const sceneDur = scene.duration, lt = S.T - SMS.sceneStart(si), th = 7 / TL.pps;
    const sel = mode === 'move' ? SMS.expandGroups(S.sel).map(SMS.findItem).filter(r => r && !r.audio && r.sceneIdx === si && !r.item.locked).map(r => r.item) : [el];
    const items = sel.map(x => ({ el: x, start: x.start, end: SMS.effEnd(x, scene), trim: x.trimIn || 0 }));
    const others = scene.elements.filter(x => !sel.includes(x)).flatMap(x => [x.start, SMS.effEnd(x, scene)]); const cands = [0, sceneDur, lt].concat(others);
    drag(e, (dx) => {
      let dt = dx / TL.pps;
      if (mode === 'move') {
        dt = SMS.clamp(dt, -Math.min(...items.map(s => s.start)), Math.min(...items.map(s => sceneDur - s.end)));
        dt += snapTimes(cands, [items[0].start + dt, items[0].end + dt], th); dt = SMS.clamp(dt, -Math.min(...items.map(s => s.start)), Math.min(...items.map(s => sceneDur - s.end)));
        items.forEach(s => { s.el.start = fq(s.start + dt); const en = s.end + dt; s.el.end = en >= sceneDur - 1e-4 ? null : fq(en); });
      } else if (mode === 'l') {
        const s = items[0]; let ns = s.start + dt; ns += snapTimes(cands, [ns], th); ns = SMS.clamp(ns, el.type === 'video' ? Math.max(0, s.start - s.trim) : 0, s.end - 0.1); s.el.start = fq(ns);
        if (el.type === 'video') s.el.trimIn = Math.max(0, SMS.round(s.trim + (fq(ns) - s.start), 3));
      } else {
        const s = items[0]; let ne = s.end + dt; ne += snapTimes(cands, [ne], th); let mx = sceneDur;
        if (el.type === 'video' && !el.loop) { const rec = SMS.Media.get(el.mediaId); if (rec && rec.duration) mx = Math.min(mx, s.start + rec.duration - (el.trimIn || 0)); }
        ne = SMS.clamp(ne, s.start + 0.1, mx); s.el.end = ne >= sceneDur - 1e-4 ? null : fq(ne);
      }
      SMS.touch();
    }, (ev, moved) => { if (moved) SMS.changed('clip'); else SMS.setTime(Math.max(S.T, 0)); });
  }
  function audioDrag(e, c, mode) {
    selectClip(e, c.id); const s0 = { start: c.start, dur: c.dur, off: c.offset }, rec = SMS.Media.get(c.mediaId), th = 7 / TL.pps;
    const cands = [S.T, 0, SMS.total()].concat(S.project.audio.filter(x => x !== c).flatMap(x => [x.start, x.start + x.dur]));
    drag(e, (dx) => {
      let dt = dx / TL.pps;
      if (mode === 'move') { dt += snapTimes(cands, [s0.start + dt, s0.start + s0.dur + dt], th); c.start = Math.max(0, fq(s0.start + dt)); }
      else if (mode === 'l') { dt = SMS.clamp(dt, -s0.off, s0.dur - 0.1); dt = Math.max(dt, -s0.start); c.start = fq(s0.start + dt); c.offset = Math.max(0, SMS.round(s0.off + (c.start - s0.start), 3)); c.dur = SMS.round(s0.dur - (c.start - s0.start), 3); }
      else { let nd = s0.dur + dt; nd += snapTimes(cands, [s0.start + nd], th); const mx = rec && rec.duration ? rec.duration - s0.off : 1e9; c.dur = SMS.clamp(SMS.round(nd, 3), 0.1, mx); }
      SMS.touch();
    }, (ev, moved) => { if (moved) SMS.changed('aclip'); });
  }
  function keyDrag(e, item, prop, k, clipStartG, dur) {
    S.selKey = { id: item.id, prop, kid: k.id }; SMS.emit('selkey');
    drag(e, (dx) => {
      let abs = SMS.clamp(fq((k.anchor === 'end' ? dur - k.t : k.t) + 0), 0, dur); const base = k._abs0 == null ? (k._abs0 = abs) : k._abs0;
      abs = SMS.clamp(fq(base + dx / TL.pps), 0, dur); k.t = k.anchor === 'end' ? SMS.round(dur - abs, 4) : SMS.round(abs, 4); SMS.touch();
    }, (ev, moved) => { delete k._abs0; if (moved) SMS.changed('key'); else { SMS.setTime(clipStartG + (k.anchor === 'end' ? dur - k.t : k.t)); SMS.emit('selkey'); } });
  }

  /* ---------- construção ---------- */
  function render() {
    if (!inner || !S.project) return;
    const P = S.project, L = SMS.layout(), lw = LW(), pps = TL.pps, fps = SMS.fps();
    let end = L.total; P.audio.forEach(a => { end = Math.max(end, a.start + a.dur); });
    const W = lw + (end + 3) * pps; inner.style.width = Math.max(W, scroller.clientWidth) + 'px'; inner.textContent = '';
    const X = (t) => lw + t * pps, row = (cls) => { const r = h('div', { class: 'row ' + (cls || '') }); inner.append(r); return r; }, lab = (r, ...c) => r.append(h('div', { class: 'rlabel' }, ...c));

    // régua
    const ru = h('div', { class: 'ruler', onpointerdown: (e) => { if (e.clientX - scroller.getBoundingClientRect().left < lw) return; SMS.App.pause(); SMS.setTime(fq(seekX(e.clientX))); drag(e, (dx, ev) => SMS.setTime(fq(seekX(ev.clientX)))); } });
    ru.append(h('div', { class: 'rlabel', style: { height: '100%' }, text: 'Tempo' }));
    const steps = [1 / fps, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300], step = steps.find(s => s * pps >= 64) || 300, minor = pps >= fps * 5 ? 1 / fps : step / 5;
    if (end / minor < 2500) for (let t = 0; t <= end + 2; t += minor) ru.append(h('div', { class: 'tick', style: { left: X(t) + 'px' } }));
    for (let t = 0; t <= end + 2; t += step) { ru.append(h('div', { class: 'tick maj', style: { left: X(t) + 'px' } }), h('div', { class: 'tlab', style: { left: X(t) + 'px' }, text: step < 1 ? SMS.fmtTime(t, fps).slice(3) : (t >= 60 ? Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0') : t + 's') })); }
    inner.append(ru);

    // cenas
    const sr = row(); lab(sr, h('span', { text: 'Cenas' }));
    L.items.forEach((it, i) => {
      const blk = h('div', { class: 'scene-blk' + (i === S.sceneIdx ? ' cur' : ''), style: { left: X(it.start) + 'px', width: Math.max(10, (it.end - it.start) * pps) + 'px' }, title: it.scene.name + ' · ' + SMS.round(it.scene.duration, 2) + ' s' }, h('span', { text: (i + 1) + '. ' + it.scene.name, style: { overflow: 'hidden', textOverflow: 'ellipsis' } }));
      const hd = h('div', { class: 'hd', title: 'Arraste para mudar a duração' }); blk.append(hd);
      blk.addEventListener('pointerdown', (e) => {
        if (e.target === hd) { const d0 = it.scene.duration; drag(e, (dx) => { C.setSceneDuration(i, fq(d0 + dx / pps)); }, (ev, m) => { if (m) SMS.changed('dur'); }); return; }
        const left0 = it.start * pps;
        drag(e, (dx) => { blk.style.transform = 'translateX(' + dx + 'px)'; blk.style.zIndex = 5; blk.style.opacity = .8; }, (ev, moved) => {
          if (!moved) { SMS.App.pause(); SMS.setTime(it.start); SMS.setSelection([]); return; }
          const center = left0 + (ev.clientX - e.clientX) + (it.end - it.start) * pps / 2; let ni = 0; L.items.forEach((o, j) => { if (j !== i && (o.start + o.end) / 2 * pps < center) ni++; }); blk.style.transform = ''; C.moveScene(i, ni);
        });
      });
      sr.append(blk); if (it.tr > 0) sr.append(h('div', { class: 'trov', style: { left: X(it.end - it.tr) + 'px', width: it.tr * pps + 'px' } }));
    });

    // elementos da cena atual (camada de cima primeiro)
    const sc = SMS.scene(), si = S.sceneIdx, s0 = SMS.sceneStart(si);
    const only = S.sel.length === 1 ? SMS.findItem(S.sel[0]) : null;
    sc.elements.slice().reverse().forEach(el => {
      const r = row(S.sel.includes(el.id) ? 'sel' : ''), ic = { text: 'T', image: '▧', video: '▶', shape: '■', icon: '★', texture: '▦', particles: '✦' }[el.type];
      lab(r, h('span', { text: ic + ' ' + el.name, title: el.name }), h('button', { class: el.visible === false ? '' : 'on', title: 'Mostrar/ocultar', 'aria-label': 'Mostrar ou ocultar', onclick: () => { el.visible = el.visible === false; SMS.changed(); } }, UI.svg(el.visible === false ? 'eyeoff' : 'eye')), h('button', { class: el.locked ? 'on' : '', title: 'Bloquear', 'aria-label': 'Bloquear', onclick: () => { el.locked = !el.locked; SMS.changed(); } }, UI.svg(el.locked ? 'lock' : 'unlock')));
      const en = SMS.effEnd(el, sc), clip = h('div', { class: 't-' + el.type + ' clip' + (S.sel.includes(el.id) ? ' sel' : '') + (el.visible === false ? ' hid' : ''), style: { left: X(s0 + el.start) + 'px', width: Math.max(8, (en - el.start) * pps) + 'px' }, title: el.name }, h('span', { class: 'cl', text: el.name }));
      if (el.type === 'video') { const rec = SMS.Media.get(el.mediaId); if (rec && rec.poster) { clip.style.backgroundImage = 'url(' + rec.poster + ')'; clip.style.backgroundSize = 'auto 100%'; } }
      const l = h('div', { class: 'hd l' }), rr = h('div', { class: 'hd r' }); clip.append(l, rr);
      const seen = new Set(); Object.keys(el.kf || {}).forEach(p => (el.kf[p] || []).forEach(k => { const a = k.anchor === 'end' ? (en - el.start) - k.t : k.t, key = Math.round(a * 1000); if (!seen.has(key)) { seen.add(key); clip.append(h('div', { class: 'kfd', style: { left: a * pps + 'px' } })); } }));
      clip.addEventListener('pointerdown', (e) => clipDrag(e, el, sc, si, e.target === l ? 'l' : e.target === rr ? 'r' : 'move'));
      r.append(clip);
      if (only && only.item === el && A.hasAny(el)) {
        Object.keys(el.kf).filter(p => el.kf[p].length).forEach(p => {
          const sr2 = row('sub'); lab(sr2, h('span', { text: '◆ ' + ((A.PROPS[p] || {}).label || p) }));
          const dur = en - el.start;
          el.kf[p].forEach(k => { const a = k.anchor === 'end' ? dur - k.t : k.t; const d = h('div', { class: 'kfd big' + (S.selKey && S.selKey.kid === k.id ? ' sel' : ''), style: { left: X(s0 + el.start + a) + 'px' }, title: ((A.PROPS[p] || {}).label || p) + ' · ' + SMS.round(a, 2) + ' s' }); d.addEventListener('pointerdown', (e) => keyDrag(e, el, p, k, s0 + el.start, dur)); sr2.append(d); });
        });
      }
    });

    // áudio
    S.project.audio.forEach(c => {
      const r = row(S.sel.includes(c.id) ? 'sel' : ''); lab(r, h('span', { text: '♪ ' + c.name, title: c.name }), h('button', { class: c.muted ? '' : 'on', title: 'Som ligado/mudo', 'aria-label': 'Som', onclick: () => { c.muted = !c.muted; SMS.changed(); } }, UI.svg(c.muted ? 'eyeoff' : 'eye')));
      const clip = h('div', { class: 'clip t-audio' + (S.sel.includes(c.id) ? ' sel' : '') + (c.muted ? ' hid' : ''), style: { left: X(c.start) + 'px', width: Math.max(8, c.dur * pps) + 'px' }, title: c.name });
      const cv = h('canvas'), l = h('div', { class: 'hd l' }), rr = h('div', { class: 'hd r' }); clip.append(cv, h('span', { class: 'cl', text: c.name }), l, rr);
      const rec = SMS.Media.get(c.mediaId), pk = rec ? SMS.Media.peaks(c.mediaId) : null;
      if (!rec) clip.style.background = '#552'; else if (pk) drawWave(cv, pk, c, rec, pps);
      (c.kf.volume || []).forEach(k => { clip.append(h('div', { class: 'kfd', style: { left: (k.anchor === 'end' ? c.dur - k.t : k.t) * pps + 'px' } })); });
      clip.addEventListener('pointerdown', (e) => audioDrag(e, c, e.target === l ? 'l' : e.target === rr ? 'r' : 'move')); r.append(clip);
      if (only && only.item === c && c.kf.volume && c.kf.volume.length) {
        const sr2 = row('sub'); lab(sr2, h('span', { text: '◆ Volume' }));
        c.kf.volume.forEach(k => { const a = k.anchor === 'end' ? c.dur - k.t : k.t, d = h('div', { class: 'kfd big' + (S.selKey && S.selKey.kid === k.id ? ' sel' : ''), style: { left: X(c.start + a) + 'px' } }); d.addEventListener('pointerdown', (e) => keyDrag(e, c, 'volume', k, c.start, c.dur)); sr2.append(d); });
      }
    });
    if (!sc.elements.length && !S.project.audio.length) { const r = row(); lab(r, h('span', { text: 'Vazio' })); r.append(h('div', { class: 'hint', style: { position: 'absolute', left: lw + 12 + 'px', top: '6px', margin: 0 }, text: 'Adicione elementos pelo painel Camadas ou pela Biblioteca.' })); }
    playhead = h('div', { id: 'playhead' }); inner.append(playhead); placePlayhead(); updateTransport();
  }
  function drawWave(cv, pk, c, rec, pps) {
    const w = Math.min(4096, Math.max(8, Math.round(c.dur * pps))), hgt = 28; cv.width = w; cv.height = hgt; const x = cv.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < w; i++) { const t = c.offset + i / w * c.dur, idx = Math.min(pk.length - 1, Math.floor(t / (rec.duration || 1) * pk.length)); const v = Math.min(1, pk[idx] * 1.4) * hgt / 2; x.fillRect(i, hgt / 2 - v, 1, Math.max(1, v * 2)); }
  }
  function placePlayhead() { if (playhead) playhead.style.left = LW() + S.T * TL.pps + 'px'; }
  function ensureVisible() {
    const x = LW() + S.T * TL.pps, l = scroller.scrollLeft, w = scroller.clientWidth;
    if (x > l + w - 30 || x < l + LW()) scroller.scrollLeft = Math.max(0, x - LW() - 40);
  }

  /* ---------- transporte ---------- */
  function buildTransport() {
    const bar = $('transport'), A_ = () => SMS.App;
    const b = (icon, title, on, cls) => { const x = UI.btn({ icon, title, on, cls: cls || '' }); bar.append(x); return x; };
    b('prev', 'Ir para o início (Home)', () => { A_().pause(); SMS.setTime(0); });
    b('left', 'Quadro anterior (,)', () => { A_().pause(); SMS.setTime(fq(S.T - 1 / SMS.fps())); });
    tctl.play = b('play', 'Reproduzir / pausar (Espaço)', () => A_().toggle(), 'primary');
    b('right', 'Próximo quadro (.)', () => { A_().pause(); SMS.setTime(fq(S.T + 1 / SMS.fps())); });
    b('next', 'Ir para o fim (End)', () => { A_().pause(); SMS.setTime(SMS.total()); });
    b('stop', 'Parar e voltar ao início', () => { A_().pause(); SMS.setTime(0); });
    tctl.loop = b('loop', 'Repetir', () => { S.loop = !S.loop; tctl.loop.classList.toggle('on', S.loop); });
    tctl.time = h('div', { class: 'time', 'aria-live': 'off' }); bar.append(tctl.time);
    tctl.speed = h('select', { title: 'Velocidade de reprodução (áudio só em 1×)', 'aria-label': 'Velocidade', onchange: () => { S.speed = Number(tctl.speed.value); if (S.playing) A_().play(); } }); [0.25, 0.5, 1, 1.5, 2].forEach(v => tctl.speed.append(h('option', { value: v, text: v + '×', selected: v === 1 }))); bar.append(tctl.speed);
    tctl.fps = h('select', { title: 'Taxa de quadros do projeto', 'aria-label': 'Quadros por segundo', onchange: () => C.setFps(Number(tctl.fps.value)) }); [24, 25, 30, 50, 60].forEach(v => tctl.fps.append(h('option', { value: v, text: v + ' fps' }))); bar.append(tctl.fps);
    b('cut', 'Dividir clipe selecionado no cursor (S)', () => C.split());
    bar.append(h('span', { class: 'spacer' }));
    tctl.zoom = h('input', { type: 'range', min: 0, max: 100, value: 50, title: 'Zoom da linha do tempo', 'aria-label': 'Zoom da linha do tempo', oninput: () => setPps(zFromSlider(Number(tctl.zoom.value))) }); bar.append(tctl.zoom);
    b('fit', 'Ajustar a linha do tempo', () => TL.fit());
  }
  const zFromSlider = (v) => 6 * Math.pow(300 / 6, v / 100), zToSlider = (p) => Math.log(p / 6) / Math.log(300 / 6) * 100;
  function setPps(p, anchorX) {
    p = SMS.clamp(p, 6, 300); const lw = LW(), ax = anchorX == null ? scroller.clientWidth / 2 : anchorX, t = (scroller.scrollLeft + ax - lw) / TL.pps; TL.pps = p;
    UI.setPref('pps', p); render(); scroller.scrollLeft = Math.max(0, t * p + lw - ax); if (tctl.zoom) tctl.zoom.value = zToSlider(p);
  }
  TL.fit = () => { if (scroller.clientWidth < 80) { TL._needFit = true; return; } TL._needFit = false; const total = Math.max(1, SMS.total()); setPps((scroller.clientWidth - LW() - 30) / total); scroller.scrollLeft = 0; };
  function updateTransport() {
    if (!tctl.time) return; const fps = SMS.fps();
    tctl.time.textContent = SMS.fmtTime(S.T, fps) + ' / ' + SMS.fmtTime(SMS.total(), fps); tctl.fps.value = String(fps);
    if (![24, 25, 30, 50, 60].includes(fps)) { if (!tctl.fps.querySelector('[data-c]')) tctl.fps.append(h('option', { value: fps, text: fps + ' fps', dataset: { c: 1 } })); tctl.fps.value = String(fps); }
    tctl.play.textContent = ''; tctl.play.append(UI.svg(S.playing ? 'pause' : 'play'));
  }
  TL.updateTransport = updateTransport;

  TL.init = () => {
    inner = $('tlInner'); scroller = $('tlScroll'); TL.pps = UI.pref('pps', 80); buildTransport();
    scroller.style.touchAction = 'pan-x pan-y';
    scroller.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = scroller.getBoundingClientRect(); setPps(TL.pps * Math.pow(1.002, -e.deltaY), e.clientX - r.left); } }, { passive: false });
    const ptrs = new Map(); let pz = null;
    scroller.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; ptrs.set(e.pointerId, e.clientX); if (ptrs.size === 2) { const v = Array.from(ptrs.values()); pz = { d: Math.abs(v[0] - v[1]) || 1, p: TL.pps }; } });
    scroller.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, e.clientX); if (ptrs.size === 2 && pz) { const v = Array.from(ptrs.values()); setPps(pz.p * Math.abs(v[0] - v[1]) / pz.d, (v[0] + v[1]) / 2 - scroller.getBoundingClientRect().left); } });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pz = null; }; scroller.addEventListener('pointerup', up); scroller.addEventListener('pointercancel', up);
    const rs = $('tlResize'); rs.addEventListener('pointerdown', (e) => { const app = $('app'), h0 = $('tl').getBoundingClientRect().height; drag(e, (dx, ev, dy) => { app.style.setProperty('--tlh', SMS.clamp(h0 - dy, 110, window.innerHeight * 0.6) + 'px'); }, () => { }); });
    ['change', 'selection', 'scene', 'project:loaded', 'media:peaks', 'canvas', 'selkey', 'project:restored'].forEach(n => SMS.on(n, TL.schedule));
    SMS.on('time', () => { placePlayhead(); updateTransport(); if (S.playing) ensureVisible(); });
    SMS.on('history', () => { }); new ResizeObserver(() => { if (TL._needFit && scroller.clientWidth >= 80) TL.fit(); else TL.schedule(); }).observe(scroller);
    render();
  };
  TL.setPlaying = updateTransport;
})();
