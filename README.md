# Metaverse Reloaded

Öffentlicher, browserbasierter Eventraum für bis zu 25 Personen.

## Funktionen

- elegante futuristische 3D-Welt für Desktop und Mobile
- KayKit-Rogue-Avatare aus Kuble Office mit Idle- und Laufanimation
- Avatar-Konfigurator mit Outfitfarbe, Haarfarbe, vier Haarstilen und drei Kleidungsstilen
- kamera-relative Navigation, Jump und Double-Jump mit Salto
- synchronisierte Reaktionen wie Clap, Hearts, Celebrate, Wave und Laugh
- Host-Raumkontrolle mit `Seat all`, Sitzplatz-Lock und Unlock
- eindeutige Räume mit getrennten Guest- und Cohost-Invite-Codes
- automatische Rollen: Creator wird Host, Guest-Code wird Guest, Cohost-Code wird Cohost
- Cohosts können Voice, Screenshare, Seat all, Lock und Unlock bedienen
- Presence und flüssige Avatarbewegung über WebRTC Data Channels
- Host-Mikrofon als Voice-Broadcast an den ganzen Raum
- Host-Screenshare auf der virtuellen Main Stage
- persistenter Textchat mit `@Name`-Mentions
- strikt raumbezogener Chat ohne Nachrichten-Leaks zwischen Spaces
- Host-Portale zu anderen Spaces mit 3D-Näheinteraktion und Mobile-Button
- Invite-Konsole für den Haupt-Host mit kopierbaren Codes
- Kapazitätsprüfung für maximal 25 aktive Personen
- 25 gestaffelte 3D-Sitzplätze für `Seat all` und Sitzplatz-Lock

## Nutzung

1. Seite öffnen und Namen eingeben.
2. `Raum erstellen` wählen und einen Raumnamen vergeben. Der Creator ist automatisch Host.
3. Alternativ `Raum beitreten` wählen und einen Guest- oder Cohost-Code eingeben. Die Rolle wird automatisch gesetzt.
4. Mit `W A S D`, Pfeiltasten oder dem mobilen Steuerkreuz bewegen.
5. Mit `Space` springen; zweimal `Space` löst einen Double-Jump mit Salto aus.
6. Über `Reaktionen` Clap, Hearts und weitere Emotes auslösen.
7. Die Kamera mit Mausziehen oder einer Wischgeste drehen.
8. Host und Cohosts können Mikrofon und Screenshare über die untere Steuerleiste aktivieren.
9. Host und Cohosts können alle Personen auf Sitzplätze verteilen und dort sperren; nach Unlock können sie wieder aufstehen.
10. Nur der Haupt-Host sieht die getrennten Guest- und Cohost-Codes in der Invite-Konsole.

Screensharing hängt von der Browserunterstützung ab. Desktop-Chrome und Desktop-Safari sind dafür die empfohlenen Oberflächen. Mobile Teilnehmende können die Welt, Host-Audio, Screenshare und Chat nutzen; mobile Browser ohne `getDisplayMedia` können selbst keinen Bildschirm senden.

## Realtime-Architektur

- `/_db/presence/presence`: Room Discovery und Heartbeats
- `/_db/chat/messages`: Textchat und Mentions
- `/_db/realtime/signals`: atomare WebRTC-Angebote und Antworten inklusive ICE Candidates
- `/_db/spaces/rooms`: eindeutige Räume und SHA-256-Hashes der Invite-Codes
- `/_db/spaces/portals`: aktive Verbindungen zwischen Spaces
- `/_db/profiles/avatars`: raumbezogene Avatarprofile für die Remote-Darstellung
- WebRTC Mesh: Host-Audio, Screenshare und Avatarbewegung

Für bis zu 25 Personen sendet ein Host Audio und einen auf 15 bis 24 FPS begrenzten Bildschirmstream direkt an die anderen Teilnehmenden. Da die Zahl der direkten WebRTC-Verbindungen im Mesh quadratisch wächst, sollte die produktive Skalierungsstufe für zuverlässig grosse Räume auf eine SFU wie LiveKit wechseln.

## Dateien

- `index.html`: UI und Dialoge
- `styles.css`: responsive Gestaltung und Mobile-Layout
- `app.js`: Three.js, Realtime, Chat und WebRTC
- `public/assets/avatars/kaykit-rogue.glb`: CC0-Avatar
- `public/assets/avatars/LICENSE.md`: Herkunft und Lizenz

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
- `node tests/ten-person-smoke.mjs`: WebRTC-Mesh-Regression mit zehn Personen
- `node tests/capacity-smoke.mjs`: 25 Personen, Seat all, Lock und Ablehnung der 26. Person
- `node tests/mobile-live-smoke.mjs`: echter mobiler Live-Beitritt, Touch-Bewegung und Chat

## Lizenz

Der Anwendungscode steht unter der [MIT-Lizenz](LICENSE). Der mitgelieferte KayKit-Avatar ist separat unter CC0 lizenziert; Details stehen in [`public/assets/avatars/LICENSE.md`](public/assets/avatars/LICENSE.md).
