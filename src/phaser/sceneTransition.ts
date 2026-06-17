import Phaser from 'phaser';

const TRANSITION_MASK_TEXTURE = 'scene-transition-mask';
const TILE_SIZE = 32;
const TRANSITION_DEPTH = 100000;
const TRANSITION_DURATION_MS = 980;
const TRANSITION_STAGGER = 0.42;
const ROTATION_RADIANS = Math.PI * 0.72;

export function playGridTransition(scene: Phaser.Scene): Promise<void> {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const texture = createTransitionTexture(scene, width, height);
  const overlay = scene.add.image(0, 0, TRANSITION_MASK_TEXTURE).setOrigin(0);
  overlay.setDepth(TRANSITION_DEPTH);
  renderTransitionMask(texture, width, height, 0);

  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TRANSITION_DURATION_MS,
      ease: 'Linear',
      onUpdate: (tween) => {
        renderTransitionMask(texture, width, height, tween.getValue() ?? 0);
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
  progress: number,
): void {
  const context = texture.getContext();
  const image = context.createImageData(width, height);

  const columns = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const centerColumn = (columns - 1) / 2;
  const centerRow = (rows - 1) / 2;
  const maxDistance = Math.max(1, Math.hypot(centerColumn, centerRow));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const distance = Math.hypot(column - centerColumn, row - centerRow) / maxDistance;
      const localProgress = clamp01((progress - distance * TRANSITION_STAGGER) / (1 - TRANSITION_STAGGER));
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
