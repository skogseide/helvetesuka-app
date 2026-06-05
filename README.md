# Helvetesuka Web App 🚀

Dette er en premium, glassmorfisk og mobilvennlig Single Page Application (SPA) utviklet for å hjelpe deg med å gjennomføre **Erik Bertrand Larsens «Helvetesuka»** (Hell Week) – *selv mens du er i full, vanlig jobb.*

Applikasjonen kjører 100% klientside og lagrer alle data lokalt i nettleseren din (via `localStorage`), slik at dine refleksjoner og dagbøker forblir helt private.

---

## Innhold og Struktur

Applikasjonen består av følgende kjernekomponenter:

1. **`index.html`**: Skjelettet for onboarding, den daglige tidslinjen, checklist-regler, de 7 tema-modulene og delingsfunksjonaliteten.
2. **`index.css`**: Et nydelig mørkt design med glassmorfiske elementer, neon-cyan, lilla og grønne detaljer, samt flytende mikro-animasjoner.
3. **`index.js`**: All forretningslogikk, powernap-tidsur, live døgnings-teller, puste-veiledning, skrytevegg, varslingsplanlegger og historikk-arkivering.
4. **`manifest.json`**: Konfigurasjon som gjør appen til en installert Progressive Web App (PWA).
5. **`service-worker.js`**: Cache-håndtering som lagrer alle statiske filer for full offline-støtte.

---

## Funksjoner

### 1. Oppsett & Onboarding
Før du starter, velger du hvilken dato Helvetesuka skal begynne (det anbefales på det sterkeste å velge en mandag). Appen regner automatisk ut hvilken dag du er på basert på dagens dato.

### 2. De 7 faste reglene
Hver dag har en sjekkliste med de 6 reglene du må følge (progresjonsringen øverst oppdateres automatisk):
*   Opp kl. **05:00**, i seng kl. **22:00** (unntatt torsdag natt!).
*   Minst **1 time trening** hver morgen.
*   Spis **100% sunt** (ingen godteri, fastfood eller alkohol).
*   Vær **100% påskrudd** og profesjonell på jobb.
*   **Logg helt av** TV, strømmetjenester og sosiale medier på fritiden.
*   Vær bevisst på vaner, fokus og indre dialog.

### 3. Daglige tema-moduler
*   **Dag 0 (Forberedelse):** Planlegging, innkjøp av sunn mat, klargjøring av klær og formulering av intensjoner.
*   **Dag 1 (Vaner):** Kartlegg dine gode vaner og uvaner for å erstatte uvanene dine.
*   **Dag 2 (Modus):** Logg og definer aktive moduser for dagen.
*   **Dag 3 (Tidsstyring):** Time-for-time planlegger fra 05:00 til 22:00 med interaktive tidsblokker.
*   **Dag 4 (All-nighter):** Live-teller som sporer våkentid og lar deg sjekke inn på checkpoints gjennom natten (00:00, 02:00, 04:00).
*   **Dag 5 (Hvile & Restitusjon):** 20-minutters Powernap-nedtelling (med alarmlyd) og pusteveiledning (Box Breathing).
*   **Dag 6 (Indre dialog):** En digital skrytevegg der du plasserer lapper med dine positive egenskaper.
*   **Dag 7 (Evaluering):** Evaluer Aha-opplevelser, nye standarder for jobbuka og belønning. Utløser konfettifeiring ved fullføring!

### 4. PWA & Offline Support
Takket være Service Worker-caching kan appen installeres direkte på hjemskjermen på mobilen eller skrivebordet, og fungerer 100% offline uten internettilkobling.

### 5. Nettleservarsler (Notifications)
Hvis du tillater varslinger (via bjellen i headeren), vil appen gi deg lokale påminnelser kl. 05:00 (stå opp!) og 22:00 (leggetid), samt gi deg checkpoints under all-nighteren torsdag natt.
*(Merk: På iOS kreves det at appen er installert på hjemskjermen for å motta bakgrunnsvarsler).*

### 6. Delingskort (Share Card)
Når du har fullført søndagsevalueringen, kan du generere et ferdig formatert delingskort som oppsummerer progresjon per dag, antall sjekkpunkter og dine aha-opplevelser, klart til å limes inn på LinkedIn, sosiale medier eller epost.

### 7. Multi-ukers Historikk og Statistikk
Når uken er fullført, trykker du "Arkiver Uke" på søndag. Appen lagrer dataene i din historikk, viser ukesprogresjonen i et grafisk diagram og nullstiller dashboardet for en ny runde. Du kan ekspandere og kollapse de arkiverte ukeskortene for å sammenligne resultater over tid.

---

## Hvordan kjøre applikasjonen lokalt

For å kjøre appen lokalt med full støtte for Service Worker og PWA, må den serves via en lokal webserver. 

Du kan starte en enkel server ved hjelp av Python:
```bash
python3 -m http.server 8080
```

Åpne deretter nettleseren din på:
👉 **[http://localhost:8080](http://localhost:8080)**
