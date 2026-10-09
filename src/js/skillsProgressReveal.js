import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Reveal fijado Skills → Proceso: mientras Skills (la cortina, z3) se desliza
// hacia arriba, la sección de progreso queda FIJA detrás (z2) y se destapa.
// Al terminar de salir Skills, la sección queda STICKY dentro de su holder:
// el holder reserva PIN_VH de scroll extra, durante el cual el título sigue
// clavado en el viewport (los ojos de processEyes.js abren en ese mismo punto).
// Después la sección sale con normalidad hacia las tarjetas.
// Encima se mantiene el "lens pull": el contenido de Skills recede y el título
// de progreso emerge y se asienta.
const PIN_VH = 0.5;

export const skillsProgressReveal = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skills = document.querySelector('.main__skills-section');
  const section = document.querySelector('.progress-title-section');
  if (!skills || !section || reduceMotion) return;

  const title = section.querySelector('.section-title');

  // Contenido de Skills a un wrapper propio para poder escalarlo sin deformar
  // el fondo ni el arco/bisel (mismo patrón que .overlap-inner).
  let inner = skills.querySelector(':scope > .skills-inner');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'skills-inner';
    [...skills.childNodes].forEach((node) => inner.appendChild(node));
    skills.appendChild(inner);
  }

  // El holder ocupa el alto de la sección + el recorrido de pin: la sección
  // sticky queda fija mientras el holder se recorre y luego sale con él.
  let holder = section.parentElement;
  if (!holder || !holder.classList.contains('progress-reveal')) {
    holder = document.createElement('div');
    holder.className = 'progress-reveal';
    section.parentNode.insertBefore(holder, section);
    holder.appendChild(section);
  }
  const syncHolder = () => {
    holder.style.height = `${section.offsetHeight + Math.round(window.innerHeight * PIN_VH)}px`;
  };
  syncHolder();
  ScrollTrigger.addEventListener('refreshInit', syncHolder);
  window.addEventListener('resize', syncHolder);

  const reveal = () => section.classList.add('is-revealed');
  const release = () => section.classList.remove('is-revealed');

  // Trigger sobre Skills (elemento no transformado): la ventana es exactamente
  // su salida, así ScrollTrigger no mide posiciones de la sección fija.
  gsap
    .timeline({
      scrollTrigger: {
        trigger: skills,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
        onEnter: reveal,
        onLeave: release,
        onEnterBack: reveal,
        onLeaveBack: release,
      },
      defaults: { ease: 'none' },
    })
    // Cortina delantera: recede hacia atrás (lens pull).
    .fromTo(inner, { scale: 1, yPercent: 0 }, { scale: 0.88, yPercent: -8 }, 0)
    // Plano de atrás: emerge (más grande) y se asienta.
    .fromTo(
      title,
      { scale: 1.12, yPercent: 16, transformOrigin: 'center top' },
      { scale: 1, yPercent: 0 },
      0,
    );
};
