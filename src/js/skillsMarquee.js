// Skills: arma la marquesina de cada categoría. El primer track es el legible
// por lectores de pantalla; los clones son aria-hidden. Se agregan tantas copias
// como haga falta para que (N-1)·W ≥ ancho del viewport: así el loop nunca deja
// un tramo vacío y el fade se ve parejo en ambos lados y en ambos sentidos.
// La duración se calibra según el ancho para que la velocidad sea pareja.
export const initSkillsMarquee = () => {
  const marquees = document.querySelectorAll('.skill-marquee');
  if (!marquees.length) return;

  marquees.forEach((marquee) => {
    const base = marquee.querySelector('.skill-marquee__track');
    if (!base || base.dataset.marqueeReady) return;
    base.dataset.marqueeReady = 'true';

    const viewport = marquee.querySelector('.skill-marquee__viewport') || marquee;

    // Velocidad ~80 px/s; mínimo 16s para que ninguna corra nerviosa.
    const setDuration = () => {
      const width = base.scrollWidth;
      if (!width) return; // categoría cerrada: se recalibra al abrir
      marquee.style.setProperty('--d', `${Math.max(16, width / 80)}s`);
    };

    const ensureCoverage = () => {
      const vw = viewport.clientWidth;
      const w = base.scrollWidth;
      if (!vw || !w) return;
      // Cobertura: (N-1)·w ≥ vw  →  N = ceil(vw/w) + 1
      const needed = Math.ceil(vw / w) + 1;
      let count = viewport.querySelectorAll('.skill-marquee__track').length;
      while (count < needed) {
        const clone = base.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.removeAttribute('data-marquee-ready');
        viewport.append(clone);
        count += 1;
      }
    };

    const sync = () => {
      ensureCoverage();
      setDuration();
    };

    sync();
    document.fonts?.ready.then(sync);

    // Con el <details> cerrado el contenido no tiene layout: medimos al abrir.
    const details = marquee.closest('details');
    details?.addEventListener('toggle', () => {
      if (details.open) sync();
    });

    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        sync();
      });
    });
  });
};
