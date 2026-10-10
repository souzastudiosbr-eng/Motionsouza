/* Núcleo: utilidades, modelo de projeto versionado, linha do tempo (layout), histórico e migração. */
(function () {
  'use strict';
  const SMS = window.SMS = window.SMS || {};
  SMS.cfg = window.SMS_CONFIG || {};
  const VERSION = 3;
  SMS.PROJECT_VERSION = VERSION;

  /* ---------- utilidades ---------- */
  SMS.uid = (p) => (p || 'e') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  SMS.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  SMS.lerp = (a, b, t) => a + (b - a) * t;
  SMS.clone = (o) => JSON.parse(JSON.stringify(o));
  SMS.num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  SMS.round = (v, p) => { const m = Math.pow(10, p == null ? 2 : p); return Math.round(v * m) / m; };
  SMS.debounce = (fn, ms) => { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; };
  SMS.safeName = (n) => String(n || 'arquivo').replace(/[\u0000-\u001f\u007f<>:"\\|?*]/g, '').replace(/^.*[\\/]/, '').trim().slice(0, 80) || 'arquivo';
  SMS.fileBase = (n) => SMS.safeName(n).replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._ -]+/gu, '-').replace(/-{2,}/g, '-').trim() || 'projeto';
  SMS.fmtTime = (t, fps) => {
    t = Math.max(0, t || 0); fps = fps || 30;
    const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.min(fps - 1, Math.floor((t - Math.floor(t)) * fps + 1e-6));
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0');
  };
  SMS.download = (blob, name) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = SMS.safeName(name); a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  /* Helper de DOM: nunca usa innerHTML, então textos do usuário são sempre seguros. */
  SMS.h = function (tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(x => x != null && el.append(x.nodeType ? x : document.createTextNode(String(x))));
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  /* Barramento de eventos */
  const bus = {};
  SMS.on = (n, f) => { (bus[n] = bus[n] || []).push(f); return f; };
  SMS.off = (n, f) => { bus[n] = (bus[n] || []).filter(x => x !== f); };
  SMS.emit = (n, d) => { (bus[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.error('[evento ' + n + ']', e); } }); };

  /* ---------- modelo ---------- */
  const ASPECTS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  SMS.ASPECTS = ASPECTS;

  SMS.newScene = (o) => Object.assign({
    id: SMS.uid('s'), name: 'Cena', duration: 4, bg: '#0b0b0b',
    transition: { type: 'none', duration: 0.6 }, elements: []
  }, o || {});

  SMS.newProject = (o) => {
    o = o || {};
    const sz = ASPECTS[o.aspect || '9:16'];
    const p = {
      app: 'Souza Motion Studio', version: VERSION, id: SMS.uid('p'), name: o.name || 'Projeto sem título',
      settings: { width: o.width || sz[0], height: o.height || sz[1], fps: o.fps || SMS.cfg.defaultFps || 30, aspect: o.aspect || '9:16' },
      export: { format: 'auto', res: 1080, quality: 'media', audio: true, transparent: false },
      guides: { v: [], h: [] },
      scenes: [SMS.newScene({ name: 'Cena 1' })],
      audio: [],
      created: Date.now(), modified: Date.now()
    };
    return p;
  };

  const COMMON = () => ({
    id: '', type: '', name: '', x: 0, y: 0, w: 200, h: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    start: 0, end: null, visible: true, locked: false, groupId: null, lockRatio: false,
    kf: {}, shadow: { on: false, color: '#000000', blur: 16, x: 0, y: 6, alpha: 0.5 }, stroke: { on: false, color: '#000000', width: 4 }
  });
  const TYPE_DEFAULTS = {
    text: () => ({ text: 'Novo texto', font: 'Arial', size: 72, weight: 800, italic: false, align: 'center', valign: 'middle', color: '#ffffff', letterSpacing: 0, lineHeight: 1.15, autoFit: false, typed: 1, wipe: 1, w: 800, h: 220 }),
    image: () => ({ mediaId: null, crop: { x: 0, y: 0, w: 1, h: 1 }, radius: 0, mask: 'none', fit: 'fill', lockRatio: true, bgRemove: null, wipe: 1, blur: 0, filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0 }, w: 500, h: 500 }),
    video: () => ({ mediaId: null, crop: { x: 0, y: 0, w: 1, h: 1 }, radius: 0, mask: 'none', fit: 'fill', lockRatio: true, trimIn: 0, volume: 1, muted: false, loop: false, wipe: 1, blur: 0, filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0 }, w: 600, h: 340 }),
    shape: () => ({ shape: 'rect', color: '#ffd400', fillOn: true, radius: 0, sides: 5, inner: 0.45, points: '50,0 100,100 0,100', wipe: 1, w: 400, h: 240 }),
    icon: () => ({ icon: 'star', color: '#ffd400', wipe: 1, lockRatio: true, w: 200, h: 200 }),
    texture: () => ({ pattern: 'grid', color: '#ffffff', size: 60, thick: 2, wipe: 1, w: 1080, h: 1920 }),
    particles: () => ({ pShape: 'circle', color: '#ffd400', color2: '#ffffff', count: 40, size: 14, sizeVar: 1, speed: 160, dir: -90, spread: 60, gravity: 0, life: 2.5, seed: 7, wipe: 1, w: 800, h: 200 })
  };
  const TYPE_NAMES = { text: 'Texto', image: 'Imagem', video: 'Vídeo', shape: 'Forma', icon: 'Ícone', texture: 'Textura', particles: 'Partículas' };
  SMS.TYPE_NAMES = TYPE_NAMES;
  const merge = (base, o) => {
    for (const k in o) {
      if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], o[k]);
      else base[k] = o[k];
    }
    return base;
  };
  SMS.makeElement = (type, o) => {
    if (!TYPE_DEFAULTS[type]) throw new Error('Tipo de elemento desconhecido: ' + type);
    const e = merge(Object.assign(COMMON(), TYPE_DEFAULTS[type]()), o || {});
    e.id = (o && o.id) || SMS.uid('e'); e.type = type;
    if (!e.name) e.name = TYPE_NAMES[type];
    return e;
  };
  SMS.fillElement = (raw) => {
    if (!raw || !TYPE_DEFAULTS[raw.type]) return null;
    const e = SMS.makeElement(raw.type, raw); e.id = raw.id || SMS.uid('e');
    if (!e.kf || typeof e.kf !== 'object') e.kf = {};
    for (const k in e.kf) { if (!Array.isArray(e.kf[k])) delete e.kf[k]; else e.kf[k] = e.kf[k].filter(x => x && Number.isFinite(x.t) && x.v != null); }
    return e;
  };

  /* ---------- linha do tempo ---------- */
  SMS.effEnd = (el, scene) => Math.min(scene.duration, el.end == null ? scene.duration : el.end);
  SMS.trLen = (scene, next) => {
    if (!next || !scene.transition || scene.transition.type === 'none') return 0;
    return SMS.clamp(Number(scene.transition.duration) || 0, 0, Math.min(scene.duration, next.duration) / 2);
  };
  SMS.computeLayout = (p) => {
    let t = 0; const items = [];
    p.scenes.forEach((s, i) => {
      const tr = SMS.trLen(s, p.scenes[i + 1]);
      items.push({ scene: s, index: i, start: t, end: t + s.duration, tr });
      t = t + s.duration - tr;
    });
    const total = items.length ? items[items.length - 1].end : 0;
    // áudio global também pode ultrapassar a última cena: não aumenta o vídeo (o vídeo termina com a última cena)
    return { items, total };
  };

  /* ---------- estado global ---------- */
  const S = SMS.S = {
    project: null, T: 0, sceneIdx: 0, sel: [], playing: false, speed: 1, loop: false,
    ver: 0, dirty: false, selKey: null, clip: null, animClip: null
  };
  let layoutCache = { ver: -1, proj: null, val: null };
  SMS.layout = () => {
    if (layoutCache.ver !== S.ver || layoutCache.proj !== S.project) layoutCache = { ver: S.ver, proj: S.project, val: SMS.computeLayout(S.project) };
    return layoutCache.val;
  };
  SMS.total = () => SMS.layout().total;
  SMS.fps = () => S.project.settings.fps || 30;
  SMS.scene = () => S.project.scenes[S.sceneIdx] || S.project.scenes[0];
  SMS.sceneStart = (i) => { const it = SMS.layout().items[i]; return it ? it.start : 0; };
  SMS.sceneAt = (T) => {
    const L = SMS.layout(); let idx = 0;
    for (let i = 0; i < L.items.length; i++) if (L.items[i].start <= T + 1e-9) idx = i;
    return idx;
  };
  SMS.localT = () => S.T - SMS.sceneStart(S.sceneIdx);
  SMS.findItem = (id) => {
    const P = S.project;
    for (let i = 0; i < P.scenes.length; i++) { const e = P.scenes[i].elements.find(x => x.id === id); if (e) return { item: e, scene: P.scenes[i], sceneIdx: i, audio: false }; }
    const a = P.audio.find(x => x.id === id); if (a) return { item: a, scene: null, sceneIdx: -1, audio: true };
    return null;
  };
  SMS.selItems = () => S.sel.map(SMS.findItem).filter(Boolean).map(r => r.item);
  SMS.itemLocalT = (r) => r.audio ? S.T - r.item.start : S.T - SMS.sceneStart(r.sceneIdx) - r.item.start;
  SMS.itemDur = (r) => r.audio ? r.item.dur : SMS.effEnd(r.item, r.scene) - r.item.start;

  SMS.setTime = (T, o) => {
    const total = SMS.total();
    S.T = SMS.clamp(T, 0, total);
    const idx = SMS.sceneAt(S.T);
    if (idx !== S.sceneIdx) { S.sceneIdx = idx; SMS.emit('scene', idx); }
    SMS.emit('time', o || {});
  };
  SMS.setSelection = (ids, o) => {
    S.sel = Array.from(new Set(ids || [])); S.selKey = null;
    SMS.emit('selection', o || {});
  };
  SMS.expandGroups = (ids) => {
    const out = new Set(ids);
    ids.forEach(id => { const r = SMS.findItem(id); if (r && r.item.groupId) r.scene.elements.forEach(e => { if (e.groupId === r.item.groupId) out.add(e.id); }); });
    return Array.from(out);
  };

  /* ---------- histórico ---------- */
  const H = SMS.History = { stack: [], idx: -1, lastKey: null, lastAt: 0 };
  H.reset = () => { H.stack = [JSON.stringify(S.project)]; H.idx = 0; H.lastKey = null; SMS.emit('history'); };
  H.commit = (key) => {
    const s = JSON.stringify(S.project);
    if (s === H.stack[H.idx]) return;
    const now = Date.now();
    H.stack.length = H.idx + 1;
    if (key && key === H.lastKey && now - H.lastAt < 900 && H.idx > 0) H.stack[H.idx] = s;
    else { H.stack.push(s); H.idx++; }
    H.lastKey = key || null; H.lastAt = now;
    const lim = SMS.cfg.undoLimit || 80;
    while (H.stack.length > lim) { H.stack.shift(); H.idx--; }
    SMS.emit('history');
  };
  H.canUndo = () => H.idx > 0; H.canRedo = () => H.idx < H.stack.length - 1;
  const restore = () => {
    S.project = JSON.parse(H.stack[H.idx]); S.ver++; S.dirty = true;
    S.sceneIdx = Math.min(S.sceneIdx, S.project.scenes.length - 1);
    const ids = new Set(); S.project.scenes.forEach(s => s.elements.forEach(e => ids.add(e.id))); S.project.audio.forEach(a => ids.add(a.id));
    S.sel = S.sel.filter(id => ids.has(id)); S.selKey = null;
    H.lastKey = null; SMS.setTime(S.T);
    SMS.emit('project:restored'); SMS.emit('selection', {}); SMS.emit('change'); SMS.emit('history');
  };
  H.undo = () => { if (H.canUndo()) { H.idx--; restore(); } };
  H.redo = () => { if (H.canRedo()) { H.idx++; restore(); } };

  /* Alteração sem histórico (durante arraste) e com histórico (ao concluir) */
  SMS.touch = () => { S.ver++; S.dirty = true; S.project.modified = Date.now(); SMS.emit('change'); };
  SMS.changed = (key) => { SMS.touch(); H.commit(key); SMS.emit('committed'); };

  /* Carrega um projeto novo como atual */
  SMS.loadProject = (p, o) => {
    S.project = p; S.ver++; S.T = 0; S.sceneIdx = 0; S.sel = []; S.selKey = null; S.dirty = !!(o && o.dirty);
    H.reset(); SMS.setTime(0);
    SMS.emit('project:loaded', o || {}); SMS.emit('selection', {}); SMS.emit('change');
  };

  /* ---------- validação / normalização / migração ---------- */
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  SMS.normalizeProject = (raw) => {
    if (!isObj(raw)) throw new Error('O arquivo não contém um projeto válido (JSON inesperado).');
    if (!Array.isArray(raw.scenes) || !raw.scenes.length) throw new Error('O projeto não tem nenhuma cena.');
    if (typeof raw.version === 'number' && raw.version > VERSION) throw new Error('Este projeto foi criado numa versão mais nova do editor (v' + raw.version + '). Atualize o editor para abri-lo.');
    const base = SMS.newProject();
    const p = {
      app: 'Souza Motion Studio', version: VERSION, id: typeof raw.id === 'string' ? raw.id : base.id,
      name: String(raw.name || 'Projeto').slice(0, 80),
      settings: Object.assign({}, base.settings, isObj(raw.settings) ? raw.settings : {}),
      export: Object.assign({}, base.export, isObj(raw.export) ? raw.export : {}),
      guides: { v: [], h: [] }, scenes: [], audio: [], created: raw.created || Date.now(), modified: Date.now()
    };
    p.settings.width = SMS.clamp(Math.round(SMS.num(p.settings.width, 1080)), 64, 4096);
    p.settings.height = SMS.clamp(Math.round(SMS.num(p.settings.height, 1920)), 64, 4096);
    p.settings.fps = SMS.clamp(Math.round(SMS.num(p.settings.fps, 30)), 1, 120);
    if (isObj(raw.guides)) { p.guides.v = (raw.guides.v || []).map(Number).filter(Number.isFinite); p.guides.h = (raw.guides.h || []).map(Number).filter(Number.isFinite); }
    raw.scenes.forEach((rs, i) => {
      if (!isObj(rs)) throw new Error('Cena ' + (i + 1) + ' inválida.');
      const s = SMS.newScene({ id: rs.id || SMS.uid('s'), name: String(rs.name || 'Cena ' + (i + 1)).slice(0, 60), duration: SMS.clamp(SMS.num(rs.duration, 4), 0.2, 600), bg: rs.bg === null ? null : (typeof rs.bg === 'string' ? rs.bg : '#0b0b0b') });
      if (isObj(rs.transition)) s.transition = { type: String(rs.transition.type || 'none'), duration: SMS.clamp(SMS.num(rs.transition.duration, 0.6), 0.1, 5) };
      (Array.isArray(rs.elements) ? rs.elements : []).forEach(re => { const e = SMS.fillElement(re); if (e) s.elements.push(e); });
      p.scenes.push(s);
    });
    (Array.isArray(raw.audio) ? raw.audio : []).forEach(a => {
      if (!isObj(a)) return;
      p.audio.push({ id: a.id || SMS.uid('a'), type: 'audio', name: String(a.name || 'Áudio').slice(0, 60), mediaId: a.mediaId || null, start: Math.max(0, SMS.num(a.start, 0)), dur: Math.max(0.05, SMS.num(a.dur, 5)), offset: Math.max(0, SMS.num(a.offset, 0)), volume: SMS.clamp(SMS.num(a.volume, 1), 0, 2), fadeIn: Math.max(0, SMS.num(a.fadeIn, 0)), fadeOut: Math.max(0, SMS.num(a.fadeOut, 0)), muted: !!a.muted, kf: isObj(a.kf) ? a.kf : {} });
    });
    return p;
  };

  /* Migra projetos antigos (v1/v2 do Souza Motion Studio Pro). Retorna {project, pendingMedia}. */
  SMS.migrate = (raw) => {
    if (!isObj(raw)) throw new Error('O arquivo não contém um projeto válido (JSON inesperado).');
    const v = SMS.num(raw.version, 1);
    if (v >= 3) return { project: SMS.normalizeProject(raw), pendingMedia: [] };
    if (!Array.isArray(raw.scenes) || !raw.scenes.length) throw new Error('Projeto antigo sem cenas.');
    const pending = [], p = SMS.newProject({ name: 'Projeto importado (v' + v + ')', width: 720, height: 1280 });
    p.settings.width = 720; p.settings.height = 1280; p.settings.aspect = '9:16'; p.scenes = [];
    raw.scenes.forEach((os, i) => {
      const s = SMS.newScene({ name: String(os.name || 'Cena ' + (i + 1)).slice(0, 60), duration: SMS.clamp(SMS.num(os.duration, 4), 1, 60), bg: os.bg || '#080808' });
      (os.elements || []).forEach(oe => {
        const common = { name: String(oe.name || '').slice(0, 50), x: SMS.num(oe.x, 360), y: SMS.num(oe.y, 640), w: SMS.num(oe.w, 300), h: SMS.num(oe.h, 150), rotation: SMS.num(oe.rotation, 0), opacity: SMS.clamp(SMS.num(oe.opacity, 100) / 100, 0, 1), visible: oe.visible !== false };
        let e = null;
        if (oe.type === 'text') e = SMS.makeElement('text', Object.assign(common, { text: String(oe.text || ''), size: SMS.num(oe.font, 36), color: oe.color || '#fff', weight: oe.bold === false ? 500 : 900, align: oe.align || 'center' }));
        else if (oe.type === 'rect') e = SMS.makeElement('shape', Object.assign(common, { shape: 'rect', color: oe.color || '#ffd400' }));
        else if (oe.type === 'circle') e = SMS.makeElement('shape', Object.assign(common, { shape: 'ellipse', color: oe.color || '#ffd400' }));
        else if (oe.type === 'image' && typeof oe.src === 'string' && /^data:image\//.test(oe.src)) {
          const mid = SMS.uid('m'); pending.push({ id: mid, dataUrl: oe.src, name: common.name || 'imagem' });
          e = SMS.makeElement('image', Object.assign(common, { mediaId: mid, lockRatio: true }));
        }
        if (!e) return;
        const A = SMS.Anim;
        if (A) {
          if (oe.anim === 'fade') A.applyPreset(e, 'fadeIn', { dur: 0.65 }, s.duration);
          else if (oe.anim === 'rise') A.applyPreset(e, 'slideIn', { dur: 0.65, dir: 'bottom', dist: 100 }, s.duration);
          else if (oe.anim === 'slide') A.applyPreset(e, 'slideIn', { dur: 0.65, dir: 'right', dist: 180 }, s.duration);
          else if (oe.anim === 'zoom') A.applyPreset(e, 'zoomIn', { dur: 0.65 }, s.duration);
        }
        s.elements.push(e);
      });
      p.scenes.push(s);
    });
    return { project: SMS.normalizeProject(p), pendingMedia: pending };
  };

  /* ---------- clonagem de elementos com novos ids ---------- */
  SMS.cloneElements = (els) => {
    const gmap = {};
    return els.map(e => {
      const c = SMS.clone(e); c.id = SMS.uid('e');
      if (c.groupId) { gmap[c.groupId] = gmap[c.groupId] || SMS.uid('g'); c.groupId = gmap[c.groupId]; }
      return c;
    });
  };
})();
