import Phaser from 'phaser';
import type { ActorKind } from '../game/types';

export const SPRITE_TEXTURES = {
  actorLight: 'sprite-actor-light',
  actorDark: 'sprite-actor-dark',
  lightSource: 'sprite-light-source',
  fixedLightSource: 'sprite-fixed-light-source',
  wall: 'sprite-wall',
  crate: 'sprite-crate',
  lightTreasure: 'sprite-light-treasure',
  darkTreasure: 'sprite-dark-treasure',
} as const;

export const SPRITE_ANIMATIONS = {
  actorLightActive: 'actor-light-active',
  actorLightWait: 'actor-light-wait',
  actorDarkActive: 'actor-dark-active',
  actorDarkWait: 'actor-dark-wait',
  lightSourceIdle: 'light-source-idle',
  fixedLightSourceIdle: 'fixed-light-source-idle',
  lightTreasureIdle: 'light-treasure-idle',
  darkTreasureIdle: 'dark-treasure-idle',
} as const;

const SPRITE_PATHS = {
  [SPRITE_TEXTURES.actorLight]: '/assets/sprites/actor-light.png',
  [SPRITE_TEXTURES.actorDark]: '/assets/sprites/actor-dark.png',
  [SPRITE_TEXTURES.lightSource]: '/assets/sprites/light-source.png',
  [SPRITE_TEXTURES.fixedLightSource]: '/assets/sprites/fixed-light-source.png',
  [SPRITE_TEXTURES.wall]: '/assets/sprites/wall.png',
  [SPRITE_TEXTURES.crate]: '/assets/sprites/crate.png',
  [SPRITE_TEXTURES.lightTreasure]: '/assets/sprites/light-treasure.png',
  [SPRITE_TEXTURES.darkTreasure]: '/assets/sprites/dark-treasure.png',
} as const;

const LIGHT_SOURCE_FRAMES = 6;
const TREASURE_FRAMES = 2;

export function preloadSpriteSheets(scene: Phaser.Scene, tileSize: number): void {
  loadSpriteSheet(scene, SPRITE_TEXTURES.actorLight, SPRITE_PATHS[SPRITE_TEXTURES.actorLight], tileSize);
  loadSpriteSheet(scene, SPRITE_TEXTURES.actorDark, SPRITE_PATHS[SPRITE_TEXTURES.actorDark], tileSize);
  loadSpriteSheet(scene, SPRITE_TEXTURES.lightSource, SPRITE_PATHS[SPRITE_TEXTURES.lightSource], tileSize);
  loadSpriteSheet(scene, SPRITE_TEXTURES.fixedLightSource, SPRITE_PATHS[SPRITE_TEXTURES.fixedLightSource], tileSize);
  loadSpriteSheet(scene, SPRITE_TEXTURES.lightTreasure, SPRITE_PATHS[SPRITE_TEXTURES.lightTreasure], tileSize);
  loadSpriteSheet(scene, SPRITE_TEXTURES.darkTreasure, SPRITE_PATHS[SPRITE_TEXTURES.darkTreasure], tileSize);
  loadImage(scene, SPRITE_TEXTURES.wall, SPRITE_PATHS[SPRITE_TEXTURES.wall]);
  loadImage(scene, SPRITE_TEXTURES.crate, SPRITE_PATHS[SPRITE_TEXTURES.crate]);
}

export function ensureSpriteAnimations(scene: Phaser.Scene): void {
  ensureAnimation(scene, SPRITE_ANIMATIONS.actorLightActive, SPRITE_TEXTURES.actorLight, [0, 1], 5);
  ensureAnimation(scene, SPRITE_ANIMATIONS.actorLightWait, SPRITE_TEXTURES.actorLight, [2, 3], 4);
  ensureAnimation(scene, SPRITE_ANIMATIONS.actorDarkActive, SPRITE_TEXTURES.actorDark, [0, 1], 5);
  ensureAnimation(scene, SPRITE_ANIMATIONS.actorDarkWait, SPRITE_TEXTURES.actorDark, [2, 3], 4);
  ensureAnimation(scene, SPRITE_ANIMATIONS.lightSourceIdle, SPRITE_TEXTURES.lightSource, LIGHT_SOURCE_FRAMES, 10);
  ensureAnimation(scene, SPRITE_ANIMATIONS.fixedLightSourceIdle, SPRITE_TEXTURES.fixedLightSource, LIGHT_SOURCE_FRAMES, 10);
  ensureAnimation(scene, SPRITE_ANIMATIONS.lightTreasureIdle, SPRITE_TEXTURES.lightTreasure, TREASURE_FRAMES, 2);
  ensureAnimation(scene, SPRITE_ANIMATIONS.darkTreasureIdle, SPRITE_TEXTURES.darkTreasure, TREASURE_FRAMES, 2);
}

export function actorTextureKey(kind: ActorKind): string {
  return kind === 'light' ? SPRITE_TEXTURES.actorLight : SPRITE_TEXTURES.actorDark;
}

export function actorAnimationKey(kind: ActorKind, active: boolean): string {
  if (kind === 'light') return active ? SPRITE_ANIMATIONS.actorLightActive : SPRITE_ANIMATIONS.actorLightWait;
  return active ? SPRITE_ANIMATIONS.actorDarkActive : SPRITE_ANIMATIONS.actorDarkWait;
}

export function treasureTextureKey(kind: ActorKind): string {
  return kind === 'light' ? SPRITE_TEXTURES.lightTreasure : SPRITE_TEXTURES.darkTreasure;
}

export function treasureAnimationKey(kind: ActorKind): string {
  return kind === 'light' ? SPRITE_ANIMATIONS.lightTreasureIdle : SPRITE_ANIMATIONS.darkTreasureIdle;
}

function loadSpriteSheet(scene: Phaser.Scene, key: string, url: string, tileSize: number): void {
  if (scene.textures.exists(key)) return;
  scene.load.spritesheet(key, url, {
    frameWidth: tileSize,
    frameHeight: tileSize,
  });
}

function loadImage(scene: Phaser.Scene, key: string, url: string): void {
  if (scene.textures.exists(key)) return;
  scene.load.image(key, url);
}

function ensureAnimation(
  scene: Phaser.Scene,
  key: string,
  textureKey: string,
  frames: number[] | number,
  frameRate: number,
): void {
  if (scene.anims.exists(key)) return;
  const frameNumbers = Array.isArray(frames)
    ? scene.anims.generateFrameNumbers(textureKey, { frames })
    : scene.anims.generateFrameNumbers(textureKey, { start: 0, end: frames - 1 });
  scene.anims.create({
    key,
    frames: frameNumbers,
    frameRate,
    repeat: -1,
  });
}
