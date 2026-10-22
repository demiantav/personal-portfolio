// Estado del puntero del hero, compartido por el humo (heroSmoke.js) y las
// esporas (heroSpores.js). Un solo listener pasivo: la interacción es un extra
// decorativo, nunca debe bloquear el scroll ni el hover del navbar.
const REDUCE = '(prefers-reduced-motion: reduce)';

export const heroPointer = {
  x: 0,
  y: 0,
  active: false,
};

let initialized = false;

// Se inicializa una sola vez, cuando arranca el hero. Sin reduced motion.
export const initHeroPointer = () => {
  if (initialized) return;
  initialized = true;
  if (window.matchMedia(REDUCE).matches) return;
  const host = document.querySelector('.hero-pin');
  if (!host) return;

  let touchDown = false;

  // Sobre links/botones la interacción se apaga: el hover del navbar manda
  const overUI = (target) =>
    target instanceof Element && !!target.closest('a, button, [role="button"]');

  const inside = (x, y) => {
    const r = host.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const update = (e) => {
    heroPointer.x = e.clientX;
    heroPointer.y = e.clientY;
    heroPointer.active = inside(e.clientX, e.clientY) && !overUI(e.target);
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      // En touch sólo cuenta mientras el dedo está apoyado; si el navegador
      // toma el gesto para scrollear, llega pointercancel y se apaga.
      if (e.pointerType === 'touch' && !touchDown) return;
      update(e);
    },
    { passive: true },
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') touchDown = true;
      update(e);
    },
    { passive: true },
  );
  const off = () => {
    touchDown = false;
    heroPointer.active = false;
  };
  window.addEventListener('pointerup', off, { passive: true });
  window.addEventListener('pointercancel', off, { passive: true });
  document.addEventListener('pointerleave', off);
  window.addEventListener('blur', off);
};
