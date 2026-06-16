import { describe, expect, it } from 'vitest';
import { FLAME_HORIZONTAL_OFFSETS } from './flameAnimation';
import { createInitialState } from '../game/engine';
import { pointKey } from '../game/geometry';
import { parseLevelText } from '../game/levelParser';
import { shadowPolygon } from './shadowGeometry';
import {
  GROUND_BASE_LUMINANCE,
  GROUND_PATTERN_LUMINANCE,
  groundBaseLuminance,
  visualLightBlockers,
} from './visualLighting';

describe('visual light shadow geometry', () => {
  it('moves the normal-map light smoothly from side to side', () => {
    expect(FLAME_HORIZONTAL_OFFSETS).toEqual([-0.16, -0.08, 0, 0.08, 0.16, 0.08, 0, -0.08]);
  });
  it('projects a continuous shadow away from a rectangular blocker', () => {
    const polygon = shadowPolygon(
      { x: 24, y: 24 },
      { x: 96, y: 48, width: 48, height: 48 },
      500,
    );
    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(4);
    expect(Math.max(...polygon!.slice(1, 3).map((point) => point.x))).toBeGreaterThan(500);
  });

  it('does not cast a shadow from a blocker containing the source', () => {
    expect(shadowPolygon(
      { x: 24, y: 24 },
      { x: 0, y: 0, width: 48, height: 48 },
      500,
    )).toBeNull();
  });

  it('uses ground albedo, not fixed-direction normal lighting, in unlit areas', () => {
    const first = groundBaseLuminance(0, 0);
    const second = groundBaseLuminance(17, 31);
    expect(first).toBeGreaterThanOrEqual(GROUND_BASE_LUMINANCE);
    expect(first).toBeLessThanOrEqual(GROUND_BASE_LUMINANCE + GROUND_PATTERN_LUMINANCE);
    expect(second).toBeGreaterThanOrEqual(GROUND_BASE_LUMINANCE);
    expect(second).toBeLessThanOrEqual(GROUND_BASE_LUMINANCE + GROUND_PATTERN_LUMINANCE);
  });

  it('does not include movable or fixed light sources in visual blockers', () => {
    const level = parseLevelText(`
########
#FS.Ll.#
#..B...#
#d...D.#
########`, { id: 'test', name: 'Test', lightRadius: 4 });
    const blockerKeys = new Set(visualLightBlockers(level, createInitialState(level)).map(pointKey));
    expect(blockerKeys.has(pointKey({ x: 1, y: 1 }))).toBe(false);
    expect(blockerKeys.has(pointKey({ x: 2, y: 1 }))).toBe(false);
    expect(blockerKeys.has(pointKey({ x: 3, y: 2 }))).toBe(true);
  });
});
