/* Componentes de interface: ícones SVG, avisos, janelas, campos de formulário (sempre via DOM, nunca innerHTML com texto do usuário). */
(function () {
  'use strict';
  const SMS = window.SMS, h = SMS.h;
  const UI = SMS.UI = {};
  UI.MOBILE_Q = '(max-width:699px),(max-width:899px) and (orientation:portrait)';
  UI.isMobile = () => window.matchMedia(UI.MOBILE_Q).matches;

  const P = {
    play: 'M8 5v14l11-7z', pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', stop: 'M6 6h12v12H6z', prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z', next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    left: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z', right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
    undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
    redo: 'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z',
    save: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', del: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    eyeoff: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    unlock: 'M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z',
    cut: 'M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z',
    zin: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z',
    zout: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z',
    fit: 'M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z',
    full: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    grid: 'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z',
    hand: 'M13 24c-3.26 0-6.19-1.99-7.4-5.02l-3.03-7.61a1 1 0 0 1 .56-1.3c.5-.2 1.06-.04 1.38.4L6 13V4.5a1.5 1.5 0 0 1 3 0V11h1V2.5a1.5 1.5 0 0 1 3 0V11h1V3.5a1.5 1.5 0 0 1 3 0V11h1V6.5a1.5 1.5 0 0 1 3 0V17c0 3.87-3.13 7-7 7z',
    cursor: 'M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5z', layers: 'M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z',
    folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    timeline: 'M3 5h18v2H3zm0 6h12v2H3zm0 6h15v2H3z', anim: 'M12 2L22 12 12 22 2 12z', movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
    more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z', down: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z', up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
    loop: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    drag: 'M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V3H3z', clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    swap: 'M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z', dl: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z', check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
  };
  UI.svg = (name, cls) => {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', cls || 'ic'); p.setAttribute('d', P[name] || name); s.appendChild(p); return s;
  };
  UI.btn = (o) => {
    const b = h('button', { class: 'btn' + (o.cls ? ' ' + o.cls : ''), type: 'button', title: o.title || o.label || '', 'aria-label': o.title || o.label || '', onclick: o.on, disabled: o.disabled });
    if (o.icon) b.append(UI.svg(o.icon)); if (o.label) b.append(document.createTextNode(o.label)); if (o.icon && !o.label) b.classList.add('icon');
    return b;
  };

  /* ---------- avisos ---------- */
  UI.toast = (msg, type, ms) => {
    const box = document.getElementById('toasts'), t = h('div', { class: 'toast ' + (type === 'warn' ? '' : type || ''), role: 'status', text: msg });
    box.append(t); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), ms || (type === 'err' || type === 'warn' ? 7000 : 3200));
  };
  SMS.on('toast', (d) => UI.toast(d.msg, d.type));

  /* ---------- janelas ---------- */
  UI.modal = (o) => {
    const root = document.getElementById('modals'), prev = document.activeElement;
    const ov = h('div', { class: 'ov', onpointerdown: (e) => { if (e.target === ov && o.dismiss !== false) api.close(); } });
    const body = h('div', { class: 'mb' }, o.body), foot = h('footer');
    const box = h('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title }, h('header', null, h('span', { text: o.title }), UI.btn({ icon: 'del', title: 'Fechar', cls: 'sm', on: () => api.close() })), body, foot);
    (o.actions || []).forEach(a => foot.append(h('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), type: 'button', text: a.label, onclick: () => { const r = a.on ? a.on(api) : undefined; if (a.keep !== true && r !== false) api.close(); } })));
    if (!(o.actions || []).length) foot.hidden = true;
    ov.append(box); root.append(ov);
    const key = (e) => { if (e.key === 'Escape' && o.dismiss !== false) { e.stopPropagation(); api.close(); } };
    document.addEventListener('keydown', key, true);
    const api = { el: box, body, foot, close() { document.removeEventListener('keydown', key, true); ov.remove(); if (o.onClose) o.onClose(); try { if (prev && prev.focus) prev.focus(); } catch (e) { /* ok */ } } };
    const f = box.querySelector('input,select,textarea'); if (f && !UI.isMobile()) setTimeout(() => f.focus(), 30);
    return api;
  };
  UI.confirm = (msg, okLabel, danger) => new Promise(res => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    UI.modal({ title: 'Confirmar', body: h('p', { text: msg }), onClose: () => fin(false), actions: [{ label: 'Cancelar', on: () => fin(false) }, { label: okLabel || 'OK', primary: !danger, danger, on: () => fin(true) }] });
  });
  UI.ask = (title, label, value) => new Promise(res => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    const inp = h('input', { type: 'text', value: value || '', maxlength: 80, onkeydown: (e) => { if (e.key === 'Enter') { fin(inp.value.trim() || null); m.close(); } } });
    const m = UI.modal({ title, body: h('div', { class: 'fld full' }, h('label', { text: label }), inp), onClose: () => fin(null), actions: [{ label: 'Cancelar', on: () => fin(null) }, { label: 'OK', primary: true, on: () => fin(inp.value.trim() || null) }] });
  });
  UI.pickFiles = (accept, multiple) => new Promise(res => {
    const inp = document.getElementById('filePick'); inp.value = ''; inp.accept = accept || ''; inp.multiple = !!multiple;
    inp.onchange = () => { res(Array.from(inp.files || [])); inp.onchange = null; }; inp.click();
  });

  /* ---------- campos ---------- */
  /* Todos retornam {el, update()} — update() relê o valor do modelo (sem mexer no campo que está em edição). */
  const mk = (label, ctrl, extra, full) => h('div', { class: 'fld' + (full ? ' full' : '') }, label ? h('label', { text: label }) : null, ctrl, extra || null);
  const editing = (el) => document.activeElement === el;
  UI.num = (o) => {
    const inp = h('input', { type: 'number', inputmode: 'decimal', step: o.step || 1, min: o.min, max: o.max, 'aria-label': o.label });
    const el = mk(o.label, inp, o.extra);
    const f = { el, input: inp, update() { if (editing(inp)) return; const v = o.get(); if (v == null) { inp.value = ''; return; } inp.value = String(SMS.round(v, o.dp == null ? 2 : o.dp)); } };
    inp.addEventListener('input', () => { if (inp.value === '' || inp.value === '-') return; let v = Number(inp.value); if (!Number.isFinite(v)) return; if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); o.set(v); });
    inp.addEventListener('blur', () => f.update()); return f;
  };
  UI.range = (o) => {
    const inp = h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, 'aria-label': o.label }), out = h('span', { style: { fontSize: '11px', color: '#aaa', minWidth: '34px', textAlign: 'right' } });
    const el = mk(o.label, inp, o.extra || out);
    const f = { el, update() { const v = o.get(); if (!editing(inp)) inp.value = v; out.textContent = SMS.round(v, 2) + (o.unit || ''); } };
    inp.addEventListener('input', () => { o.set(Number(inp.value)); out.textContent = SMS.round(Number(inp.value), 2) + (o.unit || ''); }); return f;
  };
  UI.color = (o) => {
    const inp = h('input', { type: 'color', 'aria-label': o.label }), el = mk(o.label, inp, o.extra);
    const f = { el, update() { if (editing(inp)) return; const v = String(o.get() || '#000000'); inp.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'; } };
    inp.addEventListener('input', () => o.set(inp.value)); return f;
  };
  UI.select = (o) => {
    const s = h('select', { 'aria-label': o.label }); (o.options || []).forEach(op => s.append(h('option', { value: Array.isArray(op) ? op[0] : op.value, text: Array.isArray(op) ? op[1] : op.label })));
    const el = mk(o.label, s, o.extra, o.full);
    const f = { el, sel: s, update() { if (editing(s)) return; s.value = String(o.get()); }, setOptions(opts) { s.textContent = ''; opts.forEach(op => s.append(h('option', { value: op[0], text: op[1] }))); f.update(); } };
    s.addEventListener('change', () => o.set(s.value)); return f;
  };
  UI.check = (o) => {
    const inp = h('input', { type: 'checkbox', 'aria-label': o.label }), el = mk(o.label, inp, o.extra);
    const f = { el, update() { inp.checked = !!o.get(); } }; inp.addEventListener('change', () => o.set(inp.checked)); return f;
  };
  UI.text = (o) => {
    const inp = h('input', { type: 'text', maxLength: o.max || 120, 'aria-label': o.label }), el = mk(o.label, inp, o.extra, o.full);
    const f = { el, input: inp, update() { if (!editing(inp)) inp.value = o.get() == null ? '' : o.get(); } }; inp.addEventListener('input', () => o.set(inp.value)); return f;
  };
  UI.area = (o) => {
    const inp = h('textarea', { rows: o.rows || 3, maxLength: o.max || 600, 'aria-label': o.label });
    const el = mk(o.label, inp, null, true);
    const f = { el, input: inp, update() { if (!editing(inp)) inp.value = o.get() == null ? '' : o.get(); } }; inp.addEventListener('input', () => o.set(inp.value)); return f;
  };
  UI.sect = (title, children, closed, key) => {
    const body = h('div', { class: 'body' }, children), s = h('div', { class: 'sect' + (closed ? ' closed' : '') });
    const hd = h('h3', { onclick: () => { s.classList.toggle('closed'); }, text: title }); s.append(hd, body); return s;
  };
  UI.fmtBytes = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';

  /* preferências leves (por navegador) */
  UI.pref = (k, d) => { try { const v = localStorage.getItem('sms.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  UI.setPref = (k, v) => { try { localStorage.setItem('sms.' + k, JSON.stringify(v)); } catch (e) { /* bloqueado */ } };
})();
