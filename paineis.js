/* Painéis da esquerda (Camadas, Biblioteca), navegação, janelas (Projetos, Novo/Modelos, Configurações,
   Exportar, Remover fundo) e barra superior. */
(function () {
  'use strict';
  const SMS = window.SMS, S = SMS.S, C = SMS.Cmd, UI = SMS.UI, M = SMS.Media, X = SMS.Exporter, h = SMS.h, $ = (id) => document.getElementById(id);
  const Pn = SMS.Panels = {};
  const btnrow = (...c) => h('div', { class: 'btnrow' }, ...c);

  /* ---------- navegação ---------- */
  const NAV = [['timeline', 'Tempo', 'timeline'], ['layers', 'Camadas', 'layers'], ['lib', 'Mídia', 'folder'], ['props', 'Props', 'tune'], ['anim', 'Anim', 'anim'], ['scene', 'Cena', 'movie']];
  Pn.show = (id) => {
    const app = $('app'); app.dataset.m = id;
    if (id === 'layers' || id === 'lib') $('dockL').dataset.tab = id; else if (id !== 'timeline') $('dockR').dataset.tab = id;
    document.querySelectorAll('#tabsL button,#tabsR button,#mnav button').forEach(b => b.classList.toggle('on', b.dataset.id === id || (b.dataset.id === $('dockL').dataset.tab && !UI.isMobile() && ['layers', 'lib'].includes(b.dataset.id)) || (b.dataset.id === $('dockR').dataset.tab && !UI.isMobile() && ['props', 'anim', 'scene'].includes(b.dataset.id))));
    if (UI.isMobile()) setTimeout(() => SMS.Stage.layout(), 30);
  };
  function buildNav() {
    const mk = (box, items, cls) => items.forEach(i => { const b = h('button', { type: 'button', dataset: { id: i[0] }, onclick: () => Pn.show(i[0]) }); if (cls) { b.append(UI.svg(i[2]), h('span', { text: i[1] })); } else b.textContent = i[1]; box.append(b); });
    mk($('tabsL'), [['layers', 'Camadas'], ['lib', 'Biblioteca']]); mk($('tabsR'), [['props', 'Propriedades'], ['anim', 'Animação'], ['scene', 'Cena']]); mk($('mnav'), NAV, true);
    $('tabsL').firstChild.classList.add('on'); $('tabsR').firstChild.classList.add('on'); $('mnav').children[1].classList.add('on');
  }

  /* ---------- importação ---------- */
  Pn.importAndAdd = async (files, o) => {
    if (!files || !files.length) return;
    const res = await M.importFiles(files, o); res.errors.forEach(e => UI.toast(e.name + ': ' + e.msg, 'err'));
    res.ok.forEach(r => { if (r.kind !== 'font') C.addMedia(r.id); });
    if (res.ok.length) UI.toast(res.ok.length + ' arquivo(s) importado(s) para a biblioteca.', 'ok'); return res;
  };
  Pn.pickAndAdd = async (accept, o) => { const f = await UI.pickFiles(accept, true); await Pn.importAndAdd(f, o); };

  /* ---------- camadas ---------- */
  const layerThumb = (e) => {
    const t = h('div', { class: 'lth' });
    if (e.type === 'image') { const rec = M.get(e.mediaId); if (rec) t.append(h('img', { src: M.url(e.mediaId), alt: '' })); else t.textContent = '⚠'; }
    else if (e.type === 'video') { const rec = M.get(e.mediaId); if (rec && rec.poster) t.append(h('img', { src: rec.poster, alt: '' })); else t.textContent = '▶'; }
    else if (e.type === 'text') { t.textContent = 'T'; t.style.color = e.color; }
    else if (e.type === 'shape') { const s = h('div', { style: { width: '18px', height: '18px', background: e.fillOn === false ? 'transparent' : e.color, border: e.fillOn === false ? '2px solid ' + e.color : '0', borderRadius: e.shape === 'ellipse' ? '50%' : '2px' } }); t.append(s); }
    else if (e.type === 'icon') { const s = UI.svg(SMS.iconPath(e.icon)); s.style.fill = e.color; t.append(s); }
    else t.textContent = e.type === 'texture' ? '▦' : '✦';
    return t;
  };
  function buildLayers() {
    const root = $('pLayers'); root.textContent = '';
    const add = (label, on) => h('button', { class: 'chip', type: 'button', text: label, onclick: on });
    root.append(h('div', { class: 'chips' }, add('＋ Texto', () => C.addText()), add('▭ Retângulo', () => C.addShape('rect')), add('● Círculo', () => C.addShape('ellipse')), add('▧ Imagem', () => Pn.pickAndAdd('image/*')), add('▶ Vídeo', () => Pn.pickAndAdd('video/*')), add('♪ Áudio', () => Pn.pickAndAdd('audio/*')), add('★ Ícone', () => { Pn.libTab('icons'); Pn.show('lib'); }), add('▦ Textura', () => C.addTexture('grid')), add('✦ Partículas', () => C.addParticles()), add('▬ Fundo', () => C.addBackground(SMS.scene().bg || '#222222'))));
    root.append(btnrow(UI.btn({ icon: 'copy', title: 'Copiar (Ctrl+C)', cls: 'sm', on: () => C.copy() }), UI.btn({ label: 'Colar', title: 'Colar (Ctrl+V)', cls: 'sm', on: () => C.paste() }), UI.btn({ label: 'Duplicar', cls: 'sm', on: () => C.duplicateSel() }), UI.btn({ icon: 'up', title: 'Trazer para frente', cls: 'sm', on: () => C.reorder('up') }), UI.btn({ icon: 'down', title: 'Enviar para trás', cls: 'sm', on: () => C.reorder('down') }), UI.btn({ label: 'Agrupar', cls: 'sm', on: () => C.group() }), UI.btn({ label: 'Desagrupar', cls: 'sm', on: () => C.ungroup() }), UI.btn({ icon: 'del', title: 'Excluir (Delete)', cls: 'sm danger', on: () => C.deleteSel() })));
    const sc = SMS.scene(), list = h('div', { id: 'layerList' });
    root.append(h('div', { class: 'hint', text: 'Cena: ' + sc.name + ' · ' + sc.elements.length + ' camada(s). A de cima fica na frente.' }), list);
    const n = sc.elements.length;
    sc.elements.slice().reverse().forEach((e, di) => {
      const idx = n - 1 - di, row = h('div', { class: 'layer' + (S.sel.includes(e.id) ? ' sel' : ''), dataset: { id: e.id } });
      const grab = h('button', { class: 'grab', title: 'Arraste para reordenar', 'aria-label': 'Reordenar' }, UI.svg('drag')), nm = h('div', { class: 'ln', title: 'Toque para selecionar · duplo toque para renomear' }, e.name, h('small', { text: SMS.TYPE_NAMES[e.type] + (e.groupId ? ' · grupo' : '') + (A_has(e) ? ' · animado' : '') }));
      nm.addEventListener('click', (ev) => { const additive = ev.shiftKey || ev.ctrlKey || ev.metaKey || SMS.Stage.opts.multi; if (additive) { const cur = new Set(S.sel); if (cur.has(e.id)) cur.delete(e.id); else SMS.expandGroups([e.id]).forEach(i => cur.add(i)); SMS.setSelection(Array.from(cur)); } else SMS.setSelection(SMS.expandGroups([e.id])); });
      nm.addEventListener('dblclick', async () => { const v = await UI.ask('Renomear camada', 'Nome', e.name); if (v) { e.name = v; SMS.changed(); } });
      row.append(grab, layerThumb(e), nm, h('button', { class: e.visible === false ? '' : 'on', title: 'Mostrar/ocultar', 'aria-label': 'Mostrar ou ocultar', onclick: () => { e.visible = e.visible === false; SMS.changed(); } }, UI.svg(e.visible === false ? 'eyeoff' : 'eye')), h('button', { class: e.locked ? 'on' : '', title: 'Bloquear/desbloquear', 'aria-label': 'Bloquear', onclick: () => { e.locked = !e.locked; SMS.changed(); } }, UI.svg(e.locked ? 'lock' : 'unlock')));
      grab.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); const rows = Array.from(list.children); let target = null;
        const mv = (m) => { rows.forEach(r => r.classList.remove('drop')); const el = document.elementFromPoint(m.clientX, m.clientY), r = el && el.closest && el.closest('.layer'); target = r && rows.includes(r) ? r : null; if (target && target !== row) target.classList.add('drop'); };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); rows.forEach(r => r.classList.remove('drop')); if (!target || target === row) return; const ti = n - 1 - rows.indexOf(target); C.moveLayer(e.id, idx < ti ? ti : ti + 1); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      list.append(row);
    });
    if (!n) list.append(h('p', { class: 'hint', text: 'Cena vazia. Use os botões acima para adicionar texto, formas, imagens, vídeo ou áudio.' }));
  }
  const A_has = (e) => SMS.Anim.hasAny(e);

  /* ---------- biblioteca ---------- */
  const Lib = { tab: 'media', filter: 'all', q: '' };
  Pn.libTab = (t) => { Lib.tab = t; buildLib(); };
  function waveThumb(id) {
    const cv = h('canvas', { width: 120, height: 60 }), pk = M.peaks(id), x = cv.getContext('2d'); x.fillStyle = '#7fdcff';
    if (pk) for (let i = 0; i < 120; i++) { const v = Math.min(1, pk[Math.floor(i / 120 * pk.length)] * 1.4) * 28; x.fillRect(i, 30 - v, 1, Math.max(1, v * 2)); } else { x.fillStyle = '#7fdcff'; x.font = '28px sans-serif'; x.fillText('♪', 46, 40); }
    return cv;
  }
  function mediaCard(r) {
    const th = h('div', { class: 'th', title: 'Toque para adicionar ao projeto', onclick: () => C.addMedia(r.id) });
    if (r.kind === 'image') th.append(h('img', { src: M.url(r.id), alt: r.name, loading: 'lazy' })); else if (r.kind === 'video') th.append(r.poster ? h('img', { src: r.poster, alt: r.name }) : h('span', { class: 'big', text: '▶' })); else if (r.kind === 'audio') th.append(waveThumb(r.id)); else th.append(h('span', { class: 'big', text: 'Aa', style: { fontFamily: '"' + r.family + '", sans-serif', fontSize: '34px' } }));
    const tag = r.logo ? 'LOGO' : r.kind === 'video' ? 'VÍDEO · ' + SMS.round(r.duration || 0, 1) + 's' : r.kind === 'audio' ? SMS.round(r.duration || 0, 1) + 's' : r.kind === 'font' ? 'FONTE' : (r.hasAlpha ? 'PNG α' : '');
    if (tag) th.append(h('span', { class: 'bd', text: tag }));
    const acts = h('div', { class: 'acts' }, h('button', { title: 'Adicionar ao projeto', 'aria-label': 'Adicionar', onclick: () => C.addMedia(r.id) }, UI.svg('add')));
    if (r.kind === 'image') acts.append(h('button', { title: r.logo ? 'Desmarcar como logotipo' : 'Marcar como logotipo', 'aria-label': 'Logotipo', class: r.logo ? 'on' : '', style: r.logo ? { color: '#ffd400' } : null, onclick: async () => { r.logo = !r.logo; await SMS.db.put('media', r); buildLib(); } }, h('span', { text: 'L', style: { fontWeight: 800 } })));
    acts.append(h('button', { title: 'Substituir arquivo (mantém usos no projeto)', 'aria-label': 'Substituir', onclick: async () => { const f = await UI.pickFiles(M.ACCEPT); if (!f.length) return; try { await M.replaceBlob(r.id, f[0]); UI.toast('Arquivo substituído.', 'ok'); SMS.emit('change'); } catch (e) { UI.toast(e.message, 'err'); } } }, UI.svg('swap')),
      h('button', { title: 'Excluir da biblioteca', 'aria-label': 'Excluir', onclick: async () => { const u = M.usage(r.id); if (await UI.confirm(u ? 'Este arquivo é usado ' + u + ' vez(es) no projeto atual; esses elementos ficarão com "mídia ausente". Excluir mesmo assim?' : 'Excluir "' + r.name + '" da biblioteca?', 'Excluir', true)) { await M.remove(r.id); SMS.touch(); } } }, UI.svg('del')));
    return h('div', { class: 'card' }, th, h('div', { class: 'nm', title: r.name, text: r.name }), h('div', { class: 'nm', style: { color: '#888', paddingTop: 0 }, text: M.usage(r.id) ? 'em uso ×' + M.usage(r.id) : UI.fmtBytes(r.size) }), acts);
  }
  function buildLib() {
    const root = $('pLib'); root.textContent = '';
    const tabs = [['media', 'Mídia'], ['icons', 'Ícones'], ['emoji', 'Emojis'], ['bg', 'Fundos'], ['comp', 'Componentes'], ['tpl', 'Modelos']];
    root.append(h('div', { class: 'chips' }, tabs.map(t => h('button', { class: 'chip' + (Lib.tab === t[0] ? ' on' : ''), type: 'button', text: t[1], onclick: () => Pn.libTab(t[0]) }))));
    const body = h('div'); root.append(body);
    if (Lib.tab === 'media') {
      const miss = M.missingIds();
      if (miss.length) body.append(h('div', { class: 'warn' }, h('b', { text: 'Mídias ausentes (' + miss.length + ')' }), ...miss.map(m => h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' } }, h('span', { text: m.name, style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' } }), UI.btn({ label: 'Religar', cls: 'sm', on: async () => { const f = await UI.pickFiles(M.ACCEPT); if (!f.length) return; try { await M.replaceBlob(m.id, f[0]); UI.toast('Mídia religada.', 'ok'); SMS.touch(); } catch (e) { UI.toast(e.message, 'err'); } } })))));
      body.append(btnrow(UI.btn({ icon: 'upload', label: 'Importar e adicionar', cls: 'primary', on: () => Pn.pickAndAdd(M.ACCEPT) }), UI.btn({ label: 'Importar logotipo', on: () => Pn.pickAndAdd('image/*', { logo: true }) })));
      body.append(h('input', { type: 'text', placeholder: 'Pesquisar na biblioteca…', value: Lib.q, 'aria-label': 'Pesquisar', oninput: (e) => { Lib.q = e.target.value; fillGrid(); } }));
      body.append(h('div', { class: 'chips', style: { marginTop: '8px' } }, [['all', 'Tudo'], ['image', 'Imagens'], ['logo', 'Logotipos'], ['audio', 'Áudio'], ['video', 'Vídeo'], ['font', 'Fontes']].map(f => h('button', { class: 'chip' + (Lib.filter === f[0] ? ' on' : ''), type: 'button', text: f[1], onclick: () => { Lib.filter = f[0]; buildLib(); } }))));
      const grid = h('div', { class: 'grid' }); body.append(grid);
      const fillGrid = () => { grid.textContent = ''; const q = Lib.q.trim().toLowerCase(); const l = M.list().filter(r => (Lib.filter === 'all' || (Lib.filter === 'logo' ? r.logo : r.kind === Lib.filter)) && (!q || r.name.toLowerCase().includes(q))); l.forEach(r => grid.append(mediaCard(r))); if (!l.length) grid.append(h('p', { class: 'hint', style: { gridColumn: '1/-1' }, text: M.list().length ? 'Nada encontrado.' : 'A biblioteca está vazia. Importe PNG (com transparência), JPG, WebP, SVG, áudio, vídeo ou fontes. Tudo fica salvo só neste navegador.' })); };
      fillGrid(); body.append(h('p', { class: 'hint', text: 'Os arquivos ficam no armazenamento local do navegador (IndexedDB), não em servidor. Para backup, use Projetos › Exportar pacote.' }));
    } else if (Lib.tab === 'icons') {
      body.append(h('div', { class: 'grid' }, SMS.ICONS.map(i => h('div', { class: 'card' }, h('div', { class: 'th', title: i.label, onclick: () => C.addIcon(i.id) }, UI.svg(i.d)), h('div', { class: 'nm', text: i.label })))), h('p', { class: 'hint', text: 'Ícones vetoriais Material Icons (Apache 2.0). Mude cor e tamanho livremente.' }));
    } else if (Lib.tab === 'emoji') {
      body.append(h('div', { class: 'hint', text: 'Emojis' }), h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(44px,1fr))' } }, SMS.EMOJIS.map(e => h('button', { class: 'btn', type: 'button', style: { fontSize: '24px', padding: 0 }, text: e, onclick: () => C.addEmoji(e) }))), h('div', { class: 'hint', text: 'Símbolos' }), h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(44px,1fr))' } }, SMS.SYMBOLS.map(e => h('button', { class: 'btn', type: 'button', style: { fontSize: '20px', padding: 0 }, text: e, onclick: () => C.addText(e) }))));
    } else if (Lib.tab === 'bg') {
      body.append(h('div', { class: 'hint', text: 'Cor de fundo da cena (toque) · segure Shift/Ctrl para adicionar como camada' }), h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(44px,1fr))' } }, SMS.SOLIDS.map(c => h('button', { class: 'btn', type: 'button', title: c, 'aria-label': 'Cor ' + c, style: { background: c, height: '44px' }, onclick: (e) => { if (e.shiftKey || e.ctrlKey) C.addBackground(c); else { SMS.scene().bg = c; SMS.changed(); } } }))),
        h('div', { class: 'hint', text: 'Texturas (camada editável)' }), h('div', { class: 'grid' }, SMS.TEXTURES.map(t => h('button', { class: 'btn', type: 'button', text: t[1], onclick: () => C.addTexture(t[0]) }))));
    } else if (Lib.tab === 'comp') {
      C.listComponents().then(l => { if (Lib.tab !== 'comp') return; body.append(h('p', { class: 'hint', text: 'Selecione elementos e use "Salvar como componente" em Propriedades para reutilizá-los em qualquer cena ou projeto.' })); l.forEach(c => body.append(h('div', { class: 'pcard' }, h('div', { class: 'pi' }, h('b', { text: c.name }), h('small', { text: c.els.length + ' elemento(s)' })), UI.btn({ label: 'Inserir', cls: 'sm', on: () => C.insertComponent(c) }), UI.btn({ icon: 'del', cls: 'sm danger', title: 'Excluir', on: async () => { await C.removeComponent(c.id); } })))); if (!l.length) body.append(h('p', { class: 'hint', text: 'Nenhum componente salvo ainda.' })); });
    } else {
      body.append(h('p', { class: 'hint', text: 'Escolha um modelo para criar um novo projeto. Todos os textos, cores, logotipo, animações e duração continuam editáveis.' }), tplCards());
    }
  }
  const tplCards = () => h('div', { class: 'tcards' }, SMS.TEMPLATES.map(t => h('button', { class: 'tcard', type: 'button', onclick: () => Pn.newProject(t) }, h('span', { class: 'tag', text: t.cat + ' · ' + t.aspect }), h('b', { text: t.name }), h('small', { text: t.desc }))));

  /* ---------- novo projeto / modelos ---------- */
  async function beforeReplace() { if (S.dirty) { try { await SMS.Store.saveCurrent(); UI.toast('Projeto anterior salvo em "Projetos".'); } catch (e) { /* segue */ } } }
  Pn.newProject = (tpl) => {
    const body = h('div'), m = UI.modal({ title: 'Novo projeto', body, wide: true });
    const chooser = () => {
      body.textContent = ''; body.append(h('div', { class: 'hint', text: 'Em branco' }), btnrow(...Object.keys(SMS.ASPECTS).map(a => UI.btn({ label: a + (a === '9:16' ? ' vertical' : a === '16:9' ? ' horizontal' : ''), on: async () => { await beforeReplace(); const P = SMS.newProject({ aspect: a }); SMS.loadProject(P, { dirty: true }); m.close(); } }))), h('div', { class: 'hint', text: 'Modelos' }), h('div', { class: 'tcards' }, SMS.TEMPLATES.map(t => h('button', { class: 'tcard', type: 'button', onclick: () => form(t) }, h('span', { class: 'tag', text: t.cat + ' · ' + t.aspect }), h('b', { text: t.name }), h('small', { text: t.desc })))));
    };
    const form = (t) => {
      const v = SMS.templateDefaults(t), inputs = {}; let logoFile = null; body.textContent = '';
      body.append(h('div', { class: 'hint', text: t.name + ' — preencha os campos (tudo pode ser alterado depois no editor).' }));
      SMS.TPL_FIELDS.forEach(f => {
        let ctl;
        if (f.type === 'file') ctl = h('input', { type: 'file', accept: 'image/*', onchange: (e) => { logoFile = e.target.files[0] || null; } });
        else { ctl = h('input', { type: f.type === 'color' ? 'color' : 'text', value: v[f.k] || '', maxlength: 120 }); inputs[f.k] = ctl; }
        body.append(h('div', { class: 'fld full' }, h('label', { text: f.label }), ctl));
      });
      m.foot.hidden = false; m.foot.textContent = '';
      m.foot.append(h('button', { class: 'btn', type: 'button', text: '← Voltar', onclick: () => { m.foot.hidden = true; chooser(); } }), h('button', { class: 'btn primary', type: 'button', text: 'Criar projeto', onclick: async () => {
        const vals = {}; Object.keys(inputs).forEach(k => vals[k] = inputs[k].value);
        try {
          if (logoFile) { const r = await M.importFiles([logoFile], { logo: true }); r.errors.forEach(e => UI.toast(e.name + ': ' + e.msg, 'err')); if (r.ok[0]) vals.logoId = r.ok[0].id; }
          await beforeReplace(); SMS.loadProject(SMS.buildTemplate(t, vals), { dirty: true }); m.close(); Pn.show(UI.isMobile() ? 'timeline' : 'layers');
        } catch (e) { UI.toast('Falha ao criar o projeto: ' + e.message, 'err'); }
      } }));
    };
    if (tpl) form(tpl); else chooser();
  };

  /* ---------- projetos ---------- */
  Pn.projects = async () => {
    const body = h('div'), m = UI.modal({ title: 'Projetos', body, wide: true });
    const open = async (fn) => { try { await beforeReplace(); await fn(); m.close(); } catch (e) { UI.toast(e.message, 'err'); } };
    const draw = async () => {
      body.textContent = '';
      body.append(btnrow(UI.btn({ label: '＋ Novo / modelos', cls: 'primary', on: () => { m.close(); Pn.newProject(); } }), UI.btn({ icon: 'upload', label: 'Abrir arquivo…', on: async () => { const f = await UI.pickFiles('.json,.smsp,application/json'); if (f[0]) open(() => SMS.Store.openFile(f[0])); } }), UI.btn({ label: 'Salvar como…', on: async () => { const n = await UI.ask('Salvar como', 'Nome do projeto', S.project.name); if (n) { S.project.name = n; $('projName').value = n; await SMS.Store.saveCurrent(true); UI.toast('Salvo como novo projeto.', 'ok'); draw(); } } })),
        btnrow(UI.btn({ label: 'Duplicar projeto atual', cls: 'sm', on: async () => { await SMS.Store.duplicateCurrent(); $('projName').value = S.project.name; UI.toast('Projeto duplicado.', 'ok'); draw(); } }), UI.btn({ icon: 'dl', label: 'Baixar .json', cls: 'sm', on: () => SMS.Store.downloadJSON() }), UI.btn({ icon: 'dl', label: 'Exportar pacote .smsp (com mídias)', cls: 'sm', on: () => { const n = SMS.Store.downloadPackage(); UI.toast('Pacote gerado com ' + n + ' mídia(s).', 'ok'); } }), UI.btn({ icon: 'settings', label: 'Configurações', cls: 'sm', on: () => { m.close(); Pn.settings(); } })));
      body.append(h('p', { class: 'hint', text: 'Projetos salvos neste navegador. O navegador pode apagar dados locais se faltar espaço: faça backup com o pacote .smsp.' }));
      let list = []; try { list = await SMS.Store.list(); } catch (e) { UI.toast('Não foi possível ler os projetos: ' + e.message, 'err'); }
      list.forEach(p => body.append(h('div', { class: 'pcard' }, p.thumb ? h('img', { src: p.thumb, alt: '' }) : h('div', { style: { width: '48px', height: '64px' } }), h('div', { class: 'pi' }, h('b', { text: p.name + (p.id === S.project.id ? ' (aberto)' : '') }), h('small', { text: new Date(p.updated).toLocaleString('pt-BR') })), UI.btn({ label: 'Abrir', cls: 'sm', on: () => open(() => SMS.Store.open(p.id)) }), UI.btn({ icon: 'del', cls: 'sm danger', title: 'Excluir projeto', on: async () => { if (await UI.confirm('Excluir o projeto "' + p.name + '" deste navegador?', 'Excluir', true)) { await SMS.Store.remove(p.id); draw(); } } }))));
      if (!list.length) body.append(h('p', { class: 'hint', text: 'Nenhum projeto salvo ainda. Use o botão Salvar.' }));
    };
    draw();
  };

  /* ---------- configurações ---------- */
  let installEvt = null; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
  Pn.settings = async () => {
    const body = h('div'), O = SMS.Stage.opts, m = UI.modal({ title: 'Configurações', body, wide: true });
    body.append(UI.sect('Interface', [
      h('div', { class: 'fld' }, h('label', { text: 'Grade (px)' }), h('input', { type: 'number', min: 5, max: 500, value: O.gridSize, onchange: (e) => { O.gridSize = SMS.clamp(Number(e.target.value) || 40, 5, 500); UI.setPref('gridSize', O.gridSize); SMS.Stage.invalidate(); } })),
      h('div', { class: 'fld' }, h('label', { text: 'Xadrez de transparência' }), h('select', { onchange: (e) => { UI.setPref('checker', Number(e.target.value)); document.documentElement.style.setProperty('--ck', e.target.value + 'px'); } }, [8, 16, 24, 32].map(v => h('option', { value: v, text: v + ' px', selected: v === UI.pref('checker', 16) })))),
      h('div', { class: 'fld' }, h('label', { text: 'Xadrez – cores' }), h('select', { onchange: (e) => { const c = e.target.value.split(','); document.documentElement.style.setProperty('--ck1', c[0]); document.documentElement.style.setProperty('--ck2', c[1]); UI.setPref('ckc', e.target.value); } }, [['#262626,#343434', 'Escuro'], ['#d9d9d9,#ffffff', 'Claro'], ['#555,#777', 'Médio']].map(a => h('option', { value: a[0], text: a[1], selected: a[0] === UI.pref('ckc', '#262626,#343434') }))))]));
    const st = h('div', { class: 'hint', text: 'Calculando…' }); const pbtn = UI.btn({ label: 'Pedir armazenamento persistente', cls: 'sm', on: async () => { const ok = await SMS.Store.requestPersist(); UI.toast(ok ? 'O navegador marcou os dados como persistentes.' : 'O navegador não concedeu persistência. Faça backups com o pacote .smsp.', ok ? 'ok' : 'warn'); } });
    body.append(UI.sect('Armazenamento local', [st, pbtn, h('div', { class: 'hint', text: 'Projetos, imagens, áudios, vídeos e fontes importados ficam no IndexedDB deste navegador/dispositivo. Limpar dados do site ou o modo anônimo apagam tudo: use Exportar pacote para backup.' })]));
    SMS.Store.estimate().then(e => { st.textContent = (e.memoryOnly ? '⚠ O navegador bloqueou o armazenamento: os dados só duram até fechar a página. ' : '') + (e.usage != null ? 'Em uso: ' + UI.fmtBytes(e.usage) + ' de ~' + UI.fmtBytes(e.quota) + '. ' : '') + (e.persisted != null ? (e.persisted ? 'Persistente.' : 'Não persistente.') : ''); });
    const sc = [['Espaço', 'Reproduzir / pausar'], [', e .', 'Quadro anterior / próximo (Shift = 1 s)'], ['Home / End', 'Início / fim'], ['Delete', 'Excluir'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+C / X / V / D', 'Copiar / recortar / colar / duplicar'], ['Ctrl+G · Shift+G', 'Agrupar · desagrupar'], ['Setas (Shift = 10 px)', 'Mover elemento'], ['S', 'Dividir clipe no cursor'], ['Ctrl+S', 'Salvar'], ['+ / − / 0', 'Zoom / ajustar'], ['Alt (arrastando)', 'Desliga o ímã']];
    body.append(UI.sect('Atalhos (teclado)', [h('table', { class: 'sc' }, ...sc.map(r => h('tr', null, h('td', null, h('span', { class: 'kbd', text: r[0] })), h('td', { text: r[1] }))))], true));
    const inst = installEvt ? UI.btn({ label: 'Instalar como aplicativo (PWA)', cls: 'sm', on: async () => { installEvt.prompt(); installEvt = null; } }) : h('div', { class: 'hint', text: 'Instalação PWA: disponível quando a página é servida por HTTPS (ou localhost) e o navegador oferece. No Chrome Android: menu ⋮ › Instalar app.' });
    body.append(UI.sect('Aplicativo / offline', [inst, h('div', { class: 'hint', text: 'Versão ' + SMS.cfg.version + '. Funciona offline depois do primeiro carregamento, se o Service Worker estiver ativo (HTTPS/localhost).' })], true));
    body.append(UI.sect('Licenças', [h('div', { class: 'hint', text: 'Sem bibliotecas externas: HTML, CSS e JavaScript puros. Ícones vetoriais: Material Icons (Apache License 2.0).' })], true));
  };

  /* ---------- exportar ---------- */
  Pn.exportDialog = () => {
    SMS.App.pause(); const P = S.project, fmts = X.formats(), ex = P.export, body = h('div'), m = UI.modal({ title: 'Exportar vídeo', body, dismiss: true, wide: false });
    if (!fmts.length) { body.append(h('div', { class: 'warn', text: 'Este navegador não consegue gravar vídeo (faltam MediaRecorder/captureStream). Use o Chrome ou Edge atualizado. Você ainda pode salvar o quadro atual como PNG.' })); }
    const fmt = h('select', null, [['auto', 'Automático (melhor disponível)']].concat(fmts.map(f => [f.id, f.label])).map(a => h('option', { value: a[0], text: a[1], selected: a[0] === ex.format })));
    const res = h('select', null, [480, 720, 1080, 1440, 2160].map(r => h('option', { value: r, text: r + 'p (lado menor)', selected: r === ex.res })));
    const q = h('select', null, [['baixa', 'Baixa (arquivo menor)'], ['media', 'Média'], ['alta', 'Alta'], ['maxima', 'Máxima']].map(a => h('option', { value: a[0], text: a[1], selected: a[0] === ex.quality })));
    const aud = h('input', { type: 'checkbox', checked: ex.audio }), tr = h('input', { type: 'checkbox', checked: ex.transparent }), rng = h('select', null, [['all', 'Projeto inteiro'], ['scene', 'Somente a cena atual']].map(a => h('option', { value: a[0], text: a[1] })));
    const info = h('div', { class: 'hint' }), warn = h('div'), hasAudio = SMS.Audio.has(P);
    const resolved = () => fmts.find(f => f.id === fmt.value) || fmts[0];
    const range = () => { const L = SMS.layout(), it = L.items[S.sceneIdx]; return rng.value === 'scene' ? { from: it.start, to: it.end } : { from: 0, to: L.total }; };
    const refresh = () => {
      const f = resolved(), r = range(), d = X.dims(P, Number(res.value)), dur = r.to - r.from; warn.textContent = '';
      aud.disabled = !hasAudio; tr.disabled = !(f && f.alpha);
      info.textContent = d.w + '×' + d.h + ' · ' + P.settings.fps + ' fps · ' + SMS.round(dur, 1) + ' s · ~' + SMS.round(X.estimateMB(P, { res: Number(res.value), quality: q.value }, dur), 1) + ' MB' + (f ? ' · ' + f.label : '') + (hasAudio ? '' : ' · sem áudio no projeto');
      const warns = []; if (/Android|iPhone|iPad/i.test(navigator.userAgent) && (Number(res.value) >= 1440 || dur > 120)) warns.push('Em celulares, resoluções acima de 1080p ou vídeos longos (mais de ~2 min) podem esgotar a memória. Se falhar, reduza a resolução.');
      if (f && f.id.startsWith('webm')) warns.push('WebM reproduz no Chrome, VLC e redes sociais modernas; alguns apps/galerias antigos preferem MP4.');
      if (tr.checked && f && f.alpha) warns.push('Fundo transparente: grava WebM com alfa (suporte depende do navegador e do reprodutor). Defina o fundo das cenas como transparente em Cena › Fundo.');
      warns.forEach(w => warn.append(h('div', { class: 'warn', text: w })));
    };
    [fmt, res, q, aud, tr, rng].forEach(c => c.addEventListener('change', refresh));
    const fl = (label, c) => h('div', { class: 'fld' }, h('label', { text: label }), c);
    body.append(fl('Formato', fmt), fl('Resolução', res), fl('Qualidade', q), fl('Intervalo', rng), fl('Incluir áudio', aud), fl('Fundo transparente', tr), info, warn,
      h('p', { class: 'hint', text: 'A exportação grava em tempo real (a duração do vídeo = tempo de espera). Mantenha esta aba em primeiro plano e a tela ligada. MP4 só aparece quando o navegador realmente grava MP4.' }));
    const start = h('button', { class: 'btn primary', type: 'button', text: '● Iniciar exportação', disabled: !fmts.length }), still = h('button', { class: 'btn', type: 'button', text: 'Salvar quadro atual (PNG)' });
    m.foot.hidden = false; m.foot.append(still, start);
    still.onclick = async () => { try { const b = await X.stillPNG(P, S.T, { res: Number(res.value), transparent: tr.checked }); SMS.download(b, SMS.fileBase(P.name) + '-quadro.png'); } catch (e) { UI.toast(e.message, 'err'); } };
    start.onclick = async () => {
      Object.assign(P.export, { format: fmt.value, res: Number(res.value), quality: q.value, audio: aud.checked, transparent: tr.checked }); SMS.touch();
      const r = range(), prog = h('div', { class: 'prog' }, h('i')), status = h('div', { class: 'hint', text: 'Preparando…' }), warns = h('div');
      body.textContent = ''; body.append(h('p', { text: 'Exportando… não troque de aba nem bloqueie a tela.' }), prog, status, warns); m.foot.textContent = '';
      SMS.exporting = true; SMS.Stage.invalidate(); let ctl;
      const cancel = h('button', { class: 'btn danger', type: 'button', text: 'Cancelar', onclick: () => ctl && ctl.cancel() }); m.foot.append(cancel);
      ctl = X.run(P, { format: fmt.value === 'auto' ? fmts[0].id : fmt.value, res: Number(res.value), quality: q.value, audio: aud.checked, transparent: tr.checked, from: r.from, to: r.to }, { progress: (p) => { prog.firstChild.style.width = Math.round(p * 100) + '%'; status.textContent = 'Renderizando… ' + Math.round(p * 100) + '%'; }, status: (s) => { status.textContent = s; }, warn: (w) => warns.append(h('div', { class: 'warn', text: w })) });
      try {
        const out = await ctl.promise; SMS.exporting = false; SMS.Stage.invalidate(); const url = URL.createObjectURL(out.blob);
        body.textContent = ''; body.append(h('p', { text: '✔ Vídeo pronto: ' + out.w + '×' + out.h + ' · ' + SMS.round(out.dur, 1) + ' s · ' + UI.fmtBytes(out.blob.size) + ' · ' + out.ext.toUpperCase() + (out.hasAudio ? ' · com áudio' : ' · sem áudio') }), h('video', { src: url, controls: true, playsinline: true, style: { width: '100%', maxHeight: '50vh', background: '#000', borderRadius: '8px' } }), h('p', { class: 'hint', text: 'Confira a reprodução acima antes de publicar.' }));
        m.foot.textContent = ''; m.foot.append(h('button', { class: 'btn', type: 'button', text: 'Fechar', onclick: () => { URL.revokeObjectURL(url); m.close(); } }), h('button', { class: 'btn primary', type: 'button', text: '⬇ Baixar vídeo', onclick: () => SMS.download(out.blob, SMS.fileBase(P.name) + '.' + out.ext) }));
      } catch (e) {
        SMS.exporting = false; SMS.Stage.invalidate(); M.pauseVideos();
        if (e.message === 'cancelado') { UI.toast('Exportação cancelada.'); m.close(); } else { body.textContent = ''; body.append(h('div', { class: 'warn', text: 'A exportação falhou: ' + e.message }), h('p', { class: 'hint', text: 'Tente uma resolução menor, outro formato ou feche outras abas.' })); m.foot.textContent = ''; m.foot.append(h('button', { class: 'btn', type: 'button', text: 'Fechar', onclick: () => m.close() })); }
      }
    };
    refresh();
  };

  /* ---------- remover fundo por cor ---------- */
  Pn.bgRemoveDialog = (el) => {
    const rec = M.get(el.mediaId); if (!rec) { UI.toast('Imagem não encontrada.', 'err'); return; }
    M.imageAsync(el.mediaId).then(img => {
      if (!img) { UI.toast('Não foi possível carregar a imagem.', 'err'); return; }
      const k = Math.min(1, 520 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), hh = Math.round(img.naturalHeight * k);
      const src = h('canvas', { width: w, height: hh }), sx = src.getContext('2d', { willReadFrequently: true }); sx.drawImage(img, 0, 0, w, hh); const orig = sx.getImageData(0, 0, w, hh);
      const view = h('canvas', { width: w, height: hh }), vx = view.getContext('2d');
      const br = el.bgRemove ? SMS.clone(el.bgRemove) : { color: rec.corner ? rec.corner.slice() : [255, 255, 255], tol: 20, soft: 6, mode: 'edge' };
      const sw = h('div', { style: { width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #444' } }); let rf = 0, show = true;
      const draw = () => { cancelAnimationFrame(rf); rf = requestAnimationFrame(() => { sw.style.background = 'rgb(' + br.color.join(',') + ')'; const d = new ImageData(new Uint8ClampedArray(orig.data), w, hh); vx.clearRect(0, 0, w, hh); vx.putImageData(show ? M.processBg(d, w, hh, br) : d, 0, 0); }); };
      view.addEventListener('pointerdown', (e) => { const r = view.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * w), y = Math.floor((e.clientY - r.top) / r.height * hh), i = (y * w + x) * 4; br.color = [orig.data[i], orig.data[i + 1], orig.data[i + 2]]; draw(); });
      const tol = UI.range({ label: 'Tolerância', min: 0, max: 80, get: () => br.tol, set: (v) => { br.tol = v; draw(); }, unit: '%' }), soft = UI.range({ label: 'Suavização', min: 0, max: 30, get: () => br.soft, set: (v) => { br.soft = v; draw(); }, unit: '%' }), mode = UI.select({ label: 'Modo', options: [['edge', 'Só fundo ligado às bordas (seguro)'], ['global', 'Todos os pixels dessa cor']], get: () => br.mode, set: (v) => { br.mode = v; draw(); } });
      [tol, soft, mode].forEach(f => f.update());
      const body = h('div', null, h('div', { class: 'hint', text: 'Toque na imagem para escolher a cor do fundo. O arquivo original não é alterado; dá para desfazer.' }), h('div', { class: 'bgprev' }, view), h('div', { class: 'fld' }, h('label', { text: 'Cor escolhida' }), sw), tol.el, soft.el, mode.el, h('div', { class: 'btnrow' }, UI.btn({ label: 'Cor do canto', cls: 'sm', disabled: !rec.corner, on: () => { br.color = rec.corner.slice(); draw(); } }), UI.btn({ label: 'Alternar antes/depois', cls: 'sm', on: () => { show = !show; draw(); } })), h('div', { class: 'hint', text: 'Este recurso remove uma cor. Não é remoção inteligente de qualquer fundo (isso exigiria um modelo de segmentação externo).' }));
      UI.modal({ title: 'Remover fundo por cor', body, wide: false, actions: [{ label: 'Cancelar' }, { label: 'Aplicar', primary: true, on: () => { el.bgRemove = { color: br.color.map(Math.round), tol: br.tol, soft: br.soft, mode: br.mode }; SMS.changed(); SMS.Props.buildProps(); } }] }); draw();
    });
  };

  /* ---------- barra superior ---------- */
  function buildTop() {
    const bar = $('topTools'), b = (o) => { const x = UI.btn(o); bar.append(x); return x; };
    b({ icon: 'folder', label: 'Projetos', title: 'Projetos: abrir, novo, importar', on: () => Pn.projects() });
    b({ icon: 'save', label: 'Salvar', title: 'Salvar (Ctrl+S)', on: () => SMS.App.save() });
    const un = b({ icon: 'undo', title: 'Desfazer (Ctrl+Z)', on: () => SMS.History.undo() }), re = b({ icon: 'redo', title: 'Refazer (Ctrl+Y)', on: () => SMS.History.redo() });
    b({ icon: 'settings', title: 'Configurações', cls: 'hide-m', on: () => Pn.settings() });
    b({ icon: 'movie', label: 'Exportar', title: 'Exportar vídeo', cls: 'primary', on: () => Pn.exportDialog() });
    const sync = () => { un.disabled = !SMS.History.canUndo(); re.disabled = !SMS.History.canRedo(); }; SMS.on('history', sync); sync();
    const nm = $('projName'); nm.addEventListener('input', () => { S.project.name = nm.value || 'Projeto sem título'; SMS.changed('pname'); });
  }

  Pn.init = () => {
    buildNav(); buildTop(); buildLayers(); buildLib();
    const lay = SMS.debounce(buildLayers, 0); let t = 0;
    ['selection', 'scene', 'project:loaded', 'project:restored'].forEach(n => SMS.on(n, buildLayers));
    SMS.on('change', () => { if (!t) t = requestAnimationFrame(() => { t = 0; const a = document.activeElement; if (!$('pLayers').contains(a) || a.tagName === 'BODY') buildLayers(); }); });
    SMS.on('media:changed', () => { buildLib(); buildLayers(); }); SMS.on('components', () => { if (Lib.tab === 'comp') buildLib(); }); SMS.on('project:loaded', buildLib);
    SMS.on('project:loaded', () => { $('projName').value = S.project.name; });
    window.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); Pn.importAndAdd(e.dataTransfer.files); } });
  };
})();
