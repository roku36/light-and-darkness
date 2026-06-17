# Desktop Build

This project uses Tauri 2 to package the Vite/Phaser game as a desktop app.

## Local Development

```sh
npm run desktop:dev
```

Tauri starts the Vite dev server and opens the game in a fullscreen desktop window.

## Regenerate A Release Build

```sh
npm run desktop:build
```

The command runs `npm run build` first, embeds `dist/` into the Tauri app, then writes platform-specific bundles under:

```txt
src-tauri/target/release/bundle/
```

## macOS `.app`

On macOS:

```sh
npm run desktop:build:mac
```

This project is configured to produce only:

```txt
src-tauri/target/release/bundle/macos/Light and Darkness Treasure.app
```

It does not produce a `.dmg`.

## Windows `.exe`

On a Windows machine:

```sh
npm install
npm run desktop:build:windows
```

This produces an NSIS installer executable:

```txt
src-tauri/target/release/bundle/nsis/*-setup.exe
```

For a portable single app executable without an installer, run this on Windows:

```sh
npm run desktop:build:windows:portable
```

That produces:

```txt
src-tauri/target/release/light-and-darkness.exe
```

The portable `.exe` assumes the target PC already has Microsoft WebView2 Runtime. Current Windows 10/11 machines usually do, but the installer route is safer for public distribution because Tauri can handle WebView2 installation policy there.

## Build Both From GitHub Actions

The workflow at `.github/workflows/desktop-build.yml` can be started manually from GitHub Actions. It builds:

- macOS: `Light and Darkness Treasure.app`, uploaded as a zip artifact
- Windows: `light-and-darkness.exe` and the NSIS `*-setup.exe`, uploaded as artifacts

When a `v*` tag is pushed, the same workflow also creates or updates the GitHub Release for that tag and attaches:

- `light-and-darkness-macos-app.zip`
- `light-and-darkness.exe`
- `light-and-darkness-setup.exe`

Release command:

```sh
git tag v0.1.1
git push origin main v0.1.1
```

This is the closest Tauri equivalent to a one-shot multi-platform export: each platform is built on its native runner, then the artifacts are collected on the GitHub Release.

## Cross-Building Windows From macOS

This is possible, but it is not the default happy path. Tauri's Windows installer docs say Windows apps are normally built on a Windows computer, while macOS/Linux cross-compilation is possible for NSIS with caveats and needs extra setup: NSIS, LLVM, the `x86_64-pc-windows-msvc` Rust target, and `cargo-xwin`.

After installing those tools, the macOS cross-build command is:

```sh
npm run desktop:build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

The output path for that cross-build is:

```txt
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
```

## Fullscreen Policy

The main window is configured in `src-tauri/tauri.conf.json` with:

```json
"fullscreen": true,
"decorations": false,
"resizable": false
```

The Rust startup code in `src-tauri/src/lib.rs` applies the same fullscreen, decoration, and resize settings again at runtime so the game starts as a fullscreen-only desktop experience.
