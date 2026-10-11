import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { progressState } from './progressState.js';

gsap.registerPlugin(ScrollTrigger);

// Escena 3D de las cards. Cada carta vive en u = p·(N+1) − i − 1 y su pose sale de
// pose(): entra desde la niebla (lejos, rotada, transparente), queda activa de
// frente un rato para leerla y sale hacia la cámara disolviéndose, solapada con la
// siguiente. El blur va sólo en las no activas.
// Cada carta tiene además un desplazamiento lateral (offX/offY) que alterna lados
// para que cada paso ocupe un lugar distinto. El desplazamiento escala con la
// actividad, así llega desde el centro y vuelve al centro al salir.
// Finale: después de la última carta la escena queda fijada mientras los ojos
// absorben el humo (absorb 0→1). Con absorb las cards desaparecen.
const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = '(max-width: 48rem)';
const TILT = 12; // inclinación de reposo (°), alterna igual que el layout anterior
const ABSORB_VH = 1.0; // duración del finale, en alto de viewport (ritmo contemplativo)

const DESKTOP = {
  stepVh: 1.25, // scroll por carta, en alto de viewport
  farZ: -1400,
  nearZ: 500,
  rotIn: -18,
  rotOut: 18,
  blur: 10,
  breathe: 6,
  offX: [-0.08, 0.08, -0.06, 0.06], // fracción de ancho de viewport
  offY: [0.02, -0.02, 0.02, -0.02], // fracción de alto de viewport
};
const COMPACT_PROFILE = {
  stepVh: 1.0,
  farZ: -700,
  nearZ: 250,
  rotIn: -10,
  rotOut: 10,
  blur: 5,
  breathe: 3,
  offX: [-0.02, 0.02, -0.02, 0.02],
  offY: [0.01, -0.01, 0.01, -0.01],
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

const pose = (t, c) => {
  if (t < 0) {
    const k = ease(clamp01(t + 1));
    return { z: lerp(c.farZ, 0, k), ry: lerp(c.rotIn, 0, k), op: k, act: k };
  }
  if (t <= 0.5) return { z: 0, ry: 0, op: 1, act: 1 };
  const k = ease(clamp01((t - 0.5) / 0.5));
  return {
    z: lerp(0, c.nearZ, k),
    ry: lerp(0, c.rotOut, k),
    op: lerp(1, 0.15, k) * (1 - clamp01(t - 1)),
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

  // v recorre todo el pin: primero las cards (p) y después la absorción (absorb)
  const paint = (v) => {
    const c = profile();
    const cardsVh = c.stepVh * N;
    const cardsFrac = cardsVh / (cardsVh + ABSORB_VH);
    const p = clamp01(v / cardsFrac);
    const absorb = clamp01((v - cardsFrac) / (1 - cardsFrac));
    const u = p * (N + 1);
    const now = performance.now() / 1000;
    const W = window.innerWidth;
    const H = window.innerHeight;
    progressState.p = p;
    progressState.absorb = absorb;
    progressState.active = Math.min(N - 1, Math.max(0, Math.round(u - 1)));
    cards.forEach((card, i) => {
      const s = pose(u - i - 1, c);
      const dx = (c.offX[i] ?? 0) * W * s.act;
      const dy = (c.offY[i] ?? 0) * H * s.act;
      const blur = (1 - s.act) * c.blur;
      gsap.set(card, {
        x: dx,
        y: dy,
        z: s.z,
        rotationY: s.ry + Math.sin(now * 0.7 + i * 1.7) * c.breathe * s.act,
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
      scrub: 0.6,
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
