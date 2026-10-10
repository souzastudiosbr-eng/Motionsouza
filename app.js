/* App: reprodução, atalhos de teclado, inicialização e PWA. */
(function () {
  'use strict';
  const SMS = window.SMS, S = SMS.S, $ = (id) => document.getElementById(id);
  const A = SMS.App = {};
  let raf = 0, wall0 = 0, T0 = 0, until = null, restoreAfter = null;

  function tick(now) {
    if (!S.playing) return;
    raf = requestAnimationFrame(tick);
    let T = T0 + (now - wall0) / 1000 * S.speed;
    const total = SMS.total();
    if (until != null && T >= until) {
      A.pause(); SMS.setTime(until);
      if (restoreAfter != null) { SMS.setTime(restoreAfter); restoreAfter = null; }
      return;
    }
    if (T >= total) {
      if (S.loop && until == null) { A.play({ from: 0 }); return; }
      A.pause(); SMS.setTime(total); return;
    }
    SMS.setTime(T);
  }
  A.play = (o) => {
    o = o || {};
    cancelAnimationFrame(raf);
    if (o.from != null) SMS.setTime(o.from);
    else if (!o.until && S.T >= SMS.total() - 1e-3) SMS.setTime(0);
    until = o.until == null ? null : o.until;
    S.playing = true; T0 = S.T; wall0 = performance.now();
    if (SMS.Audio.has(S.project)) {
      SMS.Audio.ensure();
      SMS.Audio.prepare(S.project).then(r => {
        if (!S.playing) return;
        if (r.unavailable.length) SMS.emit('toast', { msg: 'Sem áudio (não decodificado): ' + r.unavailable.join(', '), kind: 'warn' });
        T0 = S.T; wall0 = performance.now();
        SMS.Audio.start(S.project, S.T, { speed: S.speed });
      });
    }
    if (SMS.Timeline.updateTransport) SMS.Timeline.updateTransport();
    raf = requestAnimationFrame(tick);
  };
  A.pause = () => {
    if (!S.playing) return;
    S.playing = false; cancelAnimationFrame(raf);
    SMS.Audio.stop(); SMS.Media.pauseVideos(); SMS.Stage.invalidate();
    if (SMS.Timeline.updateTransport) SMS.Timeline.updateTransport();
  };
  A.toggle = () => { if (S.playing) A.pause(); else A.play(); };
  /* Toca um trecho [a,b]; se back, volta ao ponto original no fim. */
  A.playRange = (a, b, back) => {
    const orig = S.T; A.pause(); restoreAfter = back ? orig : null;
    A.play({ from: a, until: Math.min(b, SMS.total()) });
  };
  A.save = async () => {
    try { await SMS.Store.saveCurrent(); SMS.emit('toast', { msg: 'Projeto salvo neste navegador.' }); }
    catch (e) { SMS.emit('toast', { msg: 'Não foi possível salvar: ' + e.message, kind: 'error' }); }
  };

  /* ---------- atalhos ---------- */
  const typing = (e) => { const t = e.target || {}; return /INPUT|TEXTAREA|SELECT/.test(t.tagName || '') || t.isContentEditable; };
  function onKey(e) {
    if (document.querySelector('#modals .modal, #modals [role=dialog]')) return;
    if (typing(e)) return;
    const C = SMS.Cmd, k = e.key, mod = e.ctrlKey || e.metaKey, fr = 1 / SMS.fps();
    const done = () => { e.preventDefault(); };
    if (mod) {
      switch (k.toLowerCase()) {
        case 'z': done(); e.shiftKey ? SMS.History.redo() : SMS.History.undo(); return;
        case 'y': done(); SMS.History.redo(); return;
        case 'c': done(); C.copy(); return;
        case 'x': done(); C.cut(); return;
        case 'v': done(); C.paste(); return;
        case 'd': done(); C.duplicateSel(); return;
        case 'a': done(); SMS.setSelection(SMS.scene().elements.map(x => x.id)); return;
        case 's': done(); A.save(); return;
        case 'g': done(); e.shiftKey ? C.ungroup() : C.group(); return;
      }
      return;
    }
    switch (k) {
      case ' ': if (e.target && e.target.tagName === 'BUTTON') return; done(); A.toggle(); break;
      case ',': done(); A.pause(); SMS.setTime(S.T - fr); break;
      case '.': done(); A.pause(); SMS.setTime(S.T + fr); break;
      case 'Home': done(); A.pause(); SMS.setTime(0); break;
      case 'End': done(); A.pause(); SMS.setTime(SMS.total()); break;
      case 'Delete': case 'Backspace': done(); C.deleteSel(); break;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        if (!S.sel.length) return; done(); const n = e.shiftKey ? 10 : 1;
        C.nudge(k === 'ArrowLeft' ? -n : k === 'ArrowRight' ? n : 0, k === 'ArrowUp' ? -n : k === 'ArrowDown' ? n : 0); break;
      }
      case 's': case 'S': done(); C.split(); break;
      case '+': case '=': done(); SMS.Stage.zoomTo(SMS.Stage.view.zoom * 1.2); break;
      case '-': done(); SMS.Stage.zoomTo(SMS.Stage.view.zoom / 1.2); break;
      case '0': done(); SMS.Stage.fit(); break;
      case 'Escape': SMS.setSelection([]); break;
    }
  }

  /* ---------- inicialização ---------- */
  async function start() {
    const boot = $('boot');
    try {
      await SMS.db.ready();
      await SMS.Media.load();
      let ok = false;
      try { ok = await SMS.Store.recover(); } catch (e) { ok = false; }
      if (!ok) {
        const t = SMS.TEMPLATES.find(x => x.id === 'souza') || SMS.TEMPLATES[0];
        SMS.loadProject(SMS.buildTemplate(t));
      }
      $('app').hidden = false;
      SMS.Stage.init(); SMS.Timeline.init(); SMS.Props.init(); SMS.Panels.init();
      $('projName').value = S.project.name;
      SMS.History.reset(); SMS.emit('selection', {}); SMS.emit('change');
      SMS.Panels.show('layers');
      SMS.Timeline.fit(); requestAnimationFrame(() => requestAnimationFrame(() => { SMS.Stage.layout(); SMS.Stage.fit(); }));
      SMS.setTime(Math.min(2.2, SMS.total() * 0.6));
      SMS.Media.preload && SMS.Media.preload(S.project);
      if (SMS.dbMemoryOnly) SMS.emit('toast', { msg: 'Armazenamento do navegador indisponível: salve o projeto em arquivo.', kind: 'warn' });
      if (boot) boot.remove();
      document.addEventListener('keydown', onKey);
      const flush = () => { if (S.dirty) SMS.Store.autosaveNow(); };
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.hidden) { flush(); if (S.playing && !SMS.exporting) A.pause(); } });
      window.addEventListener('beforeunload', (e) => { if (S.dirty && SMS.dbMemoryOnly) { e.preventDefault(); e.returnValue = ''; } });
      $('projName').addEventListener('change', (e) => { S.project.name = e.target.value.trim().slice(0, 80) || 'Projeto'; SMS.changed('name'); });
      if (SMS.cfg.registerServiceWorker && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('sw.js').catch(() => { /* PWA opcional */ });
      }
      SMS.ready = true; SMS.emit('ready');
    } catch (err) {
      console.error(err);
      if (boot) { boot.textContent = ''; boot.append(SMS.h('div', { text: 'Erro ao iniciar: ' + err.message }), SMS.h('button', { type: 'button', text: 'Limpar dados locais e recarregar', onclick: async () => { try { await SMS.db.clear('meta'); } catch (e) { /* ok */ } location.reload(); } })); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
