/* Persistência: projetos no IndexedDB, recuperação automática, arquivos .json e pacotes .smsp (projeto + mídias). */
(function () {
  'use strict';
  const SMS = window.SMS, M = SMS.Media;
  const Store = SMS.Store = {};
  const MAGIC = 'SMSP1\n';

  function thumb(project) {
    try {
      const W = project.settings.width, H = project.settings.height, k = 120 / Math.max(W, H), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
      SMS.Render.frame(c.getContext('2d'), project, Math.min(0.8, SMS.computeLayout(project).total / 2), { scale: k });
      return c.toDataURL('image/jpeg', 0.6);
    } catch (e) { return null; }
  }
  Store.saveCurrent = async (asNew) => {
    const P = SMS.S.project;
    if (asNew) { P.id = SMS.uid('p'); P.created = Date.now(); }
    P.modified = Date.now();
    await SMS.db.put('projects', { id: P.id, name: P.name, json: JSON.stringify(P), updated: Date.now(), thumb: thumb(P) });
    SMS.S.dirty = false; await Store.autosaveNow(); SMS.emit('saved', P);
    return P;
  };
  Store.list = async () => (await SMS.db.all('projects')).sort((a, b) => b.updated - a.updated);
  Store.remove = (id) => SMS.db.del('projects', id);
  Store.open = async (id) => {
    const rec = await SMS.db.get('projects', id); if (!rec) throw new Error('Projeto não encontrado.');
    return Store.loadJSONText(rec.json);
  };
  Store.loadJSONText = async (text) => {
    let raw; try { raw = JSON.parse(text); } catch (e) { throw new Error('O arquivo não é um JSON válido: ' + e.message); }
    const r = SMS.migrate(raw);
    for (const pm of r.pendingMedia) { try { await M.addFromDataUrl(pm.id, pm.dataUrl, pm.name); } catch (e) { console.warn('Imagem antiga não importada', e); } }
    SMS.loadProject(r.project);
    const miss = M.missingIds();
    if (miss.length) SMS.emit('toast', { msg: miss.length + ' arquivo(s) de mídia ausente(s). Use Biblioteca › Mídias ausentes para religar.', type: 'warn' });
    return r.project;
  };
  Store.duplicateCurrent = async () => {
    const P = SMS.S.project; P.name = P.name + ' (cópia)'; await Store.saveCurrent(true); SMS.emit('project:loaded', {}); return P;
  };

  /* ---------- recuperação automática ---------- */
  let auto = 0;
  Store.autosaveNow = async () => {
    try { await SMS.db.put('meta', { id: 'autosave', json: JSON.stringify(SMS.S.project), updated: Date.now() }); } catch (e) { /* quota: ignora */ }
  };
  SMS.on('change', () => { clearTimeout(auto); auto = setTimeout(() => { if (SMS.S.dirty) Store.autosaveNow(); }, SMS.cfg.autosaveMs || 1500); });
  SMS.on('project:loaded', () => Store.autosaveNow());
  Store.recover = async () => {
    try {
      const rec = await SMS.db.get('meta', 'autosave'); if (!rec) return false;
      const r = SMS.migrate(JSON.parse(rec.json)); SMS.loadProject(r.project); return true;
    } catch (e) { console.warn('Recuperação falhou', e); return false; }
  };

  /* ---------- arquivos ---------- */
  Store.downloadJSON = () => {
    const P = SMS.S.project;
    SMS.download(new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' }), SMS.fileBase(P.name) + '.json');
  };
  Store.usedMediaIds = (P) => {
    const ids = new Set();
    P.scenes.forEach(s => s.elements.forEach(e => {
      if (e.mediaId) ids.add(e.mediaId);
      if (e.type === 'text' && e.font && String(e.font).startsWith('SMSF_')) M.list('font').forEach(r => { if (r.family === e.font) ids.add(r.id); });
    }));
    P.audio.forEach(a => a.mediaId && ids.add(a.mediaId));
    return Array.from(ids).filter(id => M.items.has(id));
  };
  Store.downloadPackage = () => {
    const P = SMS.S.project, metas = [], parts = []; let off = 0;
    Store.usedMediaIds(P).forEach(id => {
      const r = M.get(id), m = { id: r.id, name: r.name, kind: r.kind, mime: r.mime, size: r.size, w: r.w, h: r.h, duration: r.duration, hasAlpha: r.hasAlpha, logo: r.logo, family: r.family, poster: r.poster, offset: off, length: r.blob.size };
      metas.push(m); parts.push(r.blob); off += r.blob.size;
    });
    const head = new TextEncoder().encode(JSON.stringify({ format: 1, project: P, media: metas })), len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, head.length, true);
    SMS.download(new Blob([MAGIC, len, head].concat(parts), { type: 'application/octet-stream' }), SMS.fileBase(P.name) + '.smsp');
    return metas.length;
  };
  Store.openFile = async (file) => {
    const first = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer());
    if (new TextDecoder().decode(first) === MAGIC) {
      const dv = new DataView(await file.slice(MAGIC.length, MAGIC.length + 4).arrayBuffer()), hl = dv.getUint32(0, true), start = MAGIC.length + 4;
      if (hl > 50 * 1048576) throw new Error('Pacote corrompido (cabeçalho grande demais).');
      let head; try { head = JSON.parse(await file.slice(start, start + hl).text()); } catch (e) { throw new Error('Pacote corrompido: cabeçalho ilegível.'); }
      const data = start + hl, errs = [];
      for (const m of head.media || []) {
        if (M.items.has(m.id)) continue;
        try { const blob = file.slice(data + m.offset, data + m.offset + m.length, m.mime || ''); await M.importAs(new File([blob], m.name, { type: m.mime || '' }), m.id, { logo: m.logo }); }
        catch (e) { errs.push(m.name + ': ' + e.message); }
      }
      const r = SMS.migrate(head.project); SMS.loadProject(r.project);
      if (errs.length) SMS.emit('toast', { msg: 'Algumas mídias do pacote não puderam ser importadas: ' + errs.join(' | '), type: 'warn' });
      return r.project;
    }
    if (file.size > 60 * 1048576) throw new Error('Arquivo grande demais para ser um projeto JSON.');
    return Store.loadJSONText(await file.text());
  };
  Store.estimate = async () => {
    const out = { usage: null, quota: null, persisted: null, memoryOnly: SMS.dbMemoryOnly };
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; } } catch (e) { /* ok */ }
    try { if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted(); } catch (e) { /* ok */ }
    return out;
  };
  Store.requestPersist = async () => { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } };
})();
