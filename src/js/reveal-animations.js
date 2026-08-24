import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export const animateReveals = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Líneas divisorias de about-me: se dibujan desde el borde de su alineación
  // (la secundaria vive a la derecha → espejo)
  if (!reduceMotion) {
    gsap.utils.toArray('.main__about-me-section .main__line').forEach((line) => {
      const fromRight = line.classList.contains('main__line--secondary');
      gsap.set(line, {
        scaleX: 0,
        transformOrigin: fromRight ? 'right center' : 'left center',
      });
      gsap.to(line, {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: line,
          start: 'top 60%',
          // una sola vez: dibujadas, quedan dibujadas
          toggleActions: 'play none none none',
          invalidateOnRefresh: true,
        },
      });
    });
  }

  const images = gsap.utils.toArray('.main__gallery img');
  if (images.length === 0) return;

  const frames = images.map((img) => {
    const frame = document.createElement('div');
    frame.className = 'reveal-frame';
    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);
    return frame;
  });

  if (reduceMotion) return;

  frames.forEach((frame) => {
    const img = frame.querySelector('img');

    gsap.set(frame, {
      clipPath: 'inset(0% 0% 0% 100%)',
      x: 60,
      scale: 1,
    });
    gsap.set(img, { scale: 1.35 });

    gsap
      .timeline({
        scrollTrigger: {
          trigger: frame,
          start: 'top 55%',
          toggleActions: 'play none none reverse',
          invalidateOnRefresh: true,
        },
        defaults: { ease: 'power3.out' },
      })
      .to(frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1 }, 0)
      .to(frame, { x: 0, duration: 1.2 }, 0)
      .to(frame, { scale: 0.9, duration: 1.4, ease: 'power2.inOut' }, 0)
      .to(img, { scale: 1, duration: 1.4 }, 0);
  });

  // ─── Project Cards ────────────────────────────────────────────────
  const projectCards = gsap.utils.toArray('.main__project-card');
  if (projectCards.length === 0) return;

  projectCards.forEach((card) => {
    const link = card.querySelector('a');
    const img = card.querySelector('img');
    const tags = gsap.utils.toArray(card.querySelectorAll('.main__label span'));
    const tagContainer = card.querySelector('.main__label');
    const paragraph = card.querySelector('p');

    if (!link || !img) return;

    // ── 1) Image: vertical clipPath reveal + cinematic scale ──
    gsap.set(link, { clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set(img, { scale: 1.15 });

    const imgTween = gsap
      .timeline({
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        defaults: { ease: 'power3.out' },
      })
      .to(link, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3 }, 0)
      .to(img, { scale: 1, duration: 3, ease: 'power2.out' }, 0);

    // ── 2) Tags: clip-path reveal from top + SplitText chars chaotic burst ──
    if (tags.length > 0) {
      gsap.set(tags, { clipPath: 'inset(0% 0% 100% 0%)' });

      // Clip-path reveal: open from top to bottom per tag
      gsap.to(tags, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.4,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: tagContainer,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      });

      // SplitText per-tag chars: chaotic burst — after each tag finishes revealing
      tags.forEach((tag, i) => {
        SplitText.create(tag, {
          type: 'chars',
          mask: 'chars',
          autoSplit: true,
          smartWrap: true,
          onSplit(self) {
            const tween = gsap.from(self.chars, {
              duration: 0.35,
              autoAlpha: 0,
              yPercent: 'random([-100, 100])',
              ease: 'back.out',
              stagger: { from: 'random', amount: 0.45 },
              delay: 0.6 + i * 0.12,
              scrollTrigger: {
                trigger: tagContainer,
                start: 'top 90%',
                toggleActions: 'play none none none',
              },
            });
            return () => {
              tween.scrollTrigger?.kill();
              tween.kill();
            };
          },
        });
      });
    }

    // ── 3) Text: SplitText words — same as .main__about-me-secundary ──
    if (paragraph) {
      SplitText.create(paragraph, {
        type: 'words',
        mask: 'words',
        autoSplit: true,
        smartWrap: true,
        onSplit(self) {
          const tween = gsap.from(self.words, {
            duration: 0.89,
            autoAlpha: 0,
            yPercent: '100, -100',
            ease: 'back.out',
            stagger: { amount: 0.9, from: 'start' },
            scrollTrigger: {
              trigger: paragraph,
              start: 'top 90%',
              toggleActions: 'play none none none',
            },
          });
          return () => {
            tween.scrollTrigger?.kill();
            tween.kill();
          };
        },
      });
    }
  });
};
