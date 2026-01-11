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

    gsap.to(pinWrap, {
      scrollTrigger: {
        scrub: true,
        trigger: sec,
        pin: sec,
        start: 'center center',
        end: () => `+=${pinWrapWidth}`,
        invalidateOnRefresh: true,
        markers: true,
      },
      x: () => -horizontalScrollLength,
      ease: 'none',
    });

    ScrollTrigger.addEventListener('refreshInit', refresh);
  });
};

export default horizontalAnimation;
