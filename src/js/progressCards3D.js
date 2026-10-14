import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { progressState } from './progressState.js';

gsap.registerPlugin(ScrollTrigger);

// Escena 3D de las cards. Cada carta nace lejos en profundidad, chica y rotada,
// sube hacia el centro mientras crece y se asienta de frente. Con el scroll sale
// hacia arriba de la pantalla, como el humo. u = p·(N+1) − i − 1: cada carta tiene
// su propio tramo del scroll, así surgen una tras otra y se solapan al salir.
// La carta conserva su layout original: se escala completa con una escala base
// según el alto del viewport, sin rediseñar su contenido.
// Finale (f 0→1, en 1.5 vh): después de la última carta los ojos se centran por
// scroll (center), al quedar centrados se dispara el anillo con tiempo fijo (ring)
// y después el scroll absorbe todo el humo (absorb, hasta f 0.9). Al terminar la
// absorción arranca el cierre en tiempo fijo (close, 1 s): el humo y los párpados
// se apagan juntos y, al quedar los ojos cerrados, se dispara el aro del pie
// (reveal). Con absorb las cards desaparecen.
const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = '(max-width: 48rem)';
const TILT = 12; // inclinación de reposo (°), alterna igual que el layout original
const ABSORB_VH = 3; // duración del finale, en alto de viewport
const CENTER_END = 0.15; // fracción del finale en que los ojos llegan al centro y se dispara el anillo
const ABSORB_END = 0.9; // fracción del finale en que el humo ya fue absorbido por completo
const SHUT_S = 1.0; // s: duración fija del cierre de los ojos (arranca al terminar la absorción)
const RING_S = 1.6; // s: duración fija del anillo
const REVEAL_S = 1.6; // s: duración fija del aro que revela el pie
const FRAME_FRAC = 0.48; // alto máximo de la carta respecto del viewport (escala base)

const DESKTOP = {
  stepVh: 1.25, // scroll por carta, en alto de viewport
  farZ: -2200, // profundidad de la que surge
  startScale: 0.4, // tamaño al surgir
  startY: 0.16, // fracción de H: surge desde abajo
  rotIn: -28, // rotación Y al surgir (°)
  tiltIn: 24, // rotación X al surgir (°)
  rotOut: 22, // rotación Y al salir (°)
  tiltOut: -18, // rotación X al salir (°)
  exitY: -1.1, // fracción de H: sale por arriba
  blur: 10,
  breathe: 3,
  offX: [-0.08, 0.08, -0.06, 0.06], // fracción de ancho de viewport
  offY: [0.008, 0, 0.008, 0], // fracción de alto de viewport: sólo hacia abajo, lejos de los ojos
};
const COMPACT_PROFILE = {
  stepVh: 1.0,
  farZ: -1200,
  startScale: 0.45,
  startY: 0.12,
  rotIn: -18,
  tiltIn: 16,
  rotOut: 14,
  tiltOut: -12,
  exitY: -1.1,
  blur: 5,
  breathe: 2,
  offX: [-0.02, 0.02, -0.02, 0.02],
  offY: [0.01, -0.01, 0.01, -0.01],
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

const pose = (t, c) => {
  if (t < 0) {
    const k = easeOut(clamp01(t + 1));
    return {
      z: lerp(c.farZ, 0, k),
      sc: lerp(c.startScale, 1, k),
      y: lerp(c.startY, 0, k),
      ry: lerp(c.rotIn, 0, k),
      rx: lerp(c.tiltIn, 0, k),
      op: clamp01(k * 1.6),
      act: k,
    };
  }
  if (t <= 0.5) return { z: 0, sc: 1, y: 0, ry: 0, rx: 0, op: 1, act: 1 };
  const k = ease(clamp01((t - 0.5) / 0.5));
  return {
    z: lerp(0, -300, k),
    sc: lerp(1, 0.9, k),
    y: lerp(0, c.exitY, k),
    ry: lerp(0, c.rotOut, k),
    rx: lerp(0, c.tiltOut, k),
    op: 1 - ease(clamp01((k - 0.8) / 0.2)),
    act: 1 - k,
  };
};

export const progressCards3D = () => {
  const sec = document.querySelector('.main__progress-section');
  const cards = gsap.utils.toArray('.progress__card');
  // Sin JS o con reduce-motion queda el layout estático del CSS
  if (!sec || !cards.length || window.matchMedia(REDUCE).matches) return;

  const compact = window.matchMedia(COMPACT);
  const profile = () => (compact.matches ? COMPACT_PROFILE : DESKTOP);
  const N = cards.length;
  const total = () => (profile().stepVh * N + ABSORB_VH) * window.innerHeight;

  sec.classList.add('progress-section--3d');
  gsap.set(cards, { xPercent: -50, yPercent: -50 });

  // Escala base: la carta se ajusta al viewport sin cambiar su layout interno
  let base = 1;
  const measureBase = () => {
    base = Math.min(1, (window.innerHeight * FRAME_FRAC) / cards[0].offsetHeight);
  };
  measureBase();
  window.addEventListener('resize', measureBase);

  // Anillo: tiempo fijo que avanza al pasar el centrado y se invierte al subir
  const ringTween = gsap.to({}, { duration: RING_S, ease: 'none', paused: true });
  let ringWanted = null;

  // Aro del pie: tiempo fijo que arranca solo al cerrarse los ojos y se invierte si se reabren
  const revealTween = gsap.to({}, { duration: REVEAL_S, ease: 'none', paused: true });
  window.addEventListener('eyesClosed', () => revealTween.play());
  window.addEventListener('eyesOpened', () => revealTween.reverse());
  // Cierre: tiempo fijo que arranca al completarse la absorción y se invierte si se
  // sube antes. Un solo progreso (close) maneja párpados, humo y halo, así el humo
  // desaparece junto con el cierre de los ojos
  const shutTween = gsap.to({}, { duration: SHUT_S, ease: 'none', paused: true });
  let shutWanted = false;
  let anchored = false;
  let absorbFrom = CENTER_END;

  // v recorre todo el pin: primero las cards (p) y después el finale (f)
  const paint = (v) => {
    const c = profile();
    const cardsVh = c.stepVh * N;
    const cardsFrac = cardsVh / (cardsVh + ABSORB_VH);
    const p = clamp01(v / cardsFrac);
    const f = clamp01((v - cardsFrac) / (1 - cardsFrac));
    const u = p * (N + 1);
    const now = performance.now() / 1000;
    const W = window.innerWidth;
    const H = window.innerHeight;

    const wantRing = f >= CENTER_END;
    if (wantRing !== ringWanted) {
      ringWanted = wantRing;
      if (wantRing) ringTween.play();
      else ringTween.reverse();
    }
    // Mientras el anillo corre el scroll no mueve el humo. Al terminar, la
    // absorción arranca desde donde esté el scroll, sin saltos ni zona muerta
    const ringDone = ringTween.progress() >= 1;
    if (ringDone && !anchored) {
      anchored = true;
      absorbFrom = Math.min(ABSORB_END - 0.05, Math.max(CENTER_END, f));
    } else if (!ringDone) {
      anchored = false;
      absorbFrom = CENTER_END;
    }
    const absorb = ringDone ? clamp01((f - absorbFrom) / (ABSORB_END - absorbFrom)) : 0;
    // El cierre arranca recién cuando la absorción terminó (ab = 1): así el humo que
    // desaparece, los párpados y el aro quedan en una sola secuencia en tiempo fijo
    const wantShut = absorb >= 0.999;
    if (wantShut !== shutWanted) {
      shutWanted = wantShut;
      if (wantShut) shutTween.play();
      else shutTween.reverse();
    }
    const close = shutTween.progress();
    const ring = ringTween.progress();

    progressState.p = p;
    progressState.center = ease(clamp01(f / CENTER_END));
    progressState.ring = ring;
    progressState.absorb = absorb;
    progressState.close = close;
    progressState.reveal = revealTween.progress();
    // El ojo se abre con el anillo, crece mientras absorbe (ease-in) y vuelve a su
    // tamaño al cerrarse
    const inhaleUp = ease(clamp01(ring / 0.15));
    const inhaleDown = ease(clamp01((ring - 0.15) / 0.15));
    const drain = absorb * absorb;
    const squeeze = ease(close);
    progressState.inhale = 0.03 * inhaleUp * (1 - inhaleDown) + 0.12 * drain - 0.12 * squeeze;
    progressState.active = Math.min(N - 1, Math.max(0, Math.round(u - 1)));
    cards.forEach((card, i) => {
      const s = pose(u - i - 1, c);
      const dx = (c.offX[i] ?? 0) * W * s.act;
      const dy = (c.offY[i] ?? 0) * H * s.act + s.y * H;
      const blur = (1 - s.act) * c.blur;
      gsap.set(card, {
        x: dx,
        y: dy,
        z: s.z,
        scale: base * s.sc,
        rotationX: s.rx,
        rotationY: s.ry + Math.sin(now * 0.6 + i * 1.7) * c.breathe * s.act,
        rotationZ: i % 2 ? TILT : -TILT,
        autoAlpha: s.op * (1 - absorb),
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
      });
    });
  };

  const state = { v: 0 };
  gsap.to(state, {
    v: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: sec,
      start: 'center center',
      end: () => `+=${total()}`,
      pin: true,
      scrub: 0.9,
      invalidateOnRefresh: true,
    },
  });

  // Pintado continuo sólo con la sección en pantalla: la respiración de cada
  // carta necesita frames aunque el scroll esté quieto.
  let inView = false;
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
  }).observe(sec);
  gsap.ticker.add(() => {
    if (inView) paint(state.v);
  });
  paint(0);
};
