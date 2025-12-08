export const animateMenu = () => {
  const d = document;
  const $hamb = d.querySelector('.header__container-hamb'),
    $menu = d.querySelector('.header__nav-menu');

  $hamb.addEventListener('click', () => {
    console.log('click');

    $menu.classList.toggle('open');
    d.querySelector('.header__hamb-line1').classList.toggle('line-open');
  });
};
