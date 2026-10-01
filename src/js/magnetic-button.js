import { gsap } from 'gsap';

// Botón magnético del footer: al entrar, el círculo crece y la flecha se
// achica; moviendo el puntero el círculo se desliza tras él. Todo es transform
// (sin reflow) y se anima con GSAP. Solo desktop con hover fino y sin
// reduced-motion.
const HOVER_DESKTOP = '(width >= 970px) and (hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';

export const magneticBackToTop = () => {
  if (!window.matchMedia(HOVER_DESKTOP).matches || window.matchMedia(REDUCE).matches) return;

  const btn = document.querySelector('.back-to-top');
  const arrow = btn?.querySelector('svg');
  if (!btn) return;

  const MAX = 14;
  const STRENGTH = 0.35;
  const toX = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
  const toY = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });

  const onMove = (e) => {
    // Centro en reposo = rect actual − translate vivo (evita realimentación).
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2 - (gsap.getProperty(btn, 'x') || 0);
    const cy = r.top + r.height / 2 - (gsap.getProperty(btn, 'y') || 0);
    toX(gsap.utils.clamp(-MAX, MAX, (e.clientX - cx) * STRENGTH));
    toY(gsap.utils.clamp(-MAX, MAX, (e.clientY - cy) * STRENGTH));
  };

  const onEnter = () => {
    gsap.to(btn, { scale: 1.15, duration: 0.5, ease: 'back.out(2)' });
    gsap.to(arrow, { scale: 0.7, duration: 0.5, ease: 'back.out(2)' });
  };

  const onLeave = () => {
    toX(0);
    toY(0);
    gsap.to(btn, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    gsap.to(arrow, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
  };

  btn.addEventListener('pointerenter', onEnter);
  btn.addEventListener('pointermove', onMove);
  btn.addEventListener('pointerleave', onLeave);
};
