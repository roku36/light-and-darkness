import Phaser from 'phaser';

const TRANSITION_TILE_TEXTURE = 'scene-transition-tile';
const TILE_SIZE = 32;
const TRANSITION_DEPTH = 100000;
const TRANSITION_DURATION_MS = 520;
const TRANSITION_STAGGER_MS = 18;

export function playGridTransition(scene: Phaser.Scene): Promise<void> {
  ensureTransitionTexture(scene);
  const width = scene.scale.width;
  const height = scene.scale.height;
  const columns = Math.ceil(width / TILE_SIZE) + 2;
  const rows = Math.ceil(height / TILE_SIZE) + 2;
  const originX = -TILE_SIZE;
  const originY = -TILE_SIZE;
  let remaining = columns * rows;

  return new Promise((resolve) => {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tile = scene.add.image(
          originX + column * TILE_SIZE + TILE_SIZE / 2,
          originY + row * TILE_SIZE + TILE_SIZE / 2,
          TRANSITION_TILE_TEXTURE,
        );
        tile.setDepth(TRANSITION_DEPTH);
        tile.setDisplaySize(TILE_SIZE + 1, TILE_SIZE + 1);
        const distance = Math.hypot(column - columns / 2, row - rows / 2);
        scene.tweens.add({
          targets: tile,
          angle: 135 + ((row + column) % 2) * -270,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          delay: distance * TRANSITION_STAGGER_MS,
          duration: TRANSITION_DURATION_MS,
          ease: 'Cubic.easeInOut',
          onComplete: () => {
            tile.destroy();
            remaining -= 1;
            if (remaining === 0) resolve();
          },
        });
      }
    }
  });
}

function ensureTransitionTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TRANSITION_TILE_TEXTURE)) return;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 1);
  graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  graphics.lineStyle(1, 0xffffff, 1);
  graphics.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  graphics.generateTexture(TRANSITION_TILE_TEXTURE, TILE_SIZE, TILE_SIZE);
  graphics.destroy();
}
