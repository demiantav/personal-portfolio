let $links;

const hoverDesktop = window.matchMedia('(width >= 970px) and (hover: hover) and (pointer: fine)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Convierte el texto de cada link en dos capas apiladas por letra (roll). Acá
// solo se arma el DOM una vez: el movimiento del hover es 100% CSS.
const buildRoll = (span) => {
  if (span.dataset.rollBuilt) return;
  const link = span.closest('a');
  const text = span.textContent.trim();
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

  span.replaceChildren(roll);
  span.dataset.rollBuilt = 'true';
};

// Solo en desktop con hover y sin reduce-motion: en mobile/overlay el texto
// queda plano (el builder ni se ejecuta).
const applyRoll = () => {
  if (!hoverDesktop.matches || reduceMotion.matches) return;
  $links.forEach((link) => {
    const span = link.querySelector('.header__span');
    if (span) buildRoll(span);
  });
};

export const animateMenu = () => {
  const d = document;
  const $hamb = d.querySelectorAll('.header__hamb'),
    $menu = d.querySelector('.header__nav-menu');

  $links = d.querySelectorAll('.header__nav-link');

  applyRoll();
  hoverDesktop.addEventListener('change', applyRoll);
  reduceMotion.addEventListener('change', applyRoll);

  $hamb.forEach((e) =>
    e.addEventListener('click', () => {
      console.log('click');

      $menu.classList.toggle('open');
    })
  );

  $links.forEach((link) =>
    link.addEventListener('click', () => {
      $menu.classList.remove('open');
    })
  );

  $links.forEach((link) =>
    link.addEventListener('click', (event) => {
      if (!d.startViewTransition) {
        activeLink(link);
        return;
      }

      d.startViewTransition(() => {
        activeLink(link);
      });
    })
  );
};

const activeLink = (link) => {
  $links.forEach((l) => l.classList.remove('active'));
  link.classList.add('active');
};
