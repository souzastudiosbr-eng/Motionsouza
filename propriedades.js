/* Painéis da direita: Propriedades (mudam conforme o tipo), Animação (presets + editor de keyframes) e Cena/Projeto. */
(function () {
  'use strict';
  const SMS = window.SMS, S = SMS.S, A = SMS.Anim, C = SMS.Cmd, UI = SMS.UI, M = SMS.Media, h = SMS.h, $ = (id) => document.getElementById(id);
  const Pr = SMS.Props = {};
  let pFields = [], aFields = [];
  const sel = () => S.sel.map(SMS.findItem).filter(Boolean);
  const val = (it, p) => { const r = SMS.findItem(it.id); if (!r) return A.base(it, p); return A.value(it, p, SMS.itemLocalT(r), SMS.itemDur(r)); };
  const commit = (it, k) => SMS.changed(k + ':' + it.id);
  const row2 = (...c) => h('div', { class: 'row2' }, ...c), btnrow = (...c) => h('div', { class: 'btnrow' }, ...c);

  function diamond(it, prop) {
    const b = h('button', { class: 'kf', type: 'button', title: 'Keyframe: adicionar/remover no cursor', 'aria-label': 'Keyframe de ' + prop, onclick: () => {
      const r = SMS.findItem(it.id), lt = SMS.itemLocalT(r), dur = SMS.itemDur(r);
      if (lt < -0.001 || lt > dur + 0.001) { UI.toast('O cursor está fora deste clipe. Mova o cursor para dentro dele.', 'warn'); return; }
      const ex = A.keyAt(it, prop, lt, dur);
      if (ex) { A.removeKey(it, prop, ex.k.id); S.selKey = null; } else { const k = A.setKey(it, prop, Math.max(0, lt), A.value(it, prop, lt, dur), dur); S.selKey = { id: it.id, prop, kid: k.id }; }
      SMS.changed(); SMS.emit('selkey');
    } }, UI.svg('anim'));
    const update = () => { const r = SMS.findItem(it.id); if (!r) return; const has = A.isAnimated(it, prop); b.classList.toggle('has', has); b.classList.toggle('on', has && !!A.keyAt(it, prop, SMS.itemLocalT(r), SMS.itemDur(r))); };
    return { el: b, update };
  }
  function anum(it, prop, label, o) {
    o = o || {}; const d = diamond(it, prop), meta = A.PROPS[prop] || {};
    const f = UI.num({ label, step: o.step || meta.step || 1, min: o.min != null ? o.min : meta.min, max: o.max != null ? o.max : meta.max, dp: o.dp, extra: d.el, get: () => val(it, prop), set: (v) => { C.setProp(it, prop, v); commit(it, prop); } });
    const u = f.update; f.update = () => { u(); d.update(); }; return f;
  }
  function acolor(it, prop, label) {
    const d = diamond(it, prop), f = UI.color({ label, extra: d.el, get: () => val(it, prop), set: (v) => { C.setProp(it, prop, v); commit(it, prop); } });
    const u = f.update; f.update = () => { u(); d.update(); }; return f;
  }
  function arange(it, prop, label, min, max, step, scale) {
    const d = diamond(it, prop), sc = scale || 1;
    const f = UI.range({ label, min, max, step, extra: null, get: () => val(it, prop) * sc, set: (v) => { C.setProp(it, prop, v / sc); commit(it, prop); }, unit: scale ? '%' : '' });
    f.el.append(d.el); f.el.style.gridTemplateColumns = '96px minmax(0,1fr) 44px 26px'; const u = f.update; f.update = () => { u(); d.update(); }; return f;
  }
  const plain = {
    num: (it, path, label, o) => { o = o || {}; return UI.num({ label, step: o.step || 1, min: o.min, max: o.max, dp: o.dp, get: () => get(it, path), set: (v) => { set(it, path, v); commit(it, path); } }); },
    check: (it, path, label) => UI.check({ label, get: () => get(it, path), set: (v) => { set(it, path, v); commit(it, path); } }),
    color: (it, path, label) => UI.color({ label, get: () => get(it, path), set: (v) => { set(it, path, v); commit(it, path); } }),
    select: (it, path, label, options, after) => UI.select({ label, options, get: () => get(it, path), set: (v) => { set(it, path, isNaN(v) || v === '' ? v : (typeof get(it, path) === 'number' ? Number(v) : v)); commit(it, path); if (after) after(); } }),
    range: (it, path, label, min, max, step, unit) => UI.range({ label, min, max, step, unit, get: () => get(it, path), set: (v) => { set(it, path, v); commit(it, path); } }),
    text: (it, path, label, o) => UI.text(Object.assign({ label, get: () => get(it, path), set: (v) => { set(it, path, v); commit(it, path); } }, o || {})),
    area: (it, path, label, rows, max) => UI.area({ label, rows, max, get: () => get(it, path), set: (v) => { set(it, path, v); commit(it, path); } })
  };
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };

  const track = (f) => { pFields.push(f); return f.el; };

  /* ================= PROPRIEDADES ================= */
  Pr.buildProps = () => {
    const root = $('pProps'); root.textContent = ''; pFields = [];
    const items = sel();
    if (!items.length) {
      root.append(h('p', { class: 'hint', text: 'Nenhum elemento selecionado. Toque num elemento no palco ou numa camada para editar suas propriedades. Dica: toque duas vezes num texto para editá-lo.' }),
        UI.sect('Adicionar rapidamente', [btnrow(UI.btn({ label: 'Texto', on: () => C.addText() }), UI.btn({ label: 'Retângulo', on: () => C.addShape('rect') }), UI.btn({ label: 'Círculo', on: () => C.addShape('ellipse') }))]));
      return;
    }
    if (items.length > 1) return multi(root, items);
    const r = items[0], it = r.item;
    if (r.audio) return audioPanel(root, it);
    // cabeçalho
    root.append(h('div', { class: 'sect' }, h('div', { class: 'body' },
      track(UI.text({ label: 'Nome', max: 50, get: () => it.name, set: (v) => { it.name = v; SMS.changed('name:' + it.id); } })),
      h('div', { class: 'hint', text: SMS.TYPE_NAMES[it.type] + (it.groupId ? ' · em grupo' : '') + (it.locked ? ' · bloqueado' : '') }),
      btnrow(UI.btn({ icon: 'copy', title: 'Duplicar', on: () => C.duplicateSel(), cls: 'sm' }), UI.btn({ icon: it.visible === false ? 'eyeoff' : 'eye', title: 'Mostrar/ocultar', on: () => { it.visible = it.visible === false; SMS.changed(); Pr.buildProps(); }, cls: 'sm' }), UI.btn({ icon: it.locked ? 'lock' : 'unlock', title: 'Bloquear/desbloquear', on: () => { it.locked = !it.locked; SMS.changed(); Pr.buildProps(); }, cls: 'sm' }), UI.btn({ icon: 'up', title: 'Trazer para frente', on: () => C.reorder('front'), cls: 'sm' }), UI.btn({ icon: 'down', title: 'Enviar para trás', on: () => C.reorder('back'), cls: 'sm' }), UI.btn({ icon: 'del', title: 'Excluir', on: () => C.deleteSel(), cls: 'sm danger' })))));
    // transformação
    const T = [anum(it, 'x', 'Posição X'), anum(it, 'y', 'Posição Y'), anum(it, 'w', 'Largura', { min: 1 }), anum(it, 'h', 'Altura', { min: 1 }), anum(it, 'rotation', 'Rotação (°)', { dp: 1 }), anum(it, 'scaleX', 'Escala X', { step: 0.05, dp: 3 }), anum(it, 'scaleY', 'Escala Y', { step: 0.05, dp: 3 }), arange(it, 'opacity', 'Opacidade', 0, 100, 1, 100)];
    T.forEach(f => pFields.push(f)); const lock = plain.check(it, 'lockRatio', 'Manter proporção'); pFields.push(lock);
    root.append(UI.sect('Transformação', T.map(f => f.el).concat(lock.el)));
    // tempo
    const tf = [UI.num({ label: 'Início (s)', step: 0.1, min: 0, get: () => it.start, set: (v) => { const en = SMS.effEnd(it, r.scene); it.start = SMS.clamp(v, 0, en - 0.1); commit(it, 'start'); } }),
      UI.num({ label: 'Fim (s)', step: 0.1, min: 0.1, get: () => SMS.effEnd(it, r.scene), set: (v) => { const nv = SMS.clamp(v, it.start + 0.1, r.scene.duration); it.end = nv >= r.scene.duration - 1e-4 ? null : nv; commit(it, 'end'); } }),
      UI.check({ label: 'Até o fim da cena', get: () => it.end == null, set: (v) => { it.end = v ? null : r.scene.duration; commit(it, 'end'); } })];
    tf.forEach(f => pFields.push(f)); root.append(UI.sect('Tempo na cena', tf.map(f => f.el), true));
    TYPE_PANELS[it.type](root, it, r);
    if (['text', 'shape', 'icon', 'image', 'video'].includes(it.type)) {
      const so = [plain.check(it, 'stroke.on', 'Contorno'), plain.color(it, 'stroke.color', 'Cor do contorno'), plain.num(it, 'stroke.width', 'Espessura', { min: 0, step: 0.5 })], sh = [plain.check(it, 'shadow.on', 'Sombra'), plain.color(it, 'shadow.color', 'Cor'), plain.range(it, 'shadow.alpha', 'Opacidade', 0, 1, 0.05), plain.num(it, 'shadow.blur', 'Desfoque', { min: 0 }), plain.num(it, 'shadow.x', 'Deslocar X'), plain.num(it, 'shadow.y', 'Deslocar Y')];
      so.concat(sh).forEach(f => pFields.push(f)); root.append(UI.sect('Contorno', so.map(f => f.el), true), UI.sect('Sombra', sh.map(f => f.el), true));
    }
    root.append(btnrow(UI.btn({ label: 'Salvar como componente', cls: 'sm', on: async () => { const n = await UI.ask('Salvar componente', 'Nome do componente', it.name); if (n) C.saveComponent(n); } })));
    Pr.refresh();
  };

  function multi(root, items) {
    const els = items.filter(r => !r.audio);
    root.append(h('div', { class: 'sect' }, h('h3', { text: items.length + ' itens selecionados' }), h('div', { class: 'body' },
      h('div', { class: 'hint', text: 'Alinhar (usa a seleção; com um só item, alinha ao palco)' }),
      btnrow(...[['left', '⇤ Esq.'], ['hcenter', '↔ Centro'], ['right', 'Dir. ⇥'], ['top', '⤒ Topo'], ['vcenter', '↕ Meio'], ['bottom', 'Base ⤓']].map(a => UI.btn({ label: a[1], cls: 'sm', on: () => C.align(a[0]) }))),
      btnrow(UI.btn({ label: 'Distribuir ↔', cls: 'sm', on: () => C.distribute('h') }), UI.btn({ label: 'Distribuir ↕', cls: 'sm', on: () => C.distribute('v') })),
      btnrow(UI.btn({ label: 'Agrupar', cls: 'sm', on: () => { C.group(); Pr.buildProps(); } }), UI.btn({ label: 'Desagrupar', cls: 'sm', on: () => { C.ungroup(); Pr.buildProps(); } })),
      btnrow(UI.btn({ icon: 'copy', label: 'Duplicar', cls: 'sm', on: () => C.duplicateSel() }), UI.btn({ icon: 'del', label: 'Excluir', cls: 'sm danger', on: () => C.deleteSel() })),
      track(UI.range({ label: 'Opacidade', min: 0, max: 100, get: () => (els[0] ? val(els[0].item, 'opacity') * 100 : 100), set: (v) => { els.forEach(r => C.setProp(r.item, 'opacity', v / 100)); SMS.changed('multiop'); }, unit: '%' })),
      btnrow(UI.btn({ label: 'Salvar como componente', cls: 'sm', on: async () => { const n = await UI.ask('Salvar componente', 'Nome do componente', 'Meu componente'); if (n) C.saveComponent(n); } })))));
    Pr.refresh();
  }

  function audioPanel(root, c) {
    const rec = M.get(c.mediaId), F = [
      UI.text({ label: 'Nome', max: 50, get: () => c.name, set: (v) => { c.name = v; SMS.changed('an:' + c.id); } }),
      UI.num({ label: 'Início (s)', step: 0.1, min: 0, get: () => c.start, set: (v) => { c.start = Math.max(0, v); commit(c, 'as'); } }),
      UI.num({ label: 'Duração (s)', step: 0.1, min: 0.1, get: () => c.dur, set: (v) => { c.dur = Math.max(0.1, v); commit(c, 'ad'); } }),
      UI.num({ label: 'Corte inicial (s)', step: 0.1, min: 0, get: () => c.offset, set: (v) => { c.offset = Math.max(0, v); commit(c, 'ao'); } }),
      arange(c, 'volume', 'Volume', 0, 200, 1, 100),
      UI.num({ label: 'Fade-in (s)', step: 0.1, min: 0, get: () => c.fadeIn, set: (v) => { c.fadeIn = Math.max(0, v); commit(c, 'af'); } }),
      UI.num({ label: 'Fade-out (s)', step: 0.1, min: 0, get: () => c.fadeOut, set: (v) => { c.fadeOut = Math.max(0, v); commit(c, 'ag'); } }),
      UI.check({ label: 'Mudo', get: () => c.muted, set: (v) => { c.muted = v; commit(c, 'am'); } })];
    F.forEach(f => pFields.push(f));
    root.append(UI.sect('Faixa de áudio', [h('div', { class: 'hint', text: rec ? 'Arquivo: ' + rec.name + ' · ' + SMS.round(rec.duration || 0, 1) + ' s' : '' })].concat(!rec ? [h('div', { class: 'warn', text: 'Arquivo de áudio ausente. Religue em Biblioteca › Mídias ausentes.' })] : [], F.map(f => f.el),
      [btnrow(UI.btn({ icon: 'cut', label: 'Dividir no cursor', cls: 'sm', on: () => C.split() }), UI.btn({ icon: 'copy', label: 'Duplicar', cls: 'sm', on: () => C.duplicateSel() }), UI.btn({ icon: 'del', label: 'Excluir', cls: 'sm danger', on: () => C.deleteSel() })), h('div', { class: 'hint', text: 'O áudio fica numa trilha global: não é cortado nas transições de cena. Use ◆ para animar o volume.' })])));
    Pr.refresh();
  }

  const mediaSelect = (it, kind) => {
    const opts = () => { const l = M.list(kind).map(r => [r.id, r.name]); if (it.mediaId && !M.get(it.mediaId)) l.unshift([it.mediaId, '⚠ (mídia ausente)']); if (!it.mediaId) l.unshift(['', '— escolha —']); return l; };
    const f = UI.select({ label: 'Mídia', options: opts(), full: true, get: () => it.mediaId || '', set: (v) => { it.mediaId = v || null; commit(it, 'media'); if (it.type === 'video') M.gcVideos(); } });
    return f;
  };
  const filters = (it) => [plain.range(it, 'filters.brightness', 'Brilho', 0, 200, 1, '%'), plain.range(it, 'filters.contrast', 'Contraste', 0, 200, 1, '%'), plain.range(it, 'filters.saturate', 'Saturação', 0, 200, 1, '%'), plain.range(it, 'filters.hue', 'Matiz', -180, 180, 1, '°')];
  const replaceBtn = (it, kind, accept) => UI.btn({ icon: 'swap', label: 'Substituir arquivo', cls: 'sm', title: 'Importa outro arquivo e troca nesta camada, mantendo posição, animações e efeitos', on: async () => {
    const f = await UI.pickFiles(accept); if (!f.length) return; const res = await M.importFiles([f[0]]); res.errors.forEach(e => UI.toast(e.name + ': ' + e.msg, 'err'));
    if (res.ok[0] && res.ok[0].kind === kind) { it.mediaId = res.ok[0].id; SMS.changed(); Pr.buildProps(); UI.toast('Arquivo substituído; as propriedades da camada foram mantidas.', 'ok'); } else if (res.ok[0]) UI.toast('O arquivo escolhido não é do tipo ' + kind + '.', 'warn');
  } });
  const mediaCommon = (root, it, kind) => {
    const rec = M.get(it.mediaId), ms = mediaSelect(it, kind), body = [ms.el, btnrow(replaceBtn(it, kind, kind === 'image' ? 'image/*' : 'video/*'))];
    pFields.push(ms);
    if (kind === 'image' && rec && !rec.hasAlpha && !it.bgRemove) body.push(h('div', { class: 'warn', text: 'Esta imagem não tem transparência real (o fundo faz parte da imagem).' + (rec.corner ? ' Dá para tentar remover o fundo por cor abaixo.' : '') }));
    root.append(UI.sect(kind === 'image' ? 'Imagem' : 'Vídeo', body));
    const F = [plain.select(it, 'fit', 'Ajuste', [['fill', 'Esticar'], ['contain', 'Conter'], ['cover', 'Cobrir']]), plain.select(it, 'mask', 'Máscara', [['none', 'Nenhuma'], ['circle', 'Círculo/elipse'], ['rounded', 'Cantos arredondados']]), anum(it, 'radius', 'Arredondar', { min: 0 }), anum(it, 'blur', 'Desfoque', { min: 0 }),
      plain.num(it, 'crop.x', 'Recorte X (0–1)', { min: 0, max: 0.95, step: 0.05 }), plain.num(it, 'crop.y', 'Recorte Y (0–1)', { min: 0, max: 0.95, step: 0.05 }), plain.num(it, 'crop.w', 'Recorte larg.', { min: 0.05, max: 1, step: 0.05 }), plain.num(it, 'crop.h', 'Recorte alt.', { min: 0.05, max: 1, step: 0.05 })].concat(filters(it));
    F.forEach(f => pFields.push(f)); root.append(UI.sect('Ajustes', F.map(f => f.el), true));
  };

  const TYPE_PANELS = {
    text(root, it) {
      const F = [plain.area(it, 'text', 'Texto', 3, 600), UI.select({ label: 'Fonte', full: false, options: M.fontList().map(f => [f.value, f.label]), get: () => it.font, set: (v) => { it.font = v; commit(it, 'font'); } }), anum(it, 'size', 'Tamanho', { min: 4, max: 800 }), plain.select(it, 'weight', 'Peso', [[300, 'Fina'], [400, 'Normal'], [500, 'Média'], [600, 'Semibold'], [700, 'Negrito'], [800, 'Extra'], [900, 'Preta']]), plain.check(it, 'italic', 'Itálico'),
        plain.select(it, 'align', 'Alinhar', [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']]), plain.select(it, 'valign', 'Vertical', [['top', 'Topo'], ['middle', 'Meio'], ['bottom', 'Base']]), acolor(it, 'color', 'Cor'), anum(it, 'letterSpacing', 'Espaç. letras', { step: 0.5 }), plain.num(it, 'lineHeight', 'Entrelinha', { min: 0.6, max: 3, step: 0.05 }), plain.check(it, 'autoFit', 'Ajuste automático (reduz p/ caber)'), anum(it, 'typed', 'Digitação (0–1)', { step: 0.05 })];
      F.forEach(f => pFields.push(f)); root.append(UI.sect('Texto', F.map(f => f.el)));
      Pr.textArea = F[0];
    },
    image(root, it) {
      mediaCommon(root, it, 'image'); const rec = M.get(it.mediaId);
      root.append(UI.sect('Transparência / fundo', [h('div', { class: 'hint', text: rec ? (rec.hasAlpha ? 'Esta imagem tem canal alpha (transparência real preservada).' : 'Sem transparência real.') : '' }), it.bgRemove ? h('div', { class: 'hint', text: 'Remoção ativa: cor ' + toHex(it.bgRemove.color) + ' · tolerância ' + it.bgRemove.tol + '%. O arquivo original continua intacto.' }) : null,
        btnrow(UI.btn({ label: it.bgRemove ? 'Ajustar remoção de fundo' : 'Remover fundo por cor…', cls: 'sm', on: () => SMS.Panels.bgRemoveDialog(it) }), it.bgRemove ? UI.btn({ label: 'Desfazer remoção', cls: 'sm', on: () => { it.bgRemove = null; SMS.changed(); Pr.buildProps(); } }) : null)]));
    },
    video(root, it) {
      mediaCommon(root, it, 'video'); const F = [plain.num(it, 'trimIn', 'Início no vídeo (s)', { min: 0, step: 0.1 }), arange(it, 'volume', 'Volume', 0, 200, 1, 100), plain.check(it, 'muted', 'Mudo'), plain.check(it, 'loop', 'Repetir se o clipe for maior')];
      F.forEach(f => pFields.push(f)); root.append(UI.sect('Reprodução', F.map(f => f.el)));
    },
    shape(root, it) {
      const sh = UI.select({ label: 'Forma', options: [['rect', 'Retângulo'], ['ellipse', 'Elipse/círculo'], ['line', 'Linha'], ['polygon', 'Polígono'], ['star', 'Estrela'], ['arrow', 'Seta'], ['custom', 'Personalizada']], get: () => it.shape, set: (v) => { it.shape = v; if (v === 'custom' && R_parse(it.points).length < 3) it.points = '50,0 100,100 0,100'; commit(it, 'shape'); Pr.buildProps(); } });
      const F = [sh, acolor(it, 'color', 'Preenchimento'), plain.check(it, 'fillOn', 'Usar preenchimento')];
      if (it.shape === 'rect') F.push(anum(it, 'radius', 'Cantos arredondados', { min: 0 }));
      if (it.shape === 'polygon' || it.shape === 'star') F.push(plain.num(it, 'sides', 'Lados/pontas', { min: 3, max: 12 }));
      if (it.shape === 'star') F.push(plain.num(it, 'inner', 'Raio interno', { min: 0.1, max: 0.95, step: 0.05 }));
      if (it.shape === 'custom') F.push(plain.area(it, 'points', 'Pontos x,y (0–100) separados por espaço', 3, 400));
      F.forEach(f => pFields.push(f)); root.append(UI.sect('Forma', F.map(f => f.el)));
    },
    icon(root, it) {
      const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(44px,1fr))', marginBottom: '8px' } }, SMS.ICONS.map(i => { const b = h('button', { class: 'btn icon sm', type: 'button', title: i.label, onclick: () => { it.icon = i.id; commit(it, 'icon'); } }); b.append(UI.svg(i.d)); return b; }));
      const F = [acolor(it, 'color', 'Cor')]; F.forEach(f => pFields.push(f)); root.append(UI.sect('Ícone', [grid].concat(F.map(f => f.el))));
    },
    texture(root, it) { const F = [plain.select(it, 'pattern', 'Padrão', SMS.TEXTURES), acolor(it, 'color', 'Cor'), plain.num(it, 'size', 'Tamanho', { min: 6 }), plain.num(it, 'thick', 'Espessura', { min: 1 })]; F.forEach(f => pFields.push(f)); root.append(UI.sect('Textura', F.map(f => f.el))); },
    particles(root, it) {
      const F = [plain.select(it, 'pShape', 'Forma', [['circle', 'Círculo'], ['square', 'Quadrado'], ['star', 'Estrela'], ['spark', 'Faísca']]), acolor(it, 'color', 'Cor 1'), plain.color(it, 'color2', 'Cor 2'), plain.num(it, 'count', 'Quantidade', { min: 1, max: 300 }), plain.num(it, 'size', 'Tamanho', { min: 1 }), plain.range(it, 'sizeVar', 'Variação', 0, 1, 0.05), plain.num(it, 'speed', 'Velocidade'), plain.num(it, 'dir', 'Direção (°)', { step: 5 }), plain.num(it, 'spread', 'Abertura (°)', { min: 0, max: 360, step: 5 }), plain.num(it, 'gravity', 'Gravidade'), plain.num(it, 'life', 'Vida (s)', { min: 0.2, step: 0.1 }), plain.num(it, 'seed', 'Semente', { step: 1 })];
      F.forEach(f => pFields.push(f)); root.append(UI.sect('Partículas', F.map(f => f.el).concat(btnrow(UI.btn({ label: 'Nova aleatoriedade', cls: 'sm', on: () => { it.seed = Math.floor(Math.random() * 999); commit(it, 'seed'); } })))));
    }
  };
  const R_parse = (s) => SMS.Render.parsePoints(s);
  const toHex = (c) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  Pr.refresh = () => { pFields.forEach(f => { try { f.update(); } catch (e) { console.error(e); } }); };
  Pr.focusText = (id) => { SMS.setSelection([id]); SMS.UI.isMobile() ? SMS.Panels.show('props') : SMS.Panels.show('props'); setTimeout(() => { Pr.buildProps(); const t = Pr.textArea && Pr.textArea.input; if (t) { t.focus(); t.select(); } }, 60); };

  /* ================= ANIMAÇÃO ================= */
  const AP = { phase: 'in', dur: 0, dir: '', stagger: 0, prop: null };
  function buildAnim() {
    const root = $('pAnim'); root.textContent = ''; aFields = []; const items = sel(), it0 = items[0];
    if (!items.length) { root.append(h('p', { class: 'hint', text: 'Selecione um ou mais elementos para aplicar presets e editar keyframes. Os presets criam keyframes reais, que você pode editar depois.' })); return; }
    const phases = [['in', 'Entrada'], ['out', 'Saída'], ['loop', 'Contínuo'], ['fx', 'Efeitos']];
    const chips = h('div', { class: 'chips' }, phases.map(p => h('button', { class: 'chip' + (AP.phase === p[0] ? ' on' : ''), type: 'button', text: p[1], onclick: () => { AP.phase = p[0]; buildAnim(); } })));
    const grid = h('div', { class: 'presets' });
    const list = AP.phase === 'fx' ? [] : A.PRESETS.filter(p => p.phase === AP.phase);
    list.forEach(p => { const dis = p.only && !items.some(r => r.item.type === p.only); grid.append(h('button', { class: 'btn preset', type: 'button', disabled: dis, onclick: () => applyPreset(p, items) }, h('span', { text: p.name }), h('small', { text: p.desc }))); });
    if (AP.phase === 'fx') grid.append(h('button', { class: 'btn preset', type: 'button', onclick: () => { C.addParticles(); } }, h('span', { text: 'Movimento de partículas' }), h('small', { text: 'Adiciona um emissor de partículas editável na cena.' })));
    const dirSel = UI.select({ label: 'Direção', options: A.SIDES, get: () => AP.dir || 'left', set: (v) => { AP.dir = v; } });
    root.append(UI.sect('Presets de animação', [chips, h('div', { class: 'fld' }, h('label', { text: 'Duração (s)' }), h('input', { type: 'number', min: 0, step: 0.1, value: AP.dur || '', placeholder: 'padrão', onchange: (e) => { AP.dur = Number(e.target.value) || 0; } })), dirSel.el, h('div', { class: 'fld' }, h('label', { text: 'Escalonar (s)' }), h('input', { type: 'number', min: 0, step: 0.1, value: AP.stagger || '', placeholder: '0', title: 'Atraso entre elementos selecionados (animação em sequência)', onchange: (e) => { AP.stagger = Number(e.target.value) || 0; } })), grid,
      h('div', { class: 'hint', text: 'Cada preset altera só as propriedades que usa. Entrada e saída coexistem (a saída fica ancorada no fim do clipe).' })]));
    root.append(UI.sect('Copiar / limpar animação', [btnrow(UI.btn({ label: 'Copiar animação', cls: 'sm', on: () => { const r = items.find(x => A.hasAny(x.item)); if (!r) { UI.toast('O elemento não tem animação para copiar.', 'warn'); return; } S.animClip = A.copyKeys(r.item); UI.toast('Animação copiada.', 'ok'); } }), UI.btn({ label: 'Colar animação', cls: 'sm', disabled: !S.animClip, on: () => { if (!S.animClip) return; items.forEach(r => A.pasteKeys(r.item, S.animClip)); SMS.changed(); UI.toast('Animação colada em ' + items.length + ' item(ns).', 'ok'); } }), UI.btn({ label: 'Limpar tudo', cls: 'sm danger', on: () => { items.forEach(r => A.clear(r.item)); S.selKey = null; SMS.changed(); } }))], true));
    if (items.length === 1 && !it0.audio) keyEditor(root, it0.item);
  }
  function applyPreset(p, items) {
    let ok = 0, first = null, last = 0, i = 0;
    items.forEach(r => {
      if (r.audio) return; const params = { delay: (i++) * (AP.stagger || 0) }; if (AP.dur) params.dur = AP.dur; if (p.hasDir && AP.dir) params.dir = AP.dir;
      if (A.applyPreset(r.item, p.id, params, SMS.itemDur(r))) { ok++; const g = SMS.sceneStart(r.sceneIdx) + r.item.start; if (first == null || g < first) first = g; last = Math.max(last, g + Math.min(SMS.itemDur(r), (AP.dur || p.dur || 1) + params.delay + 0.6)); }
    });
    if (!ok) { UI.toast('Este preset não se aplica ao(s) elemento(s) selecionado(s).', 'warn'); return; }
    SMS.changed(); SMS.App.playRange(first, p.phase === 'out' ? Math.max(first + 1, last) : last, p.phase === 'out');
  }
  function keyEditor(root, it) {
    const r = SMS.findItem(it.id), dur = SMS.itemDur(r), props = A.propsFor(it);
    if (!AP.prop || !props.includes(AP.prop)) AP.prop = (S.selKey && S.selKey.id === it.id && S.selKey.prop) || props.find(p => A.isAnimated(it, p)) || 'opacity';
    if (S.selKey && S.selKey.id === it.id && props.includes(S.selKey.prop)) AP.prop = S.selKey.prop;
    const ps = UI.select({ label: 'Propriedade', options: props.map(p => [p, (A.isAnimated(it, p) ? '◆ ' : '') + A.PROPS[p].label]), get: () => AP.prop, set: (v) => { AP.prop = v; S.selKey = null; buildAnim(); } });
    const keys = A.sortedKeys(it, AP.prop, dur), body = [ps.el];
    body.push(btnrow(UI.btn({ label: '◆ Adicionar no cursor', cls: 'sm', on: () => { const lt = SMS.itemLocalT(r); if (lt < -0.001 || lt > dur + 0.001) { UI.toast('Mova o cursor para dentro do clipe.', 'warn'); return; } const k = A.setKey(it, AP.prop, Math.max(0, lt), A.value(it, AP.prop, lt, dur), dur); S.selKey = { id: it.id, prop: AP.prop, kid: k.id }; SMS.changed(); buildAnim(); } }), UI.btn({ label: 'Limpar propriedade', cls: 'sm danger', disabled: !keys.length, on: () => { A.clear(it, AP.prop); S.selKey = null; SMS.changed(); } })));
    if (!keys.length) body.push(h('div', { class: 'hint', text: 'Esta propriedade não tem keyframes. Adicione uma no cursor, mude o cursor e altere o valor: a keyframe seguinte é criada automaticamente.' }));
    keys.forEach(o => { const isSel = S.selKey && S.selKey.kid === o.k.id; body.push(h('div', { class: 'keyrow' + (isSel ? ' sel' : ''), onclick: () => { S.selKey = { id: it.id, prop: AP.prop, kid: o.k.id }; SMS.App.pause(); SMS.setTime(SMS.sceneStart(r.sceneIdx) + (r.audio ? 0 : it.start) + (r.audio ? it.start : 0) + o.t); SMS.emit('selkey'); } }, h('span', { text: SMS.round(o.t, 2) + ' s' }), h('span', { text: typeof o.k.v === 'number' ? String(SMS.round(o.k.v, 2)) : String(o.k.v) }), h('span', { text: (A.EASES.find(e => e[0] === (o.k.ease || 'linear')) || ['', o.k.ease])[1], style: { color: '#9a9a9a' } }))); });
    const sk = S.selKey && S.selKey.id === it.id && S.selKey.prop === AP.prop ? A.findKey(it, AP.prop, S.selKey.kid) : null;
    if (sk) {
      const abs = () => sk.anchor === 'end' ? dur - sk.t : sk.t, isColor = typeof sk.v === 'string';
      const F = [UI.num({ label: 'Tempo (s)', step: 0.05, min: 0, max: dur, get: abs, set: (v) => { v = SMS.clamp(v, 0, dur); sk.t = sk.anchor === 'end' ? SMS.round(dur - v, 4) : SMS.round(v, 4); SMS.changed('kt'); } }),
        isColor ? UI.color({ label: 'Valor', get: () => sk.v, set: (v) => { sk.v = v; it[AP.prop] = v; SMS.changed('kv'); } }) : UI.num({ label: 'Valor', step: (A.PROPS[AP.prop] || {}).step || 1, dp: 3, get: () => sk.v, set: (v) => { sk.v = v; SMS.changed('kv'); } }),
        UI.select({ label: 'Curva até a próxima', options: A.EASES, get: () => sk.ease || 'linear', set: (v) => { sk.ease = v; if (v === 'bezier' && !sk.bz) sk.bz = [0.42, 0, 0.58, 1]; SMS.changed(); buildAnim(); } })];
      F.forEach(f => aFields.push(f)); body.push(h('div', { class: 'sect', style: { marginTop: '8px' } }, h('div', { class: 'body' }, ...F.map(f => f.el))));
      if (sk.ease === 'bezier') { const bz = sk.bz || (sk.bz = [0.42, 0, 0.58, 1]); const nums = bz.map((v, i) => UI.num({ label: ['x1', 'y1', 'x2', 'y2'][i], step: 0.05, min: i % 2 ? -1 : 0, max: i % 2 ? 2 : 1, get: () => sk.bz[i], set: (n) => { sk.bz[i] = n; SMS.changed('bz'); drawCurve(sk); } })); nums.forEach(f => aFields.push(f)); body.push(row2(nums[0].el, nums[1].el), row2(nums[2].el, nums[3].el)); }
      const cv = h('canvas', { id: 'curve', width: 240, height: 70 }); body.push(cv, btnrow(UI.btn({ label: 'Duplicar keyframe', cls: 'sm', on: () => { const nk = SMS.clone(sk); nk.id = SMS.uid('k'); nk.t = SMS.round(Math.min(dur, abs() + 0.25), 4); if (nk.anchor === 'end') nk.t = SMS.round(dur - Math.min(dur, abs() + 0.25), 4); it.kf[AP.prop].push(nk); S.selKey = { id: it.id, prop: AP.prop, kid: nk.id }; SMS.changed(); buildAnim(); } }), UI.btn({ label: 'Excluir', cls: 'sm danger', on: () => { A.removeKey(it, AP.prop, sk.id); S.selKey = null; SMS.changed(); buildAnim(); } })));
      setTimeout(() => drawCurve(sk), 0);
    }
    root.append(UI.sect('Keyframes · ' + it.name, body));
    aFields.forEach(f => f.update());
  }
  function drawCurve(k) {
    const cv = $('curve'); if (!cv) return; const x = cv.getContext('2d'), w = cv.width, hh = cv.height; x.clearRect(0, 0, w, hh); x.strokeStyle = '#333'; x.strokeRect(10.5, 8.5, w - 21, hh - 17);
    x.strokeStyle = '#ffd400'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, e = A.ease(k, u), px = 10 + u * (w - 20), py = hh - 9 - e * (hh - 18) * 0.8 - 2; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  }

  /* ================= CENA / PROJETO ================= */
  let sFields = [];
  function buildScene() { buildScene0(); sFields.forEach(f => f.update()); }
  function buildScene0() {
    const root = $('pScene'); root.textContent = ''; sFields = []; const P = S.project, sc = SMS.scene(), i = S.sceneIdx, next = P.scenes[i + 1];
    const F = [UI.text({ label: 'Nome', max: 60, get: () => sc.name, set: (v) => { sc.name = v; SMS.changed('sn'); } }), UI.num({ label: 'Duração (s)', step: 0.5, min: 0.5, max: 600, get: () => sc.duration, set: (v) => { C.setSceneDuration(S.sceneIdx, v); SMS.changed('sd'); } }),
      UI.color({ label: 'Cor de fundo', get: () => sc.bg || '#000000', set: (v) => { sc.bg = v; SMS.changed('sb'); } }), UI.check({ label: 'Fundo transparente', get: () => sc.bg == null, set: (v) => { sc.bg = v ? null : '#0b0b0b'; SMS.changed(); } }),
      UI.select({ label: 'Transição → próxima', options: SMS.TRANSITIONS, get: () => sc.transition.type, set: (v) => { sc.transition.type = v; SMS.changed(); } }), UI.num({ label: 'Duração transição', step: 0.1, min: 0.1, max: 5, get: () => sc.transition.duration, set: (v) => { sc.transition.duration = v; SMS.changed('st'); } })];
    F.forEach(f => sFields.push(f));
    root.append(UI.sect('Cena ' + (i + 1) + ' de ' + P.scenes.length, F.map(f => f.el).concat([h('div', { class: 'hint', text: next ? 'A transição sobrepõe o fim desta cena ao começo da próxima e encurta o vídeo total pela mesma duração.' : 'A última cena não tem transição de saída.' }),
      btnrow(UI.btn({ label: '＋ Cena', cls: 'sm', on: () => C.addScene() }), UI.btn({ label: 'Duplicar', cls: 'sm', on: () => C.dupScene() }), UI.btn({ label: '◀ Mover', cls: 'sm', disabled: i === 0, on: () => C.moveScene(i, i - 1) }), UI.btn({ label: 'Mover ▶', cls: 'sm', disabled: i === P.scenes.length - 1, on: () => C.moveScene(i, i + 1) }), UI.btn({ label: 'Excluir', cls: 'sm danger', disabled: P.scenes.length < 2, on: async () => { if (await UI.confirm('Excluir a cena "' + sc.name + '"?', 'Excluir', true)) C.delScene(); } }))])));
    F.forEach(f => f.update());
    // projeto
    const st = P.settings, W = h('input', { type: 'number', min: 64, max: 4096, value: st.width }), Hh = h('input', { type: 'number', min: 64, max: 4096, value: st.height }), scale = h('input', { type: 'checkbox', checked: true });
    const asp = h('select', { 'aria-label': 'Proporção' }, [['9:16', '9:16 · vertical (Stories/Reels)'], ['16:9', '16:9 · horizontal'], ['1:1', '1:1 · quadrado'], ['4:5', '4:5 · feed vertical'], ['custom', 'Personalizado']].map(a => h('option', { value: a[0], text: a[1], selected: a[0] === st.aspect })));
    asp.onchange = () => { if (asp.value !== 'custom') { const d = SMS.ASPECTS[asp.value]; W.value = d[0]; Hh.value = d[1]; } };
    const pf = [UI.text({ label: 'Nome', max: 80, get: () => P.name, set: (v) => { P.name = v; SMS.changed('pn'); $('projName').value = v; } })]; pf.forEach(f => sFields.push(f));
    root.append(UI.sect('Projeto', pf.map(f => f.el).concat([h('div', { class: 'fld' }, h('label', { text: 'Proporção' }), asp), h('div', { class: 'fld' }, h('label', { text: 'Largura × Altura' }), row2(W, Hh)), h('div', { class: 'fld' }, h('label', { text: 'Reposicionar' }), h('label', null, scale, ' proporcionalmente')),
      btnrow(UI.btn({ label: 'Aplicar tamanho', cls: 'sm', on: () => { C.setCanvas(Number(W.value), Number(Hh.value), asp.value, scale.checked); buildScene(); } })), h('div', { class: 'hint', text: 'Tamanho de design: as coordenadas são relativas a ele. A resolução final do vídeo é escolhida na exportação (480p–2160p).' }),
      h('div', { class: 'hint', text: 'Duração total: ' + SMS.round(SMS.total(), 2) + ' s · ' + P.settings.fps + ' fps · ' + st.width + '×' + st.height })])));
  }
  Pr.refreshScene = () => sFields.forEach(f => f.update());

  Pr.init = () => {
    const rebuild = SMS.debounce(() => { Pr.buildProps(); buildAnim(); buildScene(); }, 0);
    SMS.on('selection', () => { Pr.buildProps(); buildAnim(); }); SMS.on('project:loaded', rebuild); SMS.on('project:restored', rebuild); SMS.on('media:changed', () => { Pr.buildProps(); }); SMS.on('canvas', buildScene);
    SMS.on('scene', () => { buildScene(); }); SMS.on('selkey', buildAnim);
    let rt = 0; SMS.on('change', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { Pr.refresh(); aFields.forEach(f => f.update()); Pr.refreshScene(); }); });
    SMS.on('committed', () => { const r = $('pAnim'); if (!r.contains(document.activeElement) || document.activeElement.tagName === 'BODY') buildAnim(); if (!$('pScene').contains(document.activeElement)) buildScene(); });
    SMS.on('time', () => { const t = performance.now(); if (Pr._t && t - Pr._t < 90) return; Pr._t = t; Pr.refresh(); });
    $('pAnim').addEventListener('focusout', () => setTimeout(() => { if (!$('pAnim').contains(document.activeElement)) buildAnim(); }, 80));
    SMS.on('edit-text', (id) => Pr.focusText(id));
    rebuild();
  };
})();
