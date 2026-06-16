import Phaser from 'phaser';
import type { GameState, LevelDefinition, Point } from '../game/types';
import { createLightMap } from './visualLighting';
import { preloadSpriteSheets, SPRITE_TEXTURES } from './spriteSheets';

const TILE = 48;
const LOGO_WIDTH = TILE * 5;
const LOGO_HEIGHT = TILE;
const LIGHT_LOGO_ROW = 2;
const DARK_LOGO_ROW = 4;
const TITLE_LOGO_LIGHT = 'title-logo-light';
const TITLE_LOGO_DARK = 'title-logo-dark';

interface TitleSceneData {
  source: string;
  onStart: () => void;
}

interface TitleLayout {
  width: number;
  height: number;
  walls: Point[];
  lights: Point[];
  fixedLights: Point[];
}

export class TitleScene extends Phaser.Scene {
  private board!: Phaser.GameObjects.Container;
  private layout!: TitleLayout;
  private onStart!: () => void;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private started = false;

  constructor() {
    super('title');
  }

  init(data: TitleSceneData): void {
    this.layout = parseTitleLayout(data.source);
    this.onStart = data.onStart;
    this.started = false;
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
    this.keys = this.input.keyboard!.addKeys('SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', () => this.startGame());
    this.scale.on('resize', this.layoutBoard, this);
    this.renderTitle();
    this.layoutBoard();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      this.startGame();
    }
  }

  private renderTitle(): void {
    this.board.removeAll(true);
    const level = titleLevelDefinition(this.layout);
    const state = titleGameState(level);
    this.board.add(createLightMap(this, level, state, TILE));
    this.layout.walls.forEach((point) => this.drawWall(point));
    this.drawLogo(TITLE_LOGO_LIGHT, LIGHT_LOGO_ROW);
    this.drawLogo(TITLE_LOGO_DARK, DARK_LOGO_ROW);
  }

  private drawLogo(textureKey: string, row: number): void {
    const logo = this.add.image((this.layout.width * TILE) / 2, (row + 0.5) * TILE, textureKey)
      .setDisplaySize(LOGO_WIDTH, LOGO_HEIGHT);
    this.board.add(logo);
  }

  private drawWall(point: Point): void {
    const wall = this.add.image((point.x + 0.5) * TILE, (point.y + 0.5) * TILE, SPRITE_TEXTURES.wall);
    this.board.add(wall);
  }

  private layoutBoard(): void {
    const availableWidth = this.scale.width - 32;
    const availableHeight = this.scale.height - 32;
    const boardWidth = this.layout.width * TILE;
    const boardHeight = this.layout.height * TILE;
    const integerScale = Math.max(1, Math.floor(Math.min(availableWidth / boardWidth, availableHeight / boardHeight)));
    const scale = Math.min(integerScale, 2);
    this.board.setScale(scale);
    this.board.setPosition(
      Math.floor((this.scale.width - boardWidth * scale) / 2),
      Math.floor((this.scale.height - boardHeight * scale) / 2),
    );
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    this.onStart();
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

function titleLevelDefinition(layout: TitleLayout): LevelDefinition {
  const dummy = { x: 0, y: 0 };
  return {
    id: 'title',
    name: 'Title',
    lightRadius: 999,
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
