import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attemptMove, cloneState, createInitialState, GameSession, switchCharacter } from './engine';
import { pointKey } from './geometry';
import { isStateSafe } from './lighting';
import { parseLevelText } from './levelParser';
import type { Direction, GameState, LevelDefinition, TurnResult } from './types';

type SolutionStep = Direction | 'switch';
type MovedObject = NonNullable<TurnResult['movedObject']>;

const LEVEL_SOLUTIONS = [
  {
    entry: { id: 'first-switch', name: 'First Switch', file: '01.txt', lightRadius: 4, nextLevel: 'box-step' },
    steps: ['right', 'right', 'switch', 'right'],
    requiredObjects: ['crate'],
  },
  {
    entry: { id: 'box-step', name: 'Box Step', file: '02.txt', lightRadius: 4, nextLevel: 'lamp-push' },
    steps: ['up', 'up', 'switch', 'right', 'right'],
    requiredObjects: ['crate'],
  },
  {
    entry: { id: 'lamp-push', name: 'Lamp Push', file: '03.txt', lightRadius: 4, nextLevel: 'make-shadow' },
    steps: ['left', 'left', 'switch', 'right', 'right'],
    requiredObjects: ['light'],
  },
  {
    entry: { id: 'make-shadow', name: 'Make Shadow', file: '04.txt', lightRadius: 5, nextLevel: 'two-treasures' },
    steps: ['right', 'right', 'switch', 'right', 'right'],
    requiredObjects: ['crate'],
  },
  {
    entry: { id: 'two-treasures', name: 'Two Treasures', file: '05.txt', lightRadius: 5 },
    steps: [
      'down',
      'left',
      'down',
      'right',
      'down',
      'right',
      'up',
      'left',
      'up',
      'left',
      'left',
      'up',
      'switch',
      'up',
      'up',
    ],
    requiredObjects: [],
  },
] satisfies Array<{ entry: LevelEntry; steps: SolutionStep[]; requiredObjects: MovedObject[] }>;

interface LevelEntry {
  id: string;
  name: string;
  file: string;
  lightRadius: number;
  nextLevel?: string;
}

function loadLevel(entry: LevelEntry) {
  return parseLevelText(readFileSync(resolve('public/levels', entry.file), 'utf8'), entry);
}

function play(entry: LevelEntry, steps: SolutionStep[]): { session: GameSession; movedObjects: MovedObject[] } {
  const level = loadLevel(entry);
  const session = new GameSession(level);
  const movedObjects: MovedObject[] = [];
  expect(isStateSafe(level, session.state), `${entry.id} starts safe`).toBe(true);

  for (const [index, step] of steps.entries()) {
    if (step === 'switch') {
      session.switchCharacter();
      expect(isStateSafe(level, session.state), `${entry.id} switch ${index + 1} remains safe`).toBe(true);
      continue;
    }
    const result = session.move(step);
    expect(result.accepted, `${entry.id} step ${index + 1} ${step}; died=${result.died}`).toBe(true);
    if (result.movedObject) movedObjects.push(result.movedObject);
  }

  expect(session.state.status, `${entry.id} should be complete`).toBe('complete');
  return { session, movedObjects };
}

function canCompleteWithoutMovingObjects(level: LevelDefinition): boolean {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  const start = createInitialState(level);
  const queue: GameState[] = [start];
  const visited = new Set([stateKey(start)]);

  while (queue.length > 0) {
    const state = queue.shift()!;
    if (state.status === 'complete') return true;

    const switched = switchCharacter(state);
    enqueue(switched);

    for (const direction of directions) {
      const result = attemptMove(level, state, direction);
      if (!result.accepted || result.movedObject) continue;
      enqueue(result.state);
    }
  }

  return false;

  function enqueue(state: GameState): void {
    const key = stateKey(state);
    if (visited.has(key)) return;
    visited.add(key);
    queue.push(cloneState(state));
  }
}

function canCompleteWhileAvoidingObject(level: LevelDefinition, avoidedObject: MovedObject): boolean {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  const start = createInitialState(level);
  const queue: GameState[] = [start];
  const visited = new Set([stateKey(start)]);

  while (queue.length > 0) {
    const state = queue.shift()!;
    if (state.status === 'complete') return true;

    const switched = switchCharacter(state);
    enqueue(switched);

    for (const direction of directions) {
      const result = attemptMove(level, state, direction);
      if (!result.accepted || result.movedObject === avoidedObject) continue;
      enqueue(result.state);
    }
  }

  return false;

  function enqueue(state: GameState): void {
    const key = stateKey(state);
    if (visited.has(key)) return;
    visited.add(key);
    queue.push(cloneState(state));
  }
}

function stateKey(state: GameState): string {
  return [
    state.activeActor,
    pointKey(state.actors.light),
    pointKey(state.actors.dark),
    ...state.crates.map(pointKey).sort(),
    ...state.lights.map(pointKey).sort(),
    state.status,
  ].join('|');
}

describe('tutorial level solutions', () => {
  it('matches the five-stage level index order', () => {
    const index = JSON.parse(readFileSync(resolve('public/levels/index.json'), 'utf8')) as LevelEntry[];
    expect(index.map((entry) => entry.id)).toEqual(LEVEL_SOLUTIONS.map(({ entry }) => entry.id));
  });

  it('stage 01 requires a box push before switching to dark', () => {
    const result = play(LEVEL_SOLUTIONS[0].entry, LEVEL_SOLUTIONS[0].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[0].requiredObjects));
  });

  it('stage 02 teaches vertical box pushing', () => {
    const result = play(LEVEL_SOLUTIONS[1].entry, LEVEL_SOLUTIONS[1].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[1].requiredObjects));
  });

  it('stage 03 teaches that only the light actor can push a light source', () => {
    const result = play(LEVEL_SOLUTIONS[2].entry, LEVEL_SOLUTIONS[2].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[2].requiredObjects));
  });

  it('stage 04 teaches making a shadow with a box', () => {
    const result = play(LEVEL_SOLUTIONS[3].entry, LEVEL_SOLUTIONS[3].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[3].requiredObjects));
  });

  it('stage 05 keeps its documented route valid', () => {
    const result = play(LEVEL_SOLUTIONS[4].entry, LEVEL_SOLUTIONS[4].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[4].requiredObjects));
  });

  it.each(LEVEL_SOLUTIONS.filter(({ requiredObjects }) => requiredObjects.length > 0))('$entry.id cannot be completed without moving a box or light source', ({ entry }) => {
    const level = loadLevel(entry);
    expect(canCompleteWithoutMovingObjects(level), entry.id).toBe(false);
  });

  it.each(LEVEL_SOLUTIONS)('$entry.id requires every listed object type', ({ entry, requiredObjects }) => {
    const level = loadLevel(entry);
    for (const objectType of requiredObjects) {
      expect(canCompleteWhileAvoidingObject(level, objectType), `${entry.id} without ${objectType}`).toBe(false);
    }
  });
});
