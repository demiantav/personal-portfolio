import gsap from 'gsap';
import { projects } from '../data/projects.js';

// Modal de proyecto. Overlay custom (no <dialog>) a propósito: queda por debajo
// del cursor custom (z 100000) para que el aro siga visible. Apertura/cierre con
// View Transitions (morph de la imagen de la card) + stagger del contenido con
// GSAP, coordinado con la VT. Fallback sin VT y con reduced-motion. El botón
// atrás cierra (history).
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
  const closeBtn = modal.querySelector('.project-modal__close');
  const meta = modal.querySelector('.project-modal__meta');
  const main = document.querySelector('main');
  const triggers = document.querySelectorAll('[data-project]');

  const reduceMotion = window.matchMedia(REDUCE);
  const supportsVT = typeof document.startViewTransition === 'function';

  let isOpen = false;
  let sourceButton = null;
  let sourceImg = null;

  // Items que entran en stagger (el divisor se anima con scaleX aparte).
  const items = [meta, title, desc, tags, link].filter(Boolean);
  const allAnim = [meta, divider, title, desc, tags, link].filter(Boolean);

  const render = (project, mediaSrc, mediaAlt) => {
    const idx = projects.findIndex((p) => p.id === project.id) + 1;
    indexCurrent.textContent = String(Math.max(1, idx)).padStart(2, '0');
    indexTotal.textContent = String(projects.length).padStart(2, '0');
    title.textContent = project.title;
    year.textContent = project.year || '';
    role.textContent = project.role || '';
    sep.hidden = !(project.year && project.role);
    desc.textContent = project.description || '';
    tags.replaceChildren(
      ...(project.tags || []).map((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
      }),
    );
    img.src = mediaSrc || '';
    img.alt = mediaAlt || project.title;
    if (project.link) {
      link.href = project.link;
      link.hidden = false;
    } else {
      link.removeAttribute('href');
      link.hidden = true;
    }
  };

  const setHidden = () => {
    gsap.set(items, { autoAlpha: 0, y: 24 });
    gsap.set(divider, { autoAlpha: 0, scaleX: 0 });
  };

  const setVisible = () => {
    gsap.set(allAnim, { autoAlpha: 1, y: 0, scaleX: 1, clearProps: 'transform' });
  };

  const playIntro = () =>
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .to(meta, { autoAlpha: 1, y: 0, duration: 0.45 })
      .to(divider, { autoAlpha: 1, scaleX: 1, duration: 0.5 }, '<0.05')
      .to(title, { autoAlpha: 1, y: 0, duration: 0.55 }, '<0.08')
      .to(desc, { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.1')
      .to(tags, { autoAlpha: 1, y: 0, duration: 0.4 }, '<0.08')
      .to(link, { autoAlpha: 1, y: 0, duration: 0.4 }, '<0.06');

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

  const open = (project, button, pushHistory = true) => {
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

    if (sourceImg) sourceImg.style.viewTransitionName = '--project-media';
    modal.classList.add('project-modal--vt');
    document.documentElement.classList.add('vt-active');

    const vt = document.startViewTransition(() => {
      show();
      if (sourceImg) sourceImg.style.viewTransitionName = '';
      img.style.viewTransitionName = '--project-media';
    });

    vt.finished.finally(() => {
      modal.classList.remove('project-modal--vt');
      document.documentElement.classList.remove('vt-active');
      window.dispatchEvent(new Event('vt-done'));
      img.style.viewTransitionName = '';
      if (sourceImg) sourceImg.style.viewTransitionName = '';
      if (animate) playIntro();
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

    gsap.to(allAnim, {
      autoAlpha: 0,
      y: -16,
      duration: 0.22,
      ease: 'power2.in',
      stagger: 0.025,
      onComplete: afterOutro,
    });
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
