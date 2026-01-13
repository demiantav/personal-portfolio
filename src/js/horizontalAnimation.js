import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const horizontalAnimation = () => {
  const horizontalSections = gsap.utils.toArray('.main__progress-section');

  horizontalSections.forEach(function (sec, i) {
    const pinWrap = sec.querySelector('.progress-section_cards-container');
    const cards = sec.querySelectorAll('.progress__card');

    let pinWrapWidth;
    let horizontalScrollLength;

    function refresh() {
      pinWrapWidth = pinWrap.scrollWidth;
      horizontalScrollLength = pinWrapWidth - window.innerWidth;
    }

    refresh();

    gsap.to(pinWrap, {
      scrollTrigger: {
        scrub: true,
        trigger: sec,
        pin: sec,
        start: 'center center',
        end: () => `+=${pinWrapWidth}`,
        invalidateOnRefresh: true,
      },

      x: () => -horizontalScrollLength,
      ease: 'none',
    });

    cards.forEach((card) => {
      gsap.to(card, {
        scrollTrigger: {
          trigger: card,
          scrub: true,
          start: 'center center',
          end: () => `+=${pinWrapWidth}`,
        },
        rotate: 0.5,
        ease: 'none',
      });
    });

    ScrollTrigger.addEventListener('refreshInit', refresh);
  });
};

export default horizontalAnimation;
