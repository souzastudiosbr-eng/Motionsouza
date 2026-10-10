/* Renderizador determinístico: dado (projeto, tempo) desenha exatamente o mesmo quadro no
   preview e na exportação. Cenas, transições, elementos e keyframes são avaliados aqui. */
(function () {
  'use strict';
  const SMS = window.SMS, A = SMS.Anim, PI = Math.PI;
  const R = SMS.Render = {};
  SMS.TRANSITIONS = [['none', 'Corte seco'], ['fade', 'Fusão (crossfade)'], ['dip', 'Fade pelo preto'], ['slideleft', 'Empurrar para a esquerda'], ['slideright', 'Empurrar para a direita'], ['slideup', 'Empurrar para cima'], ['slidedown', 'Empurrar para baixo'], ['zoom', 'Zoom'], ['wipe', 'Cortina'], ['circle', 'Círculo']];
  const GENERIC = ['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive', 'fantasy'];
  const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  const HAS_FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const tmp = [null, null];
  function getTmp(i, w, h) {
    let c = tmp[i];
    if (!c) { c = tmp[i] = document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  /* ---------- quadro ---------- */
  R.frame = function (ctx, project, t, opt) {
    opt = opt || {};
    const sc = opt.scale || 1, cw = ctx.canvas.width, ch = ctx.canvas.height, L = opt.layout || SMS.computeLayout(project);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = 'transparent'; ctx.clearRect(0, 0, cw, ch);
    if (!L.items.length) return;
    t = SMS.clamp(t, 0, Math.max(0, L.total - 1e-4));
    let act = L.items.filter(i => t >= i.start - 1e-9 && t < i.end - 1e-9);
    if (!act.length) act = [L.items[L.items.length - 1]];
    if (act.length === 1 || !act[0].tr) { const it = act[act.length - 1]; drawScene(ctx, project, it, t - it.start, opt, sc); return; }
    const out = act[0], inn = act[1], p = SMS.clamp((t - inn.start) / out.tr, 0, 1), type = out.scene.transition.type;
    const A_ = getTmp(0, cw, ch), B_ = getTmp(1, cw, ch), ca = A_.getContext('2d'), cb = B_.getContext('2d');
    ca.setTransform(1, 0, 0, 1, 0, 0); ca.clearRect(0, 0, cw, ch); cb.setTransform(1, 0, 0, 1, 0, 0); cb.clearRect(0, 0, cw, ch);
    drawScene(ca, project, out, t - out.start, opt, sc); drawScene(cb, project, inn, t - inn.start, opt, sc);
    composite(ctx, A_, B_, type, p, cw, ch);
  };
  function composite(ctx, a, b, type, p, cw, ch) {
    const e = easeIO(p); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    switch (type) {
      case 'dip':
        if (e < 0.5) { ctx.drawImage(a, 0, 0); ctx.globalAlpha = e * 2; } else { ctx.drawImage(b, 0, 0); ctx.globalAlpha = (1 - e) * 2; }
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch); break;
      case 'slideleft': ctx.drawImage(a, -e * cw, 0); ctx.drawImage(b, (1 - e) * cw, 0); break;
      case 'slideright': ctx.drawImage(a, e * cw, 0); ctx.drawImage(b, -(1 - e) * cw, 0); break;
      case 'slideup': ctx.drawImage(a, 0, -e * ch); ctx.drawImage(b, 0, (1 - e) * ch); break;
      case 'slidedown': ctx.drawImage(a, 0, e * ch); ctx.drawImage(b, 0, -(1 - e) * ch); break;
      case 'zoom': {
        let s = 1 + 0.25 * e; ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(s, s); ctx.drawImage(a, -cw / 2, -ch / 2); ctx.restore();
        s = 0.85 + 0.15 * e; ctx.globalAlpha = e; ctx.translate(cw / 2, ch / 2); ctx.scale(s, s); ctx.drawImage(b, -cw / 2, -ch / 2); break;
      }
      case 'wipe': ctx.drawImage(a, 0, 0); ctx.beginPath(); ctx.rect(0, 0, cw * e, ch); ctx.clip(); ctx.drawImage(b, 0, 0); break;
      case 'circle': ctx.drawImage(a, 0, 0); ctx.beginPath(); ctx.arc(cw / 2, ch / 2, e * Math.hypot(cw, ch) / 2, 0, PI * 2); ctx.clip(); ctx.drawImage(b, 0, 0); break;
      default: ctx.drawImage(a, 0, 0); ctx.globalAlpha = e; ctx.drawImage(b, 0, 0);
    }
    ctx.restore();
  }
  function drawScene(ctx, project, item, local, opt, sc) {
    const W = project.settings.width, H = project.settings.height, s = item.scene;
    ctx.save(); ctx.setTransform(sc, 0, 0, sc, 0, 0);
    if (!opt.transparent && s.bg && s.bg !== 'transparent') { ctx.fillStyle = s.bg; ctx.fillRect(0, 0, W, H); }
    for (const el of s.elements) drawEl(ctx, el, s, local, opt, sc);
    ctx.restore();
  }

  /* Valores avaliados de um elemento no tempo local da cena (também usado pelo palco para seleção). */
  R.evalEl = function (el, scene, local) {
    const end = SMS.effEnd(el, scene), lt = local - el.start, dur = end - el.start;
    const active = el.visible !== false && local >= el.start - 1e-9 && local < end - 1e-9;
    const v = (p) => A.value(el, p, lt, dur);
    return { active, lt, dur, x: v('x'), y: v('y'), w: Math.max(0, v('w')), h: Math.max(0, v('h')), sx: v('scaleX'), sy: v('scaleY'), rot: v('rotation'), op: SMS.clamp(v('opacity'), 0, 1), v };
  };
  R.hit = function (ev, px, py) {
    const a = -ev.rot * PI / 180, dx = px - ev.x, dy = py - ev.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(lx) <= Math.abs(ev.w * ev.sx) / 2 && Math.abs(ly) <= Math.abs(ev.h * ev.sy) / 2;
  };

  function drawEl(ctx, el, scene, local, opt, sc) {
    if (el.visible === false) return;
    const ev = R.evalEl(el, scene, local); if (!ev.active || ev.op <= 0.001) return;
    const v = ev.v, w = ev.w, h = ev.h;
    ctx.save(); ctx.globalAlpha = ev.op; ctx.translate(ev.x, ev.y); ctx.rotate(ev.rot * PI / 180); ctx.scale(ev.sx, ev.sy);
    const wipe = el.wipe != null || A.isAnimated(el, 'wipe') ? v('wipe') : 1;
    if (wipe < 0.999) { ctx.beginPath(); ctx.rect(-w / 2 - 40, -h / 2 - 40, w * wipe + 40, h + 80); ctx.clip(); }
    try {
      switch (el.type) {
        case 'text': drawText(ctx, el, v, w, h, sc); break;
        case 'shape': drawShape(ctx, el, v, w, h, sc); break;
        case 'icon': drawIcon(ctx, el, v, w, h, sc); break;
        case 'texture': drawTexture(ctx, el, v, w, h); break;
        case 'particles': drawParticles(ctx, el, v, w, h, ev.lt); break;
        case 'image': case 'video': drawMedia(ctx, el, v, w, h, ev, opt, sc); break;
      }
    } catch (e) { console.error('Erro ao desenhar', el.name, e); }
    ctx.restore();
  }
  function shadow(ctx, el, sc) {
    const s = el.shadow; if (!s || !s.on) return;
    ctx.shadowColor = rgba(s.color, s.alpha); ctx.shadowBlur = s.blur * sc; ctx.shadowOffsetX = s.x * sc; ctx.shadowOffsetY = s.y * sc;
  }
  function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  function rgba(c, a) {
    c = String(c || '#000000'); if (c[0] !== '#') return c;
    if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    const n = parseInt(c.slice(1, 7), 16) || 0; return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
  }

  /* ---------- texto ---------- */
  const layoutCache = new Map();
  function fontStr(el, size) {
    const fam = String(el.font || 'Arial').replace(/["'\\]/g, '');
    return (el.italic ? 'italic ' : '') + (el.weight || 700) + ' ' + size + 'px ' + (GENERIC.includes(fam) ? fam : '"' + fam + '", sans-serif');
  }
  function wrap(ctx, text, maxW) {
    const lines = [];
    String(text == null ? '' : text).split('\n').forEach(par => {
      if (par === '') { lines.push(''); return; }
      let cur = '';
      par.split(' ').forEach(word => {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width <= maxW || !cur) {
          if (ctx.measureText(test).width > maxW && !cur) { // palavra maior que a caixa: quebra por caracteres
            let part = ''; for (const ch of word) { if (ctx.measureText(part + ch).width > maxW && part) { lines.push(part); part = ch; } else part += ch; } cur = part;
          } else cur = test;
        } else { lines.push(cur); cur = word; }
      });
      lines.push(cur);
    });
    return lines;
  }
  function textLayout(ctx, el, size, ls, w, h) {
    const key = [el.text, el.font, el.weight, el.italic, size, ls, w, h, el.autoFit, el.lineHeight].join('|');
    let r = layoutCache.get(key); if (r) return r;
    let s = Math.max(4, size);
    for (let guard = 0; guard < 60; guard++) {
      ctx.font = fontStr(el, s); if (HAS_LS) ctx.letterSpacing = ls + 'px';
      const lines = wrap(ctx, el.text, w);
      if (!el.autoFit || lines.length * s * el.lineHeight <= h || s <= 8) { r = { lines, size: s, widths: lines.map(l => ctx.measureText(l).width) }; break; }
      s = Math.max(8, s - Math.max(1, Math.round(s * 0.05)));
    }
    if (layoutCache.size > 300) layoutCache.clear();
    layoutCache.set(key, r); return r;
  }
  function drawText(ctx, el, v, w, h, sc) {
    const size = v('size'), ls = v('letterSpacing'), lh = el.lineHeight || 1.15;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const L = textLayout(ctx, el, size, ls, w, h); ctx.font = fontStr(el, L.size); if (HAS_LS) ctx.letterSpacing = ls + 'px';
    const total = L.lines.length * L.size * lh;
    const y0 = el.valign === 'top' ? -h / 2 : el.valign === 'bottom' ? h / 2 - total : -total / 2;
    const typed = el.typed != null || A.isAnimated(el, 'typed') ? v('typed') : 1;
    let remaining = typed >= 0.999 ? Infinity : Math.round(L.lines.reduce((a, l) => a + l.length, 0) * typed);
    const color = v('color'), st = el.stroke && el.stroke.on && el.stroke.width > 0;
    if (st) { ctx.lineWidth = el.stroke.width; ctx.strokeStyle = el.stroke.color; ctx.lineJoin = 'round'; ctx.miterLimit = 2; }
    ctx.fillStyle = color;
    for (let i = 0; i < L.lines.length && remaining > 0; i++) {
      let txt = L.lines[i]; if (txt.length > remaining) txt = txt.slice(0, remaining); remaining -= L.lines[i].length;
      if (!txt) continue;
      const lw = L.widths[i], x = el.align === 'left' ? -w / 2 : el.align === 'right' ? w / 2 - lw : -lw / 2, y = y0 + (i + 0.5) * L.size * lh;
      if (st) { shadow(ctx, el, sc); ctx.strokeText(txt, x, y); noShadow(ctx); ctx.fillText(txt, x, y); }
      else { shadow(ctx, el, sc); ctx.fillText(txt, x, y); noShadow(ctx); }
    }
    if (HAS_LS) ctx.letterSpacing = '0px';
  }

  /* ---------- formas ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = SMS.clamp(r || 0, 0, Math.min(Math.abs(w), Math.abs(h)) / 2);
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  R.parsePoints = (s) => String(s || '').trim().split(/\s+/).map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite));
  function poly(ctx, pts) { pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  function shapePath(ctx, el, v, w, h) {
    const hw = w / 2, hh = h / 2; ctx.beginPath();
    switch (el.shape) {
      case 'ellipse': ctx.ellipse(0, 0, Math.max(0.01, hw), Math.max(0.01, hh), 0, 0, PI * 2); break;
      case 'line': rr(ctx, -hw, -hh, w, h, Math.min(w, h) / 2); break;
      case 'polygon': { const n = SMS.clamp(Math.round(el.sides), 3, 12), pts = []; for (let i = 0; i < n; i++) { const a = -PI / 2 + i * 2 * PI / n; pts.push([Math.cos(a) * hw, Math.sin(a) * hh]); } poly(ctx, pts); break; }
      case 'star': { const n = SMS.clamp(Math.round(el.sides), 3, 12), pts = []; for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, r = i % 2 ? el.inner : 1; pts.push([Math.cos(a) * hw * r, Math.sin(a) * hh * r]); } poly(ctx, pts); break; }
      case 'arrow': poly(ctx, [[-.5, -.18], [.1, -.18], [.1, -.5], [.5, 0], [.1, .5], [.1, .18], [-.5, .18]].map(p => [p[0] * w, p[1] * h])); break;
      case 'custom': { const pts = R.parsePoints(el.points).map(p => [(p[0] / 100 - 0.5) * w, (p[1] / 100 - 0.5) * h]); if (pts.length > 2) poly(ctx, pts); else rr(ctx, -hw, -hh, w, h, 0); break; }
      default: rr(ctx, -hw, -hh, w, h, v('radius'));
    }
  }
  function drawShape(ctx, el, v, w, h, sc) {
    shapePath(ctx, el, v, w, h);
    shadow(ctx, el, sc);
    if (el.fillOn !== false) { ctx.fillStyle = v('color'); ctx.fill(); noShadow(ctx); }
    if (el.stroke && el.stroke.on && el.stroke.width > 0) { ctx.lineWidth = el.stroke.width; ctx.strokeStyle = el.stroke.color; ctx.lineJoin = 'round'; ctx.stroke(); }
    noShadow(ctx);
  }
  const pathCache = new Map();
  function drawIcon(ctx, el, v, w, h, sc) {
    let p = pathCache.get(el.icon); if (!p) { p = new Path2D(SMS.iconPath(el.icon)); pathCache.set(el.icon, p); }
    ctx.translate(-w / 2, -h / 2); ctx.scale(w / 24, h / 24);
    shadow(ctx, el, sc); ctx.fillStyle = v('color'); ctx.fill(p); noShadow(ctx);
    if (el.stroke && el.stroke.on && el.stroke.width > 0) { ctx.lineWidth = el.stroke.width * 24 / Math.max(1, w); ctx.strokeStyle = el.stroke.color; ctx.lineJoin = 'round'; ctx.stroke(p); }
  }

  /* ---------- texturas (padrões em ladrilho) ---------- */
  const tiles = new Map();
  function tile(el, color) {
    const s = Math.max(6, Math.round(el.size)), th = Math.max(1, el.thick), key = [el.pattern, s, th, color].join('|');
    let c = tiles.get(key); if (c) return c;
    const kind = el.pattern, dim = kind === 'checker' ? s * 2 : kind === 'noise' ? 128 : s;
    c = document.createElement('canvas'); c.width = c.height = dim; const x = c.getContext('2d'); x.fillStyle = color; x.strokeStyle = color; x.lineWidth = th;
    if (kind === 'grid') { x.fillRect(0, 0, s, th); x.fillRect(0, 0, th, s); }
    else if (kind === 'dots') { x.beginPath(); x.arc(s / 2, s / 2, th * 1.2, 0, PI * 2); x.fill(); }
    else if (kind === 'stripes') { x.fillRect(0, 0, s, th); }
    else if (kind === 'diagonal') { x.beginPath(); x.moveTo(0, s); x.lineTo(s, 0); x.moveTo(-s / 2, s / 2); x.lineTo(s / 2, -s / 2); x.moveTo(s / 2, s * 1.5); x.lineTo(s * 1.5, s / 2); x.stroke(); }
    else if (kind === 'checker') { x.fillRect(0, 0, s, s); x.fillRect(s, s, s, s); }
    else { let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; for (let i = 0; i < 700; i++) { x.globalAlpha = 0.3 + rnd() * 0.7; x.fillRect(rnd() * 128, rnd() * 128, th, th); } }
    if (tiles.size > 40) tiles.clear(); tiles.set(key, c); return c;
  }
  function drawTexture(ctx, el, v, w, h) {
    const pat = ctx.createPattern(tile(el, v('color')), 'repeat'); if (!pat) return;
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip(); ctx.translate(-w / 2, -h / 2); ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h);
  }

  /* ---------- partículas (determinísticas: dependem só do tempo e da semente) ---------- */
  const rnd = (i, k, seed) => { const x = Math.sin(i * 127.1 + k * 311.7 + seed * 74.7) * 43758.5453; return x - Math.floor(x); };
  function drawParticles(ctx, el, v, w, h, lt) {
    const ga = ctx.globalAlpha, n = SMS.clamp(Math.round(el.count), 1, 300), life = Math.max(0.2, el.life), seed = el.seed || 1, c1 = v('color'), c2 = el.color2 || c1;
    for (let i = 0; i < n; i++) {
      const r = [0, 1, 2, 3, 4, 5, 6].map(k => rnd(i, k, seed)), te = (lt + r[2] * life) % life, u = te / life;
      const ang = (el.dir + (r[3] - 0.5) * el.spread) * PI / 180, sp = el.speed * (0.4 + 0.8 * r[4]);
      const px = (r[0] - 0.5) * w + Math.cos(ang) * sp * te, py = (r[1] - 0.5) * h + Math.sin(ang) * sp * te + 0.5 * el.gravity * te * te;
      const s = Math.max(1, el.size * (1 + (r[5] - 0.5) * el.sizeVar * 1.2) * (1 - 0.4 * u)), a = Math.sin(PI * u);
      ctx.globalAlpha = Math.max(0, a) * ga; ctx.fillStyle = r[6] < 0.5 ? c1 : c2; ctx.strokeStyle = ctx.fillStyle;
      ctx.save(); ctx.translate(px, py);
      if (el.pShape === 'square') { ctx.rotate(u * 3 + r[0] * 6); ctx.fillRect(-s / 2, -s / 2, s, s); }
      else if (el.pShape === 'star') { ctx.rotate(u * 2); ctx.beginPath(); for (let j = 0; j < 10; j++) { const aa = -PI / 2 + j * PI / 5, rr_ = (j % 2 ? 0.45 : 1) * s; j ? ctx.lineTo(Math.cos(aa) * rr_, Math.sin(aa) * rr_) : ctx.moveTo(Math.cos(aa) * rr_, Math.sin(aa) * rr_); } ctx.closePath(); ctx.fill(); }
      else if (el.pShape === 'spark') { ctx.rotate(ang); ctx.lineWidth = Math.max(1, s / 3); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  /* ---------- imagem / vídeo ---------- */
  function filterStr(el, v, sc) {
    const f = el.filters || {}, parts = [], b = v('blur');
    if (f.brightness !== 100) parts.push('brightness(' + f.brightness + '%)');
    if (f.contrast !== 100) parts.push('contrast(' + f.contrast + '%)');
    if (f.saturate !== 100) parts.push('saturate(' + f.saturate + '%)');
    if (f.hue) parts.push('hue-rotate(' + f.hue + 'deg)');
    if (b > 0.01) parts.push('blur(' + (b * sc).toFixed(2) + 'px)');
    return parts.join(' ');
  }
  function placeholder(ctx, w, h, msg) {
    ctx.save(); ctx.fillStyle = 'rgba(255,212,0,.08)'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]); ctx.fillStyle = '#ffd400'; ctx.font = '600 ' + Math.max(14, Math.min(w, h) / 9) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, 0, 0, w * 0.9); ctx.restore();
  }
  function maskPath(ctx, el, v, w, h) {
    ctx.beginPath();
    if (el.mask === 'circle') ctx.ellipse(0, 0, Math.max(0.01, w / 2), Math.max(0.01, h / 2), 0, 0, PI * 2);
    else rr(ctx, -w / 2, -h / 2, w, h, el.mask === 'rounded' || v('radius') > 0 ? Math.max(v('radius'), el.mask === 'rounded' && !v('radius') ? Math.min(w, h) * 0.12 : 0) : 0);
  }
  function drawMedia(ctx, el, v, w, h, ev, opt, sc) {
    let src = null, sw = 0, sh = 0;
    if (!el.mediaId) { if (opt.placeholders) placeholder(ctx, w, h, 'Sem mídia'); return; }
    if (el.type === 'image') {
      src = el.bgRemove ? SMS.Media.derived(el.mediaId, el.bgRemove) : SMS.Media.image(el.mediaId);
      if (!src) { if (!SMS.Media.get(el.mediaId) && opt.placeholders) placeholder(ctx, w, h, 'Mídia ausente'); return; }
      sw = src.naturalWidth || src.width; sh = src.naturalHeight || src.height;
    } else {
      src = SMS.Media.video(el.id, el.mediaId);
      if (!src) { if (opt.placeholders) placeholder(ctx, w, h, 'Mídia ausente'); return; }
      let st = (el.trimIn || 0) + ev.lt;
      if (el.loop && src.duration) { const span = Math.max(0.1, src.duration - (el.trimIn || 0)); st = (el.trimIn || 0) + (ev.lt % span); }
      SMS.Media.syncVideo(src, st, !!opt.playing);
      if (src.readyState < 2) return; sw = src.videoWidth; sh = src.videoHeight;
    }
    if (!sw || !sh) return;
    const c = el.crop || { x: 0, y: 0, w: 1, h: 1 }, cx = c.x * sw, cy = c.y * sh, cwid = Math.max(1, c.w * sw), chei = Math.max(1, c.h * sh);
    let dx = -w / 2, dy = -h / 2, dw = w, dh = h;
    if (el.fit === 'contain' || el.fit === 'cover') {
      const k = (el.fit === 'contain' ? Math.min : Math.max)(w / cwid, h / chei); dw = cwid * k; dh = chei * k; dx = -dw / 2; dy = -dh / 2;
    }
    const masked = el.mask !== 'none' || v('radius') > 0 || el.fit === 'cover';
    ctx.save();
    if (masked) {
      if (el.shadow && el.shadow.on) { // sombra no formato da máscara (desenhada fora da tela, só a sombra aparece)
        ctx.save(); const BIG = 30000; ctx.translate(-BIG, 0); maskPath(ctx, el, v, w, h);
        ctx.shadowColor = rgba(el.shadow.color, el.shadow.alpha); ctx.shadowBlur = el.shadow.blur * sc; ctx.shadowOffsetX = (BIG + el.shadow.x) * sc; ctx.shadowOffsetY = el.shadow.y * sc;
        ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
      }
      maskPath(ctx, el, v, w, h); ctx.clip();
    } else shadow(ctx, el, sc);
    if (HAS_FILTER) { const f = filterStr(el, v, sc); if (f) ctx.filter = f; }
    ctx.drawImage(src, cx, cy, cwid, chei, dx, dy, dw, dh);
    ctx.restore();
    if (el.stroke && el.stroke.on && el.stroke.width > 0) { ctx.save(); maskPath(ctx, el, v, w, h); ctx.lineWidth = el.stroke.width; ctx.strokeStyle = el.stroke.color; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  }
})();
