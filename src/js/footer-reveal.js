import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Footer reveal sin pins ni saltos: el pie vive FIJO en su posición final
// durante toda la sesión, oculto tras el lienzo opaco de la sección de
// proceso. El documento reserva su alto (margin en #hero) como ventana de
// scroll: al llegar al final, el proceso sale revelando el pie sin que este
// se mueva un pixel. Dentro de esa ventana corre una coreografía por capas:
// créditos/nav/titular siguen al scroll (revertibles), mientras línea, CTA y
// meta disparan una sola vez al cruzar su umbral y completan por sí solas.
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
    mask.style.cssText =
      'display:inline-block;overflow:hidden;vertical-align:bottom;';
    el.replaceWith(mask);
    mask.appendChild(el);
    return el;
  };
  const timeUnits = [
    wrapMask(footer.querySelector('.hour')),
    wrapMask(footer.querySelector('.colon')),
    wrapMask(footer.querySelector('.minutes')),
  ].filter(Boolean);

  // ADN Skills/Projects: ráfaga caótica de caracteres con máscara, una vez
  const burstDNA = {
    duration: 0.35,
    yPercent: 'random([-100, 100])',
    ease: 'back.out',
    stagger: { from: 'random', amount: 0.45 },
  };

  // Estados iniciales con .set: se aplican SÍ o SÍ al ejecutarse, sin la
  // ambigüedad de immediateRender dentro de timelines scrubbed
  gsap.set(wrapper, { yPercent: 6 });
  gsap.set(titleWords, { yPercent: 110 });
  if (nav) gsap.set(nav, { autoAlpha: 0, y: 24 });
  if (line) gsap.set(line, { scaleX: 0, transformOrigin: 'left center' });
  if (bottom) gsap.set(bottom, { autoAlpha: 0, y: 24 });

  // Disparos únicos por umbral: cruzado su slot de progreso, cada animación
  // corre completa aunque el scroll se detenga (dejan de reaccionar al
  // scroll por diseño). El estado pre-disparo queda oculto tras las máscaras.
  // El slot se mide de la geometría real: el reveal descubre el pie de abajo
  // hacia arriba, así que un elemento recién es visible cuando el progreso
  // alcanza su altura sobre el borde inferior del pie (con una pizca de
  // anticipo para que la ráfaga arranque al asomar los primeros píxeles).
  const LEAD = 0.03;
  const slotFor = (el) => {
    const fr = footer.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    return gsap.utils.clamp(0.02, 0.92, (fr.bottom - er.top) / fr.height - LEAD);
  };
  const shots = [];
  const addShot = (el, tween) => shots.push({ el, tween, done: false });
  // Línea: se dibuja de una vez con el ADN de las líneas divisorias del sitio
  if (line)
    addShot(
      line,
      gsap.to(line, { scaleX: 1, duration: 1.1, ease: 'power3.out', paused: true }),
    );
  // CTA: la frase entera estalla en caracteres
  if (btn) {
    const btnSplit = SplitText.create(btn, { type: 'chars', mask: 'chars' });
    // letter-spacing -4px: la tinta de cada glifo desborda su caja de avance
    // y la máscara (overflow:hidden) corta los bordes. Holgura con margen
    // negativo: mismo layout, sin recortes (mismo truco que .contact-title)
    btnSplit.masks.forEach((m) => {
      m.style.padding = '0.1em 0.07em';
      m.style.margin = '-0.1em -0.07em';
    });
    addShot(btn, gsap.from(btnSplit.chars, { ...burstDNA, paused: true }));
  }
  // Meta: ubicación + hora cierran la entrada (la hora mide su <p> contenedor)
  if (locationEl)
    addShot(
      locationEl,
      gsap.from(SplitText.create(locationEl, { type: 'chars', mask: 'chars' }).chars, {
        ...burstDNA,
        paused: true,
      }),
    );
  if (timeUnits.length)
    addShot(timeUnits[0].closest('p'), gsap.from(timeUnits, { ...burstDNA, paused: true }));

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
      onUpdate: (self) => {
        const p = self.progress;
        for (const shot of shots) {
          // slot perezoso: rect del footer fijo siempre verídico, y un resize
          // previo al disparo se absorve midiendo recién al cruzar
          shot.slot ??= slotFor(shot.el);
          if (!shot.done && p >= shot.slot) {
            shot.done = true;
            shot.tween.play();
          }
        }
      },
    },
    defaults: { ease: 'none' },
  });

  tl.to(wrapper, { yPercent: 0, duration: 1 }, 0);
  // De abajo para arriba (parte scrubbed): créditos → nav → titular.
  // Línea, CTA y meta disparan por umbral como one-shots
  if (bottom) tl.to(bottom, { autoAlpha: 1, y: 0, duration: 0.3 }, 0);
  if (nav) tl.to(nav, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.45);
  // Titular: palabras emergiendo de sus máscaras
  tl.to(titleWords, { yPercent: 0, duration: 0.3, stagger: 0.05, ease: 'power1.out' }, 0.5);

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
