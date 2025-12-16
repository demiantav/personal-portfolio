let $links;

export const animateMenu = () => {
  const d = document;
  const $hamb = d.querySelectorAll('.header__hamb'),
    $menu = d.querySelectorAll('.header__nav-menu');

  $links = d.querySelectorAll('.header__nav-link');

  $hamb.forEach((e) =>
    e.addEventListener('click', () => {
      console.log('click');

      // Iterate over each menu element
      $menu.forEach((menuItem) => {
        menuItem.classList.toggle('open');
      });
    })
  );

  // $links.forEach((link) =>
  //   link.addEventListener('mouseenter', (event) => {
  //     if (!d.startViewTransition) {
  //       activeLink(event.target);
  //       return;
  //     }

  //     d.startViewTransition(() => {
  //       activeLink(event.target);
  //     });
  //   })
  // );
};

const activeLink = (link) => {
  $links.forEach((l) => l.classList.remove('active'));
  link.classList.add('active');
};
