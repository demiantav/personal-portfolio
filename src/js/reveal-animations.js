import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const animateReveals = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Líneas divisorias de about-me: se dibujan desde el borde de su alineación
  // (la secundaria vive a la derecha → espejo)
  if (!reduceMotion) {
    gsap.utils.toArray('.main__about-me-section .main__line').forEach((line) => {
      const fromRight = line.classList.contains('main__line--secondary');
      gsap.set(line, {
        scaleX: 0,
        transformOrigin: fromRight ? 'right center' : 'left center',
      });
      gsap.to(line, {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: line,
          start: 'top 60%',
          // una sola vez: dibujadas, quedan dibujadas
          toggleActions: 'play none none none',
          invalidateOnRefresh: true,
        },
      });
    });
  }

  const images = gsap.utils.toArray('.main__gallery img');
  if (images.length === 0) return;

  const frames = images.map((img) => {
    const frame = document.createElement('div');
    frame.className = 'reveal-frame';
    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);
    return frame;
  });

  if (reduceMotion) return;

  frames.forEach((frame) => {
    const img = frame.querySelector('img');

    gsap.set(frame, {
      clipPath: 'inset(0% 0% 0% 100%)',
      x: 60,
      scale: 1,
    });
    gsap.set(img, { scale: 1.35 });

    gsap
      .timeline({
        scrollTrigger: {
          trigger: frame,
          start: 'top 55%',
          toggleActions: 'play none none reverse',
          invalidateOnRefresh: true,
        },
        defaults: { ease: 'power3.out' },
      })
      .to(frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1 }, 0)
      .to(frame, { x: 0, duration: 1.2 }, 0)
      .to(frame, { scale: 0.9, duration: 1.4, ease: 'power2.inOut' }, 0)
      .to(img, { scale: 1, duration: 1.4 }, 0);
  });
};
