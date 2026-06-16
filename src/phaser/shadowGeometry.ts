export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function shadowPolygon(source: PixelPoint, rect: PixelRect, distance: number): PixelPoint[] | null {
  if (pointInsideRect(source, rect)) return null;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  const angled = corners
    .map((point) => ({ point, angle: normalizeAngle(Math.atan2(point.y - source.y, point.x - source.x)) }))
    .sort((a, b) => a.angle - b.angle);

  let largestGap = -1;
  let gapIndex = 0;
  for (let index = 0; index < angled.length; index += 1) {
    const current = angled[index].angle;
    const next = angled[(index + 1) % angled.length].angle + (index === angled.length - 1 ? Math.PI * 2 : 0);
    if (next - current > largestGap) {
      largestGap = next - current;
      gapIndex = index;
    }
  }

  const edgeA = angled[(gapIndex + 1) % angled.length].point;
  const edgeB = angled[gapIndex].point;
  return [edgeA, projectAway(source, edgeA, distance), projectAway(source, edgeB, distance), edgeB];
}

function projectAway(source: PixelPoint, point: PixelPoint, distance: number): PixelPoint {
  const dx = point.x - source.x;
  const dy = point.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: point.x + (dx / length) * distance, y: point.y + (dy / length) * distance };
}

function pointInsideRect(point: PixelPoint, rect: PixelRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function normalizeAngle(angle: number): number {
  return angle < 0 ? angle + Math.PI * 2 : angle;
}
