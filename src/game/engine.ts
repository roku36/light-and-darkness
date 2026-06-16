import { addPoint, pointKey, samePoint } from './geometry';
import { getDeadActor } from './lighting';
import type { Direction, GameState, LevelDefinition, Point, TurnResult } from './types';

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const createInitialState = (level: LevelDefinition): GameState => ({
  levelId: level.id,
  actors: structuredClone(level.actors),
  crates: structuredClone(level.crates),
  lights: structuredClone(level.lights),
  activeActor: 'light',
  turns: 0,
  status: 'playing',
});

export const cloneState = (state: GameState): GameState => structuredClone(state);

export function switchCharacter(state: GameState): GameState {
  return { ...cloneState(state), activeActor: state.activeActor === 'light' ? 'dark' : 'light' };
}

export function attemptMove(level: LevelDefinition, state: GameState, direction: Direction): TurnResult {
  if (state.status !== 'playing') return reject(state);
  const delta = DELTAS[direction];
  const from = state.actors[state.activeActor];
  const target = addPoint(from, delta);
  const wallKeys = new Set(level.walls.map(pointKey));
  const fixedLightKeys = new Set(level.fixedLights.map(pointKey));
  if (
    wallKeys.has(pointKey(target))
    || fixedLightKeys.has(pointKey(target))
    || samePoint(target, state.actors[state.activeActor === 'light' ? 'dark' : 'light'])
  ) return reject(state);

  const next = cloneState(state);
  let movedObject: TurnResult['movedObject'] = null;
  const crateIndex = next.crates.findIndex((point) => samePoint(point, target));
  const lightIndex = next.lights.findIndex((point) => samePoint(point, target));

  if (crateIndex >= 0 || lightIndex >= 0) {
    if (lightIndex >= 0 && state.activeActor !== 'light') return reject(state);
    const destination = addPoint(target, delta);
    if (isOccupied(level, next, destination)) return reject(state);
    if (crateIndex >= 0) {
      next.crates[crateIndex] = destination;
      movedObject = 'crate';
    } else {
      next.lights[lightIndex] = destination;
      movedObject = 'light';
    }
  }

  next.actors[state.activeActor] = target;
  next.turns += 1;
  next.status = samePoint(next.actors.light, level.goals.light) && samePoint(next.actors.dark, level.goals.dark)
    ? 'complete'
    : 'playing';

  const deadActor = getDeadActor(level, next);
  if (deadActor) return { ...reject(state), died: true, deadActor, failedState: next };
  return { accepted: true, died: false, deadActor: null, failedState: null, movedObject, state: next };
}

function isOccupied(level: LevelDefinition, state: GameState, point: Point): boolean {
  return level.walls.some((item) => samePoint(item, point))
    || level.fixedLights.some((item) => samePoint(item, point))
    || state.crates.some((item) => samePoint(item, point))
    || state.lights.some((item) => samePoint(item, point))
    || samePoint(state.actors.light, point)
    || samePoint(state.actors.dark, point);
}

function reject(state: GameState): TurnResult {
  return { accepted: false, died: false, deadActor: null, failedState: null, movedObject: null, state: cloneState(state) };
}

export class GameSession {
  readonly level: LevelDefinition;
  state: GameState;
  private history: GameState[] = [];

  constructor(level: LevelDefinition) {
    this.level = level;
    this.state = createInitialState(level);
  }

  move(direction: Direction): TurnResult {
    const before = cloneState(this.state);
    const result = attemptMove(this.level, this.state, direction);
    if (result.accepted) {
      this.history.push(before);
      this.state = result.state;
    }
    return result;
  }

  switchCharacter(): void {
    this.state = switchCharacter(this.state);
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.state = previous;
    return true;
  }

  restart(): void {
    this.state = createInitialState(this.level);
    this.history = [];
  }
}
