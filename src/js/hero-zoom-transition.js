import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';
import { waves } from './textAnimate.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

function getDeveloperDOrigin() {
  const heroEl = document.querySelector('.zoom-effect');
  const dEl = document.querySelector('.d-anchor');
  if (!heroEl || !dEl) return '50% 50%';

  const heroWidth = heroEl.offsetWidth;
  const heroHeight = heroEl.offsetHeight;

  const strokeX = dEl.offsetLeft + dEl.offsetWidth * 0.15;
  const strokeY = dEl.offsetTop + dEl.offsetHeight / 2;

  return `${(strokeX / heroWidth) * 100}% ${(strokeY / heroHeight) * 100}%`;
}

export function initHeroZoomTransition() {
  // Split por letra de los h4 para la salida cinematográfica
  const h4Chars = new SplitText('.main__container-titles h4', {
    type: 'chars',
  }).chars;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.hero-pin',
      scrub: 1,
      pin: true,
      start: 'top top',
      end: '+=200%',
      invalidateOnRefresh: true,
    },
  });

  // Fase 1 (0% → 28%): las waves se cortan una por una hacia la derecha
  tl.to(waves, { exitProgress: 1, duration: 0.28 }, 0)
    // Cada letra sale en cascada: whip hacia la derecha con deriva y giro aleatorio
    .to(
      h4Chars,
      {
        xPercent: 'random(80, 180)',
        yPercent: 'random(-60, 60)',
        rotation: 'random(-30, 30)',
        autoAlpha: 0,
        force3D: true,
        stagger: { each: 0.0022, from: 'start' },
        duration: 0.16,
        ease: 'power3.in',
      },
      0.02
    );

  // Fase 2 (28% → 100%): zoom cinematográfico sobre la "D"
  tl.to(
    '.zoom-effect',
    {
      scale: 420,
      transformOrigin: getDeveloperDOrigin,
      force3D: true,
      duration: 0.72,
    },
    0.28
  );
}
