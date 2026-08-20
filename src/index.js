import { animateMenu } from './js/menuAnimation.js';
import { pageLoad, animateSectionText } from './js/textAnimate.js';
import setClock from './js/time.js';
import horizontalAnimation from './js/horizontalAnimation.js';
import { fixHeroBug } from './js/fixHeroBug.js';
import { animateReveals } from './js/reveal-animations.js';
import { parallaxAnimations } from './js/parallax-animations.js';
import { initHeroZoomTransition } from './js/hero-zoom-transition.js';

document.addEventListener('DOMContentLoaded', () => {
  //fixHeroBug();
  pageLoad();
  animateMenu();
  animateSectionText();
  //initHeroZoomTransition();
  setClock();
  horizontalAnimation();
  animateReveals();
  parallaxAnimations();
});
