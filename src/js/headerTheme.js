// El header es una barra fija abajo, transparente. Sobre las secciones de fondo
// claro (About coral, Skills durazno) el logo/letras blancos y la bubble coral
// pierden contraste. Acá se detecta qué sección está detrás del header y se
// togglea .header--on-light + data-surface (el tema visual vive en CSS).
// Hit-test con elementsFromPoint: maneja bien el overlap apilado About -> Skills
// sin sumar más ScrollTriggers.
const LIGHT_SECTIONS = '.main__about-me-section, .main__skills-section';

export const headerTheme = () => {
  const header = document.querySelector('header');
  if (!header) return;

  const desktop = window.matchMedia('(width >= 970px)');
  let raf = 0;

  const update = () => {
    raf = 0;

    // Durante una View Transition el overlay tapa el hit-test: congelar el tema
    // para que no parpadee. Se re-ejecuta al terminar (evento 'vt-done').
    if (document.documentElement.classList.contains('vt-active')) return;

    // Solo desktop: en mobile el nav es overlay y no queremos tocar su tema
    if (!desktop.matches) {
      header.classList.remove('header--on-light');
      delete header.dataset.surface;
      return;
    }

    const rect = header.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const xs = [rect.left + 48, (rect.left + rect.right) / 2, rect.right - 48];

    let match = null;
    for (const x of xs) {
      const el = document.elementsFromPoint(x, y).find((node) => !header.contains(node));
      match = el?.closest(LIGHT_SECTIONS);
      if (match) break;
    }

    const surface = match
      ? match.classList.contains('main__skills-section')
        ? 'skills'
        : 'about'
      : '';

    header.classList.toggle('header--on-light', !!surface);
    if (surface) header.dataset.surface = surface;
    else delete header.dataset.surface;
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('vt-done', schedule);
  desktop.addEventListener('change', schedule);
};
