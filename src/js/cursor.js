import gsap from 'gsap';

// Cursor custom: SOLO un aro mínimo que persigue al puntero con retardo. El
// cursor nativo NUNCA se oculta (el usuario pidió verlo junto al aro). Todo lo
// visual (tamaño, cápsula, marquesina, color) vive en CSS: acá solo se mueven
// transform y se togglea una clase por estado.
const HOVER_DESKTOP = '(width >= 970px) and (hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';
const LIGHT_SECTIONS = '.main__about-me-section, .main__skills-section, .project-modal';
const INTERACTIVE = 'a, button, [role="button"], summary, label, [tabindex]:not([tabindex="-1"])';
const EXPLICIT = '[data-cursor]';
const HIDE_RING =
  '.back-to-top, .contact-section__btn-contact, .contact-section__nav-links-wrapper ul a';
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
  const marquee = el.querySelector('.cursor__marquee');
  const track = el.querySelector('.cursor__marquee-track');
  track.textContent = MARQUEE_TEXT.repeat(8);

  gsap.set(ring, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 1, rotation: 0 });

  let px = 0;
  let py = 0;
  let raf = 0;
  let visible = false;
  let state = '';
  let vtHidden = false;
  // Lock temporal al salir de un estado no-circular: evita que la rotación por
  // velocidad dé vuelta el aro/label mientras morpha a círculo.
  let morphUntil = 0;
  let lastScrollY = window.scrollY;
  // Imagen que la lente magnifica mientras dura el estado 'lens'.
  let lensEl = null;
  const header = d.querySelector('header');

  // Física del aro: la deformación se calcula por LAG (cuánto quedó atrás el aro
  // respecto al puntero), que es lo que se siente fluido: al acelerar se estira
  // en la dirección del atraso y al alcanzar al puntero se relaja solo. La
  // rotación/escala viven en proxies animados por GSAP (así no pisan el tilt de
  // project ni el scale del click) y un único render por frame compone el
  // transform final.
  const tilt = { v: 0 };
  const press = { v: 1 };
  let angle = 0;

  // El aro persigue al puntero con un resorte sub-amortiguado: frena con
  // inercia y se asienta con un rebote sutil (no seco). Integración
  // semi-implícita por frame; el dt se clampea para no explotar al volver de
  // una pestaña en background.
  let ringX = 0;
  let ringY = 0;
  let velX = 0;
  let velY = 0;
  const SETTLE = 0.47; // tiempo de asentado (s)
  const ZETA = 0.7; // <1 → overshoot ~5%
  const OMEGA = (2 * Math.PI) / SETTLE;
  const SPRING_K = OMEGA * OMEGA;
  const SPRING_C = 2 * ZETA * OMEGA;

  // El menú del header no persigue al puntero: el aro se ciñe al <li> y lo
  // envuelve (aire 0, igual que la bubble). Se anima con un tween propio con
  // overshoot (el "imán") y se mata al salir: mientras dura, el resorte queda
  // pausado para que no se pisen pisándose la posición.
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
      // el resorte retoma desde donde quedó el imán, sin salto
      ringX = gsap.getProperty(ring, 'x');
      ringY = gsap.getProperty(ring, 'y');
      velX = 0;
      velY = 0;
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
    const wasMorph = state === 'project' || state === 'nav' || state === 'lens';
    if (state) el.classList.remove(`cursor--${state}`);
    state = next;
    el.classList.add(`cursor--${state}`);
    // Al pasar de un estado no-circular (cápsula/lente/snap) a uno circular,
    // congelamos rotación/estirado por velocidad durante el morph (~0.5s): el
    // aro encoge limpio y el label no se da vuelta en vertical.
    const isMorph = next === 'project' || next === 'nav' || next === 'lens';
    if (wasMorph && !isMorph) morphUntil = performance.now() + 500;
    // Revelado de la lente: con 'lens' la página se desatura (CSS) y la lente
    // a color resalta como un loupe. En los demás estados se limpia.
    root.classList.toggle('lens-active', next === 'lens');
    label.textContent = next === 'scroll' ? 'SCROLL' : '';
    el.classList.toggle('cursor--label', next === 'scroll');
    // El tilt va al proxy: el render lo combina con el ángulo de velocidad.
    gsap.to(tilt, {
      v: next === 'project' ? -8 : 0,
      duration: 0.55,
      ease: 'power3.out',
      overwrite: true,
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

    // Lente sobre las fotos del gallery: el aro se vuelve una lupa circular.
    // Las fotos no son links, así que sin esto quedarían en estado base.
    const lens = target?.closest('.main__gallery img');
    if (lens && !explicit) next = 'lens';

    // Al entrar en la lente se fija la imagen de fondo; al salir se limpia.
    if (next === 'lens' && lens) {
      if (lensEl !== lens) {
        lensEl = lens;
        ring.style.backgroundImage = `url("${lens.currentSrc || lens.src}")`;
        ring.style.backgroundRepeat = 'no-repeat';
      }
    } else if (lensEl) {
      lensEl = null;
      ring.style.removeProperty('background-image');
      ring.style.removeProperty('background-repeat');
    }

    // El snap se evalúa SIEMPRE, aunque el estado no cambie: moverse de un
    // link del menú a otro re-apunta el aro al nuevo <li>.
    applySnap(next === 'nav' ? explicit : null);
    if (next !== state) applyState(next);
    // El aro se esconde sobre el link activo (la bubble ya marca el estado), el
    // back-to-top (botón magnético) y el CTA (su hover es el foco).
    el.classList.toggle(
      'cursor--hide',
      !!target?.closest(HIDE_RING) || (next === 'nav' && explicit.classList.contains('active')),
    );

    // El estado lo decide el elemento de arriba (ahí viven los links del
    // header fijo), pero el COLOR se mide contra la sección real de atrás:
    // sin saltear el header el aro sería coral sobre coral en About y
    // desaparecería. Mismo criterio que headerTheme. Sobre FOTOS, en cambio,
    // se queda la coral de marca: las imágenes del portafolio son oscuras y
    // el negro adaptativo se perdería adentro.
    const behind = nodes.find((n) => !header?.contains(n));
    const onPhoto = !!behind?.closest('img');
    el.classList.toggle('cursor--invert', !onPhoto && !!behind?.closest(LIGHT_SECTIONS));
    el.classList.toggle('cursor--on-card', !!behind?.closest('.progress__card'));
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const show = () => {
    visible = true;
    root.classList.add('cursor-ready');
    ringX = px;
    ringY = py;
    velX = 0;
    velY = 0;
    gsap.set(ring, { x: px, y: py });
    el.classList.add('cursor--on');
    angle = 0;
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
    gsap.to(press, { v: 0.88, duration: 0.14, ease: 'power2.out', overwrite: true });
  };

  const onRelease = () => {
    if (!visible) return;
    gsap.to(press, { v: 1, duration: 0.7, ease: 'back.out(3)', overwrite: true });
  };

  // Squash & stretch por lag: el aro se estira en la dirección en que quedó
  // atrás respecto al puntero y se achata en la perpendicular. Solo estados
  // circulares: project (cápsula), nav (imán) y lens (vidrio) quedan sin
  // deformar.
  const LAG_REF = 80;
  const MAX_STRETCH = 0.45;
  const SQUASH = 0.5;
  // Lente: tamaño (debe coincidir con --cursor-w/h de .cursor--lens) y zoom.
  // Zoom contenido a 1.3× para no agrandar las fuentes ~920px más allá de lo
  // perceptible; el grade + vidrio (CSS) completan el efecto sin subir peso.
  const LENS_SIZE = 160;
  const LENS_HALF = LENS_SIZE / 2;
  const LENS_ZOOM = 1.3;
  const render = (time, deltaTime) => {
    if (!visible || vtHidden) return;

    // Resorte de posición (pausado durante el imán del menú).
    if (!snapEl) {
      const dt = Math.min(deltaTime, 33) / 1000;
      velX += ((px - ringX) * SPRING_K - velX * SPRING_C) * dt;
      velY += ((py - ringY) * SPRING_K - velY * SPRING_C) * dt;
      ringX += velX * dt;
      ringY += velY * dt;
      gsap.set(ring, { x: ringX, y: ringY });
    }

    // Durante el morph de salida se ignora la velocidad: sin rotación ni
    // estirado, el aro no se da vuelta ni se achata en vertical.
    const morphing = performance.now() < morphUntil;
    const circular = !morphing && state !== 'project' && state !== 'nav' && state !== 'lens';
    let stretch = 0;
    if (circular) {
      const lagX = px - ringX;
      const lagY = py - ringY;
      const dist = Math.hypot(lagX, lagY);
      if (dist > 10) angle = Math.atan2(lagY, lagX) * (180 / Math.PI);
      stretch = Math.min(MAX_STRETCH, (dist / LAG_REF) * MAX_STRETCH);
    }

    gsap.set(ring, {
      rotation: tilt.v + (circular ? angle : 0),
      scaleX: press.v * (1 + stretch),
      scaleY: press.v * (1 - stretch * SQUASH),
    });

    // Lupa: el punto de la foto bajo el centro del aro queda magnificado en el
    // centro del vidrio, así el contenido se mantiene alineado al mover.
    if (state === 'lens' && lensEl) {
      const r = lensEl.getBoundingClientRect();
      ring.style.backgroundSize = `${r.width * LENS_ZOOM}px ${r.height * LENS_ZOOM}px`;
      ring.style.backgroundPosition =
        `${LENS_HALF - (ringX - r.left) * LENS_ZOOM}px ` +
        `${LENS_HALF - (ringY - r.top) * LENS_ZOOM}px`;
    }
    // La etiqueta queda derecha y a tamaño constante durante el estirado.
    gsap.set(label, {
      rotation: -(circular ? angle : 0),
      scaleX: 1 / (1 + stretch),
      scaleY: 1 / (1 - stretch * SQUASH),
    });
    // La marquesina tampoco debe rotar con el aro (se mantiene horizontal
    // mientras se desvanece al salir del proyecto).
    gsap.set(marquee, {
      rotation: -(circular ? angle : 0),
      scaleX: 1 / (1 + stretch),
      scaleY: 1 / (1 - stretch * SQUASH),
    });
  };
  gsap.ticker.add(render);

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
    gsap.ticker.remove(render);
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
