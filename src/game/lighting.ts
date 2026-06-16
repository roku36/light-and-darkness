import { chebyshevDistance, pointKey } from './geometry';
import type { GameState, LevelDefinition, Point } from './types';

const ACTOR_HIT_RADIUS = 0.25;
const ACTOR_HIT_SAMPLES = createActorCircleSamples();

interface WorldPoint {
  x: number;
  y: number;
}

export function computeLitCells(level: LevelDefinition, state: GameState): Set<string> {
  const lit = new Set<string>();
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (isWorldPointLit(level, state, { x: x + 0.5, y: y + 0.5 })) lit.add(pointKey({ x, y }));
    }
  }
  return lit;
}

export function allLightSources(level: LevelDefinition, state: GameState): Point[] {
  return [...level.fixedLights, ...state.lights];
}

export function isDarkActorNearLight(level: LevelDefinition, state: GameState): boolean {
  return allLightSources(level, state).some((source) => chebyshevDistance(source, state.actors.dark) <= 1);
}

export function isStateSafe(level: LevelDefinition, state: GameState): boolean {
  return getDeadActor(level, state) === null;
}

export function getDeadActor(level: LevelDefinition, state: GameState): 'light' | 'dark' | null {
  const lightSamples = actorHitSamples(state.actors.light);
  const darkSamples = actorHitSamples(state.actors.dark);
  if (!lightSamples.every((sample) => isWorldPointLit(level, state, sample))) return 'light';
  if (darkSamples.some((sample) => isWorldPointLit(level, state, sample)) || isDarkActorNearLight(level, state)) return 'dark';
  return null;
}

export const isLit = (lit: Set<string>, point: Point): boolean => lit.has(pointKey(point));

function actorHitSamples(actor: Point): WorldPoint[] {
  return ACTOR_HIT_SAMPLES.map((sample) => ({
    x: actor.x + 0.5 + sample.x,
    y: actor.y + 0.5 + sample.y,
  }));
}

function createActorCircleSamples(): WorldPoint[] {
  const samples: WorldPoint[] = [{ x: 0, y: 0 }];
  for (const radius of [ACTOR_HIT_RADIUS * 0.5, ACTOR_HIT_RADIUS]) {
    const steps = radius === ACTOR_HIT_RADIUS ? 16 : 8;
    for (let index = 0; index < steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      samples.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
  }
  return samples;
}

function isWorldPointLit(level: LevelDefinition, state: GameState, target: WorldPoint): boolean {
  const blockers = [...level.walls, ...state.crates];
  return allLightSources(level, state).some((sourceCell) => {
    const source = { x: sourceCell.x + 0.5, y: sourceCell.y + 0.5 };
    return !blockers.some((blocker) => {
      if (blocker.x === sourceCell.x && blocker.y === sourceCell.y) return false;
      return segmentCrossesCell(source, target, blocker);
    });
  });
}

function segmentCrossesCell(from: WorldPoint, to: WorldPoint, blocker: Point): boolean {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const epsilon = 1e-6;
  const minX = blocker.x;
  const maxX = blocker.x + 1;
  const minY = blocker.y;
  const maxY = blocker.y + 1;
  let near = 0;
  let far = 1;

  for (const [start, delta, min, max] of [
    [from.x, deltaX, minX, maxX],
    [from.y, deltaY, minY, maxY],
  ] as const) {
    if (Math.abs(delta) < epsilon) {
      if (start < min || start > max) return false;
      continue;
    }
    const first = (min - start) / delta;
    const second = (max - start) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return false;
  }
  return far >= -epsilon && near <= 1 + epsilon;
}
