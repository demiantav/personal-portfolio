import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const animateReveals = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
