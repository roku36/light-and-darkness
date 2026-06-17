# Light / Dark

A top-down, turn-based light and shadow puzzle built with Phaser, TypeScript, and Vite.

## Commands

```sh
npm install
npm run dev
npm test
npm run build
npm run desktop:build
npm run desktop:build:mac
npm run desktop:build:windows
npm run desktop:build:windows:portable
```

Desktop packaging and regeneration notes are in [docs/desktop-build.md](docs/desktop-build.md).

## Controls

- Arrow keys or WASD: move the active character
- Space: switch between Light and Dark
- Z: undo
- R: restart the current stage

## Level format

Stages live in `public/levels`. Use numeric file names such as `01.txt`, `02.txt`, and add each file to `index.json` with an ID and light radius.

The first non-empty line is the Japanese stage name. Header lines such as `scale=2` can follow before the map rows. `scale` is the explicit integer display scale for that stage; the game scene does not choose it automatically. After the header, each non-empty line is one row and each character is one tile. Lines beginning with `//` are ignored, so stage files can carry short comments. The parser still accepts old comma-separated rows, but the shipped stages use the compact `.txt` format.

```txt
はじめの切替
scale=1
#########
#S.LBl..#
####..###
#...#Dd.#
#...#...#
#.......#
#########
```

| Token | Meaning |
| --- | --- |
| `#` | wall |
| `.` | floor |
| `L` / `D` | light / dark character |
| `B` | crate |
| `S` | movable light source |
| `F` | fixed light source |
| `l` / `d` | light / dark treasure |

Maps must have equal row widths, a closed wall perimeter, exactly one of each character and treasure, and one connected floor region.

## Transition texture

The scene transition uses `public/assets/fx/transition-mask.png` as a grayscale 0..1 transition mask. Each 32px grid cell stores a hard, uniform reveal-order value. At runtime Phaser samples it into a screen-sized `CanvasTexture` mask, then updates that mask as hard 0/1 alpha while grid squares rotate and shrink.
