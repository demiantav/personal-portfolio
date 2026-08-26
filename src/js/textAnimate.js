import gsap from 'gsap';
import SplitText from 'gsap/SplitText';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { Waves } from './waves';

gsap.registerPlugin(SplitText, ScrollTrigger);

export const waves = new Waves({
  dom: document.getElementById('webgl'),
});

export const pageLoad = ({ onReady } = {}) => {
  // 🔒 Bloquear scroll al inicio
  document.body.classList.add('no-scroll');

  const $titleChars = document.querySelectorAll('.preloader__char');
  const $logo = document.querySelector('.header__logo-img');
  const $hamb = document.querySelectorAll('.header__container-hamb');
  const $menu_full_page = document.querySelectorAll('.header__nav-link');
  const $containerblue = document.querySelector('.preloader');
  // titular spliteado para su entrada por letras (sin autoSplit: la intro es
  // pura transform/opacity, y así eliminamos cualquier re-split a mitad de ella)
  const titleSplit = SplitText.create('.zoom-effect', { type: 'chars' });

  const tl = gsap.timeline({
    delay: 1,
    onComplete: () => {
      // 🔓 Desbloquear scroll recién AL TERMINAR toda la secuencia
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
    '<',
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
          window.scrollTo(0, 0);
          onReady?.(); // triggers con layout real, nunca contra el doc colapsado
          // Refresh individual escalonado: el global mide con el pin revertido
          // y corrompe starts; el individual mide contra el layout real.
          const refreshAll = () => ScrollTrigger.getAll().forEach((t) => t.refresh());
          refreshAll();
          requestAnimationFrame(refreshAll); // imágenes que cargan justo tras el unlock
          setTimeout(refreshAll, 300);
        },
      },
      '<+=0.5',
    )
    .from(
      titleSplit.chars,
      {
        // 1️⃣ TITULAR: vuela a su lugar desde la derecha, en orden aleatorio
        // (espejo de su salida durante el zoom)
        xPercent: 'random(80, 180)',
        yPercent: 'random(-60, 60)',
        rotation: 'random(-30, 30)',
        autoAlpha: 0,
        force3D: true,
        stagger: { each: 0.025, from: 'random' },
        ease: 'power2.out',
        duration: 0.85,
      },
      '<',
    );

  // anclamos la secuencia al final de la cascada del titular
  const titleFly = tl.recent();
  tl.from(
    '.main__container-titles h4',
    {
      // 1️⃣ H4S: eco del titular, entran dentro de su mismo beat
      opacity: 0,
      yPercent: 100,
      stagger: 0.08,
      ease: 'power3.inOut',
      duration: 0.65,
    },
    titleFly.startTime() + 0.25,
  );

  tl.from(
    [$hamb, $logo, $menu_full_page],
    {
      // 2️⃣ MENÚ: la interfaz entra cuando el texto ya está en pantalla
      opacity: 0,
      yPercent: 350,
      stagger: 0.05,
      ease: 'power3.inOut',
      duration: 0.68,
    },
    titleFly.startTime() + 0.95,
  );

  // 3️⃣ WAVES: el entorno se materializa al final, llenando la escena
  tl.call(() => waves.start(), [], titleFly.startTime() + 1.25);
};

// ADN compartido de títulos de sección: ráfaga caótica de letras con máscara.
// opts: { duration, stagger } para variantes de ritmo por sección
const animateSectionHeader = (trigger, opts = {}) => {
  SplitText.create(trigger, {
    type: 'chars',
    mask: 'chars',
    autoSplit: true,
    smartWrap: true,
    onSplit(self) {
      const tween = gsap.from(self.chars, {
        duration: opts.duration ?? 0.48,
        yPercent: 'random([-100, 100])',
        ease: 'back.out',
        stagger: {
          from: 'random',
          amount: opts.stagger ?? 0.8,
        },
        scrollTrigger: {
          trigger,
          start: 'top 80%',
          toggleActions: 'play none none none', // una sola vez
        },
      });
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
  });
};

export const animateSectionText = () => {
  SplitText.create('.main__title', {
    type: 'chars',
    mask: 'chars',
    autoSplit: true,
    onSplit(self) {
      // runs every time it splits
      const tween = gsap.from(self.chars, {
        duration: 0.48,
        y: 150,
        autoAlpha: 0,
        stagger: {
          from: 'start',
          amount: 0.5,
        },

        scrollTrigger: {
          trigger: '.main__title',
          start: 'top 90%',
        },
      });
      // al re-splittear, matar tween Y su ScrollTrigger (evita huérfanos)
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
  });

  SplitText.create('.main__about-text', {
    type: 'words',
    autoSplit: true,
    onSplit(self) {
      // runs every time it splits
      const wordsTween = gsap.from(self.words, {
        duration: 0.8,
        yPercent: 'random([-80, 80])',
        rotation: 'random([-20, 30])',
        ease: 'back.out',
        autoAlpha: 0,
        stagger: {
          amount: 0.9,
          from: 'start',
        },
        scrollTrigger: {
          trigger: '.main__about-text',
          start: 'top 90%',
        },
      });

      const emojiTween = gsap.from('.main__emoji', {
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
          start: 'top 90%',
        },
      });

      const killWithTrigger = (tween) => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
      return () => {
        killWithTrigger(wordsTween);
        killWithTrigger(emojiTween);
      };
    },
  });

  // títulos de sección comparten el mismo ADN; Projects y Skills con
  // variante ágil (progress conserva su dispersión teatral)
  animateSectionHeader('.section-title__progress');
  animateSectionHeader('#projects', { duration: 0.35, stagger: 0.45 });
  animateSectionHeader('.section-title__about', { duration: 0.35, stagger: 0.45 });

  SplitText.create('.main__about-me-secundary', {
    type: 'words',
    mask: 'words',
    autoSplit: true,
    smartWrap: true,
    onSplit(self) {
      const tween = gsap.from(self.words, {
        duration: 0.89,
        yPercent: '100, -100',
        ease: 'back.out',
        yoyo: true,
        stagger: {
          amount: 0.9,
          from: 'start',
        },

        scrollTrigger: {
          trigger: '.main__about-me-secundary',
          start: 'top 90%',
        },
      });
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
  });
};
