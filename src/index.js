import { animateMenu } from './js/menuAnimation.js';
import { pageLoad, animateSectionText } from './js/textAnimate.js';
import { Waves } from './js/waves.js';
import setClock from './js/time.js';

document.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
  animateSectionText();
  setClock();
});
