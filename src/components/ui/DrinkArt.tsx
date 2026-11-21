import { memo, useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import { illustrationSvg } from '../../lib/illustrations';

// The cream paper of the JPG is hidden and the frame is tightened around the
// drink, so it fits the short phone tiles without cutting the steam or straw
const prepare = (svg: string) => svg
  .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" ')
  .replace('viewBox="0 0 800 600"', 'viewBox="40 0 720 570"');

// One observer for every tile: tiles scrolled out of view stop animating
const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
  for (const e of entries) e.target.classList.toggle('is-offscreen', !e.isIntersecting);
}, { rootMargin: '40px' });

/**
 * A drink drawing. With `animated` it moves according to the "Bebidas
 * animadas" setting in Temas (CSS only; see .drink-art in index.css).
 */
export const DrinkArt = memo(function DrinkArt({ illustration, animated = false, className }: {
  illustration: string;
  animated?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const svg = illustrationSvg(illustration);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animated || !observer) return;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [animated]);

  if (!svg) return null;
  return (
    <div
      ref={ref}
      className={cn('drink-art', animated && 'is-animated', className)}
      // Our own SVG files bundled with the app, never user content
      dangerouslySetInnerHTML={{ __html: prepare(svg) }}
    />
  );
});
