export type ActorKind = 'light' | 'dark';

export interface Point {
  x: number;
  y: number;
}

export interface Actors {
  light: Point;
  dark: Point;
}

export interface LevelDefinition {
  id: string;
  name: string;
  lightRadius: number;
  displayScale: number;
  width: number;
  height: number;
  walls: Point[];
  actors: Actors;
  crates: Point[];
  lights: Point[];
  fixedLights: Point[];
  goals: Actors;
  nextLevel?: string;
}

export interface GameState {
  levelId: string;
  actors: Actors;
  crates: Point[];
  lights: Point[];
  activeActor: ActorKind;
  turns: number;
  status: 'playing' | 'complete';
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameAction =
  | { type: 'move'; direction: Direction }
  | { type: 'switchCharacter' }
  | { type: 'undo' }
  | { type: 'restart' };

export interface TurnResult {
  accepted: boolean;
  died: boolean;
  deadActor: ActorKind | null;
  failedState: GameState | null;
  movedObject: 'crate' | 'light' | null;
  state: GameState;
}
