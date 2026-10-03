import gsap from 'gsap';

// Imán horizontal del título del footer: cada letra, dentro de un radio, se
// siente atraída por el cursor (solo en horizontal) con una pizca de giro y
// escala, y al alejarse vuelve a su lugar con un resorte definido. Solo desktop
// con puntero fino y sin reduce-motion. Las letras las publica footer-reveal.js.
const HOVER_DESKTOP = '(width >= 970px) and (hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';

const RADIUS = 180; // radio de influencia (px)
const MAX = 14; // desplazamiento horizontal máximo (px)
const ROT = 5; // giro máximo (grados)
const SCALE = 0.04; // escala máxima
const VFACTOR = 0.7; // el eje vertical pesa menos en el falloff (alcanza más arriba/abajo)
const SETTLE = 0.35; // tiempo de asentado del resorte (s)
const ZETA = 0.8; // <1 → overshoot leve
const OMEGA = (2 * Math.PI) / SETTLE;
const K = OMEGA * OMEGA;
const C = 2 * ZETA * OMEGA;

export const initFooterTitleMagnet = () => {
  if (!window.matchMedia(HOVER_DESKTOP).matches || window.matchMedia(REDUCE).matches) return;

  const footer = document.querySelector('.main__contact-section');
  const titleEl = document.querySelector('.contact-title');
  if (!footer || !titleEl) return;

  let chars = [];
  let bases = [];
  let current = [];
  let velocity = [];
  let ready = false;
  let active = false;
  const pointer = { x: 0, y: 0, inside: false };

  const tick = (time, deltaTime) => {
    if (!ready) return stop();
    const dt = Math.min(deltaTime, 33) / 1000;
    let moving = false;

    for (let i = 0; i < chars.length; i++) {
      let target = 0;
      if (pointer.inside) {
        const dx = pointer.x - bases[i].x;
        const dy = pointer.y - bases[i].y;
        // Distancia con el vertical atenuado: responde a la par desde arriba y
        // desde abajo, pero el desplazamiento sigue siendo puramente horizontal.
        const d = Math.hypot(dx, dy * VFACTOR);
        if (d < RADIUS) {
          const f = 1 - d / RADIUS; // 0..1
          target = Math.sign(dx) * MAX * f * f; // hacia el cursor, solo horizontal
        }
      }

      velocity[i] += ((target - current[i]) * K - velocity[i] * C) * dt;
      current[i] += velocity[i] * dt;

      const t = current[i] / MAX; // -1..1
      gsap.set(chars[i], {
        x: current[i],
        rotation: t * ROT,
        scale: 1 + Math.abs(t) * SCALE,
      });

      if (Math.abs(target - current[i]) > 0.05 || Math.abs(velocity[i]) > 0.05) moving = true;
    }

    // Al asentarse se apaga (cualquier pointermove lo vuelve a encender).
    if (!moving) stop();
  };

  const start = () => {
    if (active) return;
    active = true;
    gsap.ticker.add(tick);
  };

  const stop = () => {
    if (!active) return;
    active = false;
    gsap.ticker.remove(tick);
  };

  // Base de cada letra medida por LAYOUT (offsetLeft/Top), no por rect: los
  // transforms (el yPercent del reveal, la entrada por palabra y el propio imán)
  // no la afectan, así el centro queda siempre sobre las letras reales sin
  // importar en qué momento del reveal se entre al footer.
  const capture = () => {
    chars.forEach((c) => gsap.set(c, { x: 0, rotation: 0, scale: 1 }));
    const fr = footer.getBoundingClientRect();
    bases = chars.map((c) => {
      let x = c.offsetWidth / 2;
      let y = c.offsetHeight / 2;
      let node = c;
      while (node && node !== footer) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent;
      }
      if (node === footer) return { x: fr.left + x, y: fr.top + y };
      // Fallback (footer sin posicionar): mejor esfuerzo con el rect actual.
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    current.fill(0);
    velocity.fill(0);
  };

  const onEnter = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    capture();
    start();
  };

  const onMove = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    start();
  };

  const onLeave = () => {
    pointer.inside = false;
    start(); // sigue hasta asentarse y se apaga solo
  };

  const onResize = () => {
    if (ready) capture();
  };

  const setup = (list) => {
    if (!list || !list.length || ready) return;
    chars = list;
    current = chars.map(() => 0);
    velocity = chars.map(() => 0);
    chars.forEach((c) => {
      // los transforms no aplican sobre inline: asegurar bloque inline
      c.style.display = 'inline-block';
      c.style.transformOrigin = 'center';
      c.style.willChange = 'transform';
    });
    ready = true;

    footer.addEventListener('pointerenter', onEnter);
    footer.addEventListener('pointermove', onMove, { passive: true });
    footer.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    // Red de seguridad: al asentar el reveal, re-medir las bases.
    window.addEventListener('footerRevealSettled', onResize);
  };

  if (titleEl.__titleChars) setup(titleEl.__titleChars);
  else window.addEventListener('footerTitleReady', (e) => setup(e.detail.chars), { once: true });
};
