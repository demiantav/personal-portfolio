import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Overlap apilado About → Skills: el About queda pineado (sin pinSpacing)
// mientras Skills se desliza encima. El contenido escala hacia adentro de
// su propio fondo rojo full-bleed: el body nunca queda expuesto.
export const sectionOverlap = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const about = document.querySelector('.main__about-me-section');
  const skills = document.querySelector('.main__skills-section');
  if (!about || !skills || reduceMotion) return;

  // El contenido vive en un wrapper propio: la grilla pasa de la sección al
  // inner (CSS con guard :has() mantiene la grilla en la sección sin JS)
  const inner = document.createElement('div');
  inner.className = 'overlap-inner';
  [...about.childNodes].forEach((node) => inner.appendChild(node));
  about.appendChild(inner);

  // Velo que oscurece la sección saliente durante el tapado
  const dim = document.createElement('div');
  dim.className = 'overlap-dim';
  about.appendChild(dim);

  gsap.timeline({
    scrollTrigger: {
      trigger: skills,
      start: 'top bottom',
      end: 'top top',
      scrub: true,
      pin: about,
      pinSpacing: false,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
    defaults: { ease: 'none', duration: 1 },
  })
    .to(dim, { opacity: 0.45 }, 0)
    .to(inner, { scale: 0.94, transformOrigin: 'center top' }, 0);
};
