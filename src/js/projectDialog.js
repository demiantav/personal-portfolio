import gsap from 'gsap';
import SplitText from 'gsap/SplitText';
import { projects } from '../data/projects.js';

gsap.registerPlugin(SplitText);

// Modal de proyecto. Overlay custom (no <dialog>) para quedar por debajo del
// cursor custom (z 100000). Apertura/cierre con View Transitions (morph de la
// imagen) + reveal enmascarado por elemento (GSAP) coordinado con la VT. El
// párrafo se divide en palabras y cada una emerge de su propia máscara.
// Fallback sin VT y reduced-motion. El botón atrás cierra (history).
const REDUCE = '(prefers-reduced-motion: reduce)';

export const initProjectDialog = () => {
  const modal = document.querySelector('.project-modal');
  if (!modal) return;

  const img = modal.querySelector('.project-modal__img');
  const indexCurrent = modal.querySelector('.project-modal__index-current');
  const indexTotal = modal.querySelector('.project-modal__index-total');
  const title = modal.querySelector('.project-modal__title');
  const year = modal.querySelector('.project-modal__year');
  const role = modal.querySelector('.project-modal__role');
  const sep = modal.querySelector('.project-modal__sep');
  const divider = modal.querySelector('.project-modal__divider');
  const tags = modal.querySelector('.project-modal__tags');
  const desc = modal.querySelector('.project-modal__desc');
  const link = modal.querySelector('.project-modal__link');
  const linkMask = link.closest('.project-modal__mask');
  const closeBtn = modal.querySelector('.project-modal__close');
  const meta = modal.querySelector('.project-modal__meta');
  const main = document.querySelector('main');
  const triggers = document.querySelectorAll('[data-project]');

  const reduceMotion = window.matchMedia(REDUCE);
  const supportsVT = typeof document.startViewTransition === 'function';

  let isOpen = false;
  let sourceButton = null;
  let sourceImg = null;
  let descSplit = null;
  let descWords = [];

  // Elementos con máscara a animar (se consultan frescos: los chips y las
  // palabras del párrafo se recrean en cada render). El divisor va aparte.
  const chipInners = () => Array.from(tags.querySelectorAll('.project-modal__tag'));
  const textInners = () => [meta, title, ...(link.hidden ? [] : [link])];
  const allInners = () => [...textInners(), ...descWords, ...chipInners()];

  const render = (project, mediaSrc, mediaAlt) => {
    // Revertir el split anterior antes de reescribir el texto del párrafo.
    if (descSplit) {
      descSplit.revert();
      descSplit = null;
      descWords = [];
    }
    const idx = projects.findIndex((p) => p.id === project.id) + 1;
    indexCurrent.textContent = String(Math.max(1, idx)).padStart(2, '0');
    indexTotal.textContent = String(projects.length).padStart(2, '0');
    title.textContent = project.title;
    year.textContent = project.year || '';
    role.textContent = project.role || '';
    sep.hidden = !(project.year && project.role);
    desc.textContent = project.description || '';
    descSplit = SplitText.create(desc, { type: 'words', mask: 'words' });
    descWords = descSplit.words;
    tags.replaceChildren(
      ...(project.tags || []).map((t) => {
        const mask = document.createElement('li');
        mask.className = 'project-modal__tag-mask';
        const chip = document.createElement('span');
        chip.className = 'project-modal__tag';
        chip.textContent = t;
        mask.append(chip);
        return mask;
      }),
    );
    img.src = mediaSrc || '';
    img.alt = mediaAlt || project.title;
    if (project.link) {
      link.href = project.link;
      link.hidden = false;
      linkMask.hidden = false;
    } else {
      link.removeAttribute('href');
      link.hidden = true;
      linkMask.hidden = true;
    }
  };

  const setHidden = () => {
    gsap.set(allInners(), { yPercent: 110 });
    gsap.set(divider, { scaleX: 0 });
  };

  const setVisible = () => {
    gsap.set([...allInners(), divider], { yPercent: 0, scaleX: 1, clearProps: 'transform' });
  };

  // Entrada: cada bloque (y cada chip) emerge desde su máscara, en cascada.
  // Delay corto: deja que el morph de la imagen lidere y el contenido entre
  // un instante después (sin el bache largo de esperar toda la VT).
  const INTRO_DELAY = 0.18;

  const playIntro = () => {
    const tl = gsap.timeline({
      delay: INTRO_DELAY,
      defaults: { ease: 'expo.out', duration: 0.8 },
    });
    tl.to(meta, { yPercent: 0 }, 0)
      .to(divider, { scaleX: 1, duration: 0.9 }, 0.04)
      .to(title, { yPercent: 0 }, 0.08)
      .to(descWords, { yPercent: 0, duration: 0.6, stagger: 0.015 }, 0.16)
      .to(chipInners(), { yPercent: 0, stagger: 0.06 }, 0.3);
    if (!link.hidden) tl.to(link, { yPercent: 0 }, 0.4);
    return tl;
  };

  // Salida: al revés (salen hacia arriba por la máscara), antes del morph.
  const playOutro = (onComplete) => {
    const blocks = [meta, title, ...(link.hidden ? [] : [link]), ...chipInners()];
    gsap
      .timeline({ onComplete })
      .to(descWords, { yPercent: -110, duration: 0.35, ease: 'expo.in', stagger: 0.008 }, 0)
      .to(blocks, { yPercent: -110, duration: 0.4, ease: 'expo.in', stagger: 0.025 }, 0.02)
      .to(divider, { scaleX: 0, duration: 0.3, ease: 'expo.in' }, 0);
  };

  const lockScroll = (on) =>
    document.documentElement.classList.toggle('project-modal-open', on);
  const setInert = (on) => main && main.toggleAttribute('inert', on);

  const focusables = () =>
    Array.from(modal.querySelectorAll('a[href], button:not([disabled])')).filter(
      (el) => !el.hidden && el.offsetParent !== null,
    );

  const onKeydown = (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const show = () => {
    modal.classList.add('is-open');
    modal.removeAttribute('aria-hidden');
    lockScroll(true);
    setInert(true);
    closeBtn.focus({ preventScroll: true });
  };

  const hide = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    setInert(false);
  };

  const open = async (project, button, pushHistory = true) => {
    if (isOpen) return;
    isOpen = true;
    sourceButton = button;
    sourceImg = button ? button.querySelector('img') : null;

    render(
      project,
      sourceImg ? sourceImg.currentSrc || sourceImg.src : '',
      sourceImg ? sourceImg.alt : '',
    );

    const animate = !reduceMotion.matches;
    if (animate) setHidden();
    else setVisible();

    if (pushHistory) {
      history.pushState({ projectModal: project.id }, '', `#project-${project.id}`);
    }

    if (reduceMotion.matches || !supportsVT) {
      show();
      if (animate) playIntro();
      return;
    }

    // Esperar a que la imagen del modal esté decodificada ANTES de capturar el
    // snapshot nuevo: si no, el frame capturado puede salir en blanco (parpadeo).
    try {
      await img.decode();
    } catch {
      /* si falla el decode, seguimos igual */
    }

    if (sourceImg) sourceImg.style.viewTransitionName = '--project-media';
    modal.classList.add('project-modal--vt');
    document.documentElement.classList.add('vt-active');

    const vt = document.startViewTransition(() => {
      show();
      if (sourceImg) sourceImg.style.viewTransitionName = '';
      img.style.viewTransitionName = '--project-media';
    });

    // El contenido arranca apenas se muestra el nuevo estado (en paralelo con
    // el morph), no al terminar toda la VT: así no hay delay tras la imagen.
    if (animate) vt.updateCallbackDone.finally(playIntro);

    vt.finished.finally(() => {
      modal.classList.remove('project-modal--vt');
      document.documentElement.classList.remove('vt-active');
      window.dispatchEvent(new Event('vt-done'));
      img.style.viewTransitionName = '';
      if (sourceImg) sourceImg.style.viewTransitionName = '';
    });
  };

  const close = (updateHistory = true) => {
    if (!isOpen) return;
    // Cierre por Esc/botón/backdrop: si estamos en nuestro estado de historial,
    // volvemos atrás y el popstate hace el cierre visual.
    if (updateHistory && history.state && history.state.projectModal) {
      history.back();
      return;
    }

    const restoreFocus = () => {
      if (sourceButton) sourceButton.focus({ preventScroll: true });
    };
    const finish = () => {
      hide();
      isOpen = false;
      restoreFocus();
    };

    if (reduceMotion.matches) {
      finish();
      return;
    }

    const afterOutro = () => {
      if (!supportsVT) {
        finish();
        return;
      }
      img.style.viewTransitionName = '--project-media';
      modal.classList.add('project-modal--vt');
      document.documentElement.classList.add('vt-active');
      const vt = document.startViewTransition(() => {
        hide();
        img.style.viewTransitionName = '';
        if (sourceImg) sourceImg.style.viewTransitionName = '--project-media';
      });
      vt.finished.finally(() => {
        modal.classList.remove('project-modal--vt');
        document.documentElement.classList.remove('vt-active');
        window.dispatchEvent(new Event('vt-done'));
        img.style.viewTransitionName = '';
        if (sourceImg) sourceImg.style.viewTransitionName = '';
        isOpen = false;
        restoreFocus();
      });
    };

    playOutro(afterOutro);
  };

  triggers.forEach((button) => {
    button.addEventListener('click', () => {
      const project = projects.find((p) => p.id === button.dataset.project);
      if (project) open(project, button);
    });
  });

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });

  document.addEventListener('keydown', onKeydown);

  // Historial: atrás cierra; adelante reabre el proyecto correspondiente.
  window.addEventListener('popstate', (e) => {
    const id = e.state && e.state.projectModal;
    if (id && !isOpen) {
      const project = projects.find((p) => p.id === id);
      const button = document.querySelector(`[data-project="${id}"]`);
      if (project && button) open(project, button, false);
    } else if (!id && isOpen) {
      close(false);
    }
  });
};
