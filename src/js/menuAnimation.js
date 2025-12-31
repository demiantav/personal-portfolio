let $links;

export const animateMenu = () => {
  const d = document;
  const $hamb = d.querySelectorAll('.header__hamb'),
    $menu = d.querySelector('.header__nav-menu');

  $links = d.querySelectorAll('.header__nav-link');

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
