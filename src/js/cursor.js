import gsap from 'gsap';

// Cursor custom: SOLO un aro mínimo que persigue al puntero con retardo. El
// cursor nativo NUNCA se oculta (el usuario pidió verlo junto al aro). Todo lo
// visual (tamaño, cápsula, marquesina, color) vive en CSS: acá solo se mueven
// transform y se togglea una clase por estado.
const HOVER_DESKTOP = '(width >= 970px) and (hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';
const LIGHT_SECTIONS = '.main__about-me-section, .main__skills-section';
const INTERACTIVE = 'a, button, [role="button"], summary, label, [tabindex]:not([tabindex="-1"])';
const EXPLICIT = '[data-cursor]';
const MARQUEE_TEXT = 'See more → ';

export const initCursor = () => {
  if (!window.matchMedia(HOVER_DESKTOP).matches || window.matchMedia(REDUCE).matches) return;

  const d = document;
  const root = d.documentElement;

  const el = d.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<span class="cursor__ring"><span class="cursor__label"></span>' +
    '<span class="cursor__marquee"><span class="cursor__marquee-track"></span></span></span>';
  d.body.append(el);

  const ring = el.querySelector('.cursor__ring');
  const label = el.querySelector('.cursor__label');
  const track = el.querySelector('.cursor__marquee-track');
  track.textContent = MARQUEE_TEXT.repeat(8);

  gsap.set(ring, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 1, rotation: 0 });

  // El aro persigue al puntero con retardo. Es puro transform (nada de
  // layout reads por frame).
  const toRingX = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
  const toRingY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });

  let px = 0;
  let py = 0;
  let raf = 0;
  let visible = false;
  let state = '';
  let vtHidden = false;
  let lastScrollY = window.scrollY;
  const header = d.querySelector('header');

  // El menú del header no persigue al puntero: el aro se ciñe al <li> y lo
  // envuelve (aire 0, igual que la bubble). Se anima con un tween propio con
  // overshoot (el "imán") y se mata al salir: si el chase de quickTo quedara
  // vivo pisándose con este, la posición saltaría.
  let snapEl = null;
  let snapTween = null;

  const applySnap = (node) => {
    if (node === snapEl) return;
    snapEl = node;
    if (snapTween) {
      snapTween.kill();
      snapTween = null;
    }
    if (!node) {
      ring.style.removeProperty('--cursor-w');
      ring.style.removeProperty('--cursor-h');
      toRingX(px);
      toRingY(py);
      return;
    }
    const r = node.getBoundingClientRect();
    ring.style.setProperty('--cursor-w', `${Math.round(r.width)}px`);
    ring.style.setProperty('--cursor-h', `${Math.round(r.height)}px`);
    snapTween = gsap.to(ring, {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      duration: 0.5,
      ease: 'back.out(1.4)',
    });
  };

  const applyState = (next) => {
    if (state) el.classList.remove(`cursor--${state}`);
    state = next;
    el.classList.add(`cursor--${state}`);
    label.textContent = next === 'scroll' ? 'SCROLL' : '';
    el.classList.toggle('cursor--label', next === 'scroll');
    // GSAP maneja el transform del aro entero: el tilt de la etiqueta en los
    // proyectos tiene que ir acá, un rotate en CSS lo pisaría.
    gsap.to(ring, {
      rotation: next === 'project' ? -8 : 0,
      duration: 0.55,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  };

  // Un solo hit-test por frame cubre hover y scroll (elementFromPoint devuelve
  // el elemento bajo el puntero aunque la página se haya movido debajo).
  const update = () => {
    raf = 0;
    if (!visible || vtHidden) return;

    const nodes = d.elementsFromPoint(px, py);
    const target = nodes[0];
    const explicit = target?.closest(EXPLICIT);

    // data-cursor="none" anula el hover: el aro queda en su estado base.
    let next = 'default';
    if (explicit) next = explicit.dataset.cursor === 'none' ? 'default' : explicit.dataset.cursor || 'default';
    else if (target?.closest(INTERACTIVE)) next = 'link';

    // El snap se evalúa SIEMPRE, aunque el estado no cambie: moverse de un
    // link del menú a otro re-apunta el aro al nuevo <li>.
    applySnap(next === 'nav' ? explicit : null);
    if (next !== state) applyState(next);
    // sobre el link activo el aro se esconde: la bubble ya marca el estado
    el.classList.toggle('cursor--hide', next === 'nav' && explicit.classList.contains('active'));

    // El estado lo decide el elemento de arriba (ahí viven los links del
    // header fijo), pero el COLOR se mide contra la sección real de atrás:
    // sin saltear el header el aro sería coral sobre coral en About y
    // desaparecería. Mismo criterio que headerTheme. Sobre FOTOS, en cambio,
    // se queda la coral de marca: las imágenes del portafolio son oscuras y
    // el negro adaptativo se perdería adentro.
    const behind = nodes.find((n) => !header?.contains(n));
    const onPhoto = !!behind?.closest('img');
    el.classList.toggle('cursor--invert', !onPhoto && !!behind?.closest(LIGHT_SECTIONS));
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const show = () => {
    visible = true;
    root.classList.add('cursor-ready');
    gsap.set(ring, { x: px, y: py });
    el.classList.add('cursor--on');
    schedule();
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    el.classList.remove('cursor--on');
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const onMove = (e) => {
    px = e.clientX;
    py = e.clientY;
    if (!visible) show();
    // mientras el aro está ciñéndose a un <li> no hay que perseguir al puntero
    if (!snapEl) {
      toRingX(px);
      toRingY(py);
    }
    schedule();
  };

  const onScroll = () => {
    const y = window.scrollY;
    if (y !== lastScrollY) {
      el.classList.toggle('cursor--rev', y < lastScrollY);
      lastScrollY = y;
    }
    schedule();
  };

  // Click: solo un scale suave. Sin burst (el aro es chico y minimalista).
  const onPress = () => {
    if (!visible) return;
    gsap.to(ring, { scale: 0.88, duration: 0.14, ease: 'power2.out', overwrite: 'auto' });
  };

  const onRelease = () => {
    if (!visible) return;
    gsap.to(ring, { scale: 1, duration: 0.7, ease: 'back.out(3)', overwrite: 'auto' });
  };

  // El overlay de la View Transition tapa el hit-test y tapa al cursor: se
  // oculta mientras dura y se re-resuelve el estado al terminar (evento
  // 'vt-done' que dispara menuAnimation).
  const vtObserver = new MutationObserver(() => {
    const hidden = root.classList.contains('vt-active');
    if (hidden === vtHidden) return;
    vtHidden = hidden;
    el.classList.toggle('cursor--vt', hidden);
    if (hidden) {
      applySnap(null);
      applyState('default');
    } else schedule();
  });
  vtObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

  const onHoverChange = (e) => {
    if (e.matches) return;
    el.remove();
    visible = false;
    root.classList.remove('cursor-ready');
    if (snapTween) {
      snapTween.kill();
      snapTween = null;
    }
    snapEl = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    vtObserver.disconnect();
  };

  // pointerout con relatedTarget null también dispara cuando un nodo se
  // elimina debajo del puntero: solo se oculta si el puntero salió de la
  // ventana, si no parpadearía con cada mutación del DOM (ScrollTrigger).
  const onOut = (e) => {
    if (e.relatedTarget) return;
    const inside =
      e.clientX >= 0 && e.clientY >= 0 && e.clientX < window.innerWidth && e.clientY < window.innerHeight;
    if (!inside) hide();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    // el <li> cambió de tamaño: volver a medir aunque el elemento sea el mismo
    if (snapEl) {
      const node = snapEl;
      snapEl = null;
      applySnap(node);
    }
    schedule();
  });
  window.addEventListener('pointerdown', onPress);
  window.addEventListener('pointerup', onRelease);
  window.addEventListener('blur', hide);
  window.addEventListener('vt-done', schedule);
  d.addEventListener('pointerout', onOut);
  d.addEventListener('visibilitychange', () => {
    if (d.hidden) hide();
  });
  window.matchMedia(HOVER_DESKTOP).addEventListener('change', onHoverChange);
  window.matchMedia(REDUCE).addEventListener('change', onHoverChange);
};
