import { animateMenu } from './js/menuAnimation.js';
import { pageLoad, animateSectionText } from './js/textAnimate.js';
import setClock from './js/time.js';
import horizontalAnimation from './js/horizontalAnimation.js';
import { animateReveals } from './js/reveal-animations.js';
import { parallaxAnimations } from './js/parallax-animations.js';
import { initHeroZoomTransition } from './js/hero-zoom-transition.js';

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
  animateSectionText();
  initHeroZoomTransition();
  setClock();
  horizontalAnimation();
  animateReveals();
  parallaxAnimations();
});
