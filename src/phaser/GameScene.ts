import Phaser from 'phaser';
import { cloneState, GameSession } from '../game/engine';
import type { ActorKind, Direction, GameState, LevelDefinition, Point } from '../game/types';
import { FLAME_HORIZONTAL_OFFSETS } from './flameAnimation';
import { actorAnimationKey, actorTextureKey, ensureSpriteAnimations, preloadSpriteSheets, SPRITE_ANIMATIONS, SPRITE_TEXTURES } from './spriteSheets';
import { createLightMap, updateLightMap } from './visualLighting';

const TILE = 48;
const MOVE_MS = 160;
const FLAME_FRAME_MS = 90;

type FacingDirection = 'left' | 'right';

interface SceneData {
  level: LevelDefinition;
  onState: (state: GameSession['state']) => void;
  onComplete: () => void;
  onUndoPrompt: (visible: boolean) => void;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private level!: LevelDefinition;
  private onState!: SceneData['onState'];
  private onComplete!: SceneData['onComplete'];
  private onUndoPrompt!: SceneData['onUndoPrompt'];
  private board!: Phaser.GameObjects.Container;
  private lightMap?: Phaser.GameObjects.Image;
  private lightAnimationStep = 0;
  private nextLightAnimationAt = 0;
  private inputLocked = false;
  private failedMove: { actor: ActorKind; state: GameSession['state'] } | null = null;
  private undoPromptTimer?: Phaser.Time.TimerEvent;
  private lastMoveAt = 0;
  private oneBitFilterEnabled = true;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private actorFacing: Record<ActorKind, FacingDirection> = { light: 'left', dark: 'left' };

  constructor() {
    super('game');
  }

  init(data: SceneData): void {
    this.level = data.level;
    this.session = new GameSession(data.level);
    this.actorFacing = { light: 'left', dark: 'left' };
    this.onState = data.onState;
    this.onComplete = data.onComplete;
    this.onUndoPrompt = data.onUndoPrompt;
  }

  preload(): void {
    preloadSpriteSheets(this, TILE);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.board = this.add.container(0, 0);
    this.applyOneBitFilter();
    ensureSpriteAnimations(this);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,Z,R,T') as Record<string, Phaser.Input.Keyboard.Key>;
    this.scale.on('resize', this.layoutBoard, this);
    this.renderBoard();
    this.layoutBoard();
    this.onState(this.session.state);
  }

  update(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) {
      this.toggleOneBitFilter();
      return;
    }
    if (!this.inputLocked && time >= this.nextLightAnimationAt && this.lightMap?.active) {
      this.nextLightAnimationAt = time + FLAME_FRAME_MS;
      this.lightAnimationStep = (this.lightAnimationStep + 1) % FLAME_HORIZONTAL_OFFSETS.length;
      const visualState = this.failedMove?.state ?? this.session.state;
      updateLightMap(this, this.lightMap, this.level, visualState, TILE, this.lightAnimationStep);
    }
    if (this.inputLocked) return;
    if (this.failedMove) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.undoFailedMove();
      else if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
        const from = this.failedMove.state;
        this.clearFailure();
        this.session.restart();
        this.actorFacing = { light: 'left', dark: 'left' };
        this.animateStateTransition(from, this.session.state);
      }
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.session.switchCharacter();
      this.renderBoard();
      this.onState(this.session.state);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) {
      const from = cloneState(this.session.state);
      if (this.session.undo()) this.animateStateTransition(from, this.session.state, undefined, true);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      const from = cloneState(this.session.state);
      this.session.restart();
      this.actorFacing = { light: 'left', dark: 'left' };
      this.animateStateTransition(from, this.session.state, undefined, true);
      return;
    }
    if (time - this.lastMoveAt < 135) return;
    const direction = this.readDirection();
    if (direction) {
      this.lastMoveAt = time;
      this.performMove(direction);
    }
  }

  private readDirection(): Direction | null {
    if (this.cursors.up.isDown || this.keys.W.isDown) return 'up';
    if (this.cursors.down.isDown || this.keys.S.isDown) return 'down';
    if (this.cursors.left.isDown || this.keys.A.isDown) return 'left';
    if (this.cursors.right.isDown || this.keys.D.isDown) return 'right';
    return null;
  }

  private toggleOneBitFilter(): void {
    this.oneBitFilterEnabled = !this.oneBitFilterEnabled;
    this.applyOneBitFilter();
  }

  private applyOneBitFilter(): void {
    this.board.resetPostPipeline(true);
    if (this.oneBitFilterEnabled) this.board.setPostPipeline('OneBitPipeline');
  }

  private performMove(direction: Direction): void {
    const before = cloneState(this.session.state);
    const facingChanged = this.updateActorFacing(direction);
    const result = this.session.move(direction);
    if (result.died && result.deadActor && result.failedState) {
      this.inputLocked = true;
      this.failedMove = { actor: result.deadActor, state: result.failedState };
      this.animateStateTransition(before, result.failedState, undefined, false, () => {
        this.renderBoard(result.failedState!, result.deadActor!);
        this.burstActor(result.failedState!.actors[result.deadActor!], result.deadActor!);
        this.cameras.main.shake(90, 0.0035);
        this.undoPromptTimer = this.time.delayedCall(1000, () => this.onUndoPrompt(true));
        this.time.delayedCall(260, () => {
          this.inputLocked = false;
        });
      });
      return;
    }
    if (!result.accepted) {
      if (facingChanged) this.renderBoard();
      this.cameras.main.shake(55, 0.0015);
      return;
    }
    this.animateStateTransition(before, result.state, undefined, false, () => {
      this.inputLocked = false;
      this.onState(this.session.state);
      if (this.session.state.status === 'complete') this.onComplete();
    });
  }

  private animateStateTransition(
    from: GameState,
    to: GameState,
    hiddenActor?: ActorKind,
    pulse = false,
    onComplete?: () => void,
  ): void {
    this.inputLocked = true;
    const progress = { value: 0 };
    this.tweens.add({
      targets: progress,
      value: 1,
      duration: MOVE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.renderBoard(interpolateState(from, to, progress.value), hiddenActor);
        if (pulse) this.board.alpha = 0.94 + progress.value * 0.06;
      },
      onComplete: () => {
        this.board.alpha = 1;
        this.renderBoard(to, hiddenActor);
        this.onState(this.session.state);
        if (onComplete) onComplete();
        else this.inputLocked = false;
      },
    });
  }

  private updateActorFacing(direction: Direction): boolean {
    if (direction !== 'left' && direction !== 'right') return false;
    const actor = this.session.state.activeActor;
    if (this.actorFacing[actor] === direction) return false;
    this.actorFacing[actor] = direction;
    return true;
  }

  private undoFailedMove(): void {
    const from = this.failedMove?.state;
    this.clearFailure();
    if (from) this.animateStateTransition(from, this.session.state, undefined, true);
  }

  private clearFailure(): void {
    this.undoPromptTimer?.remove(false);
    this.undoPromptTimer = undefined;
    this.failedMove = null;
    this.onUndoPrompt(false);
  }

  private renderBoard(state = this.session.state, hiddenActor?: ActorKind): void {
    this.board.removeAll(true);
    this.lightMap = undefined;
    this.lightMap = createLightMap(this, this.level, state, TILE, this.lightAnimationStep);
    this.board.add(this.lightMap);
    this.level.goals.light && this.drawGoal(this.level.goals.light, 'light');
    this.level.goals.dark && this.drawGoal(this.level.goals.dark, 'dark');
    this.level.walls.forEach((point) => this.drawWall(point));
    state.crates.forEach((point) => this.drawCrate(point));
    this.level.fixedLights.forEach((point) => this.drawLight(point, true));
    state.lights.forEach((point) => this.drawLight(point, false));
    if (hiddenActor !== 'light') this.drawActor(state.actors.light, 'light');
    if (hiddenActor !== 'dark') this.drawActor(state.actors.dark, 'dark');
  }

  private burstActor(point: Point, kind: ActorKind): void {
    const centerX = (point.x + 0.5) * TILE;
    const centerY = (point.y + 0.5) * TILE;
    const color = kind === 'light' ? 0xffffff : 0xffffff;
    for (let index = 0; index < 22; index += 1) {
      const size = 2 + (index % 3) * 2;
      const particle = this.add.rectangle(centerX, centerY, size, size, color);
      this.board.add(particle);
      const angle = (index / 22) * Math.PI * 2 + (index % 4) * 0.11;
      const distance = 18 + (index % 7) * 5;
      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        angle: 90 + index * 23,
        alpha: 0,
        scale: { from: 1.4, to: 0.25 },
        duration: 210 + (index % 5) * 28,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private cellGraphics(point: Point): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics({ x: point.x * TILE, y: point.y * TILE });
    this.board.add(graphics);
    return graphics;
  }

  private drawWall(point: Point): void {
    this.drawStaticSprite(point, SPRITE_TEXTURES.wall);
  }

  private drawCrate(point: Point): void {
    this.drawStaticSprite(point, SPRITE_TEXTURES.crate);
  }

  private drawLight(point: Point, fixed: boolean): void {
    const textureKey = fixed ? SPRITE_TEXTURES.fixedLightSource : SPRITE_TEXTURES.lightSource;
    const animationKey = fixed ? SPRITE_ANIMATIONS.fixedLightSourceIdle : SPRITE_ANIMATIONS.lightSourceIdle;
    const sprite = this.add.sprite((point.x + 0.5) * TILE, (point.y + 0.5) * TILE, textureKey, 0);
    sprite.play(animationKey);
    this.board.add(sprite);
  }

  private drawStaticSprite(point: Point, textureKey: string): void {
    const sprite = this.add.image((point.x + 0.5) * TILE, (point.y + 0.5) * TILE, textureKey);
    this.board.add(sprite);
  }

  private drawGoal(point: Point, kind: ActorKind): void {
    const g = this.cellGraphics(point);
    g.lineStyle(2, kind === 'light' ? 0x000000 : 0xffffff).strokeCircle(TILE / 2, TILE / 2, 17);
    g.lineStyle(2, kind === 'light' ? 0x000000 : 0xffffff).strokeRect(16, 16, 16, 16);
    if (kind === 'dark') {
      for (let y = 18; y <= 30; y += 4) g.fillStyle(0xffffff).fillRect(18, y, 12, 1);
    }
  }

  private drawActor(point: Point, kind: ActorKind): void {
    const active = this.session.state.activeActor === kind;
    const sprite = this.add.sprite((point.x + 0.5) * TILE, (point.y + 0.5) * TILE, actorTextureKey(kind), 0);
    sprite.setFlipX(this.actorFacing[kind] === 'right');
    sprite.play(actorAnimationKey(kind, active));
    this.board.add(sprite);
  }

  private layoutBoard(): void {
    const availableWidth = this.scale.width - 32;
    const availableHeight = this.scale.height - 32;
    const boardWidth = this.level.width * TILE;
    const boardHeight = this.level.height * TILE;
    const integerScale = Math.max(1, Math.floor(Math.min(availableWidth / boardWidth, availableHeight / boardHeight)));
    const scale = Math.min(integerScale, 2);
    this.board.setScale(scale);
    this.board.setPosition(
      Math.floor((this.scale.width - boardWidth * scale) / 2),
      Math.floor((this.scale.height - boardHeight * scale) / 2),
    );
  }
}

function interpolateState(from: GameState, to: GameState, amount: number): GameState {
  return {
    ...to,
    actors: {
      light: interpolatePoint(from.actors.light, to.actors.light, amount),
      dark: interpolatePoint(from.actors.dark, to.actors.dark, amount),
    },
    crates: interpolatePoints(from.crates, to.crates, amount),
    lights: interpolatePoints(from.lights, to.lights, amount),
  };
}

function interpolatePoints(from: Point[], to: Point[], amount: number): Point[] {
  return to.map((point, index) => interpolatePoint(from[index] ?? point, point, amount));
}

function interpolatePoint(from: Point, to: Point, amount: number): Point {
  return {
    x: Phaser.Math.Linear(from.x, to.x, amount),
    y: Phaser.Math.Linear(from.y, to.y, amount),
  };
}
