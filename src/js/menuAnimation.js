import { buildRoll } from './roll.js';

let $links;

const hoverDesktop = window.matchMedia('(width >= 970px) and (hover: hover) and (pointer: fine)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Solo en desktop con hover y sin reduce-motion: en mobile/overlay el texto
// queda plano (el builder ni se ejecuta).
const applyRoll = () => {
  if (!hoverDesktop.matches || reduceMotion.matches) return;
  $links.forEach((link) => {
    const span = link.querySelector('.header__span');
    if (span) buildRoll(span);
  });
};

export const animateMenu = () => {
  const d = document;
  const $hamb = d.querySelectorAll('.header__hamb'),
    $menu = d.querySelector('.header__nav-menu');

  $links = d.querySelectorAll('.header__nav-link');

  applyRoll();
  hoverDesktop.addEventListener('change', applyRoll);
  reduceMotion.addEventListener('change', applyRoll);

  $hamb.forEach((e) =>
    e.addEventListener('click', () => {
      console.log('click');

      $menu.classList.toggle('open');
    })
  );

  $links.forEach((link) =>
    link.addEventListener('click', () => {
      $menu.classList.remove('open');
    })
  );

  $links.forEach((link) =>
    link.addEventListener('click', () => {
      if (!d.startViewTransition) {
        activeLink(link);
        return;
      }

      // El overlay de la View Transition tapa el hit-test del header: se marca
      // vt-active para congelar el tema y se avisa al terminar (headerTheme).
      d.documentElement.classList.add('vt-active');
      const vt = d.startViewTransition(() => {
        activeLink(link);
      });
      vt.finished.finally(() => {
        d.documentElement.classList.remove('vt-active');
        window.dispatchEvent(new Event('vt-done'));
      });
    })
  );
};

const activeLink = (link) => {
  $links.forEach((l) => l.classList.remove('active'));
  link.classList.add('active');
};
