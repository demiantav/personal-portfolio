import gsap from 'gsap';
import SplitText from 'gsap/SplitText';
import { buildRoll } from './roll.js';

gsap.registerPlugin(SplitText);

// Menú del header. Desktop (≥970): barra inline con el roll por letra (buildRoll).
// Mobile (<970): overlay que, además del slide, hace entrar sus ítems con
// máscaras en cascada. Incluye scroll-lock, foco, Esc y trap.
const hoverDesktop = window.matchMedia('(width >= 970px) and (hover: hover) and (pointer: fine)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobile = window.matchMedia('(width < 970px)');

let $menu;
let $links;
let $openBtn;
let $closeBtn;
let $logoImg;
let $closeInner;
let $sayHello;
let $socials;

let mobileSplitSpans = [];
let isOpen = false;
let introTl;
let outroTl;
let lastFocused = null;

// Un <span> puede tener el roll (desktop) o el split (mobile): antes de aplicar
// uno, se restaura el texto original para no anidar estructuras.
const ensurePlain = (span) => {
  if (span.dataset.rollBuilt) {
    span.textContent = span.dataset.originalText || span.textContent;
    delete span.dataset.rollBuilt;
  }
  if (span._split) {
    span._split.revert();
    span._split = null;
  }
};

const buildMobileSplits = () => {
  if (!mobile.matches) return;
  $links.forEach((link) => {
    const span = link.querySelector('.header__span');
    if (!span || span._split) return;
    ensurePlain(span);
    const split = SplitText.create(span, { type: 'words', mask: 'words' });
    // Aire horizontal en las máscaras: con el tracking negativo, la tinta de la
    // última letra se sale de la caja y el overflow la recortaría.
    split.masks.forEach((m) => {
      m.style.paddingInline = '0.08em';
      m.style.marginInline = '-0.08em';
    });
    span._split = split;
    mobileSplitSpans.push(span);
  });
};

const revertMobileSplits = () => {
  mobileSplitSpans.forEach((span) => {
    if (span._split) {
      span._split.revert();
      span._split = null;
    }
  });
  mobileSplitSpans = [];
};

const linkWords = () => {
  const words = [];
  $links.forEach((link) => {
    const span = link.querySelector('.header__span');
    if (span && span._split) words.push(...span._split.words);
  });
  return words;
};

// Desktop: roll por letra. No corre en mobile ni con reduce-motion.
const applyRoll = () => {
  if (!hoverDesktop.matches || reduceMotion.matches) return;
  revertMobileSplits();
  $links.forEach((link) => {
    const span = link.querySelector('.header__span');
    if (!span || span.dataset.rollBuilt) return;
    span.dataset.originalText = span.textContent.trim();
    buildRoll(span);
  });
};

const lockScroll = (on) => document.documentElement.classList.toggle('menu-open', on);

const setHidden = () => {
  gsap.set($logoImg, { yPercent: 250 }); // supera la altura del contenedor (close)
  gsap.set($closeInner, { yPercent: 120 });
  gsap.set(linkWords(), { yPercent: 110 });
  gsap.set([$sayHello, $socials], { autoAlpha: 0, y: 20 });
};

const playIntro = () => {
  introTl?.kill();
  introTl = gsap
    // El panel hace el wipe (~0.9s) primero; los ítems entran después.
    .timeline({ delay: 0.85, defaults: { ease: 'expo.out' } })
    .to([$logoImg, $closeInner], { yPercent: 0, duration: 0.7 }, 0)
    .to(linkWords(), { yPercent: 0, duration: 0.7, stagger: 0.05 }, 0.12)
    .to($sayHello, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.4)
    .to($socials, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.5);
};

const playOutro = (onComplete) => {
  outroTl?.kill();
  outroTl = gsap
    .timeline({ onComplete, defaults: { ease: 'expo.in' } })
    .to(linkWords(), { yPercent: 110, duration: 0.45, stagger: 0.025 }, 0)
    .to($logoImg, { yPercent: 250, duration: 0.4 }, 0.05)
    .to($closeInner, { yPercent: 120, duration: 0.4 }, 0.05)
    .to([$sayHello, $socials], { autoAlpha: 0, y: 20, duration: 0.4 }, 0.05);
};

const openMenu = () => {
  if (isOpen) return;
  isOpen = true;
  lastFocused = document.activeElement;
  buildMobileSplits();
  $menu.classList.add('open');
  $openBtn?.setAttribute('aria-expanded', 'true');
  lockScroll(true);
  requestAnimationFrame(() => $closeBtn?.focus({ preventScroll: true }));
  if (reduceMotion.matches) return;
  setHidden();
  playIntro();
};

const closeMenu = ({ restoreFocus = true } = {}) => {
  if (!isOpen) return;
  isOpen = false;
  $openBtn?.setAttribute('aria-expanded', 'false');

  const finish = () => {
    $menu.classList.remove('open');
    lockScroll(false);
    if (restoreFocus) (lastFocused || $openBtn)?.focus({ preventScroll: true });
  };

  if (reduceMotion.matches || !mobile.matches) {
    introTl?.kill();
    finish();
    return;
  }
  playOutro(finish);
};

const menuFocusables = () =>
  Array.from($menu.querySelectorAll('a[href], button:not([disabled])')).filter(
    (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden',
  );

const onKeydown = (e) => {
  if (!isOpen || !mobile.matches) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
    return;
  }
  if (e.key !== 'Tab') return;
  const list = menuFocusables();
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
};

const goToLink = (link) => {
  closeMenu({ restoreFocus: false });
  if (!document.startViewTransition) {
    activeLink(link);
    return;
  }
  document.documentElement.classList.add('vt-active');
  const vt = document.startViewTransition(() => activeLink(link));
  vt.finished.finally(() => {
    document.documentElement.classList.remove('vt-active');
    window.dispatchEvent(new Event('vt-done'));
  });
};

const activeLink = (link) => {
  $links.forEach((l) => l.classList.remove('active'));
  link.classList.add('active');
};

const onMobileChange = (e) => {
  if (e.matches) return; // pasa a desktop
  if (isOpen) {
    isOpen = false;
    introTl?.kill();
    outroTl?.kill();
    $menu.classList.remove('open');
    $openBtn?.setAttribute('aria-expanded', 'false');
    lockScroll(false);
  }
  revertMobileSplits();
  applyRoll();
};

export const animateMenu = () => {
  const d = document;
  $menu = d.querySelector('.header__nav-menu');
  if (!$menu) return;
  $links = d.querySelectorAll('.header__nav-link');
  $openBtn = d.querySelector('.header__hamb[aria-label="open menu"]');
  $closeBtn = d.querySelector('.header__hamb[aria-label="close menu"]');
  $logoImg = $menu.querySelector('.header__container-logo img');
  $closeInner = $closeBtn?.querySelector('.header__container-hamb');
  $sayHello = d.querySelector('.header__say-hello-action');
  $socials = d.querySelector('.header__container-social-links');

  applyRoll();
  hoverDesktop.addEventListener('change', applyRoll);
  reduceMotion.addEventListener('change', applyRoll);
  mobile.addEventListener('change', onMobileChange);

  $openBtn?.addEventListener('click', openMenu);
  $closeBtn?.addEventListener('click', () => closeMenu());

  $links.forEach((link) => link.addEventListener('click', () => goToLink(link)));

  document.addEventListener('keydown', onKeydown);
};
