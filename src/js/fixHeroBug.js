export const fixHeroBug = () => {
  const header = document.querySelector('header');
  const heroSection = document.querySelector('.main__hero-section');
  const aboutSection = document.querySelector('.main__about-me-section');
  const main = document.querySelector('#hero');

  let isOutside = false;

  window.addEventListener(
    'scroll',
    () => {
      const rect = aboutSection.getBoundingClientRect();

      // 1. EXTRAER: Al llegar a 'About me', saca el header al inicio de <main>
      if (rect.top <= 0 && !isOutside) {
        main.prepend(header);
        header.classList.add('is-sticky');
        isOutside = true;
      }
      // 2. RETORNAR: Al subir de nuevo, lo devuelve al final de la section hero
      else if (rect.top > 0 && isOutside) {
        heroSection.append(header);
        header.classList.remove('is-sticky');
        isOutside = false;
      }
    },
    { passive: true },
  );
};
