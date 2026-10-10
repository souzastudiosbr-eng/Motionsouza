/* Motor de áudio (Web Audio): decodifica as mídias, agenda clipes na linha do tempo global,
   aplica volume por keyframes + fade-in/out, e alimenta tanto o preview quanto a exportação. */
(function () {
  'use strict';
  const SMS = window.SMS;
  const A = SMS.Audio = { ctx: null, bufs: new Map(), active: [], master: null };
  const AC = window.AudioContext || window.webkitAudioContext, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  A.supported = !!AC;
  A.ensure = () => {
    if (!AC) return null;
    if (!A.ctx) A.ctx = new AC();
    if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
    return A.ctx;
  };
  A.buffer = (id) => {
    if (A.bufs.has(id)) return A.bufs.get(id);
    const rec = SMS.Media.get(id);
    if (!rec || !OAC || (rec.kind !== 'audio' && rec.kind !== 'video')) return Promise.resolve(null);
    const p = rec.blob.arrayBuffer().then(ab => {
      const off = new OAC(2, 1, 44100);
      return new Promise((res, rej) => { const r = off.decodeAudioData(ab, res, rej); if (r && r.then) r.then(res, rej); });
    }).catch(() => null);
    A.bufs.set(id, p); return p;
  };
  A.forget = (id) => A.bufs.delete(id);

  /* Lista de clipes sonoros do projeto, em tempo global. */
  A.collect = (project) => {
    const out = [], L = SMS.computeLayout(project);
    project.audio.forEach(c => { if (c.mediaId) out.push({ it: c, mediaId: c.mediaId, gStart: c.start, dur: c.dur, off: c.offset || 0, muted: !!c.muted, fadeIn: c.fadeIn || 0, fadeOut: c.fadeOut || 0 }); });
    L.items.forEach(li => li.scene.elements.forEach(e => {
      if (e.type !== 'video' || !e.mediaId || e.visible === false) return;
      const end = SMS.effEnd(e, li.scene), dur = end - e.start; if (dur <= 0) return;
      out.push({ it: e, mediaId: e.mediaId, gStart: li.start + e.start, dur, off: e.trimIn || 0, muted: !!e.muted, fadeIn: 0, fadeOut: 0 });
    }));
    return out;
  };
  A.has = (project) => A.collect(project).length > 0;
  A.prepare = async (project) => {
    const bad = [];
    for (const c of A.collect(project)) { const b = await A.buffer(c.mediaId); if (!b) bad.push((SMS.Media.get(c.mediaId) || {}).name || c.mediaId); }
    return { unavailable: Array.from(new Set(bad)) };
  };
  A.stop = () => {
    A.active.forEach(n => { try { n.src.onended = null; n.src.stop(); } catch (e) { /* já parou */ } try { n.src.disconnect(); n.g.disconnect(); } catch (e) { /* ok */ } });
    A.active = [];
    if (A.master) { try { A.master.disconnect(); } catch (e) { /* ok */ } A.master = null; }
  };
  /* opts: dest (MediaStreamAudioDestinationNode), monitor (padrão true), lead (s), speed */
  A.start = (project, T0, opts) => {
    opts = opts || {}; A.stop();
    const ac = A.ensure(); if (!ac) return { startAt: 0 };
    const speed = opts.speed || 1, lead = opts.lead == null ? 0.08 : opts.lead, t0 = ac.currentTime + lead;
    if (speed !== 1) return { startAt: t0 };               // áudio só no preview em 1×
    const m = A.master = ac.createGain();
    if (opts.monitor !== false) m.connect(ac.destination);
    if (opts.dest) m.connect(opts.dest);
    for (const c of A.collect(project)) {
      const buf = A.bufs.get(c.mediaId); if (!buf) continue;
      const gEnd = c.gStart + c.dur; if (gEnd <= T0 + 1e-3) continue;
      buf.then(b => {
        if (!b || !A.master || A.master !== m) return;
        const into = Math.max(0, T0 - c.gStart), when = t0 + Math.max(0, c.gStart - T0);
        let srcOff = c.off + into, play = c.dur - into;
        play = Math.min(play, b.duration - srcOff); if (play <= 0.01) return;
        const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b;
        const n = Math.max(2, Math.ceil(play * 40) + 1), curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const lt = into + (i / (n - 1)) * play; let v = c.muted ? 0 : SMS.Anim.value(c.it, 'volume', lt, c.dur);
          if (c.fadeIn > 0) v *= Math.min(1, lt / c.fadeIn); if (c.fadeOut > 0) v *= Math.min(1, (c.dur - lt) / c.fadeOut);
          curve[i] = Math.max(0, v);
        }
        g.gain.setValueCurveAtTime(curve, when, play);
        src.connect(g); g.connect(m); src.start(when, srcOff, play);
        A.active.push({ src, g });
      });
    }
    return { startAt: t0 };
  };
})();
