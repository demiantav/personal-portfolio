import { animateMenu } from './js/menuAnimation.js';
import { pageLoad, animateSectionText } from './js/textAnimate.js';
import { Waves } from './js/waves.js';

document.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
  animateSectionText();
});
