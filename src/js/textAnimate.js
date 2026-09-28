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

  const $logo = document.querySelector('.header__logo-img');
  const $hamb = document.querySelectorAll('.header__container-hamb');
  const $menu_full_page = document.querySelectorAll('.header__nav-link');
  const $containerblue = document.querySelector('.preloader');
  const $thread = document.querySelector('.item__name__line');
  const $rail = document.querySelector('.thread__rail');
  const $dot = document.querySelector('.thread__dot');
  const $pct = document.querySelector('.item__name__porcentage');
  const $burble = document.querySelector('.item__burble');
  const $burbleSpan = document.querySelector('.item__burble span');
  const $frame = document.querySelector('.preloader__frame rect');
  const $cover = document.querySelector('.preloader__cover');
  const $phrases = gsap.utils.toArray('.thread-phrase');
  // titular spliteado para su entrada por letras (sin autoSplit: la intro es
  // pura transform/opacity, y así eliminamos cualquier re-split a mitad de ella)
  const titleSplit = SplitText.create('.zoom-effect', { type: 'chars' });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COUNT_DURATION = 3.9;
  // Longitud de hilo ya recorrida al 0% (respiro respecto del %)
  const THREAD_BASE = 0.25;
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

  const refreshAndReady = () => {
    window.scrollTo(0, 0);
    onReady?.(); // triggers con layout real, nunca contra el doc colapsado
    // Refresh individual escalonado: el global mide con el pin revertido
    // y corrompe starts; el individual mide contra el layout real.
    const refreshAll = () => ScrollTrigger.getAll().forEach((t) => t.refresh());
    refreshAll();
    requestAnimationFrame(refreshAll); // imágenes que cargan justo tras el unlock
    setTimeout(refreshAll, 300);
  };

  const tl = gsap.timeline({
    onComplete: () => {
      // 🔓 Desbloquear scroll recién AL TERMINAR toda la secuencia
      document.body.classList.remove('no-scroll');
    },
  });

  // etiquetas con máscara: las de arriba entran desde arriba, las de abajo desde abajo
  const labels = gsap.utils.toArray('.item__name').map((el, i) => {
    const split = SplitText.create(el, { type: 'chars', mask: 'lines' });
    return { chars: split.chars, top: i % 2 === 0 };
  });

  // revelado del hero (compartido por las dos ramas)
  const revealHero = (at) => {
    tl.from(
      titleSplit.chars,
      {
        // 1️⃣ TITULAR: vuela a su lugar desde la derecha, en orden aleatorio
        xPercent: 'random(80, 180)',
        yPercent: 'random(-60, 60)',
        rotation: 'random(-30, 30)',
        autoAlpha: 0,
        force3D: true,
        stagger: { each: 0.025, from: 'random' },
        ease: 'power2.out',
        duration: 0.85,
      },
      at,
    );
    const titleFly = tl.recent();
    tl.from(
      '.main__container-titles h4',
      {
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

  if (reduceMotion) {
    // 🚫 Sin coreografía: estado final directo + fade corto
    $thread.style.setProperty('--p', 100);
    $pct.textContent = '100';
    activate(phrases.length - 1, { instant: true });
    gsap.set($frame, { attr: { 'stroke-dashoffset': 0 } });
    gsap.set([$rail, $dot], { autoAlpha: 1 });
    gsap.set($pct, { autoAlpha: 1 });
    gsap.set($burble, { autoAlpha: 1 });
    labels.forEach(({ chars }) => gsap.set(chars, { yPercent: 0, autoAlpha: 1 }));

    tl.to($containerblue, { autoAlpha: 0, duration: 0.4, onComplete: refreshAndReady }, 0.3);
    revealHero(0.5);
    return;
  }

  // ── estado inicial de la entrada ──
  gsap.set($pct, { scale: 0.6, autoAlpha: 0 });
  gsap.set($burble, { y: 260, autoAlpha: 0 });
  gsap.set([$rail, $dot], { autoAlpha: 0 });
  labels.forEach(({ chars, top }) =>
    gsap.set(chars, { yPercent: top ? -120 : 120, autoAlpha: 0 }),
  );
  $thread.style.setProperty('--p', 0);

  const markers = $phrases.map((el) => Number(el.dataset.at));
  let nextSwap = 1;

  // ── ENTRADA (0 → 1.45s) ──
  tl.fromTo(
    $frame,
    { attr: { 'stroke-dashoffset': 1 } },
    { attr: { 'stroke-dashoffset': 0 }, duration: 0.9, ease: 'power2.inOut' },
    0,
  );
  labels.forEach(({ chars }, i) => {
    tl.to(
      chars,
      {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.6,
        ease: 'back.out(1.4)',
        stagger: { each: 0.02 },
      },
      0.2 + i * 0.08,
    );
  });
  tl.to($pct, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)' }, 0.45);
  tl.to($burble, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.2)' }, 0.6);

  // el hilo y la bola entran en su propio beat (no antes que el resto)
  tl.to([$rail, $dot], { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, 0.85);

  const drop = { v: 0 };
  tl.to(
    drop,
    {
      v: THREAD_BASE * 100,
      duration: 0.55,
      ease: 'power3.out',
      onUpdate: () => $thread.style.setProperty('--p', drop.v),
    },
    0.9,
  );
  tl.call(() => activate(0), [], 0.98);

  const countStart = 1.45;
  const countEnd = countStart + COUNT_DURATION;

  // ── CONTADOR ──
  tl.to(
    progress,
    {
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
    },
    countStart,
  );

  // ── SALIDA ──
  // ✂️ al detenerse el hilo, se corta y el punto cae dentro de la burbuja
  tl.call(() => $thread.classList.add('is-cut'), [], countEnd).to(
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
    countEnd + 0.02,
  );

  // impacto: la burbuja hace un pulso al recibir el punto
  tl.to($burble, { scale: 1.06, duration: 0.18, ease: 'power2.out' }, countEnd + 0.45).to(
    $burble,
    { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' },
    countEnd + 0.63,
  );

  // el marco se des-dibuja
  tl.to(
    $frame,
    { attr: { 'stroke-dashoffset': 1 }, duration: 0.8, ease: 'power2.inOut' },
    countEnd + 0.6,
  );

  // los labels se retiran (arriba hacia arriba, abajo hacia abajo)
  labels.forEach(({ chars, top }, i) => {
    tl.to(
      chars,
      {
        yPercent: top ? -120 : 120,
        autoAlpha: 0,
        duration: 0.5,
        ease: 'power3.in',
        stagger: { each: 0.015 },
      },
      countEnd + 0.55 + i * 0.05,
    );
  });

  // el % se achica y se va
  tl.to($pct, { scale: 0.6, autoAlpha: 0, duration: 0.4, ease: 'power3.in' }, countEnd + 0.6);

  // las frases se retraen hacia el hilo
  tl.call(() => phrases.forEach((_, i) => deactivate(i)), [], countEnd + 0.65);

  // el disco crece desde la burbuja y se convierte en el sitio
  const maxR = Math.hypot(window.innerWidth, window.innerHeight) * 1.05;
  tl.to(
    $cover,
    { '--cover-r': `${maxR}px`, duration: 0.9, ease: 'power2.inOut' },
    countEnd + 0.9,
  );
  tl.to($burbleSpan, { autoAlpha: 0, duration: 0.3 }, countEnd + 0.9);
  tl.to($cover, { backgroundColor: '#080707', duration: 0.4 }, countEnd + 1.5);

  // handoff: el preloader se desvanece revelando el sitio (mismo negro)
  tl.to(
    $containerblue,
    { autoAlpha: 0, duration: 0.5, onComplete: refreshAndReady },
    countEnd + 1.8,
  );

  revealHero(countEnd + 2.0);
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
