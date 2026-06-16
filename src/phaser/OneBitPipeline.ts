import Phaser from 'phaser';

const fragmentShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float ditherScale;
varying vec2 outTexCoord;

vec2 blockCoord(vec2 uv) {
  return floor(uv * resolution / ditherScale);
}

vec2 blockCenterUv(vec2 block) {
  return ((block * ditherScale) + vec2(0.5 * ditherScale)) / resolution;
}

float fixedDither(vec2 block) {
  return mod(block.x + block.y, 2.0);
}

void main() {
  vec2 block = blockCoord(outTexCoord);
  vec2 sampleUv = blockCenterUv(block);
  vec4 color = texture2D(uMainSampler, sampleUv);
  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float bit;
  if (luminance < 0.34) {
    bit = 0.0;
  } else if (luminance > 0.70) {
    bit = 1.0;
  } else {
    bit = fixedDither(block);
  }
  gl_FragColor = vec4(vec3(bit), color.a);
}`;

type ScaledGameObject = Phaser.GameObjects.GameObject & { scaleX?: number };

export class OneBitPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: 'OneBitPipeline', fragShader: fragmentShader });
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    const sourceScale = Math.max(1, Math.round((this.gameObject as ScaledGameObject | undefined)?.scaleX ?? 1));
    this.set2f('resolution', target.width, target.height);
    this.set1f('ditherScale', sourceScale);
    this.bindAndDraw(target);
  }
}
