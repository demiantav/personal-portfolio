import gsap from 'gsap';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export const pageLoad = () => {
  // 🔒 Bloquear scroll al inicio
  document.body.classList.add('no-scroll');

  const $titleChars = document.querySelectorAll('.char');
  const $logo = document.querySelector('.demi-logo');
  const $hamb = document.querySelectorAll('.hamb');
  const $menu_full_page = document.querySelectorAll('.prueba');
  const $containerblue = document.querySelector('.container-initial-animation');

  let splitText = new SplitText('.about-title', { type: 'words' });

  const tl = gsap.timeline({
    delay: 1,
    onComplete: () => {
      // 🔓 Desbloquear scroll cuando termina la animación
      document.body.classList.remove('no-scroll');
    },
  });

  tl.from($titleChars, {
    yPercent: 260,
    stagger: 0.05,
    ease: 'back.out',
    duration: 0.65,
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
      [$hamb, $logo, $menu_full_page],
      {
        yPercent: 200,
        ease: 'power3.inOut',
        duration: 1.5,
      },
      '<'
    )
    .from(
      '.gsap-words',
      {
        yPercent: -90,
        stagger: 0.2,
        ease: 'back.out',
        duration: 1.4,
      },
      '<+=.20'
    );
};

// export const animateSectionText = () => {
//   const $sectionText = document.querySelector('.about-title');
//   const tl = gsap.timeline({
//     scrollTrigger: {
//       trigger: $sectionText,
//       start: 'top 80%',
//       end: 'top 30%',
//       scrub: true,
//     },
//   });

//   tl.from($sectionText, {
//     yPercent: -90,
//     stagger: 0.2,
//     ease: 'back.out',
//     duration: 1.4,
//   });
// };
