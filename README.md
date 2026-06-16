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

The first non-empty line is the Japanese stage name. After that, each non-empty line is one row and each character is one tile. Lines beginning with `//` are ignored, so stage files can carry short comments. The parser still accepts old comma-separated rows, but the shipped stages use the compact `.txt` format.

```txt
はじめの切替
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
