import ScrollTrigger from 'gsap/ScrollTrigger';

// Footer reveal sin pins ni saltos: el pie vive FIJO en su posición final
// durante toda la sesión, oculto tras el lienzo opaco de la sección de
// proceso. El documento reserva su alto (margin en #hero) como ventana de
// scroll: al llegar al final, el proceso sale en scroll natural revelando
// el pie sin que este se mueva un pixel. Sin animación de salida: el
// movimiento es puramente geométrico.
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
};
