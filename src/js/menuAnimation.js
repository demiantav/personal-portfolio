export const animateMenu = () => {
  const d = document;
  const $hamb = d.querySelector('.hamb'),
    $menu = d.querySelector('.container-items-menu');

  $hamb.addEventListener('click', () => {
    console.log('click');

    $menu.classList.toggle('full-menu');
  });
};
