import { GLASS, HOUSE, ROOF } from '@/render/house';
import styles from './HouseIcon.module.css';

const points = HOUSE.parts
  .flatMap((part) => part.d.match(/-?[\d.]+ -?[\d.]+/g) ?? [])
  .map((pair) => pair.split(' ').map(Number));
const xs = points.map((pair) => pair[0] ?? 0);
const ys = points.map((pair) => pair[1] ?? 0);
const box = [
  Math.min(...xs) - 1,
  Math.min(...ys) - 1,
  Math.max(...xs) - Math.min(...xs) + 2,
  Math.max(...ys) - Math.min(...ys) + 2,
];

/** The same little house the globe draws at home, as a flat icon for the menu. */
export function HouseIcon() {
  const [[x1, y1], [x2, y2]] = HOUSE.roof;
  return (
    <svg className={styles.house} viewBox={box.join(' ')} aria-hidden="true">
      <defs>
        <linearGradient id="menu-roof" gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0" stopColor="#5b44ab" />
          <stop offset="1" stopColor="#957fe6" />
        </linearGradient>
      </defs>
      {HOUSE.parts.map((part, index) => (
        <path
          key={index}
          d={part.d}
          fill={
            part.fill === ROOF ? 'url(#menu-roof)' : part.fill === GLASS ? '#ffd27a' : part.fill
          }
        />
      ))}
    </svg>
  );
}
