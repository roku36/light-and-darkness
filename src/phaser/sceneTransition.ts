import Phaser from 'phaser';

const TRANSITION_SHADER_KEY = 'transition-mask-shader';
const TRANSITION_SOURCE_MASK_TEXTURE = 'transition-source-mask';
const TRANSITION_SOURCE_MASK_PATH = '/assets/fx/transition-mask.png';
const TRANSITION_DEPTH = 100000;
const TRANSITION_DURATION_MS = 980;
const TILE_SIZE = 32;

const transitionFragmentShader = `
precision mediump float;

uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform float progress;

varying vec2 fragCoord;

float easeInOutCubic(float value) {
  return value < 0.5
    ? 4.0 * value * value * value
    : 1.0 - pow(-2.0 * value + 2.0, 3.0) * 0.5;
}

void main() {
  vec2 uv = fragCoord / resolution.xy;
  float revealAt = texture2D(iChannel0, uv).r;
  float localProgress = clamp((progress - revealAt * 0.42) / 0.58, 0.0, 1.0);
  float eased = easeInOutCubic(localProgress);
  float squareScale = 1.0 - eased;

  vec2 tile = vec2(${TILE_SIZE.toFixed(1)});
  vec2 cell = floor(gl_FragCoord.xy / tile);
  vec2 center = (cell + vec2(0.5)) * tile;
  vec2 delta = gl_FragCoord.xy - center;
  float direction = mod(cell.x + cell.y, 2.0) < 1.0 ? 1.0 : -1.0;
  float angle = 2.2619467 * eased * direction;
  float c = cos(angle);
  float s = sin(angle);
  vec2 local = vec2(delta.x * c + delta.y * s, -delta.x * s + delta.y * c);
  float halfSize = tile.x * 0.5 * squareScale;
  float inside = step(abs(local.x), halfSize) * step(abs(local.y), halfSize);

  gl_FragColor = vec4(0.0, 0.0, 0.0, inside);
}`;

export function preloadTransitionTexture(scene: Phaser.Scene): void {
  scene.load.image(TRANSITION_SOURCE_MASK_TEXTURE, TRANSITION_SOURCE_MASK_PATH);
}

export function playGridTransition(scene: Phaser.Scene): Promise<void> {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const shader = scene.add.shader(
    transitionShader(),
    0,
    0,
    width,
    height,
    [TRANSITION_SOURCE_MASK_TEXTURE],
    {
      minFilter: 'nearest',
      magFilter: 'nearest',
      wrapS: 'clamp_to_edge',
      wrapT: 'clamp_to_edge',
    },
  ).setOrigin(0);
  shader.setDepth(TRANSITION_DEPTH);
  shader.setUniform('progress.value', 0);

  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TRANSITION_DURATION_MS,
      ease: 'Linear',
      onUpdate: (tween) => {
        shader.setUniform('progress.value', tween.getValue() ?? 0);
      },
      onComplete: () => {
        shader.destroy();
        resolve();
      },
    });
  });
}

function transitionShader(): Phaser.Display.BaseShader {
  return new Phaser.Display.BaseShader(
    TRANSITION_SHADER_KEY,
    transitionFragmentShader,
    undefined,
    {
      progress: { type: '1f', value: 0 },
    },
  );
}
