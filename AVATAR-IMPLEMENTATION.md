# Modularer Avatar

## Asset-Entscheidung

Der read-only geprüfte Avatarbestand von Kuble Office enthält keinen neutralen oder modularen Charakter. Verfügbare GLB-Dateien:

- `/Users/gsalami/Agency Dropbox/user 1/a_code/kuble-office/public/assets/avatars/kaykit-rogue.glb`
  - SHA-256: `82d83a1cccb2e23d896336bd6fc1a558dc9830a220ff9ab0694de437b2b33550`
  - sechs Skinned-Meshes, ein gemeinsames Texturmaterial, vollständiges humanoides Rig und sechs benötigte Animationen
  - Lizenz: CC0 1.0, dokumentiert in `public/assets/avatars/LICENSE.md`
- `/Users/gsalami/Agency Dropbox/user 1/a_code/kuble-office/public/assets/gallery/blurred-reality-2023/3d/chrigib_mary.glb`
  - SHA-256: `179192b200eae92682ab4948578f9a61919d4a300d9de70dad2c7c6d4d003228`
  - statisches Galerie-Kunstwerk ohne Rig oder Animationen, deshalb als Avatar ungeeignet

Der bereits byte-identisch im Projekt vorhandene KayKit Rogue bleibt die Basis. Es wurde kein weiteres Asset kopiert. Kuble Office wurde nicht verändert.

## Technische Umsetzung

Das optimierte Rogue-GLB trennt Haare und Kleidung nicht als eigene Nodes oder Materialien. Alle sechs Körperteile verwenden dasselbe Texturmaterial. Ein selektives Ausblenden der eingebackenen Ausstattung ist daher technisch nicht zuverlässig möglich.

Der Client verwendet den Rogue deshalb als unsichtbares Animationsrig:

1. Alle sechs originalen Render-Meshes erhalten beim Laden `visible = false`.
2. Skelett, Bones und Animationsclips bleiben aktiv.
3. Ein neutraler, matter Basis-Body ohne Haare und sichtbare Kleidung wird aus Three.js-Geometrien aufgebaut.
4. Basis-Body, Haarmodule und Outfitmodule werden direkt an `head`, `chest`, `hips`, Arm-, Hand-, Bein- und Fuss-Bones gehängt.
5. Idle, Walking, Sit und Cheer bewegen damit auch die neuen Module.
6. Profilwerte und Datenbankschema bleiben unverändert: `primary_color`, `hair_style`, `hair_color`, `outfit_style`.

Die gespeicherte Outfit-ID `rogue` bleibt aus Kompatibilitätsgründen erhalten. In der Oberfläche heisst diese Variante nun `Casual`.

## Grenzen

- Die prozeduralen Module folgen den Bones als starre Teile. Stoffverformung und weiche Skin-Deformation benötigen zukünftig echte modulare Skinned-Meshes mit identischem Rig.
- Der Basis-Body verwendet vorerst einen festen Hautton und ein neutrales dunkles Underlay. Eine Hautton-Auswahl würde ein zusätzliches optionales Profilfeld benötigen.
- Die CSS-Vorschau zeigt Stil und Farben sofort. Die finale Geometrie ist nach dem Eintritt direkt im Three.js-Raum sichtbar.
- Der KayKit Rogue bleibt intern für Animationen erforderlich, obwohl seine sichtbare Geometrie vollständig deaktiviert ist.
