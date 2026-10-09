import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const horizontalAnimation = () => {
  const horizontalSections = gsap.utils.toArray('.main__progress-section');

  horizontalSections.forEach(function (sec, i) {
    const pinWrap = sec.querySelector('.progress-section_cards-container');

    let pinWrapWidth;
    let horizontalScrollLength;

    function refresh() {
      pinWrapWidth = pinWrap.scrollWidth;
      horizontalScrollLength = pinWrapWidth - window.innerWidth;
    }

    refresh();

    // Un solo recorrido para todo el carrusel. scrub con inercia (0.6 s) suaviza
    // la rueda/trackpad sin cambiar la distancia; la inclinación de las cartas
    // queda en CSS (rotate) y no se toca desde JS.
    gsap.to(pinWrap, {
      scrollTrigger: {
        scrub: 0.6,
        trigger: sec,
        pin: sec,
        start: 'center center',
        end: () => `+=${pinWrapWidth}`,
        invalidateOnRefresh: true,
      },

      x: () => -horizontalScrollLength,
      ease: 'none',
    });

    ScrollTrigger.addEventListener('refreshInit', refresh);
  });
};

export default horizontalAnimation;
