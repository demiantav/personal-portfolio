import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const YPERCENT = [-12, 18, -8];

export const parallaxAnimations = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frames = gsap.utils.toArray('.main__gallery .reveal-frame');
  if (frames.length === 0) return;

  const layers = frames.map((frame) => {
    const img = frame.querySelector('img');
    const layer = document.createElement('div');
    layer.className = 'parallax-layer';
    frame.appendChild(layer);
    layer.appendChild(img);
    return layer;
  });

  if (reduceMotion) return;

  gsap.timeline({
    scrollTrigger: {
      trigger: '.main__gallery',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      invalidateOnRefresh: true,
    },
  }).fromTo(
    layers,
    { yPercent: (i) => -YPERCENT[i % YPERCENT.length] },
    { yPercent: (i) => YPERCENT[i % YPERCENT.length], ease: 'none' },
    0,
  );
};