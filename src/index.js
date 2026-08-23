import { animateMenu } from './js/menuAnimation.js';
import { pageLoad, animateSectionText } from './js/textAnimate.js';
import setClock from './js/time.js';
import horizontalAnimation from './js/horizontalAnimation.js';
import { animateReveals } from './js/reveal-animations.js';
import { parallaxAnimations } from './js/parallax-animations.js';
import { initHeroZoomTransition } from './js/hero-zoom-transition.js';
import ScrollTrigger from 'gsap/ScrollTrigger';

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// El refresh GLOBAL mide los triggers mientras revierte el pin del hero
// (spacer sin padding) y calcula starts corruptos que no corrige. El refresh
// INDIVIDUAL de cada trigger mide contra el layout real y sí es correcto.
const refreshTriggers = () => {
  ScrollTrigger.getAll().forEach((t) => t.refresh());
};

// Las <img> sin dimensiones intrínsecas cambian el layout al cargar:
// recalcular triggers cuando el documento llega a su estado definitivo
let imgRefreshTimeout;
const debouncedImgRefresh = () => {
  clearTimeout(imgRefreshTimeout);
  imgRefreshTimeout = setTimeout(refreshTriggers, 150);
};
document.querySelectorAll('img').forEach((img) => {
  if (!img.complete) img.addEventListener('load', debouncedImgRefresh);
});
window.addEventListener('load', () => refreshTriggers());
document.fonts?.ready.then(() => refreshTriggers());

document.addEventListener('DOMContentLoaded', () => {
  pageLoad({
    // Los triggers se crean recién cuando el preloader termina: layout final,
    // scroll en 0. Si se crean antes (documento colapsado por no-scroll),
    // sus starts quedan corruptos y ningún refresh los corrige.
    onReady: () => {
      animateSectionText();
      initHeroZoomTransition();
      horizontalAnimation();
      animateReveals();
      parallaxAnimations();
    },
  });
  animateMenu();
  setClock();
});
