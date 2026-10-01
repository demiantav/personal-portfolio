// Convierte el texto de un elemento en dos capas apiladas por letra (roll):
// la de arriba sale y la de abajo entra al hover. Acá solo se arma el DOM una
// vez; el movimiento vive en CSS. El `--i` por letra alimenta el stagger.
export const buildRoll = (el) => {
  if (!el || el.dataset.rollBuilt) return;
  const link = el.closest('a');
  const text = el.textContent.trim();
  link?.setAttribute('aria-label', text);

  const roll = document.createElement('span');
  roll.className = 'roll';
  roll.setAttribute('aria-hidden', 'true');

  text.split(' ').forEach((word, w, words) => {
    const wordEl = document.createElement('span');
    wordEl.className = 'roll__word';
    [...word].forEach((char, i) => {
      const charEl = document.createElement('span');
      charEl.className = 'roll__char';
      charEl.style.setProperty('--i', i);

      const base = document.createElement('span');
      base.className = 'roll__base';
      base.textContent = char;

      const alt = base.cloneNode(true);
      alt.className = 'roll__alt';

      charEl.append(base, alt);
      wordEl.append(charEl);
    });
    roll.append(wordEl);
    if (w < words.length - 1) roll.append(document.createTextNode(' '));
  });

  el.replaceChildren(roll);
  el.dataset.rollBuilt = 'true';
};
