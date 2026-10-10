/* Exportação de vídeo: renderiza quadro a quadro no canvas (mesmo renderizador do preview) e grava com
   MediaRecorder (codificador nativo do navegador). MP4 só é oferecido quando o navegador realmente
   consegue gravar MP4; nunca renomeamos WebM para .mp4. A gravação é em tempo real. */
(function () {
  'use strict';
  const SMS = window.SMS, X = SMS.Exporter = {};
  const CAND = [
    { id: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', alpha: false, mimes: ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'] },
    { id: 'webm-vp9', label: 'WebM (VP9)', ext: 'webm', alpha: true, mimes: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9'] },
    { id: 'webm-vp8', label: 'WebM (VP8)', ext: 'webm', alpha: true, mimes: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8'] },
    { id: 'webm', label: 'WebM (padrão do navegador)', ext: 'webm', alpha: false, mimes: ['video/webm'] }
  ];
  X.supported = () => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  X.formats = () => {
    if (!X.supported()) return [];
    return CAND.map(c => ({ id: c.id, label: c.label, ext: c.ext, alpha: c.alpha, mimeAudio: c.mimes.find(m => /(opus|mp4a)/.test(m) && MediaRecorder.isTypeSupported(m)) || null, mimeVideo: c.mimes.find(m => !/(opus|mp4a)/.test(m) && MediaRecorder.isTypeSupported(m)) || null }))
      .filter(f => f.mimeAudio || f.mimeVideo);
  };
  X.dims = (project, res) => {
    const W = project.settings.width, H = project.settings.height, k = res / Math.min(W, H), even = (n) => Math.max(2, Math.round(n / 2) * 2);
    return { w: even(W * k), h: even(H * k) };
  };
  const BPP = { baixa: 0.04, media: 0.07, alta: 0.12, maxima: 0.2 };
  X.bitrate = (w, h, fps, q) => SMS.clamp(w * h * fps * (BPP[q] || BPP.media), 1.2e6, 50e6);
  X.estimateMB = (project, o, dur) => { const d = X.dims(project, o.res); return X.bitrate(d.w, d.h, project.settings.fps, o.quality) * dur / 8 / 1048576; };
  X.stillPNG = (project, t, o) => new Promise((res, rej) => {
    const d = X.dims(project, (o && o.res) || 1080), c = document.createElement('canvas'); c.width = d.w; c.height = d.h;
    SMS.Render.frame(c.getContext('2d'), project, t, { scale: d.w / project.settings.width, transparent: !!(o && o.transparent) });
    c.toBlob(b => b ? res(b) : rej(new Error('Não foi possível gerar a imagem.')), 'image/png');
  });

  /* ---- grava a duração no WebM (o MediaRecorder do Chrome não escreve), para players mostrarem a duração ---- */
  async function fixWebmDuration(blob, durMs) {
    const buf = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
    const vint = (p, keep) => { const b = buf[p]; let l = 1, m = 0x80; while (l <= 8 && !(b & m)) { l++; m >>= 1; } if (l > 8) return null; let v = keep ? b : b & (m - 1); for (let i = 1; i < l; i++) v = v * 256 + buf[p + i]; return { v, l, unknown: !keep && (b & (m - 1)) === m - 1 && buf.slice(p + 1, p + l).every(x => x === 255) }; };
    let p = 0; const id0 = vint(p, true); if (!id0 || id0.v !== 0x1A45DFA3) return blob;
    const s0 = vint(p + id0.l); p += id0.l + s0.l + s0.v;
    const seg = vint(p, true); if (!seg || seg.v !== 0x18538067) return blob;
    const ss = vint(p + seg.l); if (!ss || !ss.unknown) return blob;
    p += seg.l + ss.l;
    while (p < buf.length - 16) {
      const id = vint(p, true), sz = vint(p + id.l); if (!id || !sz || sz.unknown) return blob;
      if (id.v === 0x114D9B74 || id.v === 0x1F43B675) return blob;      // SeekHead (offsets) ou Cluster antes do Info: não mexe
      if (id.v === 0x1549A966) {
        const ds = p + id.l + sz.l, de = ds + sz.v; if (de > buf.length) return blob;
        let q = ds, scale = 1e6;
        while (q < de) { const cid = vint(q, true), cs = vint(q + cid.l); if (cid.v === 0x4489) return blob; if (cid.v === 0x2AD7B1) { let n = 0; for (let i = 0; i < cs.v; i++) n = n * 256 + buf[q + cid.l + cs.l + i]; scale = n; } q += cid.l + cs.l + cs.v; }
        const dur = new Uint8Array(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88; new DataView(dur.buffer).setFloat64(3, durMs * 1e6 / scale, false);
        const nsz = sz.v + 11; if (nsz >= Math.pow(2, 7 * sz.l) - 1) return blob;
        const sb = new Uint8Array(sz.l); let t = nsz; for (let i = sz.l - 1; i >= 0; i--) { sb[i] = t % 256; t = Math.floor(t / 256); } sb[0] |= 0x80 >> (sz.l - 1);
        return new Blob([blob.slice(0, p + id.l), sb, blob.slice(ds, de), dur, blob.slice(de)], { type: blob.type });
      }
      p += id.l + sz.l + sz.v;
    }
    return blob;
  }

  /* ---- exportação ---- */
  X.run = (project, o, hooks) => {
    hooks = hooks || {};
    const ctl = { cancelled: false, cancel() { ctl.cancelled = true; if (ctl._stop) ctl._stop(); } };
    const say = (m) => hooks.status && hooks.status(m), prog = (p) => hooks.progress && hooks.progress(SMS.clamp(p, 0, 1));
    ctl.promise = (async () => {
      if (!X.supported()) throw new Error('Este navegador não suporta gravação de vídeo (MediaRecorder/captureStream). Use o Chrome ou Edge atualizado.');
      const fmt = X.formats().find(f => f.id === o.format) || X.formats()[0];
      if (!fmt) throw new Error('Nenhum formato de vídeo gravável foi encontrado neste navegador.');
      const L = SMS.computeLayout(project), from = SMS.clamp(o.from || 0, 0, L.total), to = SMS.clamp(o.to == null ? L.total : o.to, from, L.total), dur = to - from;
      if (dur < 0.1) throw new Error('Duração do vídeo é zero. Adicione conteúdo ou aumente a duração das cenas.');
      const fps = project.settings.fps, d = X.dims(project, o.res), scale = d.w / project.settings.width;
      say('Carregando mídias…'); await SMS.Media.preload(project);
      if (ctl.cancelled) throw new Error('cancelado');
      let dest = null, hasAudio = false;
      if (o.audio && SMS.Audio.supported && SMS.Audio.has(project)) {
        say('Preparando áudio…'); const pr = await SMS.Audio.prepare(project);
        if (pr.unavailable.length) hooks.warn && hooks.warn('Sem áudio (formato não decodificável): ' + pr.unavailable.join(', '));
        const ac = SMS.Audio.ensure(); if (ac) { dest = ac.createMediaStreamDestination(); hasAudio = true; }
      }
      const mime = (hasAudio && fmt.mimeAudio) || fmt.mimeVideo || fmt.mimeAudio;
      const canvas = document.createElement('canvas'); canvas.width = d.w; canvas.height = d.h;
      const ctx = canvas.getContext('2d', { alpha: true }), opt = { scale, playing: true, placeholders: false, transparent: !!(o.transparent && fmt.alpha), layout: L };
      const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0], manual = !!(track && track.requestFrame);
      const vstream = manual ? stream : canvas.captureStream(fps);
      if (dest) dest.stream.getAudioTracks().forEach(t => vstream.addTrack(t));
      const rec = new MediaRecorder(vstream, { mimeType: mime, videoBitsPerSecond: Math.round(X.bitrate(d.w, d.h, fps, o.quality)), audioBitsPerSecond: 192000 });
      const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      let wake = null; try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* opcional */ }
      return await new Promise((resolve, reject) => {
        let raf = 0, done = false, paused = false, pausedAt = 0, lastFrame = -1e9, clockStart = 0, lead = 0.15;
        const cleanup = () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); SMS.Audio.stop(); SMS.Media.pauseVideos(); try { vstream.getTracks().forEach(t => t.stop()); } catch (e) { /* ok */ } if (wake) { try { wake.release(); } catch (e) { /* ok */ } } };
        const draw = (t) => { SMS.Render.frame(ctx, project, t, opt); if (manual) track.requestFrame(); };
        const onVis = () => {
          if (done) return;
          if (document.hidden && !paused) { paused = true; pausedAt = performance.now(); try { rec.pause(); } catch (e) { /* ok */ } if (SMS.Audio.ctx) SMS.Audio.ctx.suspend(); SMS.Media.pauseVideos(); say('Exportação pausada: volte para esta aba para continuar.'); }
          else if (!document.hidden && paused) { paused = false; clockStart += performance.now() - pausedAt; try { rec.resume(); } catch (e) { /* ok */ } if (SMS.Audio.ctx) SMS.Audio.ctx.resume(); say('Renderizando…'); }
        };
        document.addEventListener('visibilitychange', onVis);
        ctl._stop = () => { if (done) return; done = true; rec.onstop = null; try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { /* ok */ } cleanup(); reject(new Error('cancelado')); };
        rec.onerror = (e) => { if (done) return; done = true; cleanup(); reject(new Error('O codificador do navegador falhou: ' + ((e.error && e.error.message) || 'erro desconhecido'))); };
        rec.onstop = async () => {
          cleanup();
          let blob = new Blob(chunks, { type: (mime || '').split(';')[0] });
          if (!blob.size) return reject(new Error('A gravação ficou vazia.'));
          if (fmt.ext === 'webm') { try { blob = await fixWebmDuration(blob, dur * 1000); } catch (e) { /* mantém original */ } }
          resolve({ blob, ext: fmt.ext, mime: blob.type, w: d.w, h: d.h, dur, hasAudio });
        };
        draw(from); rec.start(500); say('Renderizando…');
        const started = hasAudio ? SMS.Audio.start(project, from, { dest, monitor: false, lead }) : null;
        clockStart = performance.now() + (hasAudio ? lead * 1000 : 0);
        const finish = () => { if (done) return; done = true; draw(to); setTimeout(() => { try { rec.stop(); } catch (e) { reject(e); } }, 300); prog(1); };
        const tick = (now) => {
          if (done) return;
          if (paused) { raf = requestAnimationFrame(tick); return; }
          const el = Math.max(0, (now - clockStart) / 1000);
          if (now - lastFrame >= 1000 / fps - 4) { draw(Math.min(to, from + el)); lastFrame = now; }
          prog(el / dur);
          if (el >= dur) return finish();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    })();
    return ctl;
  };
})();
