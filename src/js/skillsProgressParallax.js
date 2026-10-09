import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Parallax de costura Skills → Proceso: la sección durazno hace de cortina y
// el bloque de proceso queda "detrás". Solo transforms (nada de pines ni
// márgenes negativos): el contenido de Skills recede (lens pull: escala hacia
// atrás y sube) mientras el título de proceso emerge más grande y se asienta,
// con origen arriba para salir de detrás del arco del domo.
export const skillsProgressParallax = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skills = document.querySelector('.main__skills-section');
  const title = document.querySelector('.progress-title-section .section-title');
  if (!skills || !title || reduceMotion) return;

  // El fondo y el arco viven en la SECCIÓN (la silueta no debe deformarse);
  // el contenido va a un wrapper propio que sí se escala. Mismo patrón que
  // .overlap-inner de section-overlap.js. Sin JS el wrapper no existe y la
  // grilla sigue en la sección.
  let inner = skills.querySelector(':scope > .skills-inner');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'skills-inner';
    [...skills.childNodes].forEach((node) => inner.appendChild(node));
    skills.appendChild(inner);
  }

  gsap
    .timeline({
      scrollTrigger: {
        trigger: '.progress-title-section',
        start: 'top bottom',
        end: 'center 40%',
        scrub: true,
        invalidateOnRefresh: true,
      },
      defaults: { ease: 'none' },
    })
    // Cortina delantera: recede hacia atrás.
    .fromTo(inner, { scale: 1, yPercent: 0 }, { scale: 0.88, yPercent: -8 }, 0)
    // Plano de atrás: emerge (más grande) y se asienta.
    .fromTo(
      title,
      { scale: 1.12, yPercent: 16, transformOrigin: 'center top' },
      { scale: 1, yPercent: 0 },
      0,
    );
};
