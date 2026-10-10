/* Templates publicitários 100% editáveis. Cada um gera um projeto normal (camadas, keyframes, cenas)
   a partir dos campos do formulário; depois de criado, tudo pode ser alterado no editor.
   Nenhum dado da Souza Studios é embutido, exceto o template "Souza Studios (identidade inicial)". */
(function () {
  'use strict';
  const SMS = window.SMS, A = SMS.Anim, M = SMS.Media;

  SMS.TPL_FIELDS = [
    { k: 'brand', label: 'Nome da marca / empresa' }, { k: 'headline', label: 'Título principal' }, { k: 'sub', label: 'Subtítulo' },
    { k: 'cta', label: 'Chamada de ação' }, { k: 'contact', label: 'Contato / site / @' }, { k: 'extra', label: 'Destaque (preço, data, lista com | …)' },
    { k: 'c1', label: 'Cor de destaque', type: 'color' }, { k: 'c2', label: 'Cor de fundo', type: 'color' }, { k: 'c3', label: 'Cor do texto', type: 'color' },
    { k: 'logo', label: 'Logotipo (opcional, PNG transparente recomendado)', type: 'file' }
  ];
  const DEF = { brand: 'SUA MARCA', headline: 'Título que chama atenção', sub: 'Uma frase curta que explica a proposta.', cta: 'SAIBA MAIS', contact: 'www.seusite.com.br', extra: 'Qualidade|Agilidade|Resultado', c1: '#ffd400', c2: '#0b0b0b', c3: '#ffffff' };

  function kit(v, tpl) {
    const sz = SMS.ASPECTS[tpl.aspect], W = sz[0], H = sz[1], u = Math.min(W, H) / 1080, K = { W, H, u, v };
    const lum = (c) => { const n = parseInt(String(c).slice(1, 7), 16) || 0; return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
    K.on = (c) => lum(c) > 0.6 ? '#0b0b0b' : '#ffffff';
    K.scene = (name, dur, bg, tr) => SMS.newScene({ name, duration: dur, bg, transition: tr || { type: 'none', duration: 0.5 } });
    K.put = (s, el, ...an) => { s.elements.push(el); an.forEach(a => A.applyPreset(el, a[0], a[1] || {}, SMS.effEnd(el, s) - el.start)); return el; };
    K.txt = (s, text, o, ...an) => {
      const size = o.size, lines = o.lines || 1, rest = Object.assign({}, o); delete rest.lines; delete rest.lh; delete rest.ls;
      return K.put(s, SMS.makeElement('text', Object.assign({ text: String(text == null ? '' : text), x: W / 2, y: H / 2, w: W * 0.84, h: size * (o.lh || 1.15) * lines + 8, size, color: v.c3, weight: 800, align: 'center', autoFit: true, name: String(text).slice(0, 22) || 'Texto', lineHeight: o.lh || 1.15, letterSpacing: (o.ls || 0) * u }, rest)), ...an);
    };
    K.rect = (s, o, ...an) => K.put(s, SMS.makeElement('shape', Object.assign({ shape: 'rect', color: v.c1 }, o)), ...an);
    K.icon = (s, id, o, ...an) => K.put(s, SMS.makeElement('icon', Object.assign({ icon: id, color: v.c1, w: 120 * u, h: 120 * u, name: 'Ícone' }, o)), ...an);
    K.tex = (s, pattern, color, opacity) => K.put(s, SMS.makeElement('texture', { pattern, color, opacity, w: W, h: H, x: W / 2, y: H / 2, size: 54 * u, thick: 2, name: 'Textura', locked: true }));
    K.logo = (s, o, ...an) => {
      const rec = v.logoId && M.get(v.logoId);
      if (rec && rec.w) { const k = Math.min(o.maxW / rec.w, o.maxH / rec.h); return K.put(s, SMS.makeElement('image', { mediaId: v.logoId, x: o.x, y: o.y, w: rec.w * k, h: rec.h * k, name: 'Logotipo' }), ...an); }
      return K.txt(s, v.brand, { x: o.x, y: o.y, size: o.size, w: o.maxW, color: o.color || v.c1, ls: 2, name: 'Marca' }, ...an);
    };
    K.bullets = (s, items, y0, step, size, startDelay) => items.forEach((t, i) => {
      K.icon(s, 'check', { x: W * 0.16, y: y0 + i * step, w: size * 1.1, h: size * 1.1 });
      const last = s.elements[s.elements.length - 1]; A.applyPreset(last, 'pop', { dur: 0.4, delay: startDelay + i * 0.3 }, SMS.effEnd(last, s));
      K.txt(s, t, { x: W * 0.56, y: y0 + i * step, w: W * 0.66, size, align: 'left', name: 'Item ' + (i + 1) }, ['slideIn', { dir: 'right', dist: 200 * u, dur: 0.6, delay: startDelay + i * 0.3 }]);
    });
    K.items = () => String(v.extra || '').split('|').map(x => x.trim()).filter(Boolean).slice(0, 4);
    K.cta = (s, y, label) => {
      const bw = W * 0.7, bh = 150 * u;
      K.rect(s, { x: W / 2, y, w: bw, h: bh, radius: bh / 2, name: 'Botão' }, ['pop', { dur: 0.6 }], ['pulse', { period: 1.1 }]);
      K.txt(s, label, { x: W / 2, y, w: bw * 0.9, size: 62 * u, color: K.on(v.c1), name: 'Texto do botão' }, ['pop', { dur: 0.6, delay: 0.1 }]);
    };
    return K;
  }

  const T = [];
  const tpl = (o) => T.push(o);

  tpl({ id: 'empresa', cat: 'Publicidade', name: 'Publicidade de empresa', desc: 'Apresentação da marca, três benefícios e chamada final.', aspect: '9:16',
    values: { headline: 'Soluções que fazem sua marca crescer', sub: 'Qualidade, agilidade e resultado.', cta: 'FALE CONOSCO', extra: 'Qualidade garantida|Atendimento ágil|Preço justo' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Abertura', 3.4, v.c2, { type: 'slideleft', duration: 0.5 }), b = K.scene('Benefícios', 3.4, v.c2, { type: 'fade', duration: 0.5 }), c = K.scene('Chamada', 3.2, v.c2);
      K.tex(a, 'grid', v.c3, 0.05); K.logo(a, { x: W / 2, y: H * 0.2, maxW: W * 0.5, maxH: 200 * u, size: 70 * u }, ['slideIn', { dir: 'top', dur: 0.7 }]);
      K.rect(a, { x: W / 2, y: H * 0.29, w: 160 * u, h: 14 * u, name: 'Detalhe' }, ['reveal', { dur: 0.6, delay: 0.2 }]);
      K.txt(a, v.headline, { y: H * 0.47, size: 124 * u, lines: 3, h: 480 * u, name: 'Título' }, ['slideIn', { dir: 'bottom', dur: 0.8, delay: 0.3 }]);
      K.txt(a, v.sub, { y: H * 0.7, size: 52 * u, lines: 2, weight: 500, opacity: 0.85, name: 'Subtítulo' }, ['fadeIn', { dur: 0.8, delay: 0.9 }]);
      K.tex(b, 'dots', v.c3, 0.06); K.txt(b, 'Por que escolher?', { y: H * 0.2, size: 84 * u, color: v.c1, name: 'Título' }, ['slideIn', { dir: 'top', dur: 0.6 }]);
      K.bullets(b, K.items().length ? K.items() : ['Benefício 1'], H * 0.38, H * 0.12, 54 * u, 0.5);
      K.logo(c, { x: W / 2, y: H * 0.25, maxW: W * 0.5, maxH: 220 * u, size: 80 * u }, ['zoomIn', { dur: 0.7 }]);
      K.txt(c, v.headline, { y: H * 0.42, size: 78 * u, lines: 3, h: 330 * u, name: 'Título' }, ['fadeIn', { dur: 0.8, delay: 0.2 }]);
      K.cta(c, H * 0.62, v.cta); K.icon(c, 'globe', { x: W * 0.2, y: H * 0.78, w: 70 * u, h: 70 * u }, ['fadeIn', { delay: 0.6 }]);
      K.txt(c, v.contact, { x: W * 0.58, y: H * 0.78, w: W * 0.6, size: 50 * u, align: 'left', weight: 600, name: 'Contato' }, ['fadeIn', { delay: 0.7 }]);
      return [a, b, c];
    } });

  tpl({ id: 'site', cat: 'Divulgação de site', name: 'Divulgação de site', desc: 'Janela de navegador animada com o endereço do site.', aspect: '9:16',
    values: { headline: 'Nosso novo site está no ar', sub: 'Conheça produtos, serviços e novidades.', cta: 'ACESSE AGORA', extra: 'Rápido|Seguro|Responsivo' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Site', 4.2, v.c2, { type: 'slideup', duration: 0.5 }), b = K.scene('Recursos', 3.2, v.c2, { type: 'fade', duration: 0.5 }), c = K.scene('Chamada', 3, v.c2);
      K.txt(a, v.headline, { y: H * 0.17, size: 100 * u, lines: 3, h: 400 * u, name: 'Título' }, ['slideIn', { dir: 'top', dur: 0.7 }]);
      const wy = H * 0.5, ww = W * 0.84, wh = H * 0.3;
      K.rect(a, { x: W / 2, y: wy, w: ww, h: wh, radius: 28 * u, color: v.c3, opacity: 0.1, name: 'Janela' }, ['zoomIn', { dur: 0.7, delay: 0.3 }]);
      K.rect(a, { x: W / 2, y: wy - wh / 2 + 42 * u, w: ww, h: 84 * u, radius: 28 * u, color: v.c3, opacity: 0.12, name: 'Barra' }, ['fadeIn', { delay: 0.5 }]);
      [0, 1, 2].forEach(i => K.put(a, SMS.makeElement('shape', { shape: 'ellipse', x: W / 2 - ww / 2 + 50 * u + i * 44 * u, y: wy - wh / 2 + 42 * u, w: 22 * u, h: 22 * u, color: [v.c1, v.c3, v.c3][i], opacity: i ? 0.5 : 1, name: 'Botão ' + (i + 1) }), ['pop', { delay: 0.6 + i * 0.1, dur: 0.3 }]));
      K.txt(a, v.contact, { x: W / 2, y: wy - wh / 2 + 42 * u, w: ww * 0.75, size: 36 * u, weight: 600, name: 'Endereço' }, ['typewriter', { delay: 1, dur: 1.4 }]);
      K.icon(a, 'globe', { x: W / 2, y: wy + 40 * u, w: 260 * u, h: 260 * u, name: 'Globo' }, ['spin', { delay: 1.2, dur: 1 }], ['float', {}]);
      K.txt(a, v.sub, { y: H * 0.82, size: 50 * u, lines: 2, weight: 500, opacity: 0.85, name: 'Subtítulo' }, ['fadeIn', { delay: 1.6 }]);
      const ics = ['bolt', 'shield', 'home'], its = K.items();
      its.slice(0, 3).forEach((t, i) => { const y = H * (0.3 + i * 0.2); K.icon(b, ics[i], { x: W / 2, y, w: 130 * u, h: 130 * u }, ['pop', { delay: 0.2 + i * 0.35 }]); K.txt(b, t, { y: y + 130 * u, size: 56 * u, name: 'Recurso ' + (i + 1) }, ['fadeIn', { delay: 0.4 + i * 0.35 }]); });
      K.txt(c, v.headline, { y: H * 0.34, size: 88 * u, lines: 3, h: 360 * u, name: 'Título' }, ['cinematic']); K.cta(c, H * 0.58, v.cta);
      K.txt(c, v.contact, { y: H * 0.72, size: 56 * u, weight: 600, color: v.c1, name: 'Endereço' }, ['fadeIn', { delay: 0.7 }]);
      return [a, b, c];
    } });

  tpl({ id: 'app', cat: 'Divulgação de aplicativo', name: 'Divulgação de aplicativo', desc: 'Celular, recursos e botões de loja.', aspect: '9:16',
    values: { headline: 'Seu app, na palma da mão', sub: 'Disponível para Android e iOS.', cta: 'BAIXE GRÁTIS', extra: 'Fácil de usar|Sempre atualizado|Grátis', contact: '@seuapp' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Apresentação', 4, v.c2, { type: 'zoom', duration: 0.6 }), b = K.scene('Recursos', 3.4, v.c2, { type: 'slideleft', duration: 0.5 }), c = K.scene('Download', 3.2, v.c2);
      K.txt(a, v.headline, { y: H * 0.14, size: 96 * u, lines: 2, h: 250 * u, name: 'Título' }, ['slideIn', { dir: 'top', dur: 0.7 }]);
      const pw = W * 0.5, ph = H * 0.5, py = H * 0.5;
      K.rect(a, { x: W / 2, y: py, w: pw, h: ph, radius: 70 * u, color: '#161616', name: 'Celular', stroke: { on: true, color: v.c3, width: 8 * u }, shadow: { on: true, color: '#000000', blur: 50 * u, x: 0, y: 20 * u, alpha: 0.6 } }, ['slideIn', { dir: 'bottom', dur: 0.9, delay: 0.2 }], ['float', { amp: 12 }]);
      K.rect(a, { x: W / 2, y: py - ph / 2 + 36 * u, w: pw * 0.3, h: 22 * u, radius: 11 * u, color: '#000000', name: 'Notch' }, ['fadeIn', { delay: 0.8 }]);
      K.logo(a, { x: W / 2, y: py, maxW: pw * 0.6, maxH: ph * 0.3, size: 70 * u }, ['pop', { delay: 1, dur: 0.6 }]);
      K.put(a, SMS.makeElement('particles', { x: W / 2, y: H * 0.5, w: W * 0.9, h: H * 0.5, color: v.c1, color2: v.c3, count: 30, size: 16 * u, speed: 90 * u, dir: -90, life: 3, name: 'Partículas' }));
      K.txt(a, v.sub, { y: H * 0.86, size: 50 * u, weight: 500, opacity: 0.85, name: 'Subtítulo' }, ['fadeIn', { delay: 1.4 }]);
      K.txt(b, 'Recursos', { y: H * 0.18, size: 90 * u, color: v.c1, name: 'Título' }, ['slideIn', { dir: 'top' }]); K.bullets(b, K.items(), H * 0.38, H * 0.13, 56 * u, 0.4);
      K.txt(c, 'Baixe agora', { y: H * 0.24, size: 100 * u, name: 'Título' }, ['pop']);
      [['GOOGLE PLAY', H * 0.42], ['APP STORE', H * 0.55]].forEach((s, i) => {
        K.rect(c, { x: W / 2, y: s[1], w: W * 0.66, h: 150 * u, radius: 26 * u, color: v.c3, opacity: 0.1, name: 'Loja ' + (i + 1), stroke: { on: true, color: v.c3, width: 4 * u } }, ['slideIn', { dir: i ? 'right' : 'left', delay: 0.2 + i * 0.2 }]);
        K.txt(c, s[0], { y: s[1], size: 56 * u, w: W * 0.6, name: 'Loja ' + (i + 1) + ' texto' }, ['fadeIn', { delay: 0.5 + i * 0.2 }]);
      });
      K.cta(c, H * 0.72, v.cta); K.txt(c, v.contact, { y: H * 0.86, size: 50 * u, color: v.c1, weight: 600, name: 'Contato' }, ['fadeIn', { delay: 0.8 }]);
      return [a, b, c];
    } });

  tpl({ id: 'promo', cat: 'Promoção', name: 'Promoção relâmpago', desc: 'Oferta em destaque com partículas e contagem.', aspect: '9:16',
    values: { brand: 'SUA LOJA', headline: 'SUPER PROMOÇÃO', sub: 'Somente até domingo', cta: 'APROVEITE', extra: '50% OFF', contact: 'www.sualoja.com.br', c1: '#ff3b30' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Oferta', 3.6, v.c2, { type: 'dip', duration: 0.4 }), b = K.scene('Chamada', 3.2, v.c1);
      K.tex(a, 'diagonal', v.c1, 0.18); K.txt(a, v.brand, { y: H * 0.1, size: 56 * u, ls: 6, color: v.c1, name: 'Marca' }, ['fadeIn']);
      K.txt(a, v.headline, { y: H * 0.24, size: 112 * u, lines: 2, h: 300 * u, name: 'Título' }, ['slideIn', { dir: 'left', dur: 0.6 }]);
      K.put(a, SMS.makeElement('shape', { shape: 'star', sides: 12, inner: 0.82, x: W / 2, y: H * 0.5, w: W * 0.92, h: W * 0.92, color: v.c1, name: 'Selo' }), ['pop', { dur: 0.7, delay: 0.3 }], ['rotateLoop', {}]);
      K.txt(a, v.extra, { y: H * 0.5, size: 220 * u, w: W * 0.7, h: 300 * u, color: K.on(v.c1), name: 'Oferta', lines: 1 }, ['pop', { dur: 0.6, delay: 0.5 }], ['pulse', { period: 0.8 }]);
      K.txt(a, v.sub, { y: H * 0.82, size: 64 * u, name: 'Validade' }, ['slideIn', { dir: 'bottom', delay: 1 }]);
      K.put(a, SMS.makeElement('particles', { x: W / 2, y: H * 0.5, w: W * 0.4, h: W * 0.4, color: v.c1, color2: '#ffffff', count: 60, size: 20 * u, speed: 420 * u, dir: -90, spread: 360, life: 1.6, pShape: 'star', name: 'Faíscas' }));
      K.txt(b, v.headline, { y: H * 0.28, size: 100 * u, lines: 2, h: 280 * u, color: K.on(v.c1), name: 'Título' }, ['zoomIn']);
      K.rect(b, { x: W / 2, y: H * 0.5, w: W * 0.7, h: 160 * u, radius: 80 * u, color: K.on(v.c1), name: 'Botão' }, ['pop', { delay: 0.3 }], ['pulse', { period: 1 }]);
      K.txt(b, v.cta, { y: H * 0.5, w: W * 0.6, size: 70 * u, color: v.c1, name: 'Texto do botão' }, ['pop', { delay: 0.4 }]);
      K.txt(b, v.contact, { y: H * 0.68, size: 56 * u, color: K.on(v.c1), weight: 600, name: 'Contato' }, ['fadeIn', { delay: 0.8 }]);
      return [a, b];
    } });

  tpl({ id: 'produto', cat: 'Apresentação de produto', name: 'Apresentação de produto', desc: 'Foto/logotipo do produto, nome e preço em destaque (formato quadrado).', aspect: '1:1',
    values: { brand: 'NOME DO PRODUTO', headline: 'Nome do produto', sub: 'Descrição curta do que ele faz de melhor.', cta: 'COMPRE AGORA', extra: 'R$ 99,90', contact: 'www.sualoja.com.br' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Produto', 4, v.c2, { type: 'wipe', duration: 0.6 }), b = K.scene('Preço', 3, v.c2);
      K.put(a, SMS.makeElement('shape', { shape: 'ellipse', x: W * 0.5, y: H * 0.42, w: W * 0.62, h: W * 0.62, color: v.c1, name: 'Fundo do produto' }), ['pop', { dur: 0.7 }]);
      if (v.logoId && M.get(v.logoId)) K.logo(a, { x: W * 0.5, y: H * 0.42, maxW: W * 0.5, maxH: W * 0.5, size: 60 * u }, ['zoomIn', { delay: 0.3 }], ['float', {}]);
      else K.icon(a, 'gift', { x: W * 0.5, y: H * 0.42, w: W * 0.34, h: W * 0.34, color: K.on(v.c1), name: 'Imagem do produto (substitua)' }, ['zoomIn', { delay: 0.3 }], ['float', {}]);
      K.txt(a, v.headline, { y: H * 0.8, size: 84 * u, lines: 2, h: 200 * u, name: 'Nome' }, ['slideIn', { dir: 'bottom', delay: 0.5 }]);
      K.txt(a, v.sub, { y: H * 0.93, size: 36 * u, weight: 500, opacity: 0.85, name: 'Descrição' }, ['fadeIn', { delay: 1 }]);
      K.txt(b, v.headline, { y: H * 0.2, size: 80 * u, lines: 2, h: 200 * u, name: 'Nome' }, ['fadeIn']);
      K.rect(b, { x: W / 2, y: H * 0.46, w: W * 0.7, h: 200 * u, radius: 100 * u, name: 'Etiqueta' }, ['pop', { delay: 0.2 }]);
      K.txt(b, v.extra, { y: H * 0.46, w: W * 0.62, size: 120 * u, color: K.on(v.c1), name: 'Preço' }, ['pop', { delay: 0.3 }]);
      K.cta(b, H * 0.7, v.cta); K.txt(b, v.contact, { y: H * 0.88, size: 40 * u, weight: 600, name: 'Contato' }, ['fadeIn', { delay: 0.8 }]);
      return [a, b];
    } });

  tpl({ id: 'servico', cat: 'Anúncio de serviços', name: 'Anúncio de serviços', desc: 'Horizontal 16:9 com três serviços e contato.', aspect: '16:9',
    values: { headline: 'Serviços profissionais para você', sub: 'Atendimento rápido e garantia de qualidade.', cta: 'SOLICITE UM ORÇAMENTO', extra: 'Instalação|Manutenção|Suporte', contact: '(00) 00000-0000' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Abertura', 3.6, v.c2, { type: 'slideleft', duration: 0.5 }), b = K.scene('Serviços', 3.6, v.c2, { type: 'fade', duration: 0.5 }), c = K.scene('Contato', 3, v.c2);
      K.rect(a, { x: W * 0.03, y: H / 2, w: 24 * u, h: H * 0.5, color: v.c1, name: 'Barra' }, ['reveal', { dur: 0.6 }]);
      K.logo(a, { x: W * 0.25, y: H * 0.15, maxW: W * 0.3, maxH: 110 * u, size: 54 * u }, ['fadeIn']);
      K.txt(a, v.headline, { x: W * 0.4, y: H * 0.45, w: W * 0.7, size: 110 * u, lines: 2, h: H * 0.5, align: 'left', name: 'Título' }, ['slideIn', { dir: 'left', delay: 0.2 }]);
      K.txt(a, v.sub, { x: W * 0.4, y: H * 0.78, w: W * 0.7, size: 46 * u, align: 'left', weight: 500, opacity: 0.85, name: 'Subtítulo' }, ['fadeIn', { delay: 0.8 }]);
      const ics = ['bolt', 'shield', 'clock'];
      K.items().slice(0, 3).forEach((t, i) => { const x = W * (0.2 + i * 0.3); K.icon(b, ics[i], { x, y: H * 0.42, w: 180 * u, h: 180 * u }, ['pop', { delay: 0.2 + i * 0.3 }]); K.txt(b, t, { x, y: H * 0.68, w: W * 0.26, size: 60 * u, name: 'Serviço ' + (i + 1) }, ['fadeIn', { delay: 0.4 + i * 0.3 }]); });
      K.txt(b, 'O que fazemos', { y: H * 0.12, size: 70 * u, color: v.c1, name: 'Título' }, ['fadeIn']);
      K.txt(c, v.cta, { y: H * 0.3, size: 90 * u, lines: 2, h: H * 0.4, name: 'Chamada' }, ['zoomIn']); K.icon(c, 'phone', { x: W * 0.32, y: H * 0.68, w: 90 * u, h: 90 * u }, ['pop', { delay: 0.5 }]);
      K.txt(c, v.contact, { x: W * 0.58, y: H * 0.68, w: W * 0.4, size: 70 * u, align: 'left', color: v.c1, name: 'Contato' }, ['fadeIn', { delay: 0.6 }]);
      return [a, b, c];
    } });

  tpl({ id: 'lancamento', cat: 'Lançamento', name: 'Lançamento / Em breve', desc: 'Teaser dramático com data de lançamento.', aspect: '9:16',
    values: { headline: 'O futuro começa aqui', sub: 'Algo novo está chegando.', cta: 'ATIVE O LEMBRETE', extra: '01 / 12', contact: '@suamarca' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Teaser', 3.4, v.c2, { type: 'dip', duration: 0.6 }), b = K.scene('Revelação', 3.6, v.c2, { type: 'circle', duration: 0.7 }), c = K.scene('Data', 3.2, v.c2);
      K.tex(a, 'noise', v.c3, 0.12); K.txt(a, 'EM BREVE', { y: H * 0.4, size: 70 * u, ls: 18, color: v.c1, name: 'Em breve' }, ['fadeIn', { dur: 1.2 }]);
      K.rect(a, { x: W / 2, y: H * 0.46, w: W * 0.5, h: 6 * u, name: 'Linha' }, ['reveal', { dur: 1, delay: 0.6 }]);
      K.icon(a, 'clock', { x: W / 2, y: H * 0.56, w: 140 * u, h: 140 * u }, ['fadeIn', { delay: 1 }], ['pulse', { period: 1.2 }]);
      K.logo(b, { x: W / 2, y: H * 0.22, maxW: W * 0.5, maxH: 200 * u, size: 72 * u }, ['cinematic']);
      K.txt(b, v.headline, { y: H * 0.5, size: 130 * u, lines: 3, h: 520 * u, name: 'Título' }, ['cinematic', { delay: 0.3, dur: 1.6 }]);
      K.txt(b, v.sub, { y: H * 0.76, size: 54 * u, weight: 500, opacity: 0.85, name: 'Subtítulo' }, ['fadeIn', { delay: 1.4 }]);
      K.put(b, SMS.makeElement('particles', { x: W / 2, y: H * 0.6, w: W, h: H * 0.8, color: v.c1, color2: v.c3, count: 50, size: 10 * u, speed: 60 * u, dir: -90, life: 4, name: 'Partículas' }));
      K.txt(c, 'DATA DE LANÇAMENTO', { y: H * 0.3, size: 48 * u, ls: 8, color: v.c1, name: 'Rótulo' }, ['fadeIn']);
      K.txt(c, v.extra, { y: H * 0.46, size: 190 * u, name: 'Data' }, ['pop', { delay: 0.3 }]); K.cta(c, H * 0.66, v.cta); K.txt(c, v.contact, { y: H * 0.8, size: 52 * u, weight: 600, name: 'Contato' }, ['fadeIn', { delay: 0.8 }]);
      return [a, b, c];
    } });

  tpl({ id: 'institucional', cat: 'Institucional', name: 'Institucional', desc: 'Horizontal sóbrio: quem somos, valores e contato.', aspect: '16:9',
    values: { headline: 'Quem somos', sub: 'Transformamos ideias em resultados com ética, qualidade e compromisso.', cta: 'CONHEÇA MAIS', extra: 'Ética|Qualidade|Compromisso|Inovação', contact: 'www.suaempresa.com.br' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Quem somos', 4.4, v.c2, { type: 'fade', duration: 0.8 }), b = K.scene('Valores', 4, v.c2, { type: 'fade', duration: 0.8 }), c = K.scene('Encerramento', 3.4, v.c2);
      K.tex(a, 'grid', v.c3, 0.04); K.logo(a, { x: W / 2, y: H * 0.18, maxW: W * 0.25, maxH: 100 * u, size: 56 * u }, ['fadeIn', { dur: 1 }]);
      K.txt(a, v.headline, { y: H * 0.4, size: 120 * u, name: 'Título' }, ['cinematic']); K.rect(a, { x: W / 2, y: H * 0.53, w: 220 * u, h: 8 * u, name: 'Detalhe' }, ['reveal', { delay: 0.8, dur: 0.8 }]);
      K.txt(a, v.sub, { y: H * 0.7, w: W * 0.65, size: 54 * u, lines: 3, h: H * 0.3, weight: 500, opacity: 0.9, name: 'Texto' }, ['fadeIn', { delay: 1, dur: 1 }]);
      const it = K.items(); it.forEach((t, i) => { const x = W * ((i + 0.5) / it.length); K.icon(b, ['shield', 'star', 'heart', 'bolt'][i % 4], { x, y: H * 0.4, w: 120 * u, h: 120 * u }, ['pop', { delay: 0.3 + i * 0.3 }]); K.txt(b, t, { x, y: H * 0.62, w: W * 0.22, size: 52 * u, name: 'Valor ' + (i + 1) }, ['slideIn', { dir: 'bottom', dist: 80 * u, delay: 0.4 + i * 0.3 }]); });
      K.txt(b, 'Nossos valores', { y: H * 0.14, size: 70 * u, color: v.c1, name: 'Título' }, ['fadeIn']);
      K.logo(c, { x: W / 2, y: H * 0.34, maxW: W * 0.3, maxH: 160 * u, size: 90 * u }, ['zoomIn', { dur: 1 }]); K.txt(c, v.contact, { y: H * 0.62, size: 62 * u, weight: 600, name: 'Contato' }, ['fadeIn', { delay: 0.8 }]);
      return [a, b, c];
    } });

  tpl({ id: 'convite', cat: 'Convite', name: 'Convite', desc: 'Elegante, com serifa. Data e local.', aspect: '9:16',
    values: { brand: 'Evento', headline: 'Você está convidado', sub: 'Aniversário de Fulano', cta: 'Confirme presença', extra: 'Sábado, 20 de dezembro · 19h', contact: 'Rua Exemplo, 123 — Cidade', c1: '#d4af37', c2: '#14110f', c3: '#f5efe6' },
    build(K) {
      const { W, H, u, v } = K, S = { font: 'Georgia', weight: 400 }, a = K.scene('Convite', 4, v.c2, { type: 'fade', duration: 0.8 }), b = K.scene('Detalhes', 4, v.c2);
      K.put(a, SMS.makeElement('shape', { shape: 'rect', x: W / 2, y: H / 2, w: W * 0.88, h: H * 0.9, fillOn: false, stroke: { on: true, color: v.c1, width: 5 * u }, name: 'Moldura' }), ['reveal', { dur: 1.2 }]);
      K.txt(a, v.brand.toUpperCase(), Object.assign({ y: H * 0.2, size: 48 * u, ls: 14, color: v.c1, name: 'Tipo' }, S), ['fadeIn', { delay: 0.5 }]);
      K.txt(a, v.headline, Object.assign({ y: H * 0.42, size: 130 * u, lines: 3, h: 520 * u, name: 'Título', weight: 400, italic: true }, { font: 'Georgia' }), ['cinematic', { delay: 0.4, dur: 1.6 }]);
      K.rect(a, { x: W / 2, y: H * 0.63, w: 200 * u, h: 4 * u, name: 'Linha' }, ['reveal', { delay: 1.4 }]); K.txt(a, v.sub, Object.assign({ y: H * 0.72, size: 62 * u, lines: 2, h: 200 * u, name: 'Nome' }, S), ['fadeIn', { delay: 1.6 }]);
      K.txt(b, 'QUANDO', Object.assign({ y: H * 0.22, size: 40 * u, ls: 12, color: v.c1, name: 'Rótulo 1' }, S), ['fadeIn']); K.txt(b, v.extra, Object.assign({ y: H * 0.31, size: 66 * u, lines: 2, h: 200 * u, name: 'Data' }, S), ['slideIn', { dir: 'bottom', dist: 60 * u, delay: 0.2 }]);
      K.txt(b, 'ONDE', Object.assign({ y: H * 0.5, size: 40 * u, ls: 12, color: v.c1, name: 'Rótulo 2' }, S), ['fadeIn', { delay: 0.6 }]); K.txt(b, v.contact, Object.assign({ y: H * 0.59, size: 62 * u, lines: 2, h: 200 * u, name: 'Local' }, S), ['slideIn', { dir: 'bottom', dist: 60 * u, delay: 0.8 }]);
      K.icon(b, 'heart', { x: W / 2, y: H * 0.76, w: 90 * u, h: 90 * u }, ['pop', { delay: 1.2 }], ['pulse', { period: 1.4 }]); K.txt(b, v.cta, Object.assign({ y: H * 0.86, size: 54 * u, italic: true, name: 'Confirmação' }, S), ['fadeIn', { delay: 1.5 }]);
      return [a, b];
    } });

  tpl({ id: 'tipografico', cat: 'Videoclipe tipográfico', name: 'Videoclipe tipográfico', desc: 'Uma frase por cena, com efeitos diferentes. Troque pelo seu texto e adicione a música.', aspect: '9:16',
    values: { headline: 'ESCREVA', sub: 'sua história', extra: 'EM CADA', cta: 'PALAVRA.', c1: '#ffd400', c2: '#0b0b0b', c3: '#ffffff' },
    build(K) {
      const { W, H, u, v } = K, rows = [[v.headline, 'zoomIn', v.c2, v.c3], [v.sub, 'typewriter', v.c1, K.on(v.c1)], [v.extra, 'slideIn', v.c3, v.c2], [v.cta, 'pop', v.c2, v.c1]], out = [];
      rows.forEach((r, i) => { const s = K.scene('Frase ' + (i + 1), 2.4, r[2], { type: ['slideleft', 'zoom', 'wipe', 'fade'][i], duration: 0.4 }); if (i === 3 || i === 0) K.tex(s, 'noise', r[3], 0.1);
        K.txt(s, r[0], { y: H / 2, size: 200 * u, lines: 3, h: H * 0.6, color: r[3], w: W * 0.9, name: 'Frase' }, [r[1], r[1] === 'slideIn' ? { dir: 'right', dur: 0.6 } : {}]); out.push(s); });
      return out;
    } });

  tpl({ id: 'stories', cat: 'Stories e Reels', name: 'Stories / Reels rápido', desc: 'Três cenas curtas, ritmo rápido, respeitando a área segura.', aspect: '9:16',
    values: { headline: 'Novidade chegando', sub: 'Arrasta pra cima e confira', cta: 'ARRASTE PARA CIMA', extra: 'NOVO', contact: '@seuperfil' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Gancho', 2.2, v.c1, { type: 'slideup', duration: 0.3 }), b = K.scene('Mensagem', 2.6, v.c2, { type: 'zoom', duration: 0.3 }), c = K.scene('Chamada', 2.4, v.c2);
      K.txt(a, v.extra, { y: H * 0.4, size: 300 * u, w: W * 0.9, h: 420 * u, color: K.on(v.c1), name: 'Gancho' }, ['pop', { dur: 0.5 }], ['pulse', { period: 0.7 }]);
      K.txt(a, v.contact, { y: H * 0.14, size: 54 * u, color: K.on(v.c1), weight: 700, name: 'Perfil' }, ['fadeIn']);
      K.tex(b, 'dots', v.c3, 0.08); K.txt(b, v.headline, { y: H * 0.42, size: 130 * u, lines: 3, h: 500 * u, name: 'Título' }, ['slideIn', { dir: 'left', dur: 0.5 }]);
      K.rect(b, { x: W / 2, y: H * 0.64, w: W * 0.6, h: 14 * u, name: 'Linha' }, ['reveal', { delay: 0.4 }]); K.txt(b, v.sub, { y: H * 0.72, size: 56 * u, lines: 2, h: 170 * u, weight: 500, name: 'Subtítulo' }, ['fadeIn', { delay: 0.5 }]);
      K.logo(c, { x: W / 2, y: H * 0.3, maxW: W * 0.5, maxH: 220 * u, size: 84 * u }, ['zoomIn']); K.txt(c, v.cta, { y: H * 0.62, size: 66 * u, lines: 2, h: 190 * u, name: 'Chamada' }, ['fadeIn', { delay: 0.3 }]);
      K.icon(c, 'arrow', { x: W / 2, y: H * 0.76, w: 130 * u, h: 130 * u, rotation: -90, name: 'Seta' }, ['bounce', { dist: 160 * u, dur: 0.9, delay: 0.5 }]);
      return [a, b, c];
    } });

  tpl({ id: 'souza', cat: 'Identidade inicial', name: 'Souza Studios (identidade inicial)', desc: 'O visual do projeto original, agora como template editável.', aspect: '9:16',
    values: { brand: 'SOUZA STUDIOS', headline: 'SUA IDEIA.', sub: 'Transformamos ideias em experiências digitais.', cta: 'VAMOS CRIAR?', c1: '#ffd400', c2: '#080808', c3: '#ffffff' },
    build(K) {
      const { W, H, u, v } = K, a = K.scene('Cena 1', 4, v.c2);
      [0, 1, 2].forEach(i => K.put(a, SMS.makeElement('shape', { shape: 'line', x: W * (0.25 + i * 0.28), y: H * 0.12, w: 560 * u, h: 4 * u, rotation: 62, color: v.c1, opacity: 0.18, name: 'Acento ' + (i + 1) }), ['slideIn', { dir: 'top', dist: 300 * u, delay: i * 0.2, dur: 1 }], ['float', { amp: 25, period: 4 + i }]));
      K.txt(a, v.brand, { y: H * 0.085, size: 50 * u, color: v.c1, ls: 4, name: 'Marca' }, ['fadeIn']);
      K.txt(a, v.headline, { y: H * 0.36, size: 150 * u, name: 'Título principal' }, ['slideIn', { dir: 'bottom', dist: 140 * u, dur: 0.7, delay: 0.2 }]);
      K.txt(a, v.sub, { y: H * 0.52, size: 54 * u, lines: 3, h: 260 * u, weight: 500, opacity: 0.9, name: 'Subtítulo' }, ['fadeIn', { delay: 0.7 }]);
      K.rect(a, { x: W / 2, y: H * 0.8, w: W * 0.78, h: 120 * u, name: 'Faixa amarela' }, ['slideIn', { dir: 'right', delay: 1 }]);
      K.txt(a, v.cta, { y: H * 0.8, w: W * 0.7, size: 62 * u, color: '#080808', name: 'Chamada' }, ['zoomIn', { delay: 1.2 }]);
      return [a];
    } });

  SMS.TEMPLATES = T;
  SMS.buildTemplate = (t, values) => {
    const v = Object.assign({}, DEF, t.values || {}, values || {});
    ['c1', 'c2', 'c3'].forEach(k => { if (!/^#[0-9a-f]{6}$/i.test(v[k])) v[k] = DEF[k]; });
    const P = SMS.newProject({ name: v.brand && t.id !== 'tipografico' ? (t.name + ' — ' + v.brand).slice(0, 60) : t.name, aspect: t.aspect }), K = kit(v, t);
    P.scenes = t.build(K);
    return SMS.normalizeProject(P);
  };
  SMS.templateDefaults = (t) => Object.assign({}, DEF, t.values || {});
})();
