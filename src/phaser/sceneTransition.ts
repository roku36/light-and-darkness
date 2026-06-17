import Phaser from 'phaser';

const TRANSITION_MASK_TEXTURE = 'scene-transition-mask';
const TRANSITION_SOURCE_MASK_TEXTURE = 'transition-source-mask';
const TRANSITION_SOURCE_MASK_PATH = '/assets/fx/transition-mask.png';
const TILE_SIZE = 32;
const TRANSITION_DEPTH = 100000;
const TRANSITION_DURATION_MS = 980;
const ROTATION_RADIANS = Math.PI * 0.72;

interface ProgressLookup {
  columns: number;
  rows: number;
  values: Float32Array;
}

export function preloadTransitionTexture(scene: Phaser.Scene): void {
  scene.load.image(TRANSITION_SOURCE_MASK_TEXTURE, TRANSITION_SOURCE_MASK_PATH);
}

export function playGridTransition(scene: Phaser.Scene): Promise<void> {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const texture = createTransitionTexture(scene, width, height);
  const progressLookup = createProgressLookup(scene, width, height);
  const overlay = scene.add.image(0, 0, TRANSITION_MASK_TEXTURE).setOrigin(0);
  overlay.setDepth(TRANSITION_DEPTH);
  renderTransitionMask(texture, width, height, progressLookup, 0);

  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TRANSITION_DURATION_MS,
      ease: 'Linear',
      onUpdate: (tween) => {
        renderTransitionMask(texture, width, height, progressLookup, tween.getValue() ?? 0);
      },
      onComplete: () => {
        overlay.destroy();
        resolve();
      },
    });
  });
}

function createTransitionTexture(scene: Phaser.Scene, width: number, height: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(TRANSITION_MASK_TEXTURE)) scene.textures.remove(TRANSITION_MASK_TEXTURE);
  const texture = scene.textures.createCanvas(TRANSITION_MASK_TEXTURE, width, height);
  if (!texture) throw new Error('Could not create transition mask texture.');
  return texture;
}

function renderTransitionMask(
  texture: Phaser.Textures.CanvasTexture,
  width: number,
  height: number,
  progressLookup: ProgressLookup,
  progress: number,
): void {
  const context = texture.getContext();
  const image = context.createImageData(width, height);

  for (let row = 0; row < progressLookup.rows; row += 1) {
    for (let column = 0; column < progressLookup.columns; column += 1) {
      const revealAt = progressLookup.values[row * progressLookup.columns + column];
      const localProgress = clamp01((progress - revealAt * 0.42) / 0.58);
      const eased = easeInOutCubic(localProgress);
      const scale = 1 - eased;
      if (scale <= 0) continue;

      const x = column * TILE_SIZE + TILE_SIZE / 2;
      const y = row * TILE_SIZE + TILE_SIZE / 2;
      const angle = ROTATION_RADIANS * eased * (((row + column) % 2 === 0) ? 1 : -1);
      drawHardMaskSquare(image.data, width, height, x, y, TILE_SIZE * scale / 2, angle);
    }
  }

  context.putImageData(image, 0, 0);
  texture.refresh();
}

function createProgressLookup(scene: Phaser.Scene, width: number, height: number): ProgressLookup {
  const columns = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const texture = scene.textures.get(TRANSITION_SOURCE_MASK_TEXTURE);
  const source = texture.getSourceImage() as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read transition progress texture.');
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const values = new Float32Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u = columns <= 1 ? 0.5 : column / (columns - 1);
      const v = rows <= 1 ? 0.5 : row / (rows - 1);
      const x = Math.min(canvas.width - 1, Math.max(0, Math.round(u * (canvas.width - 1))));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.round(v * (canvas.height - 1))));
      values[row * columns + column] = pixels[(y * canvas.width + x) * 4] / 255;
    }
  }

  return { columns, rows, values };
}

function drawHardMaskSquare(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  halfSize: number,
  angle: number,
): void {
  const radius = Math.ceil(halfSize * Math.SQRT2) + 1;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;
      if (Math.abs(localX) > halfSize || Math.abs(localY) > halfSize) continue;
      const offset = (y * width + x) * 4;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 255;
    }
  }
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
