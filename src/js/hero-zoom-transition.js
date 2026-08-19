import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function getDeveloperDOrigin() {
  const heroEl = document.querySelector('.zoom-effect');
  const dEl = document.querySelector('.d-anchor');
  if (!heroEl || !dEl) return '50% 50%';

  // offsetLeft/offsetTop son relativos al offsetParent y se calculan
  // a partir del layout (box model), IGNORANDO cualquier transform CSS
  // que ya esté aplicado. Por eso no importa en qué punto del scroll
  // (o del scale) se dispare el recálculo: siempre da el mismo resultado.
  const heroWidth = heroEl.offsetWidth;
  const heroHeight = heroEl.offsetHeight;

  // Queremos el TRAZO VERTICAL de la D, no el centro del glifo completo
  // (que incluye la panza redonda). El trazo vertical está pegado al
  // borde izquierdo del span.
  const strokeX = dEl.offsetLeft + dEl.offsetWidth * 0.15; // ajustable
  const strokeY = dEl.offsetTop + dEl.offsetHeight / 2;

  const xPercent = (strokeX / heroWidth) * 100;
  const yPercent = (strokeY / heroHeight) * 100;

  return `${xPercent}% ${yPercent}%`;
}

export function initHeroZoomTransition() {
  gsap.to('.zoom-effect', {
    scale: 600,
    transformOrigin: getDeveloperDOrigin,
    force3D: true,
    scrollTrigger: {
      trigger: '.main__hero-section',
      scrub: 1,
      pin: true,
      start: 'top top',
      end: '+=5000',
      ease: 'none',
      invalidateOnRefresh: true,
    },
  });
}
