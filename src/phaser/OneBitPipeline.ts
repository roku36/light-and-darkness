import Phaser from 'phaser';

const fragmentShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
varying vec2 outTexCoord;

const float BLOCK_SIZE = 1.0;

vec2 blockCoord(vec2 uv) {
  return floor(uv * resolution / BLOCK_SIZE);
}

vec2 blockCenterUv(vec2 block) {
  return ((block * BLOCK_SIZE) + vec2(0.5 * BLOCK_SIZE)) / resolution;
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

export class OneBitPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: 'OneBitPipeline', fragShader: fragmentShader });
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    this.set2f('resolution', target.width, target.height);
    this.bindAndDraw(target);
  }
}
