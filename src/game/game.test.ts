import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attemptMove, createInitialState, GameSession } from './engine';
import { pointKey } from './geometry';
import { computeLitCells, isStateSafe } from './lighting';
import { parseLevelText } from './levelParser';

const parse = (text: string, radius = 3) => parseLevelText(text, {
  id: 'test', name: 'Test', lightRadius: radius,
});

describe('level parser', () => {
  it('parses required entities', () => {
    const level = parse(`
#######
#SL.l.#
#..#..#
#d..D.#
#######`);
    expect(level.width).toBe(7);
    expect(level.actors.light).toEqual({ x: 2, y: 1 });
    expect(level.goals.dark).toEqual({ x: 1, y: 3 });
  });

  it('still accepts comma-separated legacy rows', () => {
    const level = parse(`
#,#,#,#,#,#,#
#,S,L,.,l,.,#
#,.,.,#,.,.,#
#,d,.,.,D,.,#
#,#,#,#,#,#,#`);
    expect(level.width).toBe(7);
    expect(level.actors.dark).toEqual({ x: 4, y: 3 });
  });

  it('parses fixed light sources', () => {
    const level = parse(`
#######
#FL.l.#
#..#..#
#d..D.#
#######`);
    expect(level.fixedLights).toEqual([{ x: 1, y: 1 }]);
    expect(level.lights).toEqual([]);
  });

  it('uses the first text line as the stage name', () => {
    const level = parse(`
固定光源の部屋
#######
#FL.l.#
#..#..#
#d..D.#
#######`);
    expect(level.name).toBe('固定光源の部屋');
    expect(level.width).toBe(7);
  });

  it('rejects open perimeters and unknown tokens', () => {
    expect(() => parse(`
#####
.SLl#
#dD.#
#####`)).toThrow(/perimeter/i);
    expect(() => parse(`
#####
#SLX#
#dDl#
#####`)).toThrow(/Unknown token/);
  });
});

describe('shipped levels', () => {
  it('start with both actors in valid light conditions', () => {
    const entries = JSON.parse(readFileSync(resolve('public/levels/index.json'), 'utf8')) as Array<{
      id: string;
      name?: string;
      file: string;
      lightRadius: number;
      nextLevel?: string;
    }>;
    for (const entry of entries) {
      const text = readFileSync(resolve('public/levels', entry.file), 'utf8');
      const level = parseLevelText(text, entry);
      expect(isStateSafe(level, createInitialState(level)), entry.id).toBe(true);
    }
  });

  it('keeps Stage 01 tutorial route safe', () => {
    const entry = {
      id: 'first-switch', name: 'First Switch', file: '01.txt', lightRadius: 4,
      nextLevel: 'box-step',
    };
    const level = parseLevelText(readFileSync(resolve('public/levels/01.txt'), 'utf8'), entry);
    const session = new GameSession(level);
    const directions = ['right', 'right'] as const;
    for (const [index, direction] of directions.entries()) {
      const result = session.move(direction);
      expect(result.accepted, `move ${index + 1} ${direction}; died=${result.died}`).toBe(true);
    }
  });
});

describe('lighting', () => {
  it('lets walls and crates cast grid shadows', () => {
    const level = parse(`
########
#SL#.l.#
#......#
#d..D..#
########`, 5);
    const state = createInitialState(level);
    const lit = computeLitCells(level, state);
    expect(lit.has(pointKey({ x: 4, y: 1 }))).toBe(false);
    expect(lit.has(pointKey(state.actors.light))).toBe(true);
  });

  it('makes all adjacent cells lethal to the dark actor', () => {
    const level = parse(`
######
#SL.l#
#.D..#
#d...#
######`);
    expect(isStateSafe(level, createInitialState(level))).toBe(false);
  });

  it('reaches the entire board regardless of configured radius', () => {
    const level = parse(`
#########
#SL....l#
#.......#
#d....D.#
#########`, 1);
    const lit = computeLitCells(level, createInitialState(level));
    expect(lit.has(pointKey({ x: 7, y: 1 }))).toBe(true);
  });

  it('uses fixed lights for lighting and dark adjacency danger', () => {
    const level = parse(`
########
#F.L.l.#
#.#....#
#d...D.#
########`, 1);
    const state = createInitialState(level);
    const lit = computeLitCells(level, state);
    expect(lit.has(pointKey(level.actors.light))).toBe(true);
    expect(isStateSafe(level, state)).toBe(true);

    const nearDark = { ...state, actors: { ...state.actors, dark: { x: 2, y: 1 } } };
    expect(isStateSafe(level, nearDark)).toBe(false);
  });

  it('treats rays touching a box corner as blocked', () => {
    const level = parse(`
###########
###########
#.lSL.#...#
#....B....#
#.....#.d.#
#..S..#...#
####..#.D.#
###########`, 5);
    const lit = computeLitCells(level, createInitialState(level));
    expect(lit.has(pointKey({ x: 8, y: 3 }))).toBe(false);
  });

  it('keeps Stage 05 dark actor safe while walking upward through shadow', () => {
    const entry = { id: 'two-treasures', file: '05.txt', lightRadius: 5 };
    const level = parseLevelText(readFileSync(resolve('public/levels/05.txt'), 'utf8'), entry);
    const session = new GameSession(level);
    session.switchCharacter();
    for (const [index, direction] of (['up', 'up', 'up', 'up'] as const).entries()) {
      const result = session.move(direction);
      expect(result.accepted, `move ${index + 1}; died=${result.died}`).toBe(true);
    }
  });
});

describe('movement and history', () => {
  it('pushes one crate but never two crates', () => {
    const level = parse(`
########
#SLB.l.#
#..#...#
#d...D.#
########`);
    const state = createInitialState(level);
    const pushed = attemptMove(level, state, 'right');
    expect(pushed.accepted).toBe(true);
    expect(pushed.state.crates).toContainEqual({ x: 4, y: 1 });

    const blockedLevel = parse(`
########
#SLBBl.#
#..#...#
#d...D.#
########`);
    expect(attemptMove(blockedLevel, createInitialState(blockedLevel), 'right').accepted).toBe(false);
  });

  it('allows only the light actor to push a light source', () => {
    const level = parse(`
########
#.L.l..#
#......#
#dDS...#
########`, 2);
    const state = { ...createInitialState(level), activeActor: 'dark' as const };
    expect(attemptMove(level, state, 'right').accepted).toBe(false);
  });

  it('does not allow fixed light sources to be moved or entered', () => {
    const level = parse(`
########
#.LF.l.#
#......#
#d...D.#
########`, 2);
    const state = createInitialState(level);
    expect(attemptMove(level, state, 'right').accepted).toBe(false);
  });

  it('rejects a move when changed lighting kills the waiting actor', () => {
    const level = parse(`
#########
#SL..l..#
#.B.....#
#d...D..#
#########`, 4);
    const state = createInitialState(level);
    const result = attemptMove(level, state, 'down');
    expect(result.died || !result.accepted).toBe(true);
    expect(result.state).toEqual(state);
    expect(result.failedState).not.toBeNull();
  });

  it('undo restores actors, objects, active actor and turns', () => {
    const level = parse(`
########
#SLB.l.#
#..#...#
#d...D.#
########`);
    const session = new GameSession(level);
    const initial = structuredClone(session.state);
    expect(session.move('right').accepted).toBe(true);
    session.switchCharacter();
    expect(session.undo()).toBe(true);
    expect(session.state).toEqual(initial);
  });

  it('completes only while both actors stand on their own goals', () => {
    const level = parse(`
########
#SLl...#
#..#...#
#....Dd#
########`);
    const state = createInitialState(level);
    expect(attemptMove(level, state, 'right').state.status).toBe('playing');
    const withDarkOnGoal = { ...state, actors: { ...state.actors, dark: level.goals.dark } };
    expect(attemptMove(level, withDarkOnGoal, 'right').state.status).toBe('complete');
  });
});
