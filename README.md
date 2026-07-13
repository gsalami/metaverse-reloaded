# Metaverse Reloaded

Öffentlicher, browserbasierter Eventraum für bis zu 25 Personen.

- Live-App: https://metaverse-reloaded.host.kuble.com/
- Öffentliche Spaces: https://metaverse-reloaded.host.kuble.com/spaces.html
- Live-TODO-Board: https://metaverse-reloaded.host.kuble.com/todos.html

## Funktionen

- elegante futuristische 3D-Welt für Desktop und Mobile
- iPhone-taugliche Raum-Erstellung mit tastaturabhängigem Dialog und ohne Safari-Fokuszoom
- passwortlose Accounts per E-Mail-Magic-Link für die sichere Raum-Erstellung
- persönlicher Bereich unter `spaces.html` zum Umbenennen, Löschen und Erneuern der Invite-Codes eigener Spaces
- automatisch vorgeschlagene, kollisionsgeprüfte Raumnamen statt generischem „Mein Metaverse“
- zehn auswählbare, mobile-fähige Architekturen mit neun unterschiedlichen Raumgrössen: Neon Arena, Alpine Lodge mit Kamin, Tropical Pavilion, Mars Habitat, Cyber Gallery, Zen Courtyard, Lunar Observatory, Ocean Dome, Desert Festival und Arctic Ice Hall
- KayKit-Rogue-Rig aus Kuble Office mit Idle-, Lauf-, Sitz- und Cheer-Animation
- neutraler Basis-Body ohne sichtbare eingebackene Haare oder Kleidung
- Avatar-Konfigurator mit Outfitfarbe, Haarfarbe, vier Haarmodulen und drei animierten 3D-Outfitmodulen
- kamera-relative Navigation, Jump und Double-Jump mit Salto
- weiche Third-Person-Kamera, die sich beim Laufen automatisch hinter dem Avatar ausrichtet
- synchronisierte Reaktionen wie Clap, Hearts, Celebrate, Wave und Laugh
- Host-Raumkontrolle: `Seat all` setzt und sperrt nur Guests; Host und Cohosts bleiben beweglich
- freie Sitzplatzwahl per Klick oder Touch; belegte Plätze werden raumweit synchronisiert und der Avatar schaut automatisch zur Leinwand
- eindeutige Räume mit getrennten Guest- und Cohost-Invite-Codes
- automatische Rollen: Creator wird Host, Guest-Code wird Guest, Cohost-Code wird Cohost
- Cohosts können Voice, Screenshare, Seat all, Lock und Unlock bedienen
- Presence und flüssige Avatarbewegung über WebRTC Data Channels
- Host-Mikrofon als Voice-Broadcast an den ganzen Raum
- Host-Screenshare auf der virtuellen Main Stage
- persistenter Textchat mit `@Name`-Mentions
- strikt raumbezogener Chat ohne Nachrichten-Leaks zwischen Spaces
- Host-Portale zu anderen Spaces mit 3D-Näheinteraktion und Mobile-Button
- öffentliche Liste aller aktiven Metaverses mit direkten Guest-Deep-Links
- Portal-Ankunftsfeedback und lokale Liste der zuletzt besuchten Spaces für die Rückkehr ohne Portal
- Invite-Konsole für den Haupt-Host mit kopierbaren Codes
- Kapazitätsprüfung für maximal 25 aktive Personen
- 25 gestaffelte 3D-Sitzplätze für `Seat all` und Sitzplatz-Lock

## Nutzung

1. Seite öffnen und Namen eingeben.
2. `Raum erstellen` wählen und den Magic Link per E-Mail bestätigen. Danach einen Namen und eines der zehn Designs festlegen. Der Creator ist automatisch Host.
3. Alternativ `Raum beitreten` wählen und einen Guest- oder Cohost-Code eingeben. Die Rolle wird automatisch gesetzt.
   Ein öffentlicher Deep Link `/?room=RAUM-ID` öffnet den Zielraum direkt als Guest-Zugang.
4. Mit `W A S D`, Pfeiltasten oder dem mobilen Steuerkreuz bewegen.
5. Mit `Space` springen; zweimal `Space` löst einen Double-Jump mit Salto aus.
6. Über `Reaktionen` Clap, Hearts und weitere Emotes auslösen.
7. Die Kamera mit Mausziehen oder einer Wischgeste drehen.
8. Host und Cohosts können Mikrofon und Screenshare über die untere Steuerleiste aktivieren.
9. Einen freien Sitzplatz anklicken oder antippen, um sich zu setzen. Erneut klicken oder loslaufen, um bei entsperrtem Raum wieder aufzustehen.
10. `Seat all` verteilt alle Guests auf Sitzplätze mit Blick zur Main Stage und sperrt sie sofort. Host und Cohosts bleiben beweglich; nach `Unlock Guests` können Guests wieder aufstehen.
11. Nur der Haupt-Host sieht die getrennten Guest- und Cohost-Codes in der Invite-Konsole.
12. Unter `spaces.html` können angemeldete Personen ihre eigenen Spaces bearbeiten, löschen und beide Invite-Codes erneuern. Alte Codes werden dabei sofort ungültig.

Screensharing hängt von der Browserunterstützung ab. Desktop-Chrome und Desktop-Safari sind dafür die empfohlenen Oberflächen. Mobile Teilnehmende können die Welt, Host-Audio, Screenshare und Chat nutzen; mobile Browser ohne `getDisplayMedia` können selbst keinen Bildschirm senden.

## Realtime-Architektur

- Supabase Auth: passwortlose Magic-Link-Sessions
- Resend SMTP: produktiver Versand der Auth-E-Mails über die verifizierte Absenderdomain
- Supabase PostgreSQL mit Row Level Security: sichere Ownership, Space-Metadaten und gehashte Invite-Codes
- öffentliche Supabase-RPCs: Space-Verzeichnis, Deep Links und Invite-Auflösung ohne Offenlegung der Hashes
- `/_db/presence/presence`: Room Discovery und Heartbeats
- `/_db/chat/messages`: Textchat und Mentions
- `/_db/realtime/signals`: atomare WebRTC-Angebote und Antworten inklusive ICE Candidates
- `/_db/spaces/rooms`: Legacy-Räume und Realtime-Kompatibilität während der Migration
- `/_db/spaces/room_templates`: persistente Design-Zuordnung pro Raum mit Fallback für ältere Räume
- `/_db/spaces/portals`: aktive Verbindungen zwischen Spaces
- `/_db/profiles/avatars`: raumbezogene Avatarprofile für die Remote-Darstellung
- WebRTC Mesh: Host-Audio, Screenshare und Avatarbewegung

Für bis zu 25 Personen sendet ein Host Audio und einen auf 15 bis 24 FPS begrenzten Bildschirmstream direkt an die anderen Teilnehmenden. Da die Zahl der direkten WebRTC-Verbindungen im Mesh quadratisch wächst, sollte die produktive Skalierungsstufe für zuverlässig grosse Räume auf eine SFU wie LiveKit wechseln.

## Dateien

- `index.html`: UI und Dialoge
- `styles.css`: responsive Gestaltung und Mobile-Layout
- `app.js`: Three.js, Realtime, Chat und WebRTC
- `supabase-client.js`: browserseitiger Supabase-Client für Auth und sichere Space-Operationen
- `supabase/migrations/20260713160000_spaces_auth.sql`: Tabellen, Row Level Security und RPCs
- `spaces.html`, `spaces.css`, `spaces.js`: öffentliches Space-Verzeichnis, Account-Dashboard und lokale Besuchshistorie
- `public/assets/avatars/kaykit-rogue.glb`: CC0-Animationsrig; die sechs originalen Rogue-Render-Meshes werden im Client ausgeblendet
- `public/assets/avatars/LICENSE.md`: Herkunft und Lizenz
- `AVATAR-IMPLEMENTATION.md`: technische Entscheidung, Asset-Hash und Grenzen der modularen Avatarbasis

## Lokal starten

Die statischen Dateien können über einen lokalen HTTP-Server ausgeliefert werden. Die öffentlichen Datenbank-Endpunkte existieren nur auf der publizierten Host-Site; für vollständige Multiuser-Tests dient deshalb die Live-URL.

```bash
npm install
python3 -m http.server 8899
```

## Verifikation

- `npm run test:browser`: responsive Desktop-/Mobile-Oberfläche und Avatar-Konfiguration
- `npm run test:multiuser`: Host, Guest und Cohost, Avatar-Synchronisation, Voice, Screen, Chat und Raumkontrolle
- `npm run test:portal`: Chat-Isolation und Portalwechsel zwischen zwei Spaces
- `npm run test:spaces`: öffentliche Liste, Deep Links, letzte Spaces, Polling und Mobile-Layout
- `npm run test:spaces-owner`: Besitzer:innen-Dashboard, Umbenennen, Code-Erneuerung, Löschen und Mobile-Layout
- `npm run test:templates`: zehn Designs, Persistenz, Deep-Link-Join und Fallback für ältere Räume
- `npm run test:architectures`: zehn eigenständige Architekturen, Raumgrössen, Kamin, Gallery, Mobile-Detailreduktion sowie 25 Sitzplätze
- `npm run test:room-creation`: einzigartige Namensvorschläge, sichtbare Titel und unterschiedliche Deep Links
- `npm run test:mobile-keyboard`: iOS-VisualViewport, sichtbarer Erstellen-Button und mobile Raum-Erstellung
- `npm run test:camera-follow`: automatische Kameraausrichtung bei WASD und freies Drehen im Stand
- `npm run test:seat-selection`: Maus-Klick, Mobile-Tap, Belegungssynchronisation, Sitzrichtung und Aufstehen
- `node tests/ten-person-smoke.mjs`: WebRTC-Mesh-Regression mit zehn Personen
- `node tests/capacity-smoke.mjs`: 25 Personen, Guest-only Seat all mit Auto-Lock und Ablehnung der 26. Person
- `node tests/mobile-live-smoke.mjs`: echter mobiler Live-Beitritt, Touch-Bewegung und Chat

## Lizenz

Der Anwendungscode steht unter der [MIT-Lizenz](LICENSE). Der mitgelieferte KayKit-Avatar ist separat unter CC0 lizenziert; Details stehen in [`public/assets/avatars/LICENSE.md`](public/assets/avatars/LICENSE.md).
