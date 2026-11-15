import { useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useCardStack(ref) {
  useLayoutEffect(() => {
    const root = ref.current;
    const strips = [...root.querySelectorAll('.measure-strip')];
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      strips.forEach((strip, index) => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            id: `measure-stack-${index}`, trigger: strip,
            // Short catch-up keeps reversals responsive without snapping to wheel steps.
            start: 'top 65%', end: 'top top', scrub: .3,
            invalidateOnRefresh: true,
          },
        });
        // The reference has two consecutive 0.5 s tweens, with GSAP's default
        // power1.out ease. Geometry is provided by CSS sticky, never pinning.
        if (index > 0) {
          timeline.fromTo(strips[index - 1].querySelector('.measure-card'),
            { scale: 1, filter: 'blur(0px)' },
            { scale: .85, filter: 'blur(8px)', duration: .5, ease: 'power1.out' });
        } else {
          // Reserve the same first half for the first card, which has no predecessor.
          timeline.to({}, { duration: .5 });
        }
        timeline.fromTo(strip.querySelector('.measure-card'),
          { boxShadow: '0px 0px 0px 0px rgba(0, 0, 0, 0.02)' },
          { boxShadow: '0px -49px 49px 0px rgba(0, 0, 0, 0.02)', duration: .5, ease: 'power1.out' });
        // ScrollTrigger defaults to an exponential catch-up, which makes a
        // short scrub lurch on large wheel steps. Keep the reference's card
        // timeline intact and soften only how its playhead catches the scroll.
        const catchUp = timeline.scrollTrigger.getTween();
        catchUp.vars.ease = 'power1.out';
        catchUp.invalidate();
      });
    }, root);
    let active = true;
    document.fonts.ready.then(() => { if (active) ScrollTrigger.refresh(); });
    return () => { active = false; media.revert(); };
  }, [ref]);
}
