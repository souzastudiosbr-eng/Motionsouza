/* Motor de animação: keyframes por propriedade, interpolação, curvas Bézier e presets editáveis.
   Tempo das keyframes é RELATIVO ao início do clipe (ou ao fim, quando anchor === 'end'),
   por isso mover/aparar um clipe leva a animação junto. */
(function () {
  'use strict';
  const SMS = window.SMS;
  const A = SMS.Anim = {};

  A.PROPS = {
    x: { label: 'Posição X', step: 1 }, y: { label: 'Posição Y', step: 1 },
    scaleX: { label: 'Escala X', step: 0.01, def: 1 }, scaleY: { label: 'Escala Y', step: 0.01, def: 1 },
    rotation: { label: 'Rotação (°)', step: 1, def: 0 }, opacity: { label: 'Opacidade', step: 0.01, min: 0, max: 1, def: 1 },
    w: { label: 'Largura', step: 1 }, h: { label: 'Altura', step: 1 },
    color: { label: 'Cor', type: 'color' }, size: { label: 'Tamanho do texto', step: 1 },
    typed: { label: 'Digitação (0–1)', step: 0.01, min: 0, max: 1, def: 1 }, wipe: { label: 'Revelar (0–1)', step: 0.01, min: 0, max: 1, def: 1 },
    letterSpacing: { label: 'Espaçamento de letras', step: 0.5, def: 0 }, blur: { label: 'Desfoque', step: 0.5, min: 0, def: 0 },
    radius: { label: 'Cantos arredondados', step: 1, min: 0, def: 0 }, volume: { label: 'Volume', step: 0.01, min: 0, max: 2, def: 1 }
  };
  const COMMON = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'w', 'h'];
  A.propsFor = (it) => {
    switch (it.type) {
      case 'audio': return ['volume'];
      case 'text': return COMMON.concat(['size', 'color', 'typed', 'wipe', 'letterSpacing']);
      case 'image': return COMMON.concat(['wipe', 'blur', 'radius']);
      case 'video': return COMMON.concat(['wipe', 'blur', 'radius', 'volume']);
      case 'shape': return COMMON.concat(['color', 'wipe', 'radius']);
      default: return COMMON.concat(['color', 'wipe']);
    }
  };
  A.base = (it, p) => { const v = it[p]; if (v != null) return v; const d = A.PROPS[p] && A.PROPS[p].def; return d != null ? d : 0; };

  /* ---------- easing ---------- */
  const NAMED = {
    linear: [0, 0, 1, 1], in: [0.42, 0, 1, 1], out: [0, 0, 0.58, 1], inout: [0.42, 0, 0.58, 1],
    outStrong: [0.16, 1, 0.3, 1], inStrong: [0.7, 0, 0.84, 0], back: [0.34, 1.56, 0.64, 1]
  };
  A.EASES = [['linear', 'Linear'], ['in', 'Ease-in'], ['out', 'Ease-out'], ['inout', 'Ease-in-out'], ['outStrong', 'Saída forte (cinema)'], ['inStrong', 'Entrada forte'], ['back', 'Overshoot'], ['bounce', 'Quique'], ['elastic', 'Elástico'], ['hold', 'Manter (degrau)'], ['bezier', 'Bézier personalizada']];
  function cubic(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 24; i++) { const e = X(t); if (Math.abs(e - x) < 1e-6) break; if (e < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  const cache = {};
  function bounceOut(t) { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; }
  A.ease = (k, u) => {
    u = SMS.clamp(u, 0, 1); const e = k.ease || 'linear';
    if (e === 'hold') return u >= 1 ? 1 : 0;
    if (e === 'bounce') return bounceOut(u);
    if (e === 'elastic') return u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    let bz = e === 'bezier' ? (k.bz || NAMED.inout) : (NAMED[e] || NAMED.linear);
    const key = bz.join(',');
    const f = cache[key] || (cache[key] = cubic(bz[0], bz[1], bz[2], bz[3]));
    return f(u);
  };

  /* ---------- avaliação ---------- */
  const hex = (c) => { c = String(c || '#000'); if (c[0] !== '#') return [0, 0, 0]; if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; const n = parseInt(c.slice(1, 7), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = (r) => '#' + r.map(v => Math.round(SMS.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  A.sortedKeys = (it, p, dur) => {
    const tr = it.kf && it.kf[p]; if (!tr) return [];
    return tr.map(k => ({ k, t: k.anchor === 'end' ? dur - k.t : k.t })).sort((a, b) => a.t - b.t);
  };
  A.value = (it, p, lt, dur) => {
    const tr = it.kf && it.kf[p];
    if (!tr || !tr.length) return A.base(it, p);
    const arr = A.sortedKeys(it, p, dur), n = arr.length;
    if (lt <= arr[0].t) return arr[0].k.v;
    if (lt >= arr[n - 1].t) return arr[n - 1].k.v;
    let i = 0; while (i < n - 1 && arr[i + 1].t <= lt) i++;
    const a = arr[i], b = arr[i + 1], span = b.t - a.t, u = span > 1e-9 ? (lt - a.t) / span : 1, e = A.ease(a.k, u);
    if (typeof a.k.v === 'string') { const c1 = hex(a.k.v), c2 = hex(b.k.v); return toHex([0, 1, 2].map(j => c1[j] + (c2[j] - c1[j]) * e)); }
    return a.k.v + (b.k.v - a.k.v) * e;
  };
  A.isAnimated = (it, p) => !!(it.kf && it.kf[p] && it.kf[p].length);
  A.hasAny = (it) => !!it.kf && Object.keys(it.kf).some(p => it.kf[p] && it.kf[p].length);
  A.keyAt = (it, p, lt, dur) => {
    const eps = 0.5 / SMS.fps();
    return A.sortedKeys(it, p, dur).find(o => Math.abs(o.t - lt) <= eps) || null;
  };
  A.setKey = (it, p, lt, v, dur, extra) => {
    it.kf = it.kf || {}; const tr = it.kf[p] = it.kf[p] || [];
    const ex = A.keyAt(it, p, lt, dur);
    if (ex) { ex.k.v = v; if (extra) Object.assign(ex.k, extra); return ex.k; }
    const k = Object.assign({ id: SMS.uid('k'), t: Math.max(0, SMS.round(lt, 4)), v, ease: 'inout' }, extra || {});
    tr.push(k); return k;
  };
  A.removeKey = (it, p, kid) => { if (!it.kf || !it.kf[p]) return; it.kf[p] = it.kf[p].filter(k => k.id !== kid); if (!it.kf[p].length) delete it.kf[p]; };
  A.findKey = (it, p, kid) => (it.kf && it.kf[p] || []).find(k => k.id === kid) || null;
  A.clear = (it, p) => { if (!it.kf) return; if (p) delete it.kf[p]; else it.kf = {}; };
  A.copyKeys = (it) => SMS.clone(it.kf || {});
  A.pasteKeys = (it, kf) => { it.kf = SMS.clone(kf); for (const p in it.kf) it.kf[p].forEach(k => k.id = SMS.uid('k')); };
  /* Define um valor: se a propriedade é animada, cria/atualiza keyframe no tempo atual (como o cronômetro do After Effects). */
  A.setValue = (it, p, v, lt, dur) => {
    if (A.isAnimated(it, p)) A.setKey(it, p, Math.max(0, Math.min(lt, dur)), v, dur);
    it[p] = v;
  };

  /* ---------- presets (usam o sistema real de keyframes; editáveis depois de aplicados) ---------- */
  const PRESETS = A.PRESETS = [];
  const def = (id, name, phase, desc, build, opt) => PRESETS.push(Object.assign({ id, name, phase, desc, build }, opt || {}));
  const SIDE = [['left', 'Esquerda'], ['right', 'Direita'], ['top', 'Cima'], ['bottom', 'Baixo']];
  A.SIDES = SIDE;
  const offs = (dir, d) => ({ left: [-d, 0], right: [d, 0], top: [0, -d], bottom: [0, d] }[dir] || [-d, 0]);

  def('fadeIn', 'Aparecer (fade)', 'in', 'Opacidade de 0 até o valor atual.', (b, P) => [{ prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: P.dur, v: b('opacity') }] }], { dur: 0.6 });
  def('slideIn', 'Deslizar para dentro', 'in', 'Vem de um lado até a posição atual.', (b, P) => {
    const o = offs(P.dir, P.dist), tr = [{ prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: P.dur * 0.6, v: b('opacity') }] }];
    if (o[0]) tr.push({ prop: 'x', keys: [{ t: 0, v: b('x') + o[0], ease: 'outStrong' }, { t: P.dur, v: b('x') }] });
    if (o[1]) tr.push({ prop: 'y', keys: [{ t: 0, v: b('y') + o[1], ease: 'outStrong' }, { t: P.dur, v: b('y') }] });
    return tr;
  }, { dur: 0.7, dir: 'left', dist: 320, hasDir: true });
  def('zoomIn', 'Zoom para dentro', 'in', 'Cresce de 40% até o tamanho atual.', (b, P) => [
    { prop: 'scaleX', keys: [{ t: 0, v: b('scaleX') * 0.4, ease: 'outStrong' }, { t: P.dur, v: b('scaleX') }] },
    { prop: 'scaleY', keys: [{ t: 0, v: b('scaleY') * 0.4, ease: 'outStrong' }, { t: P.dur, v: b('scaleY') }] },
    { prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: P.dur * 0.7, v: b('opacity') }] }], { dur: 0.7 });
  def('bounce', 'Quique', 'in', 'Cai de cima e quica até a posição.', (b, P) => [
    { prop: 'y', keys: [{ t: 0, v: b('y') - P.dist, ease: 'bounce' }, { t: P.dur, v: b('y') }] },
    { prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: 0.15, v: b('opacity') }] }], { dur: 0.9, dist: 500 });
  def('pop', 'Pop', 'in', 'Surge com overshoot elástico.', (b, P) => [
    { prop: 'scaleX', keys: [{ t: 0, v: 0, ease: 'back' }, { t: P.dur, v: b('scaleX') }] },
    { prop: 'scaleY', keys: [{ t: 0, v: 0, ease: 'back' }, { t: P.dur, v: b('scaleY') }] },
    { prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: Math.min(0.12, P.dur), v: b('opacity') }] }], { dur: 0.5 });
  def('reveal', 'Revelar (cortina)', 'in', 'Revela da esquerda para a direita.', (b, P) => [{ prop: 'wipe', keys: [{ t: 0, v: 0, ease: 'inout' }, { t: P.dur, v: 1 }] }], { dur: 0.8 });
  def('spin', 'Girar para dentro', 'in', 'Gira e cresce até a posição.', (b, P) => [
    { prop: 'rotation', keys: [{ t: 0, v: b('rotation') - 270, ease: 'outStrong' }, { t: P.dur, v: b('rotation') }] },
    { prop: 'scaleX', keys: [{ t: 0, v: b('scaleX') * 0.2, ease: 'outStrong' }, { t: P.dur, v: b('scaleX') }] },
    { prop: 'scaleY', keys: [{ t: 0, v: b('scaleY') * 0.2, ease: 'outStrong' }, { t: P.dur, v: b('scaleY') }] },
    { prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: P.dur * 0.5, v: b('opacity') }] }], { dur: 0.9 });
  def('typewriter', 'Digitação de texto', 'in', 'Letras surgem uma a uma (só texto).', (b, P) => [{ prop: 'typed', keys: [{ t: 0, v: 0, ease: 'linear' }, { t: P.dur, v: 1 }] }], { dur: 1.5, only: 'text' });
  def('cinematic', 'Entrada cinematográfica', 'in', 'Aproximação lenta com fade.', (b, P) => [
    { prop: 'scaleX', keys: [{ t: 0, v: b('scaleX') * 1.3, ease: 'outStrong' }, { t: P.dur, v: b('scaleX') }] },
    { prop: 'scaleY', keys: [{ t: 0, v: b('scaleY') * 1.3, ease: 'outStrong' }, { t: P.dur, v: b('scaleY') }] },
    { prop: 'y', keys: [{ t: 0, v: b('y') + 40, ease: 'outStrong' }, { t: P.dur, v: b('y') }] },
    { prop: 'opacity', keys: [{ t: 0, v: 0, ease: 'out' }, { t: P.dur * 0.6, v: b('opacity') }] }], { dur: 1.6 });
  def('fadeOut', 'Desaparecer (fade)', 'out', 'Opacidade até 0 no final do clipe.', (b, P) => [{ prop: 'opacity', keys: [{ t: P.dur, v: b('opacity'), ease: 'in' }, { t: 0, v: 0 }] }], { dur: 0.6 });
  def('slideOut', 'Deslizar para fora', 'out', 'Sai por um lado no final do clipe.', (b, P) => {
    const o = offs(P.dir, P.dist), tr = [{ prop: 'opacity', keys: [{ t: P.dur * 0.6, v: b('opacity'), ease: 'in' }, { t: 0, v: 0 }] }];
    if (o[0]) tr.push({ prop: 'x', keys: [{ t: P.dur, v: b('x'), ease: 'inStrong' }, { t: 0, v: b('x') + o[0] }] });
    if (o[1]) tr.push({ prop: 'y', keys: [{ t: P.dur, v: b('y'), ease: 'inStrong' }, { t: 0, v: b('y') + o[1] }] });
    return tr;
  }, { dur: 0.7, dir: 'right', dist: 320, hasDir: true });
  def('zoomOut', 'Zoom para fora', 'out', 'Encolhe e some no final.', (b, P) => [
    { prop: 'scaleX', keys: [{ t: P.dur, v: b('scaleX'), ease: 'inStrong' }, { t: 0, v: b('scaleX') * 0.5 }] },
    { prop: 'scaleY', keys: [{ t: P.dur, v: b('scaleY'), ease: 'inStrong' }, { t: 0, v: b('scaleY') * 0.5 }] },
    { prop: 'opacity', keys: [{ t: P.dur, v: b('opacity'), ease: 'in' }, { t: 0, v: 0 }] }], { dur: 0.6 });
  def('softOut', 'Saída suave', 'out', 'Sobe levemente e some.', (b, P) => [
    { prop: 'y', keys: [{ t: P.dur, v: b('y'), ease: 'in' }, { t: 0, v: b('y') - 30 }] },
    { prop: 'scaleX', keys: [{ t: P.dur, v: b('scaleX'), ease: 'in' }, { t: 0, v: b('scaleX') * 0.96 }] },
    { prop: 'scaleY', keys: [{ t: P.dur, v: b('scaleY'), ease: 'in' }, { t: 0, v: b('scaleY') * 0.96 }] },
    { prop: 'opacity', keys: [{ t: P.dur, v: b('opacity'), ease: 'in' }, { t: 0, v: 0 }] }], { dur: 0.8 });
  def('float', 'Flutuar (movimento contínuo)', 'loop', 'Sobe e desce suavemente durante todo o clipe.', (b, P) => {
    const per = Math.max(0.4, P.period), n = Math.min(300, Math.ceil(P.total / (per / 2))), keys = [{ t: 0, v: b('y'), ease: 'inout' }];
    for (let i = 0; i < n; i++) keys.push({ t: per / 4 + i * per / 2, v: b('y') + (i % 2 ? P.amp : -P.amp), ease: 'inout' });
    keys.push({ t: P.total, v: b('y') }); return [{ prop: 'y', keys }];
  }, { period: 2.4, amp: 18, loop: true });
  def('pulse', 'Pulsação', 'loop', 'Escala pulsa continuamente.', (b, P) => {
    const per = Math.max(0.3, P.period), n = Math.min(300, Math.ceil(P.total / (per / 2))), kx = [], ky = [];
    for (let i = 0; i <= n; i++) { const f = i % 2 ? 1.1 : 1; kx.push({ t: i * per / 2, v: b('scaleX') * f, ease: 'inout' }); ky.push({ t: i * per / 2, v: b('scaleY') * f, ease: 'inout' }); }
    return [{ prop: 'scaleX', keys: kx }, { prop: 'scaleY', keys: ky }];
  }, { period: 0.9, loop: true });
  def('rotateLoop', 'Rotação contínua', 'loop', 'Gira continuamente (1 volta a cada 4 s).', (b, P) => [{ prop: 'rotation', keys: [{ t: 0, v: b('rotation'), ease: 'linear' }, { t: P.total, v: b('rotation') + 360 * P.total / 4 }] }], { loop: true });

  A.getPreset = (id) => PRESETS.find(p => p.id === id);
  /* Aplica um preset em um item. dur = duração efetiva do clipe. Retorna true se aplicou. */
  A.applyPreset = (it, id, params, dur) => {
    const pr = A.getPreset(id); if (!pr) return false;
    if (pr.only && it.type !== pr.only) return false;
    const P = Object.assign({ dur: pr.dur || 0.6, dir: pr.dir, dist: pr.dist, period: pr.period, amp: pr.amp, delay: 0 }, params || {});
    P.dur = Math.max(0.05, Math.min(P.dur, Math.max(0.05, dur)));
    P.total = dur;
    if (id === 'typewriter' && !(params && params.dur)) P.dur = Math.min(Math.max(0.8, String(it.text || '').length * 0.06), Math.max(0.2, dur));
    const base = (p) => A.base(it, p), tracks = pr.build(base, P);
    it.kf = it.kf || {};
    tracks.forEach(tk => {
      const keys = tk.keys.map(k => Object.assign({ id: SMS.uid('k'), grp: pr.phase }, k, { v: k.v, t: SMS.round(k.t + (P.delay || 0), 4) }));
      if (P.delay > 0 && pr.phase === 'in') keys.unshift({ id: SMS.uid('k'), grp: pr.phase, t: 0, v: keys[0].v, ease: 'linear' });
      if (pr.phase === 'out') keys.forEach(k => k.anchor = 'end');
      const old = (it.kf[tk.prop] || []).filter(k => k.grp !== pr.phase);
      it.kf[tk.prop] = old.concat(keys);
    });
    return true;
  };
})();
