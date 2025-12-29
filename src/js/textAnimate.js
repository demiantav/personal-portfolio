import gsap from 'gsap';
import SplitText from 'gsap/SplitText';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { Waves } from './waves';

gsap.registerPlugin(SplitText, ScrollTrigger);

const waves = new Waves({
  dom: document.getElementById('webgl'),
});

export const pageLoad = () => {
  // 🔒 Bloquear scroll al inicio
  document.body.classList.add('no-scroll');

  const $titleChars = document.querySelectorAll('.preloader__char');
  const $logo = document.querySelector('.header__logo-img');
  const $hamb = document.querySelectorAll('.header__container-hamb');
  const $menu_full_page = document.querySelectorAll('.header__nav-link');
  const $containerblue = document.querySelector('.preloader');

  const tl = gsap.timeline({
    delay: 1,
    onComplete: () => {
      // 🔓 Desbloquear scroll cuando termina la animación

      document.body.classList.remove('no-scroll');
    },
  });

  tl.from(
    $titleChars,
    {
      yPercent: 260,
      scale: -2.2,
      stagger: 0.05,
      ease: 'back.out',
      duration: 0.65,
    },
    '<'
  )
    .to('.preloader__title', {
      scale: 0.8,
      duration: 0.4,
      ease: 'power3.inOut',
      delay: 0.5,
    })
    .to(
      $containerblue,
      {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
        duration: 1,
        ease: 'power3.inOut',
        onComplete: () => {
          waves.start();
        },
      },
      '<+=0.5'
    )
    .from(
      [$hamb, $logo, $menu_full_page, '.main__container-titles h4'],
      {
        opacity: 0,
        yPercent: 350,
        stagger: 0.1,
        ease: 'power3.inOut',
        duration: 1.1,
      },
      '<'
    );
};

export const animateSectionText = () => {
  SplitText.create('.main__title', {
    type: 'chars',
    mask: 'chars',
    autoSplit: true,
    onSplit(self) {
      // runs every time it splits
      gsap.from(self.chars, {
        duration: 0.48,
        y: 150,
        autoAlpha: 0,
        stagger: {
          from: 'start',
          amount: 0.5,
        },

        scrollTrigger: {
          trigger: '.main__title',
          start: 'top 60%',
        },
      });
    },
  });

  SplitText.create('.main__about-text', {
    type: 'words',
    autoSplit: true,
    onSplit(self) {
      // runs every time it splits
      gsap.from(self.words, {
        duration: 0.8,
        yPercent: 'random([-80, 80])',
        rotation: 'random([-20, 30])',
        ease: 'back.out',
        color: '#ef2e48',
        autoAlpha: 0,
        stagger: {
          amount: 0.9,
          from: 'start',
        },
        scrollTrigger: {
          trigger: '.main__about-text',
          start: 'top 30%',
        },
      });

      gsap.from('.main__emoji', {
        duration: 0.8,
        yPercent: 'random([-80, 80])',
        rotation: 'random([-20, 30])',
        ease: 'back.out',
        color: '#ef2e48',
        autoAlpha: 0,
        stagger: {
          amount: 0.9,
          from: 'start',
        },
        scrollTrigger: {
          trigger: '.main__emoji',
          start: 'top 30%',
        },
      });
    },
  });
};
