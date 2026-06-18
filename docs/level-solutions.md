# Level Solutions

These are the verification routes for the five shipped stages.

Input notation:
- `R/L/U/D`: move right, left, up, down.
- `SW`: press Space to switch the active actor.

## Stage 01: 最初の部屋

Purpose: Verify basic switching and simultaneous treasure completion.

Solution: `U U U U SW D D D D`

## Stage 02: ふたつの木箱

Purpose: Verify crate pushing in the current second stage.

Solution: `R R R D D SW L L L L D SW R R D D D L`

## Stage 03: 開放

Purpose: Verify the compact crate layout.

Solution: `D L SW D D R R R U R U R SW L U L D L`

## Stage 04: 急がば回れ

Purpose: Verify the longer light-source route.

Solution: `D L L L L D L L U R R R R U R D SW R U R U U U SW D D L L L SW R U`

## Stage 05: 橋渡し

Purpose: Combine light-source movement, box shadowing, switching, and simultaneous treasure completion.

Solution: `R R R U L SW U R R R SW D L L U R R R R SW R SW D D L D D L L L SW R U U R U R`
