import Phaser from 'phaser';

const TRANSITION_SHADER_KEY = 'transition-mask-shader';
const TRANSITION_SOURCE_MASK_TEXTURE = 'transition-source-mask';
const TRANSITION_SOURCE_MASK_PATH = '/assets/fx/transition-mask.png';
const TRANSITION_DEPTH = 100000;
const TRANSITION_DURATION_MS = 980;

const transitionFragmentShader = `
precision mediump float;

uniform vec2 resolution;
uniform vec2 maskSize;
uniform sampler2D iChannel0;
uniform float progress;

varying vec2 fragCoord;

void main() {
  vec2 uv = (mod(fragCoord, maskSize) + vec2(0.5)) / maskSize;
  float disappearAt = texture2D(iChannel0, uv).r;
  float visible = 1.0 - step(disappearAt, progress);
  gl_FragColor = vec4(0.0, 0.0, 0.0, visible);
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
  shader.setScrollFactor(0);
  shader.setUniform('progress.value', 0);
  shader.setUniform('maskSize.value', transitionMaskSize(scene));

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
      maskSize: { type: '2f', value: { x: 1280, y: 720 } },
    },
  );
}

function transitionMaskSize(scene: Phaser.Scene): { x: number; y: number } {
  const texture = scene.textures.get(TRANSITION_SOURCE_MASK_TEXTURE);
  const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  return { x: source.width, y: source.height };
}
