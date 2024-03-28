import { animateMenu } from './js/menuAnimation.js';
import { pageLoad } from './js/textAnimate.js';

const d = document;

d.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
});
