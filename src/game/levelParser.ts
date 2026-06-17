import type { ActorKind, LevelDefinition, Point } from './types';
import { pointKey } from './geometry';

export interface LevelMetadata {
  id: string;
  name?: string;
  lightRadius: number;
  displayScale?: number;
  nextLevel?: string;
  tutorial?: string;
}

const TOKENS = new Set(['#', 'X', '.', 'L', 'D', 'B', 'S', 'F', 'l', 'd']);
const WALL_TOKENS = new Set(['#', 'X']);

export function parseLevelText(text: string, metadata: LevelMetadata): LevelDefinition {
  const document = parseLevelDocument(text);
  const sourceRows = parseRows(document.body);
  if (sourceRows.length < 1 || sourceRows[0].length < 1) throw new Error('Level must contain at least one map cell.');
  const sourceWidth = sourceRows[0].length;
  if (sourceRows.some((row) => row.length !== sourceWidth)) throw new Error('Level rows must have equal width.');
  const rows = withAutomaticPerimeter(stripLegacyPerimeter(sourceRows));
  const width = rows[0].length;
  if (!Number.isInteger(metadata.lightRadius) || metadata.lightRadius < 1) {
    throw new Error('lightRadius must be a positive integer.');
  }
  const displayScale = parseDisplayScale(document.settings, metadata.displayScale);

  const walls: Point[] = [];
  const crates: Point[] = [];
  const lights: Point[] = [];
  const fixedLights: Point[] = [];
  const actors: Partial<Record<ActorKind, Point>> = {};
  const goals: Partial<Record<ActorKind, Point>> = {};

  rows.forEach((row, y) => row.forEach((token, x) => {
    if (!TOKENS.has(token)) throw new Error(`Unknown token "${token}" at row ${y + 1}, column ${x + 1}.`);
    const point = { x, y };
    if (WALL_TOKENS.has(token)) walls.push(point);
    if (token === 'B') crates.push(point);
    if (token === 'S') lights.push(point);
    if (token === 'F') fixedLights.push(point);
    if (token === 'L' || token === 'D') {
      const kind = token === 'L' ? 'light' : 'dark';
      if (actors[kind]) throw new Error(`Level requires exactly one ${kind} actor.`);
      actors[kind] = point;
    }
    if (token === 'l' || token === 'd') {
      const kind = token === 'l' ? 'light' : 'dark';
      if (goals[kind]) throw new Error(`Level requires exactly one ${kind} goal.`);
      goals[kind] = point;
    }
  }));

  if (!actors.light || !actors.dark || !goals.light || !goals.dark) {
    throw new Error('Level requires L, D, l, and d exactly once.');
  }

  validateReachableFloor(width, rows.length, new Set(walls.map(pointKey)), actors.light);

  return {
    ...metadata,
    name: document.title ?? metadata.name ?? metadata.id,
    displayScale,
    width,
    height: rows.length,
    walls,
    crates,
    lights,
    fixedLights,
    actors: { light: actors.light, dark: actors.dark },
    goals: { light: goals.light, dark: goals.dark },
  };
}

export function parseLevelTitle(text: string): string | undefined {
  return parseLevelDocument(text).title;
}

function parseDisplayScale(settings: Map<string, string>, fallback?: number): number {
  const raw = settings.get('scale') ?? settings.get('displayScale') ?? settings.get('display-scale');
  const displayScale = raw === undefined ? fallback ?? 1 : Number(raw);
  if (!Number.isInteger(displayScale) || displayScale < 1) {
    throw new Error('scale must be a positive integer.');
  }
  return displayScale;
}

function parseLevelDocument(text: string): { title?: string; settings: Map<string, string>; body: string } {
  const lines = text.trim().split(/\r?\n/);
  let cursor = 0;
  while (cursor < lines.length && isIgnorableHeaderLine(lines[cursor])) cursor += 1;
  if (cursor >= lines.length) return { settings: new Map(), body: text };

  const firstContentLine = lines[cursor].trim();
  if (isMapRow(firstContentLine)) return { settings: new Map(), body: text };

  const title = firstContentLine;
  cursor += 1;
  const settings = new Map<string, string>();
  while (cursor < lines.length) {
    const trimmed = lines[cursor].trim();
    if (trimmed.length === 0 || trimmed.startsWith('//')) {
      cursor += 1;
      continue;
    }
    if (isMapRow(trimmed)) break;
    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.+)$/.exec(trimmed);
    if (!match) throw new Error(`Unknown level header "${trimmed}".`);
    settings.set(match[1], match[2].trim());
    cursor += 1;
  }

  return {
    title,
    settings,
    body: lines.slice(cursor).join('\n'),
  };
}

function isIgnorableHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith('//');
}

function parseRows(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
    .map((line) => (line.includes(',') ? line.split(',').map((cell) => cell.trim()) : [...line]));
}

function stripLegacyPerimeter(rows: string[][]): string[][] {
  if (rows.length < 3 || rows[0].length < 3 || !hasClosedPerimeter(rows)) return rows;
  return rows.slice(1, -1).map((row) => row.slice(1, -1));
}

function hasClosedPerimeter(rows: string[][]): boolean {
  const width = rows[0].length;
  for (let x = 0; x < width; x += 1) {
    if (!WALL_TOKENS.has(rows[0][x]) || !WALL_TOKENS.has(rows[rows.length - 1][x])) return false;
  }
  for (let y = 0; y < rows.length; y += 1) {
    if (!WALL_TOKENS.has(rows[y][0]) || !WALL_TOKENS.has(rows[y][width - 1])) return false;
  }
  return true;
}

function withAutomaticPerimeter(rows: string[][]): string[][] {
  const width = rows[0].length;
  return [
    Array.from({ length: width + 2 }, () => '#'),
    ...rows.map((row) => ['#', ...row, '#']),
    Array.from({ length: width + 2 }, () => '#'),
  ];
}

function isMapRow(line: string): boolean {
  const cells = line.includes(',') ? line.split(',').map((cell) => cell.trim()) : [...line];
  return cells.length > 0 && cells.every((cell) => TOKENS.has(cell));
}

function validateReachableFloor(width: number, height: number, walls: Set<string>, start: Point): void {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const point = queue.shift()!;
    const key = pointKey(point);
    if (visited.has(key) || walls.has(key)) continue;
    visited.add(key);
    for (const next of [
      { x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 },
    ]) {
      if (next.x > 0 && next.y > 0 && next.x < width - 1 && next.y < height - 1) queue.push(next);
    }
  }
  const openCount = width * height - walls.size;
  if (visited.size !== openCount) throw new Error('All non-wall cells must form one reachable region.');
}
