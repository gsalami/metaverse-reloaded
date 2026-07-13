# Avatar assets - sources & licenses

Self-hosted only. **No live Ready Player Me / no hotlinked model URLs** are used by the browser.

## kaykit-rogue.glb

- **Model:** "Rogue" from **KayKit : Adventurers Character Pack (1.0)** by **Kay Lousberg** - https://kaylousberg.com/
- **License:** CC0 1.0 (public domain). https://creativecommons.org/publicdomain/zero/1.0/
  Verified in the pack's own `LICENSE.txt`: "License: (Creative Commons Zero, CC0)".
- **Obtained via:** official GitHub mirror
  `https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`
  (`addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb`, 3.6 MB original).
- **Processing:** shrunk locally with `@gltf-transform` (CC0 allows modification): kept only the
  `Idle` / `Cheer` / `Walking_A` / `Sit_Chair_Down` / `Sit_Chair_Idle` / `Sit_Chair_StandUp`
  clips (of 76), removed the weapon/cape attachment meshes
  (`Knife*`, `*Crossbow`, `Throwable`, `Rogue_Cape`), DRACO-compressed to **~272 KB**.
  (`Sit_Chair_StandUp` is bundled for future stand-up transitions; the office currently
  crossfades out of the sit pose directly.)
- **SHA-256:** `82d83a1cccb2e23d896336bd6fc1a558dc9830a220ff9ab0694de437b2b33550`.
- **Use in Metaverse Reloaded:** animation skeleton only. The six Rogue render meshes are hidden
  at runtime because hair and clothing are not separate nodes. A neutral procedural body plus
  bone-attached hair and outfit modules provide the visible avatar.

## Removed assets

- `quaternius-robot.glb` (Quaternius "RobotExpressive", CC0) - removed 2026-06-10 with the KayKit rollout.
- `quaternius-casual.glb` (Quaternius "Casual2", CC0, style-spike candidate "Stil B") - removed 2026-06-10.
