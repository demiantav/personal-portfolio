import { animateMenu } from './js/menuAnimation.js';
import { pageLoad, animateSectionText } from './js/textAnimate.js';
import setClock from './js/time.js';
import horizontalAnimation from './js/horizontalAnimation.js';

document.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
  animateSectionText();
  setClock();
  horizontalAnimation();
});
