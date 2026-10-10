/* Biblioteca de mídia: importação segura (SVG sanitizado), IndexedDB, miniaturas, vídeos, fontes,
   remoção de fundo por cor (não destrutiva) e forma de onda de áudio. Nada é enviado a servidores. */
(function () {
  'use strict';
  const SMS = window.SMS;
  const M = SMS.Media = { items: new Map(), res: new Map(), videos: new Map(), urls: new Map(), derivedCache: new Map(), peaksCache: new Map() };
  const EXT = {
    image: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif'], audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'flac', 'weba'],
    video: ['mp4', 'webm', 'mov', 'm4v', 'ogv'], font: ['ttf', 'otf', 'woff', 'woff2']
  };
  M.ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,.gif,.avif,.mp3,.wav,.ogg,.m4a,.aac,.opus,.flac,.mp4,.webm,.mov,.m4v,.ttf,.otf,.woff,.woff2,image/*,audio/*,video/*';
  M.kindOf = (f) => {
    const ext = (String(f.name || '').split('.').pop() || '').toLowerCase(), t = String(f.type || '');
    if (t.startsWith('image/') || EXT.image.includes(ext)) return 'image';
    if (t.startsWith('audio/') || EXT.audio.includes(ext)) return 'audio';
    if (t.startsWith('video/') || EXT.video.includes(ext)) return 'video';
    if (t.startsWith('font/') || EXT.font.includes(ext)) return 'font';
    return null;
  };

  /* ---------- SVG seguro ---------- */
  M.sanitizeSvg = (text) => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName.toLowerCase() !== 'svg') throw new Error('SVG inválido ou corrompido.');
    const bad = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'animate', 'set', 'animatetransform', 'animatemotion', 'handler', 'listener'];
    const urlBad = /url\(\s*['"]?\s*[^#'"\s)]/i;
    doc.querySelectorAll('*').forEach(el => {
      const n = el.localName.toLowerCase();
      if (bad.includes(n)) { el.remove(); return; }
      if (n === 'style' && (urlBad.test(el.textContent) || /@import/i.test(el.textContent))) { el.textContent = el.textContent.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*['"]?\s*[^#'"\s)][^)]*\)/gi, 'none'); }
      Array.from(el.attributes).forEach(a => {
        const an = a.name.toLowerCase(), v = a.value.trim();
        if (an.startsWith('on')) el.removeAttribute(a.name);
        else if ((an === 'href' || an === 'xlink:href') && !/^#|^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v)) el.removeAttribute(a.name);
        else if ((urlBad.test(v) || /javascript:|expression\(/i.test(v))) el.removeAttribute(a.name);
      });
    });
    const root = doc.documentElement; root.removeAttribute('onload');
    if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    let vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number), w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
    if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) { if (!(w > 0 && /^[\d.]+(px)?$/.test(root.getAttribute('width') || ''))) w = vb[2]; if (!(h > 0 && /^[\d.]+(px)?$/.test(root.getAttribute('height') || ''))) h = vb[3]; }
    else { if (!(w > 0)) w = 512; if (!(h > 0)) h = 512; root.setAttribute('viewBox', '0 0 ' + w + ' ' + h); }
    const k = Math.max(1, 1024 / Math.max(w, h)); root.setAttribute('width', String(Math.round(w * k))); root.setAttribute('height', String(Math.round(h * k)));
    return new XMLSerializer().serializeToString(doc);
  };

  /* ---------- carregamento ---------- */
  const loadImg = (blob) => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível decodificar a imagem.')); };
    im.src = url;
  });
  function analyzeImage(img) {
    try {
      const k = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data; let tr = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 250) tr++;
      const px = (cx, cy) => { const i = (cy * w + cx) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
      const cs = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
      const opaque = cs.every(c => c[3] > 250), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const uniform = opaque && cs.every(c => dist(c, cs[0]) < 24);
      return { hasAlpha: tr > w * h * 0.002, corner: uniform ? cs[0].slice(0, 3) : null };
    } catch (e) { return { hasAlpha: false, corner: null }; }
  }
  const probeAudio = (blob) => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), a = new Audio(); a.preload = 'metadata';
    const done = (f, v) => { URL.revokeObjectURL(url); f(v); };
    a.onloadedmetadata = () => done(res, Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => done(rej, new Error('Formato de áudio não suportado por este navegador.'));
    a.src = url; setTimeout(() => done(rej, new Error('Tempo esgotado ao ler o áudio.')), 15000);
  });
  const probeVideo = (blob) => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
    const fin = (f, val) => { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); f(val); };
    v.onerror = () => fin(rej, new Error('Vídeo não suportado por este navegador (codec incompatível). Tente MP4 H.264 ou WebM.'));
    v.onloadedmetadata = () => {
      if (!v.videoWidth) return fin(rej, new Error('O arquivo não tem imagem de vídeo reproduzível neste navegador.'));
      try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); } catch (e) { /* ignora */ }
    };
    v.onseeked = () => {
      let poster = null;
      try { const c = document.createElement('canvas'), k = 160 / Math.max(v.videoWidth, v.videoHeight); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); poster = c.toDataURL('image/jpeg', 0.7); } catch (e) { /* ignora */ }
      fin(res, { w: v.videoWidth, h: v.videoHeight, duration: v.duration || 0, poster });
    };
    v.src = url; setTimeout(() => fin(rej, new Error('Tempo esgotado ao ler o vídeo.')), 20000);
  });
  const fontFamily = (id) => 'SMSF_' + id.replace(/[^a-z0-9]/gi, '');
  async function registerFont(rec) {
    const buf = await rec.blob.arrayBuffer(), ff = new FontFace(rec.family, buf);
    await ff.load(); document.fonts.add(ff);
  }

  async function buildRecord(file, opts, forceId) {
    const kind = M.kindOf(file), name = SMS.safeName(file.name);
    if (!kind) throw new Error('Formato não suportado' + (file.type ? ' (' + file.type + ')' : '') + '. Use PNG, JPG, WebP, SVG, MP3/WAV/OGG/M4A, MP4/WebM, TTF/OTF/WOFF.');
    const lim = (SMS.cfg.maxImportMB || {})[kind] || 50;
    if (file.size > lim * 1048576) throw new Error('Arquivo grande demais (' + (file.size / 1048576).toFixed(1) + ' MB). Limite para ' + kind + ': ' + lim + ' MB.');
    if (!file.size) throw new Error('Arquivo vazio.');
    let blob = file; const rec = { id: forceId || SMS.uid('m'), name, kind, mime: file.type || '', size: file.size, created: Date.now(), logo: !!(opts && opts.logo) };
    if (kind === 'image') {
      const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(name);
      if (isSvg) { blob = new Blob([M.sanitizeSvg(await file.text())], { type: 'image/svg+xml' }); rec.mime = 'image/svg+xml'; rec.size = blob.size; }
      const im = await loadImg(blob); rec.w = im.naturalWidth || 512; rec.h = im.naturalHeight || 512;
      Object.assign(rec, analyzeImage(im)); if (isSvg) rec.hasAlpha = true;
    } else if (kind === 'audio') { rec.duration = await probeAudio(file); }
    else if (kind === 'video') { Object.assign(rec, await probeVideo(file)); }
    else if (kind === 'font') { rec.family = fontFamily(rec.id); rec.blob = blob; await registerFont(rec); }
    rec.blob = blob;
    return rec;
  }
  const quotaMsg = (e) => /quota|full|space/i.test(String(e && (e.name + e.message))) ? 'Sem espaço no armazenamento local do navegador. Remova mídias ou exporte um pacote de backup.' : null;
  M.put = async (rec) => {
    try { await SMS.db.put('media', rec); } catch (e) { throw new Error(quotaMsg(e) || 'Falha ao gravar a mídia no navegador.'); }
    M.items.set(rec.id, rec); SMS.emit('media:changed', rec.id);
    if (rec.kind === 'audio' && SMS.Audio) SMS.Audio.buffer(rec.id).then(() => M.peaks(rec.id)).catch(() => {});
    return rec;
  };
  M.importFiles = async (files, opts) => {
    const ok = [], errors = [];
    for (const f of Array.from(files)) {
      try { ok.push(await M.put(await buildRecord(f, opts))); } catch (e) { errors.push({ name: SMS.safeName(f.name), msg: e.message || String(e) }); }
    }
    return { ok, errors };
  };
  /* Substitui o arquivo mantendo o mesmo id (propriedades dos elementos continuam). Também serve para religar mídia ausente. */
  M.replaceBlob = async (id, file) => {
    const old = M.items.get(id), rec = await buildRecord(file, { logo: old && old.logo }, id);
    if (old) rec.name = old.name === rec.name ? rec.name : rec.name;
    M.drop(id, true); return M.put(rec);
  };
  M.importAs = async (file, id, opts) => M.put(await buildRecord(file, opts || {}, id));
  M.addFromDataUrl = async (id, dataUrl, name) => {
    const m = /^data:([^;,]+)[^,]*,/.exec(dataUrl); if (!m) throw new Error('Imagem embutida inválida.');
    const bin = await (await fetch(dataUrl)).blob();
    const f = new File([bin], name || 'imagem.png', { type: m[1] });
    return M.put(await buildRecord(f, {}, id));
  };
  M.drop = (id, keepItem) => {
    const u = M.urls.get(id); if (u) { URL.revokeObjectURL(u); M.urls.delete(id); }
    M.res.delete(id); M.peaksCache.delete(id);
    Array.from(M.derivedCache.keys()).forEach(k => { if (k.startsWith(id + '|')) M.derivedCache.delete(k); });
    if (SMS.Audio) SMS.Audio.forget(id);
    if (!keepItem) M.items.delete(id);
  };
  M.remove = async (id) => { M.drop(id); try { await SMS.db.del('media', id); } catch (e) { /* ignora */ } SMS.emit('media:changed', id); };
  M.url = (id) => {
    let u = M.urls.get(id); if (u) return u; const r = M.items.get(id); if (!r) return null;
    u = URL.createObjectURL(r.blob); M.urls.set(id, u); return u;
  };
  M.get = (id) => M.items.get(id) || null;
  M.list = (kind) => Array.from(M.items.values()).filter(r => !kind || r.kind === kind).sort((a, b) => b.created - a.created);
  M.load = async () => {
    let all = []; try { all = await SMS.db.all('media'); } catch (e) { all = []; }
    for (const r of all) {
      M.items.set(r.id, r);
      if (r.kind === 'font') { try { await registerFont(r); } catch (e) { console.warn('Fonte não registrada', r.name, e); } }
    }
    SMS.emit('media:changed');
  };
  M.usage = (id) => {
    let n = 0; const P = SMS.S.project; if (!P) return 0; const r = M.items.get(id);
    P.scenes.forEach(s => s.elements.forEach(e => { if (e.mediaId === id) n++; if (r && r.kind === 'font' && e.type === 'text' && e.font === r.family) n++; }));
    P.audio.forEach(a => { if (a.mediaId === id) n++; });
    return n;
  };
  M.missingIds = () => {
    const out = new Map(), P = SMS.S.project;
    P.scenes.forEach(s => s.elements.forEach(e => { if (e.mediaId && !M.items.has(e.mediaId)) out.set(e.mediaId, e.name); }));
    P.audio.forEach(a => { if (a.mediaId && !M.items.has(a.mediaId)) out.set(a.mediaId, a.name); });
    return Array.from(out, ([id, name]) => ({ id, name }));
  };
  M.fontList = () => SMS.FONTS_SYSTEM.map(f => ({ value: f, label: f })).concat(M.list('font').map(r => ({ value: r.family, label: r.name.replace(/\.[^.]+$/, '') + ' (importada)' })));

  /* ---------- imagens ---------- */
  M.image = (id) => {
    let r = M.res.get(id); if (r && r.img) return r.img; if (r && (r.loading || r.error)) return null;
    const rec = M.items.get(id); if (!rec || rec.kind !== 'image') return null;
    r = r || {}; r.loading = true; M.res.set(id, r);
    const im = new Image();
    im.onload = () => { r.img = im; r.loading = false; SMS.emit('media:loaded', id); };
    im.onerror = () => { r.error = true; r.loading = false; };
    im.src = M.url(id); return null;
  };
  M.imageAsync = (id) => new Promise(res => {
    const t0 = Date.now(), tick = () => {
      const im = M.image(id), r = M.res.get(id);
      if (im) return res(im); if (!r || r.error || Date.now() - t0 > 10000) return res(null); setTimeout(tick, 25);
    }; tick();
  });
  M.naturalSize = (id) => { const r = M.items.get(id); return r ? { w: r.w || 100, h: r.h || 100 } : null; };

  /* ---------- remoção de fundo por cor ---------- */
  M.processBg = (imgData, w, h, br) => {
    const d = imgData.data, c = br.color, tol = br.tol, soft = br.soft || 0, N = w * h, dist = new Float32Array(N);
    for (let i = 0, p = 0; i < N; i++, p += 4) dist[i] = Math.sqrt((d[p] - c[0]) * (d[p] - c[0]) + (d[p + 1] - c[1]) * (d[p + 1] - c[1]) + (d[p + 2] - c[2]) * (d[p + 2] - c[2])) / 441.673 * 100;
    if (br.mode === 'edge') {
      const seen = new Uint8Array(N), stack = new Int32Array(N); let sp = 0;
      const push = (i) => { if (!seen[i] && dist[i] <= tol) { seen[i] = 1; stack[sp++] = i; } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i / w) | 0;
        if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
      }
      for (let i = 0; i < N; i++) if (seen[i]) d[i * 4 + 3] = 0;
      if (soft > 0) for (let i = 0; i < N; i++) {
        if (seen[i]) continue; const x = i % w, y = (i / w) | 0;
        const nb = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (y > 0 && seen[i - w]) || (y < h - 1 && seen[i + w]);
        if (nb && dist[i] < tol + soft) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * SMS.clamp((dist[i] - tol) / soft, 0, 1));
      }
    } else {
      for (let i = 0; i < N; i++) {
        if (dist[i] <= tol) d[i * 4 + 3] = 0;
        else if (soft > 0 && dist[i] < tol + soft) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * (dist[i] - tol) / soft);
      }
    }
    return imgData;
  };
  M.derived = (id, br) => {
    if (!br || !br.color) return M.image(id);
    const key = id + '|' + [br.color.join(','), br.tol, br.soft || 0, br.mode].join('|');
    let c = M.derivedCache.get(key); if (c) return c;
    const src = M.image(id); if (!src) return null;
    const k = Math.min(1, 2048 / Math.max(src.naturalWidth, src.naturalHeight)), w = Math.max(1, Math.round(src.naturalWidth * k)), h = Math.max(1, Math.round(src.naturalHeight * k));
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    x.putImageData(M.processBg(x.getImageData(0, 0, w, h), w, h, br), 0, 0);
    if (M.derivedCache.size > 10) M.derivedCache.delete(M.derivedCache.keys().next().value);
    M.derivedCache.set(key, c); return c;
  };

  /* ---------- vídeo ---------- */
  M.video = (elId, mediaId) => {
    let v = M.videos.get(elId);
    if (v && v.__mid === mediaId) return v;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    const rec = M.items.get(mediaId); if (!rec || rec.kind !== 'video') return null;
    v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.__mid = mediaId;
    v.addEventListener('seeked', () => SMS.emit('media:frame')); v.addEventListener('loadeddata', () => SMS.emit('media:frame'));
    v.src = M.url(mediaId); M.videos.set(elId, v); return v;
  };
  M.syncVideo = (v, t, playing) => {
    if (!v.duration) return; t = SMS.clamp(t, 0, Math.max(0, v.duration - 0.05));
    if (playing) {
      if (Math.abs(v.currentTime - t) > 0.4 && !v.seeking) v.currentTime = t;
      if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - t) > 0.02 && !v.seeking) v.currentTime = t;
    }
  };
  M.pauseVideos = () => M.videos.forEach(v => { if (!v.paused) v.pause(); });
  M.gcVideos = () => {
    const live = new Set(); SMS.S.project.scenes.forEach(s => s.elements.forEach(e => { if (e.type === 'video') live.add(e.id); }));
    M.videos.forEach((v, id) => { if (!live.has(id)) { v.pause(); v.removeAttribute('src'); v.load(); M.videos.delete(id); } });
  };
  /* Pré-carrega tudo que o projeto usa (usado antes de exportar). */
  M.preload = async (project) => {
    const imgs = new Set(), vids = [];
    project.scenes.forEach(s => s.elements.forEach(e => {
      if (e.type === 'image' && e.mediaId) imgs.add(e.mediaId);
      if (e.type === 'video' && e.mediaId) vids.push(e);
    }));
    await Promise.all(Array.from(imgs).map(M.imageAsync));
    await Promise.all(vids.map(e => new Promise(res => {
      const v = M.video(e.id, e.mediaId); if (!v || v.readyState >= 2) return res();
      const t = setTimeout(res, 12000); v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true });
    })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  };

  /* ---------- forma de onda ---------- */
  M.peaks = (id) => {
    const c = M.peaksCache.get(id); if (c) return c.data || null;
    M.peaksCache.set(id, { data: null });
    if (!SMS.Audio) return null;
    SMS.Audio.buffer(id).then(buf => {
      if (!buf) return; const n = 1600, out = new Float32Array(n), ch = buf.numberOfChannels, len = buf.length, step = Math.max(1, Math.floor(len / n));
      for (let ci = 0; ci < ch; ci++) {
        const d = buf.getChannelData(ci);
        for (let i = 0; i < n; i++) { let m = 0; const s = i * step, e = Math.min(len, s + step); for (let j = s; j < e; j += Math.max(1, (step / 64) | 0)) { const a = Math.abs(d[j]); if (a > m) m = a; } if (m > out[i]) out[i] = m; }
      }
      M.peaksCache.set(id, { data: out }); SMS.emit('media:peaks', id);
    }).catch(() => {});
    return null;
  };
  M.dataUrlToBlob = async (u) => (await fetch(u)).blob();
})();
