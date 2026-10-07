import gsap from 'gsap';

// Línea del footer como menisco líquido. El div de 1px queda como línea idle
// (y dueño del reveal de footer-reveal.js); encima se inyecta un overlay SVG
// fijo, pointer-events none, que toma el control solo cuando el puntero ronda
// la línea: la deforma con un resorte (mismo modelo que el cursor/imán), forma
// una gota pendante con su cuello y, por dwell o flick, la desprende: cae/flya
// con gravedad, suelta una gota satélite y dispara ondas de recoil por la
// línea. Solo desktop con hover fino y sin reduced-motion. Dormant hasta que
// footer-reveal.js avisa 'footerRevealSettled'.
const HOVER_DESKTOP = '(width >= 970px) and (hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';
const NS = 'http://www.w3.org/2000/svg';

const NODES = 72; // muestras de la línea por frame
const THRESHOLD = 90; // distancia vertical (px) que activa el menisco
const MAX_AMP = 24; // levantamiento máximo de la línea (px)
const SIGMA = 95; // ancho del bulto (px)

const SETTLE = 0.34; // resorte de la deformación (s)
const ZETA = 0.72; // <1 → overshoot leve
const OMEGA = (2 * Math.PI) / SETTLE;
const K = OMEGA * OMEGA;
const C = 2 * ZETA * OMEGA;

const DWELL = 0.42; // permanencia (s) antes de empezar a formar la gota
const GROW = 0.5; // tiempo (s) hasta el radio máximo
const R_MAX = 11; // radio de la gota (px)
const NECK_MAX = 9; // semiancho del cuello al apoyar en la línea
const LAUNCH = 560; // velocidad de desprendimiento (px/s)
const FLICK_LAUNCH = 800; // desprendimiento por flick
const GRAVITY = 1500; // px/s²
const FLICK = 1.05; // umbral de velocidad del puntero (px/ms)
const TTL = 0.82; // vida de una gota libre (s)

const PULSE_SPEED = 420; // velocidad de las ondas de recoil (px/s)
const PULSE_TAU = 0.32; // decaimiento (s)
const PULSE_AMP = 10; // amplitud inicial (px)
const PULSE_SIGMA = 26;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = (x, mu, s) => Math.exp(-((x - mu) * (x - mu)) / (2 * s * s));
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

export const initFooterLine = () => {
  if (!window.matchMedia(HOVER_DESKTOP).matches || window.matchMedia(REDUCE).matches) return;

  const footer = document.querySelector('.main__contact-section');
  const line = document.querySelector('.contact-section_footer-line');
  if (!footer || !line) return;

  // ─── Overlay SVG ────────────────────────────────────────────────────
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'footer-line__svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <g class="footer-line__stage">
      <path class="footer-line__path"></path>
      <g class="footer-line__attached" style="opacity:0">
        <path class="footer-line__neck"></path>
        <circle class="footer-line__body" r="0"></circle>
      </g>
      <g class="footer-line__drops"></g>
    </g>`;
  document.body.append(svg);

  const path = svg.querySelector('.footer-line__path');
  const attachedG = svg.querySelector('.footer-line__attached');
  const neck = svg.querySelector('.footer-line__neck');
  const body = svg.querySelector('.footer-line__body');
  const dropsG = svg.querySelector('.footer-line__drops');

  // ─── Estado ─────────────────────────────────────────────────────────
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0, lastT: 0 };
  const amp = { x: 0, v: 0 };
  let metrics = null;
  let metricsDirty = true;
  let revealed = false;
  let running = false;
  let dwell = 0;
  let attached = null; // { r, cx }
  const drops = [];
  const pulses = [];

  const measure = () => {
    const r = line.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    metrics = { W, H, lineY: r.top + r.height / 2, x0: r.left, x1: r.right };
    metricsDirty = false;
  };

  const pulseAt = (x) => {
    let sum = 0;
    for (const p of pulses) sum += PULSE_AMP * Math.exp(-p.t / PULSE_TAU) * gauss(x, p.x, PULSE_SIGMA);
    return sum;
  };

  const smoothPath = (pts) => {
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    const last = pts[pts.length - 1];
    return `${d} L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  };

  // ─── Gota libre ─────────────────────────────────────────────────────
  const spawnDrop = (x, y, r, flick) => {
    const drop = {
      x,
      y,
      r,
      vx: clamp(pointer.vx * 45, -90, 90),
      vy: -(flick ? FLICK_LAUNCH : LAUNCH),
      t: 0,
      ttl: TTL,
    };
    const g = document.createElementNS(NS, 'g');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'footer-line__drop');
    g.append(c);
    dropsG.append(g);
    drop.el = g;
    drop.c = c;
    drop.ring = true;
    drops.push(drop);

    // Satélite: la inestabilidad de Plateau–Rayleigh al separarse.
    spawnSatellite(x, y + r * 0.7, r * 0.32, flick);
    pulses.push({ x, dir: -1, t: 0 }, { x, dir: 1, t: 0 });
  };

  const spawnSatellite = (x, y, r, flick) => {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const drop = {
      x,
      y,
      r,
      vx: dir * (30 + Math.random() * 45),
      vy: -(flick ? 820 : 430),
      t: 0,
      ttl: TTL * 0.8,
    };
    const g = document.createElementNS(NS, 'g');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'footer-line__dot');
    g.append(c);
    dropsG.append(g);
    drop.el = g;
    drop.c = c;
    drops.push(drop);
  };

  const killDrop = (drop) => {
    drop.el.remove();
    const i = drops.indexOf(drop);
    if (i >= 0) drops.splice(i, 1);
  };

  const detach = (flick) => {
    if (!attached) return;
    const gap = 4 + attached.r * 0.5;
    const baseY = metrics.lineY - amp.x - pulseAt(attached.cx);
    spawnDrop(attached.cx, baseY - attached.r - gap, attached.r, flick);
    attached = null;
    dwell = 0;
  };

  // ─── Render ─────────────────────────────────────────────────────────
  const render = (time, deltaTime) => {
    if (!metrics || metricsDirty) measure();
    const dt = Math.min(deltaTime, 34) / 1000;
    pointer.vx *= 0.82;
    pointer.vy *= 0.82;

    const cx = clamp(pointer.x, metrics.x0 + 6, metrics.x1 - 6);
    const dy = Math.abs(pointer.y - metrics.lineY);
    const inX = pointer.x > metrics.x0 - 24 && pointer.x < metrics.x1 + 24;
    // El footer es fijo (z1) y queda tapado por las secciones (z2) al scrollear:
    // el hit-test confirma que el puntero está sobre el pie real y no sobre una
    // capa que lo cubre (si no, dibujaríamos la línea encima del proceso).
    const el = document.elementFromPoint(pointer.x, pointer.y);
    const overFooter = !!el && footer.contains(el);
    const near = revealed && overFooter && inX && dy < THRESHOLD;
    const target = near ? MAX_AMP * (1 - dy / THRESHOLD) : 0;

    amp.v += ((target - amp.x) * K - amp.v * C) * dt;
    amp.x += amp.v * dt;

    const speed = Math.hypot(pointer.vx, pointer.vy);

    if (near && amp.x > MAX_AMP * 0.35) dwell += dt;
    else if (!attached) dwell = 0;

    if (attached && !near) {
      detach(false);
    } else if (near && speed > FLICK && !attached) {
      spawnDrop(cx, metrics.lineY - R_MAX * 0.8, R_MAX * 0.8, true);
      dwell = 0;
    } else if (dwell > DWELL) {
      if (!attached) attached = { r: R_MAX * 0.25, cx };
      attached.cx += (cx - attached.cx) * Math.min(1, dt * 12);
      attached.r = Math.min(R_MAX, attached.r + (R_MAX / GROW) * dt);
      if (attached.r >= R_MAX) detach(speed > FLICK);
    }

    // Ondas de recoil
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += dt;
      p.x += p.dir * PULSE_SPEED * dt;
      if (PULSE_AMP * Math.exp(-p.t / PULSE_TAU) < 0.4) pulses.splice(i, 1);
    }

    // Gotas libres: balística + disolución. La principal nace vaciada (anillo)
    // y "se abre" en los primeros 180ms; el satélite queda como punto sólido.
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t += dt;
      d.vy += GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const p = d.t / d.ttl;
      const open = smoothstep(0, 0.18, d.t);
      const endShrink = smoothstep(0.62, 1, p);
      const r = Math.max(0, d.r * (1 + 0.35 * open) * (1 - endShrink));
      const op = 1 - smoothstep(0.55, 1, p);
      d.c.setAttribute('cx', d.x.toFixed(2));
      d.c.setAttribute('cy', d.y.toFixed(2));
      d.c.setAttribute('r', r.toFixed(2));
      d.c.setAttribute('opacity', op.toFixed(3));
      if (d.ring) {
        d.c.setAttribute('stroke-width', (1.25 - 0.25 * open).toFixed(2));
        // Squash & stretch: se estira en la dirección del movimiento.
        const stretch = clamp(Math.hypot(d.vx, d.vy) / 900, 0, 0.35);
        const ang = (Math.atan2(d.vy, d.vx) * 180) / Math.PI;
        d.c.style.transform = `rotate(${ang.toFixed(1)}deg) scale(${(1 + stretch).toFixed(3)}, ${(
          1 - stretch * 0.5
        ).toFixed(3)})`;
      }
      if (d.t >= d.ttl) killDrop(d);
    }

    // Línea deformada
    const pts = [];
    const span = metrics.x1 - metrics.x0;
    for (let i = 0; i <= NODES; i++) {
      const x = metrics.x0 + (span * i) / NODES;
      const y = metrics.lineY - amp.x * gauss(x, cx, SIGMA) - pulseAt(x);
      pts.push({ x, y });
    }
    path.setAttribute('d', smoothPath(pts));

    // Gota pendante (cuerpo + cuello apoyados sobre la línea deformada)
    if (attached) {
      const baseY = metrics.lineY - amp.x - pulseAt(attached.cx);
      const gap = 4 + attached.r * 0.5;
      const cy = baseY - attached.r - gap;
      const nw = Math.max(0.6, NECK_MAX * (1 - attached.r / R_MAX));
      neck.setAttribute(
        'd',
        `M ${(attached.cx - nw).toFixed(2)} ${baseY.toFixed(2)} ` +
          `C ${(attached.cx - nw).toFixed(2)} ${(cy + attached.r * 0.2).toFixed(2)} ` +
          `${(attached.cx - attached.r * 0.55).toFixed(2)} ${(cy + attached.r * 0.75).toFixed(2)} ` +
          `${(attached.cx - attached.r * 0.5).toFixed(2)} ${cy.toFixed(2)} ` +
          `L ${(attached.cx + attached.r * 0.5).toFixed(2)} ${cy.toFixed(2)} ` +
          `C ${(attached.cx + attached.r * 0.55).toFixed(2)} ${(cy + attached.r * 0.75).toFixed(2)} ` +
          `${(attached.cx + nw).toFixed(2)} ${(cy + attached.r * 0.2).toFixed(2)} ` +
          `${(attached.cx + nw).toFixed(2)} ${baseY.toFixed(2)} Z`,
      );
      body.setAttribute('cx', attached.cx.toFixed(2));
      body.setAttribute('cy', cy.toFixed(2));
      body.setAttribute('r', attached.r.toFixed(2));
      attachedG.style.opacity = '1';
    } else {
      attachedG.style.opacity = '0';
    }

    // Visibilidad: el overlay manda solo cuando hay algo que mostrar
    const active = near || !!attached || drops.length > 0 || pulses.length > 0 || Math.abs(amp.x) > 0.25;
    svg.classList.toggle('is-active', active);
    line.classList.toggle('is-liquid', active);

    if (!near && !attached && !drops.length && !pulses.length && Math.abs(amp.x) < 0.2 && Math.abs(amp.v) < 0.2) {
      running = false;
      gsap.ticker.remove(render);
      svg.classList.remove('is-active');
      line.classList.remove('is-liquid');
      path.removeAttribute('d');
    }
  };

  const ensureRunning = () => {
    if (running) return;
    running = true;
    gsap.ticker.add(render);
  };

  // ─── Eventos ────────────────────────────────────────────────────────
  const onMove = (e) => {
    const now = performance.now();
    const dt = now - pointer.lastT;
    if (dt > 0 && dt < 100) {
      pointer.vx = clamp((e.clientX - pointer.lastX) / dt, -6, 6);
      pointer.vy = clamp((e.clientY - pointer.lastY) / dt, -6, 6);
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastT = now;
    ensureRunning();
  };

  const onLeave = () => {
    if (attached) detach(false);
    dwell = 0;
    ensureRunning();
  };

  const onResize = () => {
    metricsDirty = true;
  };

  window.addEventListener('footerRevealSettled', () => {
    revealed = true;
    metricsDirty = true;
  });
  footer.addEventListener('pointermove', onMove, { passive: true });
  footer.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', onResize);
};
