export const GAME_COLORS = {
  light: {
    css: '#ffffff',
    value: 0xffffff,
    shader: [1, 1, 1],
  },
  shadow: {
    css: '#333333',
    value: 0x333333,
    shader: [0.2, 0.2, 0.2],
  },
} as const;

export const LIGHT_COLOR = GAME_COLORS.light;
export const SHADOW_COLOR = GAME_COLORS.shadow;

export function applyGameColorCssVariables(root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--game-light-color', LIGHT_COLOR.css);
  root.style.setProperty('--game-shadow-color', SHADOW_COLOR.css);
}
