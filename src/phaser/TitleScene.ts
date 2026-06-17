import Phaser from 'phaser';
import type { GameState, LevelDefinition, Point } from '../game/types';
import { createLightMap, updateLightMap } from './visualLighting';
import { ensureSpriteAnimations, preloadSpriteSheets, SPRITE_ANIMATIONS, SPRITE_TEXTURES } from './spriteSheets';
import { playGridTransition } from './sceneTransition';

const TILE = 48;
const TITLE_SCALE = 3;
const TITLE_LAYOUT_WIDTH = 17;
const TITLE_LAYOUT_HEIGHT = 11;
const FLAME_FRAME_MS = 90;
const LOGO_WIDTH = TILE * 5;
const LOGO_HEIGHT = TILE;
const BUTTON_BOTTOM_MARGIN = 118;
const LIGHT_LOGO_ROW = 2;
const DARK_LOGO_ROW = 4;
const TITLE_LOGO_LIGHT = 'title-logo-light';
const TITLE_LOGO_DARK = 'title-logo-dark';
const BUTTON_WIDTH = 34;
const BUTTON_HEIGHT = 22;
const BUTTON_HOVER_SCALE = 1.14;
const BUTTON_COLORS = {
  complete: { fill: 0xffffff, stroke: 0xffffff, text: '#000000' },
  available: { fill: 0x777777, stroke: 0xffffff, text: '#000000' },
  locked: { fill: 0x222222, stroke: 0x777777, text: '#777777' },
} as const;

interface TitleSceneData {
  source: string;
  levels: TitleLevelButton[];
  completedLevels: string[];
  currentLevel: string;
  onStartLevel: (index: number) => void;
  onResetProgress: () => void;
}

interface TitleLevelButton {
  id: string;
  name?: string;
}

interface TitleLayout {
  width: number;
  height: number;
  walls: Point[];
  lights: Point[];
  fixedLights: Point[];
}

interface TitleRenderLayout extends TitleLayout {
  sourceOrigin: Point;
  sourceWidth: number;
}

interface TitleButtonState {
  index: number;
  x: number;
  y: number;
  unlocked: boolean;
  button: Phaser.GameObjects.Container;
}

export class TitleScene extends Phaser.Scene {
  private board!: Phaser.GameObjects.Container;
  private layout!: TitleLayout;
  private renderLayout!: TitleRenderLayout;
  private titleLevel!: LevelDefinition;
  private titleState!: GameState;
  private lightMap?: Phaser.GameObjects.Image;
  private lightAnimationStep = 0;
  private nextLightAnimationAt = 0;
  private levels: TitleLevelButton[] = [];
  private completedLevels = new Set<string>();
  private currentLevel = '';
  private onStartLevel!: (index: number) => void;
  private onResetProgress!: () => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private started = false;
  private transitionLocked = false;
  private titleButtons: TitleButtonState[] = [];
  private hoveredButtonIndex: number | null = null;

  constructor() {
    super('title');
  }

  init(data: TitleSceneData): void {
    this.layout = parseTitleLayout(data.source);
    this.levels = data.levels;
    this.completedLevels = new Set(data.completedLevels);
    this.currentLevel = data.currentLevel;
    this.onStartLevel = data.onStartLevel;
    this.onResetProgress = data.onResetProgress;
    this.started = false;
    this.transitionLocked = false;
  }

  preload(): void {
    preloadSpriteSheets(this, TILE);
    this.load.image(TITLE_LOGO_LIGHT, '/assets/title/logo-light.png');
    this.load.image(TITLE_LOGO_DARK, '/assets/title/logo-dark.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.board = this.add.container(0, 0);
    this.board.setPostPipeline('OneBitPipeline');
    ensureSpriteAnimations(this);
    this.keys = this.input.keyboard!.addKeys('SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.ZERO = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updateButtonHover(pointer.x, pointer.y);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const hit = this.buttonAt(pointer.x, pointer.y);
      if (hit?.unlocked) this.startLevel(hit.index);
    });
    this.input.on('gameout', () => {
      this.setHoveredButton(null);
    });
    this.scale.on('resize', this.renderTitle, this);
    this.renderTitle();
    this.transitionLocked = true;
    void playGridTransition(this).then(() => {
      this.transitionLocked = false;
    });
  }

  update(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ZERO)) {
      this.onResetProgress();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      this.startCurrentLevel();
      return;
    }
    if (time >= this.nextLightAnimationAt && this.lightMap?.active) {
      this.nextLightAnimationAt = time + FLAME_FRAME_MS;
      this.lightAnimationStep += 1;
      updateLightMap(this, this.lightMap, this.titleLevel, this.titleState, TILE, this.lightAnimationStep);
    }
  }

  private renderTitle(): void {
    this.board.removeAll(true);
    this.titleButtons = [];
    this.hoveredButtonIndex = null;
    this.renderLayout = createFullscreenLayout(this.layout, this.scale.width, this.scale.height);
    this.titleLevel = titleLevelDefinition(this.renderLayout);
    this.titleState = titleGameState(this.titleLevel);
    this.lightMap = createLightMap(this, this.titleLevel, this.titleState, TILE, this.lightAnimationStep);
    this.board.add(this.lightMap);
    this.renderLayout.walls.forEach((point) => this.drawWall(point));
    this.renderLayout.fixedLights.forEach((point) => this.drawLight(point, true));
    this.renderLayout.lights.forEach((point) => this.drawLight(point, false));
    this.drawLogo(TITLE_LOGO_LIGHT, LIGHT_LOGO_ROW);
    this.drawLogo(TITLE_LOGO_DARK, DARK_LOGO_ROW);
    this.board.setScale(TITLE_SCALE);
    const boardWidth = this.renderLayout.width * TILE * TITLE_SCALE;
    const boardHeight = this.renderLayout.height * TILE * TITLE_SCALE;
    this.board.setPosition(
      alignToScale((this.scale.width - boardWidth) / 2, TITLE_SCALE),
      alignToScale((this.scale.height - boardHeight) / 2, TITLE_SCALE),
    );
    this.drawStageButtons();
  }

  private drawLogo(textureKey: string, row: number): void {
    const logoX = (this.renderLayout.sourceOrigin.x + this.renderLayout.sourceWidth / 2) * TILE;
    const logoY = (this.renderLayout.sourceOrigin.y + row + 0.5) * TILE;
    const logo = this.add.image(logoX, logoY, textureKey)
      .setDisplaySize(LOGO_WIDTH, LOGO_HEIGHT);
    this.board.add(logo);
  }

  private drawWall(point: Point): void {
    const wall = this.add.image((point.x + 0.5) * TILE, (point.y + 0.5) * TILE, SPRITE_TEXTURES.wall);
    this.board.add(wall);
  }

  private drawLight(point: Point, fixed: boolean): void {
    const textureKey = fixed ? SPRITE_TEXTURES.fixedLightSource : SPRITE_TEXTURES.lightSource;
    const animationKey = fixed ? SPRITE_ANIMATIONS.fixedLightSourceIdle : SPRITE_ANIMATIONS.lightSourceIdle;
    const light = this.add.sprite((point.x + 0.5) * TILE, (point.y + 0.5) * TILE, textureKey, 0);
    light.play(animationKey);
    this.board.add(light);
  }

  private drawStageButtons(): void {
    const centerX = (this.renderLayout.sourceOrigin.x + this.renderLayout.sourceWidth / 2) * TILE;
    const y = (this.scale.height - BUTTON_BOTTOM_MARGIN - this.board.y) / TITLE_SCALE;
    const gap = TILE * 0.92;
    const startX = centerX - ((this.levels.length - 1) * gap) / 2;
    this.levels.forEach((level, index) => {
      const unlocked = this.isLevelUnlocked(index);
      const completed = this.completedLevels.has(level.id);
      const colors = completed ? BUTTON_COLORS.complete : unlocked ? BUTTON_COLORS.available : BUTTON_COLORS.locked;
      const x = startX + index * gap;
      const button = this.add.container(x, y);
      const box = this.add.rectangle(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, colors.fill)
        .setStrokeStyle(1, colors.stroke);
      const label = this.add.text(0, 0, String(index + 1).padStart(2, '0'), {
        fontFamily: 'Arial Narrow, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '900',
        color: colors.text,
      }).setOrigin(0.5);
      button.add([box, label]);
      this.titleButtons.push({ index, x, y, unlocked, button });
      this.board.add(button);
    });
  }

  private updateButtonHover(screenX: number, screenY: number): void {
    const hit = this.buttonAt(screenX, screenY);
    this.setHoveredButton(hit?.unlocked ? hit.index : null);
  }

  private setHoveredButton(index: number | null): void {
    if (this.hoveredButtonIndex === index) return;
    const previous = this.titleButtons.find((button) => button.index === this.hoveredButtonIndex);
    const next = this.titleButtons.find((button) => button.index === index);
    if (previous) this.tweenButtonScale(previous.button, 1);
    if (next) this.tweenButtonScale(next.button, BUTTON_HOVER_SCALE);
    this.hoveredButtonIndex = index;
    this.input.setDefaultCursor(index === null ? 'default' : 'pointer');
  }

  private tweenButtonScale(button: Phaser.GameObjects.Container, scale: number): void {
    this.tweens.killTweensOf(button);
    this.tweens.add({
      targets: button,
      scaleX: scale,
      scaleY: scale,
      duration: 70,
      ease: 'Sine.easeOut',
    });
  }

  private buttonAt(screenX: number, screenY: number): TitleButtonState | null {
    const scale = this.board.scaleX || 1;
    const localX = (screenX - this.board.x) / scale;
    const localY = (screenY - this.board.y) / scale;
    return this.titleButtons.find((button) => (
      Math.abs(localX - button.x) <= BUTTON_WIDTH / 2
      && Math.abs(localY - button.y) <= BUTTON_HEIGHT / 2
    )) ?? null;
  }

  private isLevelUnlocked(index: number): boolean {
    if (index === 0) return true;
    const current = this.levels[index];
    const previous = this.levels[index - 1];
    return this.completedLevels.has(current.id) || this.completedLevels.has(previous.id);
  }

  private startCurrentLevel(): void {
    const savedIndex = Math.max(0, this.levels.findIndex((level) => level.id === this.currentLevel));
    const index = this.isLevelUnlocked(savedIndex) ? savedIndex : this.levels.findIndex((_level, levelIndex) => this.isLevelUnlocked(levelIndex));
    if (index >= 0) this.startLevel(index);
  }

  private startLevel(index: number): void {
    if (this.started || this.transitionLocked) return;
    this.started = true;
    this.input.setDefaultCursor('default');
    this.onStartLevel(index);
  }
}

function parseTitleLayout(source: string): TitleLayout {
  const rows = source
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
    .filter((line) => [...line].every((token) => ['.', '#', 'S', 'F'].includes(token)))
    .map((line) => [...line]);

  if (rows.length < DARK_LOGO_ROW + 1) throw new Error('title.txt must contain at least five map rows.');
  const width = rows[0].length;
  if (rows.some((row) => row.length !== width)) throw new Error('title.txt rows must have equal width.');
  if (width < 5) throw new Error('title.txt must be at least five columns wide.');

  const walls: Point[] = [];
  const lights: Point[] = [];
  const fixedLights: Point[] = [];
  rows.forEach((row, y) => row.forEach((token, x) => {
    const point = { x, y };
    if (token === '#') walls.push(point);
    if (token === 'S') lights.push(point);
    if (token === 'F') fixedLights.push(point);
  }));

  return { width, height: rows.length, walls, lights, fixedLights };
}

function createFullscreenLayout(source: TitleLayout, pixelWidth: number, pixelHeight: number): TitleRenderLayout {
  const width = Math.max(source.width, TITLE_LAYOUT_WIDTH, Math.ceil(pixelWidth / TITLE_SCALE / TILE) + 1);
  const height = Math.max(source.height, TITLE_LAYOUT_HEIGHT, Math.ceil(pixelHeight / TITLE_SCALE / TILE) + 1);
  const sourceOrigin = {
    x: Math.floor((width - source.width) / 2),
    y: Math.floor((height - source.height) / 2),
  };
  return {
    width,
    height,
    sourceOrigin,
    sourceWidth: source.width,
    walls: offsetPoints(source.walls, sourceOrigin),
    lights: offsetPoints(source.lights, sourceOrigin),
    fixedLights: offsetPoints(source.fixedLights, sourceOrigin),
  };
}

function offsetPoints(points: Point[], offset: Point): Point[] {
  return points.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
}

function alignToScale(value: number, scale: number): number {
  return Math.round(value / scale) * scale;
}

function titleLevelDefinition(layout: TitleRenderLayout): LevelDefinition {
  const dummy = { x: 0, y: 0 };
  return {
    id: 'title',
    name: 'Title',
    lightRadius: 999,
    displayScale: TITLE_SCALE,
    width: layout.width,
    height: layout.height,
    walls: layout.walls,
    crates: [],
    lights: layout.lights,
    fixedLights: layout.fixedLights,
    actors: { light: dummy, dark: dummy },
    goals: { light: dummy, dark: dummy },
  };
}

function titleGameState(level: LevelDefinition): GameState {
  return {
    levelId: level.id,
    actors: level.actors,
    crates: [],
    lights: level.lights,
    activeActor: 'light',
    turns: 0,
    status: 'playing',
  };
}
