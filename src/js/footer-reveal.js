import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import ScrollToPlugin from 'gsap/ScrollToPlugin';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);

// Footer reveal: el pie vive FIJO en su posición final durante toda la sesión,
// oculto tras el lienzo opaco de la sección de proceso. El documento reserva su
// alto (margin en #hero) como ventana de scroll: al final, el proceso sale
// revelando el pie sin que este se mueva un pixel.
// Finale: cuando los ojos cierran (evento eyesClosed) el humo ya fue absorbido,
// la cortina se libera sola hacia arriba y el pie entra como una escena en
// tiempo, no atado al scroll. Si los ojos se reabren, la escena se revierte.
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
  gsap.set(wrapper, { yPercent: 6 });
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

  // Una sola escena en tiempo, disparada por los ojos al cerrarse
  const scene = gsap.timeline({
    paused: true,
    onReverseStart: () => setMasks(false),
    onComplete: () => setMasks(true),
  });
  scene.to(wrapper, { yPercent: 0, duration: 1 }, 0);
  if (line) scene.to(line, { scaleX: 1, duration: 1.1, ease: 'power3.out' }, 0.1);
  if (btnChars.length) scene.from(btnChars, { ...burstDNA }, 0.25);
  if (locationChars.length) scene.from(locationChars, { ...burstDNA }, 0.35);
  if (bottom) scene.to(bottom, { autoAlpha: 1, y: 0, duration: 0.3 }, 0.3);
  if (timeUnits.length) scene.from(timeUnits, { ...burstDNA }, 0.45);
  if (nav) scene.to(nav, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.5);
  scene.to(titleWords, { yPercent: 0, duration: 0.3, stagger: 0.05, ease: 'power1.out' }, 0.5);

  // Libera la cortina hacia arriba de forma automática, en paralelo a la escena.
  // Corta si el usuario empieza a scrollear.
  const root = document.documentElement;
  let lift = null;
  const liftCurtain = () => {
    const target = Math.max(0, ScrollTrigger.maxScroll(window));
    if (window.scrollY >= target - 2) return;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    const cleanup = () => {
      root.style.scrollBehavior = prevBehavior;
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
    const stop = () => {
      lift?.kill();
      cleanup();
    };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    lift = gsap.to(window, {
      duration: 0.9,
      ease: 'power2.inOut',
      scrollTo: { y: target, autoKill: false },
      onComplete: cleanup,
      onInterrupt: cleanup,
    });
  };

  window.addEventListener('eyesClosed', () => {
    scene.play();
    liftCurtain();
  });
  window.addEventListener('eyesOpened', () => {
    scene.reverse();
  });
};
