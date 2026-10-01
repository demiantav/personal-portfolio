import { buildRoll } from './roll.js';

// Letter roll del menú del footer: mismo ADN que el navbar, pero con clases /
// colores propios (el movimiento vive en CSS). Solo desktop con hover fino y
// sin reduced-motion: en el resto los links quedan planos.
const HOVER_DESKTOP = '(width >= 970px) and (hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';

export const footerNavRoll = () => {
  if (!window.matchMedia(HOVER_DESKTOP).matches || window.matchMedia(REDUCE).matches) return;
  document.querySelectorAll('nav.contact-section__nav-links-wrapper ul a').forEach(buildRoll);
};
