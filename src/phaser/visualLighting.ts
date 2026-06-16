import Phaser from 'phaser';
import { allLightSources } from '../game/lighting';
import type { GameState, LevelDefinition, Point } from '../game/types';
import { FLAME_HORIZONTAL_OFFSETS } from './flameAnimation';
import { shadowPolygon, type PixelPoint, type PixelRect } from './shadowGeometry';

const FLOOR_TEXTURE_KEY = 'board-floor-luminance';
export const GROUND_BASE_LUMINANCE = 0.18;
export const GROUND_PATTERN_LUMINANCE = 0.22;
const GROUND_BASE_VERTICAL_SCALE = 0.5;
const DIRECT_LIGHT_BASE_LUMINANCE = 0.52;
const DIRECT_LIGHT_RELIEF_LUMINANCE = 0.58;
const DIRECT_LIGHT_HORIZONTAL_SCALE = 0.62;
const DIRECT_LIGHT_FALLOFF = 1.04;
const DIRECT_LIGHT_FALLOFF_DISTANCE_TILES = 18;

export interface NormalField {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
}

const normalCache = new Map<string, NormalField>();

export function createLightMap(
  scene: Phaser.Scene,
  level: LevelDefinition,
  state: GameState,
  tileSize: number,
  animationStep = 0,
): Phaser.GameObjects.Image {
  renderLightTexture(scene, level, state, tileSize, animationStep);
  return scene.add.image(0, 0, FLOOR_TEXTURE_KEY).setOrigin(0);
}

export function updateLightMap(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  level: LevelDefinition,
  state: GameState,
  tileSize: number,
  animationStep: number,
): void {
  renderLightTexture(scene, level, state, tileSize, animationStep);
  if (image.texture.key !== FLOOR_TEXTURE_KEY) image.setTexture(FLOOR_TEXTURE_KEY);
}

function renderLightTexture(
  scene: Phaser.Scene,
  level: LevelDefinition,
  state: GameState,
  tileSize: number,
  animationStep: number,
): void {
  const width = level.width * tileSize;
  const height = level.height * tileSize;
  const texture = scene.textures.exists(FLOOR_TEXTURE_KEY)
    ? scene.textures.get(FLOOR_TEXTURE_KEY) as Phaser.Textures.CanvasTexture
    : scene.textures.createCanvas(FLOOR_TEXTURE_KEY, width, height);
  if (!texture) throw new Error('Could not create the visual light map.');
  if (texture.width !== width || texture.height !== height) texture.setSize(width, height);

  const context = texture.getContext();
  const pixels = context.createImageData(width, height);
  const floorLuminance = new Float32Array(width * height);
  const normals = getNormalField(width, height);
  const blockers = visualLightBlockers(level, state);
  const falloffDistance = DIRECT_LIGHT_FALLOFF_DISTANCE_TILES * tileSize;
  const horizontalOffset = FLAME_HORIZONTAL_OFFSETS[animationStep % FLAME_HORIZONTAL_OFFSETS.length] * tileSize;

  for (let index = 0; index < floorLuminance.length; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    floorLuminance[index] = groundBaseLuminance(x, y);
  }

  for (const sourceCell of allLightSources(level, state)) {
    const center = cellCenter(sourceCell, tileSize);
    const directLightPosition = { x: center.x + horizontalOffset, y: center.y };
    const visibility = createVisibilityMask(width, height, center, blockers, sourceCell, tileSize);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (visibility[index] < 128) continue;
        const directLight = directLightLuminance(normals, index, directLightPosition, { x: x + 0.5, y: y + 0.5 }, falloffDistance);
        floorLuminance[index] = Math.max(floorLuminance[index], directLight);
      }
    }
  }

  for (let index = 0; index < floorLuminance.length; index += 1) {
    const value = Math.max(0, Math.min(255, Math.round(floorLuminance[index] * 255)));
    const offset = index * 4;
    pixels.data[offset] = value;
    pixels.data[offset + 1] = value;
    pixels.data[offset + 2] = value;
    pixels.data[offset + 3] = 255;
  }

  context.clearRect(0, 0, width, height);
  context.putImageData(pixels, 0, 0);
  texture.refresh();
}

export function visualLightBlockers(level: LevelDefinition, state: GameState): Point[] {
  return [...level.walls, ...state.crates];
}

export function groundBaseLuminance(x: number, y: number): number {
  return GROUND_BASE_LUMINANCE + terrainBaseHeight(x, y) * GROUND_PATTERN_LUMINANCE;
}

function directLightLuminance(
  normals: NormalField,
  index: number,
  source: PixelPoint,
  pixel: PixelPoint,
  falloffDistance: number,
): number {
  const dx = source.x - pixel.x;
  const dy = source.y - pixel.y;
  const horizontalLength = Math.hypot(dx, dy);
  const lightX = horizontalLength > 0 ? (dx / horizontalLength) * DIRECT_LIGHT_HORIZONTAL_SCALE : 0;
  const lightY = horizontalLength > 0 ? (dy / horizontalLength) * DIRECT_LIGHT_HORIZONTAL_SCALE : 0;
  const lightZ = Math.sqrt(1 - DIRECT_LIGHT_HORIZONTAL_SCALE * DIRECT_LIGHT_HORIZONTAL_SCALE);
  const diffuse = Math.max(0, normals.x[index] * lightX + normals.y[index] * lightY + normals.z[index] * lightZ);
  const distanceRatio = Math.min(1, horizontalLength / falloffDistance);
  const subtleFalloff = Math.max(0, 1 - distanceRatio * DIRECT_LIGHT_FALLOFF);
  return (DIRECT_LIGHT_BASE_LUMINANCE + diffuse * DIRECT_LIGHT_RELIEF_LUMINANCE) * subtleFalloff;
}

function createVisibilityMask(
  width: number,
  height: number,
  source: PixelPoint,
  blockers: Point[],
  sourceCell: Point,
  tileSize: number,
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return new Uint8ClampedArray(width * height);

  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';

  for (const blocker of blockers) {
    if (blocker.x === sourceCell.x && blocker.y === sourceCell.y) continue;
    drawOcclusionShadow(context, source, cellRect(blocker, tileSize), Math.hypot(width, height) * 2);
  }

  const rgba = context.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = rgba[index * 4 + 3];
  return alpha;
}

function getNormalField(width: number, height: number): NormalField {
  const key = `${width}x${height}`;
  const cached = normalCache.get(key);
  if (cached) return cached;

  const heights = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) heights[y * width + x] = terrainHeight(x, y);
  }

  const field: NormalField = {
    x: new Float32Array(width * height),
    y: new Float32Array(width * height),
    z: new Float32Array(width * height),
  };
  const strength = 4.8;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = heights[y * width + Math.max(0, x - 1)];
      const right = heights[y * width + Math.min(width - 1, x + 1)];
      const up = heights[Math.max(0, y - 1) * width + x];
      const down = heights[Math.min(height - 1, y + 1) * width + x];
      const nx = (left - right) * strength;
      const ny = (up - down) * strength;
      const length = Math.hypot(nx, ny, 1);
      const index = y * width + x;
      field.x[index] = nx / length;
      field.y[index] = ny / length;
      field.z[index] = 1 / length;
    }
  }
  normalCache.set(key, field);
  return field;
}

function terrainHeight(x: number, y: number): number {
  return valueNoise(x * 0.075, y * 0.075) * 0.62
    + valueNoise(x * 0.19 + 31, y * 0.19 + 17) * 0.28
    + valueNoise(x * 0.47 + 83, y * 0.47 + 59) * 0.10;
}

function terrainBaseHeight(x: number, y: number): number {
  return terrainHeight(x, y * GROUND_BASE_VERTICAL_SCALE);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = random2d(x0, y0);
  const b = random2d(x0 + 1, y0);
  const c = random2d(x0, y0 + 1);
  const d = random2d(x0 + 1, y0 + 1);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function random2d(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function drawOcclusionShadow(context: CanvasRenderingContext2D, source: PixelPoint, rect: PixelRect, distance: number): void {
  const polygon = shadowPolygon(source, rect, distance);
  if (!polygon) return;
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  for (const point of polygon.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fill();
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function cellCenter(point: Point, tileSize: number): PixelPoint {
  return { x: (point.x + 0.5) * tileSize, y: (point.y + 0.5) * tileSize };
}

function cellRect(point: Point, tileSize: number): PixelRect {
  return { x: point.x * tileSize, y: point.y * tileSize, width: tileSize, height: tileSize };
}
