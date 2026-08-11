export const fixHeroBug = () => {
  const header = document.querySelector('header');
  const heroSection = document.querySelector('.main__hero-section');
  const aboutSection = document.querySelector('.main__about-me-section');
  const main = document.querySelector('#hero');

  const headerHeight = header.offsetHeight + 5;
  let isOutside = false;

  window.addEventListener(
    'scroll',
    () => {
      const rect = aboutSection.getBoundingClientRect();

      if (rect.top <= 0 && !isOutside) {
        main.prepend(header);
        header.classList.add('is-sticky');
        isOutside = true;
      } else if (rect.top > headerHeight && isOutside) {
        heroSection.append(header);
        header.classList.remove('is-sticky');
        isOutside = false;
      }
    },
    { passive: true },
  );
};
