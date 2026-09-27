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
  const $thread = document.querySelector('.item__name__line');
  const $rail = document.querySelector('.thread__rail');
  const $dot = document.querySelector('.thread__dot');
  const $pct = document.querySelector('.item__name__porcentage');
  const $burble = document.querySelector('.item__burble');
  const $phrases = gsap.utils.toArray('.thread-phrase');
  // titular spliteado para su entrada por letras (sin autoSplit: la intro es
  // pura transform/opacity, y así eliminamos cualquier re-split a mitad de ella)
  const titleSplit = SplitText.create('.zoom-effect', { type: 'chars' });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COUNT_DURATION = 3.9;
  // Longitud de hilo ya recorrida al 0% (respiro respecto del %)
  const THREAD_BASE = 0.25;
  const atPercent = (percent) => (percent / 100) * COUNT_DURATION;
  const progress = { v: 0 };

  // Cada palabra se divide en letras con máscara: los caracteres se recortan y
  // emergen desde el borde cercano al hilo ("desde adentro hacia afuera")
  const phrases = $phrases.map((root) => {
    const left = root.querySelector('.thread-phrase__left');
    const right = root.querySelector('.thread-phrase__right');
    const leftSplit = SplitText.create(left, { type: 'chars', mask: 'words' });
    const rightSplit = SplitText.create(right, { type: 'chars', mask: 'words' });
    gsap.set([left, right], { autoAlpha: 1 }); // la visibilidad la gobiernan las letras
    return { root, left: leftSplit.chars, right: rightSplit.chars };
  });

  // offset hacia el hilo: la izquierda entra desde la derecha y viceversa
  const OUT = { left: 120, right: -120 };

  const activate = (index, { instant = false, delay = 0 } = {}) => {
    const phrase = phrases[index];
    if (!phrase) return;
    if (instant) {
      gsap.set([...phrase.left, ...phrase.right], { xPercent: 0, autoAlpha: 1 });
      return;
    }
    gsap.fromTo(
      phrase.left,
      { xPercent: OUT.left, autoAlpha: 0 },
      {
        xPercent: 0,
        autoAlpha: 1,
        duration: 0.45,
        delay,
        ease: 'power3.out',
        stagger: { each: 0.03 },
      },
    );
    gsap.fromTo(
      phrase.right,
      { xPercent: OUT.right, autoAlpha: 0 },
      {
        xPercent: 0,
        autoAlpha: 1,
        duration: 0.45,
        delay,
        ease: 'power3.out',
        stagger: { each: 0.03 },
      },
    );
  };

  const deactivate = (index) => {
    const phrase = phrases[index];
    if (!phrase) return;
    gsap.to(phrase.left, {
      xPercent: OUT.left,
      autoAlpha: 0,
      duration: 0.28,
      ease: 'power3.in',
      stagger: { each: 0.02, from: 'end' },
    });
    gsap.to(phrase.right, {
      xPercent: OUT.right,
      autoAlpha: 0,
      duration: 0.28,
      ease: 'power3.in',
      stagger: { each: 0.02, from: 'end' },
    });
  };

  // todas las letras arrancan ocultas, corridas hacia el hilo
  phrases.forEach(({ left, right }) => {
    gsap.set(left, { xPercent: OUT.left, autoAlpha: 0 });
    gsap.set(right, { xPercent: OUT.right, autoAlpha: 0 });
  });

  const tl = gsap.timeline({
    delay: 1,
    onComplete: () => {
      // 🔓 Desbloquear scroll recién AL TERMINAR toda la secuencia
      document.body.classList.remove('no-scroll');
    },
  });

  if (reduceMotion) {
    // 🚫 Sin caída: estado final directo (solo la frase final), luego el wipe
    $thread.style.setProperty('--p', 100);
    $pct.textContent = '100';
    gsap.set($rail, { autoAlpha: 1 });
    activate(phrases.length - 1, { instant: true });
  } else {
    activate(0, { instant: true });
    // arranca ya con la longitud base, conectado a la punta (sin flotar)
    $thread.style.setProperty('--p', THREAD_BASE * 100);

    const markers = $phrases.map((el) => Number(el.dataset.at));
    let nextSwap = 1;

    // 0️⃣ HILO: un único progress mueve contador, hilo y punto. Lineal y recto.
    tl.to(progress, {
      v: 100,
      duration: COUNT_DURATION,
      ease: 'none',
      onUpdate: () => {
        const v = Math.min(100, progress.v);
        // geometría desacoplada del % mostrado: el hilo arranca con base
        const geometry = THREAD_BASE + (v / 100) * (1 - THREAD_BASE);
        $thread.style.setProperty('--p', geometry * 100);
        $pct.textContent = Math.round(v);

        // swaps por cruce de porcentaje (data-at)
        while (nextSwap < markers.length && v >= markers[nextSwap]) {
          deactivate(nextSwap - 1);
          activate(nextSwap, { delay: 0.18 });
          nextSwap += 1;
        }
      },
    });

    // ✂️ Justo al detenerse el hilo (100%), se corta y cae el punto en el 2026
    tl.call(() => $thread.classList.add('is-cut'), [], atPercent(100)).to(
      $dot,
      {
        y: () => {
          const dotRect = $dot.getBoundingClientRect();
          const burbleRect = $burble.getBoundingClientRect();
          return burbleRect.top + burbleRect.height / 2 - (dotRect.top + dotRect.height / 2);
        },
        autoAlpha: 0,
        duration: 0.5,
        ease: 'power2.in',
      },
      atPercent(100) + 0.02,
    );
  }

  const wipeStart = reduceMotion ? 0.15 : atPercent(100) + 0.6;

  tl.to(
    $containerblue,
    {
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
      duration: reduceMotion ? 0.4 : 1,
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
    wipeStart,
  ).from(
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
