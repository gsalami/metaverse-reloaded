# Design QA - Mobile Raum erstellen mit Tastatur

- Source visual truth: `/tmp/codex-remote-attachments/019f5a50-f92c-7270-8e7b-bf0d5c289125/E060C62E-2D2E-424F-AEF7-03B24BB883B8/1-Foto-1.jpg`
- Implementation screenshot: `/Users/gsalami/Agency Dropbox/user 1/a_code/Metaverse Reloaded/output/mobile-keyboard-fixed.png`
- Side-by-side comparison: `/Users/gsalami/Agency Dropbox/user 1/a_code/Metaverse Reloaded/output/mobile-keyboard-compare.png`
- Viewport: 390 x 430 CSS px, representing the visible iPhone area while the software keyboard is open
- State: Create-room tab, room-name input focused, mobile keyboard viewport simulated

## Full-view comparison evidence

The source shows the create-room form clipped immediately after its helper text; the primary submit action is below the visible keyboard area. In the revised implementation, the same room section remains visible and `Eigenen Raum erstellen` is fully inside the reduced viewport. The dialog is bound to `visualViewport.height` and the form owns the vertical scroll area.

## Focused region comparison evidence

The comparison focuses on the avatar footer, create/join tabs, room-name field, helper text, and primary action. A separate detail crop was unnecessary because all affected controls and their labels are readable in the side-by-side image.

## Findings and comparison history

- [P0, resolved] Primary room-creation action hidden behind the iOS keyboard.
  - Earlier evidence: source screenshot has no visible submit button below the room helper text.
  - Fix: mobile dialog height/top now follow `visualViewport`; the form has a bounded momentum-scroll area and scrolls the active entry panel into view.
  - Post-fix evidence: implementation screenshot shows the complete submit button at 390 x 430; automated test confirms its bounding box is inside the 430px visual viewport and creates a Host room.
- [P1, resolved] Safari focus zoom caused horizontal clipping and scale drift.
  - Earlier evidence: source screenshot shows horizontally cut avatar options and oversized focused room input.
  - Fix: all mobile join inputs use a minimum 16px font size; viewport scaling was not disabled.
  - Post-fix evidence: implementation screenshot has no horizontal clipping, and the keyboard smoke test confirms a computed 16px room-input font size.

## Required fidelity surfaces

- Fonts and typography: Existing DM Sans/Space Mono hierarchy is preserved; mobile text inputs use 16px only where Safari requires it to prevent focus zoom.
- Spacing and layout rhythm: Existing card, tab, input, and button spacing is preserved. Extra bottom scroll padding keeps the action clear of the keyboard and safe area.
- Colors and visual tokens: Existing cyan/blue gradient, dark surfaces, borders, and muted text tokens are unchanged.
- Image quality and asset fidelity: No image or avatar asset was changed; the existing modular avatar preview remains intact.
- Copy and content: Existing German labels and helper text are unchanged; `enterkeyhint="go"` adds a keyboard affordance without visible copy changes.

## Primary interactions tested

- Focus room-name input.
- Reduce visual viewport from 844px to 430px.
- Verify dialog and scroll container resize.
- Verify primary action is visible.
- Tap primary action and create the room as Host.
- Browser console/page errors checked: none in the keyboard smoke test.

## Implementation checklist

- [x] VisualViewport-bound mobile dialog
- [x] Bounded internal form scrolling
- [x] Automatic active-panel reveal
- [x] 16px mobile inputs to prevent Safari zoom
- [x] `enterkeyhint="go"` and Enter submission
- [x] Mobile keyboard regression test

final result: passed
