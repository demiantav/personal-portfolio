import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Footer reveal sin pins ni saltos: el pie vive FIJO en su posición final
// durante toda la sesión, oculto tras el lienzo opaco de la sección de
// proceso. El documento reserva su alto (margin en #hero) como ventana de
// scroll: al llegar al final, el proceso sale revelando el pie sin que este
// se mueva un pixel. Dentro de esa ventana corre una coreografía de entrada
// por capas (solo transforms/opacity), revertible al subir el scroll.
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
  // Mismo patrón de horizontalAnimation: recalcular antes de cada medición
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

  // ─── Coreografía de entrada dentro de la ventana de reveal ──────────
  const wrapper = footer.querySelector('.main__contact-section-wrapper');
  const header = footer.querySelector('.main__contact-header');
  const titleEl = footer.querySelector('.contact-title');
  const nav = footer.querySelector('.contact-section__nav-wrapper');
  const btn = footer.querySelector('.contact-section__btn-contact');
  const line = footer.querySelector('.contact-section_footer-line');
  const bottom = footer.querySelector('.contact-section__bottom-info');
  if (!wrapper || !titleEl) return;

  // Título por palabras con máscara (mismo ADN que los títulos de sección).
  // Sin autoSplit: título corto, evitamos re-splits dentro del scrubbed.
  // Compensación de recorte para descendentes (g, y), igual que #projects
  titleEl.style.padding = '0.14em 0.05em';
  titleEl.style.margin = '-0.14em -0.05em';
  const titleWords = SplitText.create(titleEl, { type: 'words', mask: 'words' }).words;

  // Estados iniciales con .set: se aplican SÍ o SÍ al ejecutarse, sin la
  // ambigüedad de immediateRender dentro de timelines scrubbed
  gsap.set(wrapper, { yPercent: 6 });
  gsap.set(titleWords, { yPercent: 110 });
  if (header) gsap.set(header, { autoAlpha: 0, y: 24 });
  if (nav) gsap.set(nav, { autoAlpha: 0, y: 24 });
  if (btn) gsap.set(btn, { autoAlpha: 0, scale: 0.92 });
  if (line) gsap.set(line, { scaleX: 0, transformOrigin: 'left center' });
  if (bottom) gsap.set(bottom, { autoAlpha: 0, y: 24 });

  // Sin trigger element: .main__progress-section es el MISMO elemento que
  // horizontalAnimation pinea, y ScrollTrigger no compensa el pin-spacer del
  // trigger propio (mediría 'bottom bottom' sin el largo del pin: la
  // coreografía correría entera detrás del lienzo aún opaco). Anclar al final
  // del documento es determinístico: la ventana ocupa exactamente los últimos
  // footer.offsetHeight px y termina SIEMPRE en maxScroll.
  const tl = gsap.timeline({
    scrollTrigger: {
      id: 'footerReveal',
      start: () => Math.max(0, ScrollTrigger.maxScroll(window) - footer.offsetHeight),
      end: () => ScrollTrigger.maxScroll(window),
      scrub: true,
      invalidateOnRefresh: true,
    },
    defaults: { ease: 'none' },
  });

  tl.to(wrapper, { yPercent: 0, duration: 1 }, 0);
  // De abajo para arriba: créditos → línea → CTA → nav → titular → meta
  if (bottom) tl.to(bottom, { autoAlpha: 1, y: 0, duration: 0.3 }, 0);
  if (line) tl.to(line, { scaleX: 1, duration: 0.25 }, 0.15);
  if (btn)
    tl.to(btn, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power1.out' }, 0.3);
  if (nav) tl.to(nav, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.45);
  // Titular: palabras emergiendo de sus máscaras
  tl.to(titleWords, { yPercent: 0, duration: 0.3, stagger: 0.05, ease: 'power1.out' }, 0.5);
  // Meta al final: ubicación y hora local cierran la entrada
  if (header) tl.to(header, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.75);

  const st = tl.scrollTrigger;

  // ─── Auto-sanación del trigger ──────────────────────────────────────
  // Este módulo corre dentro de onReady, con el preloader aún activo y
  // body.no-scroll puesto: el documento no tiene alto scrolleable y el
  // trigger mide start/end corruptos (start 0, maxScroll 0). Los refreshes
  // del pipeline central también vencen antes del unlock. Acá nos
  // re-medimos solos al primer scroll real o ni bien se libera el bloqueo.
  let healTimer;
  const tryHeal = () => {
    if (document.body.classList.contains('no-scroll')) {
      healTimer = setTimeout(tryHeal, 500);
      return;
    }
    window.removeEventListener('scroll', tryHeal);
    clearTimeout(healTimer);
    st.refresh();
  };
  window.addEventListener('scroll', tryHeal, { passive: true });
  healTimer = setTimeout(tryHeal, 500);
};
