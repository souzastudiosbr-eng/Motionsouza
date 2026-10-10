/* Comandos do editor: tudo que altera o projeto (adicionar, excluir, agrupar, alinhar, dividir, cenas, áudio...). */
(function () {
  'use strict';
  const SMS = window.SMS, S = SMS.S, A = SMS.Anim, R = SMS.Render, M = SMS.Media;
  const C = SMS.Cmd = {};
  const dims = () => ({ W: S.project.settings.width, H: S.project.settings.height });
  const els = () => SMS.scene().elements;

  /* Define propriedade respeitando keyframes (se animada, cria/atualiza a keyframe no cursor). */
  C.setProp = (item, prop, v) => {
    const r = SMS.findItem(item.id); if (!r) { item[prop] = v; return; }
    A.setValue(item, prop, v, SMS.itemLocalT(r), SMS.itemDur(r));
  };
  C.aabb = (el, scene, local) => {
    const ev = R.evalEl(el, scene, local), w2 = Math.abs(ev.w * ev.sx) / 2, h2 = Math.abs(ev.h * ev.sy) / 2, a = ev.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const ex = c * w2 + s * h2, ey = s * w2 + c * h2;
    return { l: ev.x - ex, r: ev.x + ex, t: ev.y - ey, b: ev.y + ey, cx: ev.x, cy: ev.y, ev };
  };
  const selEls = () => SMS.selItems().filter(i => i.type !== 'audio');
  const pick = (ids) => SMS.setSelection(ids);

  C.addElement = (type, o, name) => {
    const { W, H } = dims(), e = SMS.makeElement(type, Object.assign({ x: W / 2, y: H / 2 }, o || {}));
    if (name) e.name = name;
    els().push(e); pick([e.id]); SMS.changed(); return e;
  };
  C.addText = (text) => { const { W } = dims(); return C.addElement('text', { text: text || 'Novo texto', w: W * 0.8, h: 160, size: Math.round(W / 15) }, null); };
  C.addShape = (kind) => {
    const { W } = dims(), u = W / 1080, d = { rect: [400, 240], ellipse: [300, 300], line: [520, 10], polygon: [320, 320], star: [320, 320], arrow: [420, 200], custom: [320, 320] }[kind] || [300, 300];
    const names = { rect: 'Retângulo', ellipse: 'Elipse', line: 'Linha', polygon: 'Polígono', star: 'Estrela', arrow: 'Seta', custom: 'Forma personalizada' };
    return C.addElement('shape', { shape: kind, w: d[0] * u, h: d[1] * u, points: kind === 'custom' ? '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35' : undefined }, names[kind]);
  };
  C.addIcon = (id) => { const { W } = dims(); const i = SMS.ICONS.find(x => x.id === id); return C.addElement('icon', { icon: id, w: W * 0.2, h: W * 0.2 }, 'Ícone ' + (i ? i.label : '')); };
  C.addEmoji = (ch) => { const { W } = dims(); return C.addElement('text', { text: ch, size: Math.round(W * 0.16), weight: 400, w: W * 0.3, h: W * 0.22, autoFit: false }, 'Emoji ' + ch); };
  C.addTexture = (pattern) => { const { W, H } = dims(); return C.addElement('texture', { pattern, w: W, h: H, opacity: 0.2, size: Math.round(W / 18) }, 'Textura'); };
  C.addParticles = () => { const { W, H } = dims(); return C.addElement('particles', { w: W * 0.8, h: H * 0.2, y: H * 0.75, size: Math.round(W / 70), speed: W / 7 }, 'Partículas'); };
  C.addBackground = (color) => {
    const { W, H } = dims(), e = SMS.makeElement('shape', { shape: 'rect', x: W / 2, y: H / 2, w: W, h: H, color, name: 'Fundo' });
    els().unshift(e); pick([e.id]); SMS.changed(); return e;
  };
  C.addMedia = (id) => {
    const rec = M.get(id); if (!rec) return null; const { W, H } = dims(), sc = SMS.scene();
    if (rec.kind === 'image' || rec.kind === 'video') {
      const k = Math.min(W * 0.7 / (rec.w || 1), H * 0.5 / (rec.h || 1)), nm = rec.name.replace(/\.[^.]+$/, '');
      const o = { mediaId: id, w: Math.round((rec.w || 400) * k), h: Math.round((rec.h || 400) * k) };
      if (rec.kind === 'video') {
        if (rec.duration > sc.duration + 0.01) { sc.duration = Math.min(120, Math.ceil(rec.duration * 10) / 10); SMS.emit('toast', { msg: 'Duração da cena ajustada para ' + sc.duration + ' s para caber o vídeo.' }); }
        else o.end = rec.duration < sc.duration - 0.05 ? rec.duration : null;
      }
      return C.addElement(rec.kind, o, nm);
    }
    if (rec.kind === 'audio') return C.addAudio(id);
    if (rec.kind === 'font') {
      const t = selEls().filter(e => e.type === 'text'); if (!t.length) { SMS.emit('toast', { msg: 'Selecione uma camada de texto para aplicar a fonte.' }); return null; }
      t.forEach(e => e.font = rec.family); SMS.changed(); return t[0];
    }
    return null;
  };
  C.addAudio = (id) => {
    const rec = M.get(id); if (!rec) return null;
    const c = { id: SMS.uid('a'), type: 'audio', name: rec.name.replace(/\.[^.]+$/, ''), mediaId: id, start: SMS.S.T, dur: Math.max(0.5, rec.duration || 5), offset: 0, volume: 1, fadeIn: 0, fadeOut: 0, muted: false, kf: {} };
    S.project.audio.push(c); pick([c.id]); SMS.changed(); return c;
  };

  C.deleteSel = () => {
    const ids = new Set(SMS.expandGroups(S.sel.filter(id => { const r = SMS.findItem(id); return r && (r.audio || !r.item.locked || true); })));
    if (!ids.size) return;
    S.project.scenes.forEach(s => { s.elements = s.elements.filter(e => !ids.has(e.id)); });
    S.project.audio = S.project.audio.filter(a => !ids.has(a.id));
    S.sel = []; SMS.emit('selection', {}); SMS.changed(); SMS.Media.gcVideos();
  };
  C.duplicateSel = () => {
    const ids = SMS.expandGroups(S.sel), items = ids.map(SMS.findItem).filter(Boolean), out = [];
    const es = items.filter(r => !r.audio).map(r => r.item);
    SMS.cloneElements(es).forEach(c => { c.x += 30; c.y += 30; c.name = c.name; els().push(c); out.push(c.id); });
    items.filter(r => r.audio).forEach(r => { const c = SMS.clone(r.item); c.id = SMS.uid('a'); c.start += 0.5; S.project.audio.push(c); out.push(c.id); });
    if (out.length) { pick(out); SMS.changed(); }
  };
  C.copy = () => {
    const es = SMS.expandGroups(S.sel).map(SMS.findItem).filter(r => r && !r.audio).map(r => r.item);
    if (!es.length) return false; S.clip = { els: SMS.clone(es), n: 0 }; SMS.emit('toast', { msg: es.length + ' elemento(s) copiado(s).' }); return true;
  };
  C.cut = () => { if (C.copy()) C.deleteSel(); };
  C.paste = () => {
    if (!S.clip || !S.clip.els.length) return; S.clip.n++;
    const off = 24 * S.clip.n, cl = SMS.cloneElements(S.clip.els); cl.forEach(c => { c.x += off; c.y += off; els().push(c); });
    pick(cl.map(c => c.id)); SMS.changed();
  };
  C.group = () => {
    const es = selEls(); if (es.length < 2) return; const g = SMS.uid('g'); es.forEach(e => e.groupId = g); SMS.changed(); SMS.emit('toast', { msg: 'Elementos agrupados.' });
  };
  C.ungroup = () => { const es = SMS.expandGroups(S.sel).map(SMS.findItem).filter(r => r && !r.audio).map(r => r.item); let n = 0; es.forEach(e => { if (e.groupId) { e.groupId = null; n++; } }); if (n) SMS.changed(); };
  C.reorder = (dir) => {
    const arr = els(), sel = new Set(S.sel); if (!arr.some(e => sel.has(e.id))) return;
    if (dir === 'front') { const a = arr.filter(e => !sel.has(e.id)), b = arr.filter(e => sel.has(e.id)); arr.splice(0, arr.length, ...a, ...b); }
    else if (dir === 'back') { const a = arr.filter(e => !sel.has(e.id)), b = arr.filter(e => sel.has(e.id)); arr.splice(0, arr.length, ...b, ...a); }
    else if (dir === 'up') { for (let i = arr.length - 2; i >= 0; i--) if (sel.has(arr[i].id) && !sel.has(arr[i + 1].id)) { const t = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = t; } }
    else { for (let i = 1; i < arr.length; i++) if (sel.has(arr[i].id) && !sel.has(arr[i - 1].id)) { const t = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = t; } }
    SMS.changed();
  };
  C.moveLayer = (id, toIndex) => {
    const arr = els(), i = arr.findIndex(e => e.id === id); if (i < 0) return;
    const [e] = arr.splice(i, 1); arr.splice(SMS.clamp(toIndex, 0, arr.length), 0, e); SMS.changed();
  };
  C.nudge = (dx, dy) => {
    const es = SMS.expandGroups(S.sel).map(SMS.findItem).filter(r => r && !r.audio && !r.item.locked).map(r => r.item); if (!es.length) return;
    es.forEach(e => { const ev = R.evalEl(e, SMS.scene(), SMS.localT()); if (dx) C.setProp(e, 'x', ev.x + dx); if (dy) C.setProp(e, 'y', ev.y + dy); });
    SMS.changed('nudge');
  };
  C.align = (kind) => {
    const es = selEls().filter(e => !e.locked); if (!es.length) return; const { W, H } = dims(), sc = SMS.scene(), lt = SMS.localT();
    const bx = es.map(e => C.aabb(e, sc, lt));
    const B = es.length > 1 ? { l: Math.min(...bx.map(b => b.l)), r: Math.max(...bx.map(b => b.r)), t: Math.min(...bx.map(b => b.t)), b: Math.max(...bx.map(b => b.b)) } : { l: 0, r: W, t: 0, b: H };
    es.forEach((e, i) => {
      const b = bx[i], ev = b.ev;
      if (kind === 'left') C.setProp(e, 'x', ev.x + (B.l - b.l)); else if (kind === 'right') C.setProp(e, 'x', ev.x + (B.r - b.r)); else if (kind === 'hcenter') C.setProp(e, 'x', ev.x + ((B.l + B.r) / 2 - b.cx));
      else if (kind === 'top') C.setProp(e, 'y', ev.y + (B.t - b.t)); else if (kind === 'bottom') C.setProp(e, 'y', ev.y + (B.b - b.b)); else if (kind === 'vcenter') C.setProp(e, 'y', ev.y + ((B.t + B.b) / 2 - b.cy));
    }); SMS.changed();
  };
  C.distribute = (axis) => {
    const es = selEls().filter(e => !e.locked); if (es.length < 3) { SMS.emit('toast', { msg: 'Selecione 3 ou mais elementos para distribuir.' }); return; }
    const sc = SMS.scene(), lt = SMS.localT(), k = axis === 'h' ? 'cx' : 'cy', arr = es.map(e => ({ e, b: C.aabb(e, sc, lt) })).sort((a, b) => a.b[k] - b.b[k]);
    const first = arr[0].b[k], step = (arr[arr.length - 1].b[k] - first) / (arr.length - 1);
    arr.forEach((o, i) => { if (i && i < arr.length - 1) C.setProp(o.e, axis === 'h' ? 'x' : 'y', o.b.ev[axis === 'h' ? 'x' : 'y'] + (first + step * i - o.b[k])); }); SMS.changed();
  };
  C.split = () => {
    const done = []; const ids = S.sel.slice();
    ids.forEach(id => {
      const r = SMS.findItem(id); if (!r) return; const lt = SMS.itemLocalT(r), it = r.item;
      if (r.audio) {
        if (lt <= 0.05 || lt >= it.dur - 0.05) return; const c = SMS.clone(it); c.id = SMS.uid('a'); c.start = it.start + lt; c.offset = it.offset + lt; c.dur = it.dur - lt; c.fadeIn = 0; it.dur = lt; it.fadeOut = 0;
        shiftKeys(c, lt); S.project.audio.push(c); done.push(c.id); return;
      }
      const end = SMS.effEnd(it, r.scene), rel = lt; if (lt <= 0.05 || lt >= end - it.start - 0.05) return;
      const c = SMS.clone(it); c.id = SMS.uid('e'); c.start = it.start + rel; c.end = it.end == null ? null : it.end; it.end = it.start + rel; if (c.type === 'video') c.trimIn = (it.trimIn || 0) + rel;
      shiftKeys(c, rel); r.scene.elements.splice(r.scene.elements.indexOf(it) + 1, 0, c); done.push(c.id);
    });
    if (done.length) { pick(done); SMS.changed(); } else SMS.emit('toast', { msg: 'Posicione o cursor dentro de um clipe selecionado para dividir.' });
  };
  function shiftKeys(it, dt) { for (const p in it.kf || {}) it.kf[p].forEach(k => { k.id = SMS.uid('k'); if (k.anchor !== 'end') k.t = Math.max(0, SMS.round(k.t - dt, 4)); }); }

  /* ---------- cenas ---------- */
  const goScene = (i) => { SMS.touch(); SMS.setTime(SMS.sceneStart(i) + 0.001 > SMS.total() ? SMS.sceneStart(i) : SMS.sceneStart(i)); S.sceneIdx = i; SMS.emit('scene', i); S.sel = []; SMS.emit('selection', {}); };
  C.addScene = () => {
    const cur = SMS.scene(), s = SMS.newScene({ name: 'Cena ' + (S.project.scenes.length + 1), bg: cur.bg, duration: cur.duration });
    S.project.scenes.splice(S.sceneIdx + 1, 0, s); goScene(S.sceneIdx + 1); SMS.changed();
  };
  C.dupScene = (i) => {
    i = i == null ? S.sceneIdx : i; const src = S.project.scenes[i], c = SMS.clone(src); c.id = SMS.uid('s'); c.name = src.name + ' cópia';
    c.elements = SMS.cloneElements(src.elements); S.project.scenes.splice(i + 1, 0, c); goScene(i + 1); SMS.changed();
  };
  C.delScene = (i) => {
    i = i == null ? S.sceneIdx : i; if (S.project.scenes.length < 2) { SMS.emit('toast', { msg: 'O projeto precisa ter ao menos uma cena.' }); return; }
    S.project.scenes.splice(i, 1); goScene(Math.max(0, Math.min(i, S.project.scenes.length - 1))); SMS.changed(); SMS.Media.gcVideos();
  };
  C.moveScene = (from, to) => {
    const a = S.project.scenes; to = SMS.clamp(to, 0, a.length - 1); if (from === to) return;
    const [s] = a.splice(from, 1); a.splice(to, 0, s); SMS.touch(); goScene(to); SMS.changed();
  };
  C.setSceneDuration = (i, d) => { S.project.scenes[i].duration = SMS.clamp(d, 0.5, 600); SMS.touch(); };

  /* ---------- projeto ---------- */
  C.setFps = (fps) => { S.project.settings.fps = SMS.clamp(Math.round(fps), 1, 120); SMS.changed(); };
  C.setCanvas = (w, h, aspect, scaleContent) => {
    const st = S.project.settings, ow = st.width, oh = st.height; w = SMS.clamp(Math.round(w), 64, 4096); h = SMS.clamp(Math.round(h), 64, 4096);
    if (w === ow && h === oh) { st.aspect = aspect || st.aspect; return; }
    if (scaleContent) {
      const sx = w / ow, sy = h / oh, k = Math.min(sx, sy);
      const fx = (e, p) => { const keep = e.type === 'image' || e.type === 'video' || e.type === 'icon'; if (p === 'x') return sx; if (p === 'y') return sy; if (p === 'w') return keep || e.type === 'text' ? (keep ? k : sx) : sx; if (p === 'h') return keep || e.type === 'text' ? k : sy; if (p === 'size' || p === 'radius' || p === 'letterSpacing') return k; return 1; };
      S.project.scenes.forEach(s => s.elements.forEach(e => {
        ['x', 'y', 'w', 'h', 'size', 'radius', 'letterSpacing'].forEach(p => { if (typeof e[p] === 'number') e[p] *= fx(e, p); if (e.kf && e.kf[p]) e.kf[p].forEach(kk => kk.v *= fx(e, p)); });
        if (e.stroke) e.stroke.width *= k; if (e.shadow) { e.shadow.blur *= k; e.shadow.x *= k; e.shadow.y *= k; }
      }));
      S.project.guides.v = S.project.guides.v.map(v => v * sx); S.project.guides.h = S.project.guides.h.map(v => v * sy);
    }
    st.width = w; st.height = h; st.aspect = aspect || 'custom'; SMS.changed(); SMS.emit('canvas');
  };

  /* ---------- componentes reutilizáveis ---------- */
  C.saveComponent = async (name) => {
    const es = SMS.expandGroups(S.sel).map(SMS.findItem).filter(r => r && !r.audio).map(r => r.item); if (!es.length) { SMS.emit('toast', { msg: 'Selecione elementos para salvar como componente.', type: 'warn' }); return; }
    const sc = SMS.scene(), lt = SMS.localT(), bx = es.map(e => C.aabb(e, sc, lt)), cx = (Math.min(...bx.map(b => b.l)) + Math.max(...bx.map(b => b.r))) / 2, cy = (Math.min(...bx.map(b => b.t)) + Math.max(...bx.map(b => b.b))) / 2;
    const cl = SMS.clone(es); cl.forEach(e => { e.x -= cx; e.y -= cy; });
    await SMS.db.put('components', { id: SMS.uid('c'), name: name || 'Componente', els: cl, created: Date.now(), w: S.project.settings.width, h: S.project.settings.height });
    SMS.emit('components'); SMS.emit('toast', { msg: 'Componente salvo na biblioteca.', type: 'ok' });
  };
  C.insertComponent = (rec) => {
    const { W, H } = dims(), cl = SMS.cloneElements(rec.els), k = Math.min(1, W / (rec.w || W));
    cl.forEach(e => { e.x = W / 2 + e.x * k; e.y = H / 2 + e.y * k; e.w *= k; e.h *= k; if (e.size) e.size *= k; els().push(e); }); pick(cl.map(e => e.id)); SMS.changed();
  };
  C.listComponents = async () => (await SMS.db.all('components')).sort((a, b) => b.created - a.created);
  C.removeComponent = async (id) => { await SMS.db.del('components', id); SMS.emit('components'); };
})();
