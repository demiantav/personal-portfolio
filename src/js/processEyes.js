import gsap from 'gsap';
import { createNoise2D } from 'simplex-noise';

// Dos ojos ROJOS gatunos durante la fase de proceso. Todo va atado al scroll
// real del holder (.progress-reveal, skillsProgressReveal.js), sin ScrollTrigger
// propio: así el título y los ojos nunca se desfasan.
//  · PIN: el título queda fijo en el viewport. Mientras sale en su mismo lugar,
//    los ojos abren en el centro y ocupan el sitio del título;
//  · SUBIDA: tras el pin, la sección sale y las cards entran; los ojos suben a
//    la franja superior con inercia (resorte en Y);
//  · UN SOLO ESTADO: pose de párpados (ruido simplex, continuo), flotación,
//    parpadeo y mirada son compartidos; ambos ojos se diferencian sólo por el
//    tilt y un retardo mínimo (LAG_RIGHT) en el derecho;
//  · reaccionan a la velocidad de scroll con un leve entrecierre;
//  · al terminar, se cierran "como si durmieran" y desaparecen.
// Cada ojo es una almendra roja pura (sin pupila) con tilt externo (cat-eye).
// Los párpados usan el fondo de la sección (--bg-color) para fundirse con él.
// Reduced-motion / sin JS: sin overlay.
const REDUCE = '(prefers-reduced-motion: reduce)';
const RED = '#ff0000';
const FALLBACK_LID = '#080707';
const TILT = 0.1; // inclinación cat-eye (rad)
const EYE_TOP = 0.14; // franja superior (fracción de H) donde quedan al subir
const OPEN_FROM = 0.55; // progreso del pin en que empiezan a abrir (título ya saliendo)
const OPEN_TO = 0.95; // y en que terminan de abrir, justo al cerrar el pin
const LAG_RIGHT = 0.04; // s: retardo mínimo del ojo derecho respecto al estado compartido
const LOOK = 0.3; // base de la mirada de los párpados
const BLINK_MS = 120; // duración de un parpadeo
const BLINK_GAP = [3000, 6000]; // separación entre parpadeos (ms)
const SQUINT_MAX = 0.25; // entrecierre máximo por scroll rápido

const noise = createNoise2D();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
// Resorte amortiguado: settle = tiempo de asentado (s), zeta < 1 da rebote leve.
const mkSpring = (settle, zeta) => {
  const w = (2 * Math.PI) / settle;
  return { k: w * w, c: 2 * zeta * w };
};
const integrate = (s, target, sp, dt) => {
  s.vel += ((target - s.v) * sp.k - s.vel * sp.c) * dt;
  s.v += s.vel * dt;
  return s.v;
};

// Pose compartida: ruido continuo en vez de saltos aleatorios. Cada canal usa
// otra "semilla" (eje y) para no moverse en fase.
const sharedPose = (t) => ({
  uA: noise(t * 0.3, 1) * 0.16,
  uP: noise(t * 0.22, 5) * 0.26,
  lA: noise(t * 0.27, 9) * 0.13,
  lP: noise(t * 0.19, 13) * 0.16,
});

export const processEyes = () => {
  if (window.matchMedia(REDUCE).matches) return;
  const titleSection = document.querySelector('.progress-title-section');
  const holder = document.querySelector('.progress-reveal');
  if (!titleSection || !holder) return;
  const cards = document.querySelector('.progress-section_cards-container');
  const titleEl = titleSection.querySelector('.section-title__progress');
  const titleBlock = titleSection.querySelector('.section-title');
  const lines = titleSection.querySelectorAll('.section-title__line');

  const canvas = document.createElement('canvas');
  canvas.className = 'process-eyes';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Color de los párpados: el mismo fondo de la sección (variable de tema)
  const lid =
    getComputedStyle(titleSection).getPropertyValue('--bg-color').trim() || FALLBACK_LID;

  // ─── Estado ─────────────────────────────────────────────────────────
  let W = 0;
  let H = 0;
  let alpha = 0;
  let p = 0; // progreso horizontal de las cards (0→1)
  let lastP = 0;
  let pinP = 0; // 0→1 mientras el título está fijo
  let riseP = 0; // 0→1 mientras la sección sale y las cards entran
  let lastPinP = -1;
  let lastT = 0;
  let raf = 0;
  let running = false;
  let cyInit = false;
  const S_OPEN = mkSpring(0.62, 0.86);
  const S_GAZE = mkSpring(0.85, 0.9);
  const S_CY = mkSpring(0.9, 0.95);
  const S_SQUINT = mkSpring(0.25, 0.9);
  const sOpen = { v: 0, vel: 0 };
  const sGaze = { v: 0, vel: 0 };
  const sCy = { v: 0, vel: 0 };
  const sSquint = { v: 0, vel: 0 };

  // Ojos: sólo se diferencian por la orientación y el retardo del resorte.
  const eyes = [
    { dir: -1, lag: 0 }, // izquierdo: sigue exacto al estado compartido
    { dir: 1, lag: LAG_RIGHT }, // derecho: retardo mínimo
  ].map((e) => ({ ...e, pose: { uA: 0, uP: 0, lA: 0, lP: 0 } }));

  // Parpadeo compartido: ambos párpados cierran a la vez
  let blinkStart = -1;
  let nextBlink = performance.now() + 2000 + Math.random() * 2000;
  const blinkLevel = (now) => {
    if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
    if (blinkStart < 0) return 0;
    const ph = (now - blinkStart) / BLINK_MS;
    if (ph >= 1) {
      blinkStart = -1;
      nextBlink = now + BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]);
      return 0;
    }
    return Math.sin(ph * Math.PI); // 0 → 1 → 0 suave
  };

  // ─── Medición ───────────────────────────────────────────────────────
  const measure = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  measure();

  // ─── Almendra (path) ────────────────────────────────────────────────
  const almond = (rx, ry) => {
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.quadraticCurveTo(0, -ry * 2, rx, 0);
    ctx.quadraticCurveTo(0, ry * 2, -rx, 0);
    ctx.closePath();
  };

  // ─── Dibujo de un ojo (almendra roja + párpados rotables) ───────────
  // look = estado compartido de la frame: openV, gazeV, floatV, dx
  const drawEye = (eye, cx, cy, R, look) => {
    const rx = R * 1.9;
    const ry = R * 0.82;
    const oy = look.floatV * ry * 0.05; // flotación sutil, igual para ambos

    const ap = ry * look.openV;
    const upperEdge = -ap * 0.9 + (eye.pose.uP + LOOK * 0.3) * ry * look.openV;
    const lowerEdge = ap * 0.72 + (eye.pose.lP + LOOK * 0.3) * ry * look.openV;
    const maxA = 0.16;
    const ua = eye.pose.uA - look.gazeV * maxA;
    const la = eye.pose.lA + look.gazeV * maxA;

    ctx.save();
    ctx.translate(cx + look.dx, cy + oy);
    ctx.rotate(-eye.dir * TILT); // cat-eye: esquina externa elevada

    // Almendra roja plana (sin glow).
    ctx.fillStyle = RED;
    almond(rx, ry);
    ctx.fill();

    // Párpados recortados a la almendra, del color de fondo de la sección.
    ctx.save();
    almond(rx, ry);
    ctx.clip();
    ctx.fillStyle = lid;
    ctx.save();
    ctx.rotate(ua);
    ctx.fillRect(-rx * 2, -ry * 3, rx * 4, ry * 3 + upperEdge);
    ctx.restore();
    ctx.save();
    ctx.rotate(la);
    ctx.fillRect(-rx * 2, lowerEdge, rx * 4, ry * 3);
    ctx.restore();
    ctx.restore();

    ctx.restore();
  };

  // ─── Render ─────────────────────────────────────────────────────────
  const render = (t) => {
    raf = 0;
    if (!running) return;
    const dt = clamp((t - lastT) / 1000, 0.001, 0.033);
    lastT = t;
    const now = performance.now();
    const tSec = now / 1000;

    if (cards) {
      const maxX = cards.scrollWidth - window.innerWidth;
      if (maxX > 0) p = clamp(-gsap.getProperty(cards, 'x') / maxX, 0, 1);
    }
    const speed = Math.abs(p - lastP) / dt; // velocidad de avance de las cards
    lastP = p;

    // Recorrido real del holder: `d` son los px ya scrolleados desde que el
    // holder llegó arriba. `hold` es el tramo en que el título queda fijo.
    const hold = Math.max(1, holder.offsetHeight - titleSection.offsetHeight);
    const d = -holder.getBoundingClientRect().top;
    pinP = clamp(d / hold, 0, 1);
    riseP = clamp((d - hold) / H, 0, 1); // una altura de viewport: sección saliendo

    // El título sale en su mismo lugar, marcado por el pin (no por el tiempo)
    if (titleExit && pinP !== lastPinP) {
      titleExit.progress(pinP);
      lastPinP = pinP;
    }

    const openTarget = smoothstep(OPEN_FROM, OPEN_TO, pinP) * (1 - smoothstep(0.84, 0.96, p));
    const gazeTarget = (1 - 2 * p) * smoothstep(0, 1, riseP);
    const alphaTarget = 1 - smoothstep(0.94, 1, p);
    // Centro del título: la sección mide 100dvh y queda con top 0 durante el pin
    const anchorY = titleSection.offsetHeight / 2;
    const eyeCyTarget = anchorY + (H * EYE_TOP - anchorY) * smoothstep(0, 1, riseP);
    if (!cyInit) {
      sCy.v = eyeCyTarget; // sin deslizarse desde 0 en la primera frame
      cyInit = true;
    }

    const openV = integrate(sOpen, openTarget, S_OPEN, dt);
    const gazeV = integrate(sGaze, gazeTarget, S_GAZE, dt);
    const eyeCy = integrate(sCy, eyeCyTarget, S_CY, dt);
    const squint = integrate(sSquint, clamp(speed * 0.25, 0, SQUINT_MAX), S_SQUINT, dt);
    alpha += (alphaTarget - alpha) * Math.min(1, dt * 5);

    // Pose compartida; cada ojo la sigue con su propio retardo (0 o LAG_RIGHT)
    const shared = sharedPose(tSec);
    for (const eye of eyes) {
      const f = eye.lag > 0 ? 1 - Math.exp(-dt / eye.lag) : 1;
      eye.pose.uA += (shared.uA - eye.pose.uA) * f;
      eye.pose.uP += (shared.uP - eye.pose.uP) * f;
      eye.pose.lA += (shared.lA - eye.pose.lA) * f;
      eye.pose.lP += (shared.lP - eye.pose.lP) * f;
    }

    const blink = blinkLevel(now);
    const eyeOpen = openV * (1 - blink) * (1 - squint);

    ctx.clearRect(0, 0, W, H);

    // Sin nada visible ni en transición: se pausa el loop hasta el próximo scroll
    const idle = openTarget === 0 && openV < 0.01 && Math.abs(alphaTarget - alpha) < 0.004;
    if (idle) {
      running = false;
      return;
    }

    if (alpha > 0.004 && eyeOpen > 0.02) {
      ctx.globalAlpha = alpha;
      const R = Math.min(W * 0.055, H * 0.085);
      const cx = W / 2;
      const gap = R * 4.4;
      const look = {
        openV: eyeOpen,
        gazeV,
        floatV: Math.sin(now * 0.0006),
        // mirada: ambos ojos se desplazan igual, hacia el lado de la mirada
        dx: -gazeV * R * 0.18,
      };
      drawEye(eyes[0], cx - gap / 2, eyeCy, R, look);
      drawEye(eyes[1], cx + gap / 2, eyeCy, R, look);
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(render);
  };

  const start = () => {
    if (running) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(render);
  };

  // ─── Salida del título (mismo efecto de entrada, en reversa) ────────
  // Timeline pausado: su progreso lo marca pinP en el render.
  let titleExit = null;
  const buildTitleExit = (chars) => {
    if (!chars || !chars.length) return;
    titleExit?.kill();
    const offsets = chars.map(() => (Math.random() < 0.5 ? -100 : 100));
    titleExit = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    // Letras: misma ráfaga que la entrada, en reversa.
    titleExit.to(chars, { yPercent: (i) => offsets[i], stagger: { from: 'random', amount: 0.4 } }, 0);
    // Líneas: suben. El fade va al bloque (la `opacity` de la línea la fija la
    // animación CSS `test`, no se puede pisar por inline).
    titleExit.to(lines, { yPercent: -60 }, 0);
    titleExit.to(titleBlock, { autoAlpha: 0 }, 0.15);
    lastPinP = -1; // fuerza a aplicar el progreso actual sobre el nuevo timeline
  };
  buildTitleExit(titleEl?.__headerChars);
  window.addEventListener('sectionHeaderSplit', (e) => {
    if (e.detail.trigger === titleEl) buildTitleExit(e.detail.chars);
  });

  // Al estar pausado, cualquier scroll lo reactiva (el progreso depende de él)
  const wake = () => start();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    wake();
  });
  start();
};
