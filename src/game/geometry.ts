import type { Point } from './types';

export const pointKey = ({ x, y }: Point): string => `${x},${y}`;

export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export const addPoint = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

export const chebyshevDistance = (a: Point, b: Point): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function gridLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const doubled = error * 2;
    if (doubled >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y0 += sy;
    }
  }
  return points;
}
