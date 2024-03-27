import { animateMenu } from './src/js/menuAnimation';
import { pageLoad } from './src/js/textAnimate';

const d = document;

d.addEventListener('DOMContentLoaded', () => {
  pageLoad();
  animateMenu();
});
