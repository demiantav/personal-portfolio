import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
  gsap.to('.zoom-effect', {
    scale: 500,
    transformOrigin: getDeveloperDOrigin,
    force3D: true,
    scrollTrigger: {
      trigger: '.hero-pin', // antes: '.main__hero-section', ya no existe
      scrub: 1,
      pin: true,
      start: 'top top',
      end: '+=1000',
      ease: 'none',
      invalidateOnRefresh: true,
    },
  });
}
