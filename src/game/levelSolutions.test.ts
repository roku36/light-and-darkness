import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameSession } from './engine';
import { isStateSafe } from './lighting';
import { parseLevelText } from './levelParser';
import type { Direction, TurnResult } from './types';

type SolutionStep = Direction | 'switch';
type MovedObject = NonNullable<TurnResult['movedObject']>;

const LEVEL_SOLUTIONS = [
  {
    entry: { id: 'first-switch', name: 'First Switch', file: '01.txt', lightRadius: 4, nextLevel: 'box-step' },
    steps: ['up', 'up', 'up', 'up', 'switch', 'down', 'down', 'down', 'down'],
    movedObjects: [],
  },
  {
    entry: { id: 'box-step', name: 'Box Step', file: '02.txt', lightRadius: 4, nextLevel: 'lamp-push' },
    steps: ['right', 'right', 'right', 'down', 'down', 'switch', 'left', 'left', 'left', 'left', 'down', 'switch', 'right', 'right', 'down', 'down', 'down', 'left'],
    movedObjects: ['crate'],
  },
  {
    entry: { id: 'lamp-push', name: 'Lamp Push', file: '03.txt', lightRadius: 4, nextLevel: 'make-shadow' },
    steps: ['down', 'left', 'switch', 'down', 'down', 'right', 'right', 'right', 'up', 'right', 'up', 'right', 'switch', 'left', 'up', 'left', 'down', 'left'],
    movedObjects: ['crate'],
  },
  {
    entry: { id: 'make-shadow', name: 'Make Shadow', file: '04.txt', lightRadius: 5, nextLevel: 'two-treasures' },
    steps: ['down', 'left', 'left', 'left', 'left', 'down', 'left', 'left', 'up', 'right', 'right', 'right', 'right', 'up', 'right', 'down', 'switch', 'right', 'up', 'right', 'up', 'up', 'up', 'switch', 'down', 'down', 'left', 'left', 'left', 'switch', 'right', 'up'],
    movedObjects: ['light'],
  },
  {
    entry: { id: 'two-treasures', name: 'Two Treasures', file: '05.txt', lightRadius: 5 },
    steps: [
      'right',
      'right',
      'right',
      'up',
      'left',
      'switch',
      'up',
      'right',
      'right',
      'right',
      'switch',
      'down',
      'left',
      'left',
      'up',
      'right',
      'right',
      'right',
      'right',
      'switch',
      'right',
      'switch',
      'down',
      'down',
      'left',
      'down',
      'down',
      'left',
      'left',
      'left',
      'switch',
      'right',
      'up',
      'up',
      'right',
      'up',
      'right',
    ],
    movedObjects: ['crate', 'light'],
  },
] satisfies Array<{ entry: LevelEntry; steps: SolutionStep[]; movedObjects: MovedObject[] }>;

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

describe('level solutions', () => {
  it('matches the five-stage level index order', () => {
    const index = JSON.parse(readFileSync(resolve('public/levels/index.json'), 'utf8')) as LevelEntry[];
    expect(index.map((entry) => entry.id)).toEqual(LEVEL_SOLUTIONS.map(({ entry }) => entry.id));
  });

  it('stage 01 keeps its documented route valid', () => {
    const result = play(LEVEL_SOLUTIONS[0].entry, LEVEL_SOLUTIONS[0].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[0].movedObjects));
  });

  it('stage 02 keeps its documented route valid', () => {
    const result = play(LEVEL_SOLUTIONS[1].entry, LEVEL_SOLUTIONS[1].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[1].movedObjects));
  });

  it('stage 03 keeps its documented route valid', () => {
    const result = play(LEVEL_SOLUTIONS[2].entry, LEVEL_SOLUTIONS[2].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[2].movedObjects));
  });

  it('stage 04 keeps its documented route valid', () => {
    const result = play(LEVEL_SOLUTIONS[3].entry, LEVEL_SOLUTIONS[3].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[3].movedObjects));
  });

  it('stage 05 keeps its documented route valid', () => {
    const result = play(LEVEL_SOLUTIONS[4].entry, LEVEL_SOLUTIONS[4].steps);
    expect(new Set(result.movedObjects)).toEqual(new Set(LEVEL_SOLUTIONS[4].movedObjects));
  });
});
