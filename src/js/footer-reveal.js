import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';
import { progressState } from './progressState.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Footer reveal: el pie vive FIJO en su posición final durante toda la sesión,
// oculto tras el lienzo opaco de la sección de proceso. El documento reserva su
// alto (margin en #hero) como ventana de scroll: al final, el proceso sale
// revelando el pie sin que este se mueva un pixel.
// Finale: cuando los ojos cierran (evento eyesClosed) el humo ya fue absorbido y
// un aro en tiempo fijo revela el pie a través de un agujero del velo (progressFog.js).
// La escena del pie avanza con ese aro. Si los ojos se reabren, todo se revierte.
export const footerReveal = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progress = document.querySelector('.main__progress-section');
  const footer = document.querySelector('.main__contact-section');
  const page = document.querySelector('#hero');
  if (!progress || !footer || !page || reduceMotion) return;

  // Fija el pie detrás del contenido y reserva su alto como runway
  document.body.classList.add('footer-reveal-active');
  const syncRunway = () => {
    page.style.marginBottom = `${footer.offsetHeight}px`;
  };
  syncRunway();
  // Mismo patrón de progressCards3D: recalcular antes de cada medición
  // de triggers (el alto del pie cambia con breakpoints/orientación)
  ScrollTrigger.addEventListener('refreshInit', syncRunway);

  // El anchor #contact apunta a un elemento fixed (sin posición de scroll):
  // llevar al usuario al final del documento directamente
  document.querySelectorAll('a[href="#contact"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: document.documentElement.scrollHeight - window.innerHeight,
        behavior: 'smooth',
      });
    });
  });

  // ─── Coreografía de entrada ─────────────────────────────────────────
  const wrapper = footer.querySelector('.main__contact-section-wrapper');
  const header = footer.querySelector('.main__contact-header');
  const titleEl = footer.querySelector('.contact-title');
  const nav = footer.querySelector('.contact-section__nav-wrapper');
  const btn = footer.querySelector('.contact-section__btn-contact');
  const line = footer.querySelector('.contact-section_footer-line');
  const bottom = footer.querySelector('.contact-section__bottom-info');
  if (!wrapper || !titleEl) return;

  // Título por palabras con máscara (mismo ADN que los títulos de sección).
  // Sin autoSplit: título corto, evitamos re-splits.
  // Compensación de recorte para descendentes (g, y), igual que #projects
  titleEl.style.padding = '0.14em 0.05em';
  titleEl.style.margin = '-0.14em -0.05em';
  // chars + words: la entrada sigue por palabra (máscara), pero las letras
  // quedan disponibles para el imán del cursor (footerTitleMagnet.js).
  const titleSplit = SplitText.create(titleEl, { type: 'chars, words', mask: 'words' });
  const titleWords = titleSplit.words;
  const titleMasks = titleSplit.masks;

  // Publica las letras: propiedad + evento, así el módulo del imán funciona
  // tanto si se inicializa antes como después del split.
  titleEl.__titleChars = titleSplit.chars;
  window.dispatchEvent(
    new CustomEvent('footerTitleReady', { detail: { chars: titleSplit.chars, titleEl } }),
  );

  // Meta del header: "Torino, Italy" es texto estático → chars con máscara.
  // La hora NO puede splitearse a caracteres: setClock reescribe el
  // textContent de .hour/.minutes cada segundo y rompería las máscaras en
  // pleno vuelo. Cada unidad se envuelve en su propia máscara (estructura
  // estable para el reloj) y anima como bloque con el mismo ADN.
  const locationEl = header?.querySelector('p:not(.time)');
  const wrapMask = (el) => {
    if (!el) return null;
    // los transforms no aplican sobre elementos inline: la unidad debe ser
    // inline-block para poder volar dentro de su máscara
    el.style.display = 'inline-block';
    const mask = document.createElement('span');
    mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:bottom;';
    el.replaceWith(mask);
    mask.appendChild(el);
    return el;
  };
  const timeUnits = [
    wrapMask(footer.querySelector('.hour')),
    wrapMask(footer.querySelector('.colon')),
    wrapMask(footer.querySelector('.minutes')),
  ].filter(Boolean);

  // ADN Skills/Projects: ráfaga caótica de caracteres con máscara
  const burstDNA = {
    duration: 0.35,
    yPercent: 'random([-100, 100])',
    ease: 'back.out',
    stagger: { from: 'random', amount: 0.45 },
  };

  // Estados iniciales con .set: se aplican SÍ o SÍ al ejecutarse
  gsap.set(titleWords, { yPercent: 110 });
  if (nav) gsap.set(nav, { autoAlpha: 0, y: 24 });
  if (line) gsap.set(line, { scaleX: 0, transformOrigin: 'left center' });
  if (bottom) gsap.set(bottom, { autoAlpha: 0, y: 24 });

  // Máscaras del título: se liberan cuando el titular ya asentó (para no
  // recortar el imán del cursor) y vuelven a ocultarse al revertir la escena.
  const setMasks = (released) => {
    titleMasks.forEach((m) => {
      m.style.overflow = released ? 'visible' : 'hidden';
    });
    // El título ya asentó: el imán recalcula sus bases (ya sin el yPercent del
    // reveal ni las máscaras intermedias).
    if (released) window.dispatchEvent(new Event('footerRevealSettled'));
  };

  // La CTA y la meta se splitean acá: sus máscaras entran a la misma escena
  let btnChars = [];
  if (btn) {
    const btnSplit = SplitText.create(btn, { type: 'chars', mask: 'chars' });
    // letter-spacing -4px: la tinta de cada glifo desborda su caja de avance
    // y la máscara (overflow:hidden) corta los bordes. Holgura con margen
    // negativo: mismo layout, sin recortes (mismo truco que .contact-title)
    btnSplit.masks.forEach((m) => {
      m.style.padding = '0.1em 0.07em';
      m.style.margin = '-0.1em -0.07em';
    });
    btnChars = btnSplit.chars;
  }
  const locationChars = locationEl
    ? SplitText.create(locationEl, { type: 'chars', mask: 'chars' }).chars
    : [];

  // Cada elemento tiene su propia entrada, de duración fija: arranca cuando el agujero
  // del aro lo alcanza y se revierte si el aro retrocede. Sin scrub: cada entrada
  // termina con su ease completo
  const groups = [];
  const addGroup = (el, build) => {
    const tl = gsap.timeline({ paused: true });
    build(tl);
    groups.push({ el, tl, cx: 0, cy: 0, on: false });
  };
  if (line) addGroup(line, (tl) => tl.to(line, { scaleX: 1, duration: 1.1, ease: 'power3.out' }));
  if (btnChars.length) addGroup(btn, (tl) => tl.from(btnChars, { ...burstDNA }));
  if (locationChars.length) addGroup(locationEl, (tl) => tl.from(locationChars, { ...burstDNA }));
  if (bottom) addGroup(bottom, (tl) => tl.to(bottom, { autoAlpha: 1, y: 0, duration: 0.3 }));
  if (timeUnits.length) addGroup(timeUnits[0], (tl) => tl.from(timeUnits, { ...burstDNA }));
  if (nav) addGroup(nav, (tl) => tl.to(nav, { autoAlpha: 1, y: 0, duration: 0.25 }));
  addGroup(titleEl, (tl) => tl.to(titleWords, { yPercent: 0, duration: 0.3, stagger: 0.05, ease: 'power1.out' }));

  const measure = () => {
    groups.forEach((g) => {
      const rc = g.el.getBoundingClientRect();
      g.cx = rc.left + rc.width / 2;
      g.cy = rc.top + rc.height / 2;
    });
  };
  measure();
  window.addEventListener('resize', measure);

  // El radio del agujero (r · revealMax) decide cuándo cada elemento arranca o se
  // revierte. Al completarse el aro, las máscaras se liberan.
  let lastReveal = -1;
  let settled = false;
  gsap.ticker.add(() => {
    const r = progressState.reveal;
    if (r === lastReveal) return;
    lastReveal = r;
    const ox = progressState.revealX;
    const oy = progressState.revealY;
    const radius = r * (progressState.revealMax || 1);
    groups.forEach((g) => {
      const on = radius >= Math.hypot(g.cx - ox, g.cy - oy);
      if (on === g.on) return;
      g.on = on;
      if (on) g.tl.play();
      else g.tl.reverse();
    });
    if ((r >= 1) !== settled) {
      settled = r >= 1;
      setMasks(settled);
    }
  });
};
