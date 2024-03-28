export const pageLoad = () => {
  const $titleChars = document.querySelectorAll('.char');
  const $logo = document.querySelector('.demi-logo');
  const $hamb = document.querySelectorAll('.hamb');
  const $containerblue = document.querySelector('.container-initial-animation');
  const tl = gsap.timeline({ delay: 1 });

  tl.from($titleChars, {
    yPercent: 260,
    stagger: 0.05,
    ease: 'back.out',
    duration: '.65',
  })
    .to(
      $containerblue,
      {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
        duration: 1,
        ease: 'power3.inOut',
      },
      '<+=1.8'
    )
    .from(
      [$hamb, $logo],
      {
        yPercent: 200,
        ease: 'power3.inOut',
        duration: 1.5,
      },
      '<'
    );
};
