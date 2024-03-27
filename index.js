import { animateMenu } from './src/js/menuAnimation.js';
import { pageLoad } from './src/js/textAnimate.js';

const d = document;

d.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
});
