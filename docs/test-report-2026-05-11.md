# Testrapport 2026-05-11

## Sammanfattning

Appen är nära en fungerande skarp version. Huvudflödena är byggbara, Supabase-kopplingen svarar, publika vyer exponerar inte kontaktuppgifter och de senaste formulärvalideringarna kompilerar.

Uppdatering efter rapporten:

- Sampledata-fallbacken är borttagen från skarp appstate.
- Publik hämtning av tips har laddningsläge och felmeddelande.
- Inskick går via Postgres RPC `submit_prediction`, så deltagare och tips sparas atomärt.
- RPC:n gör server-side validering av kontaktuppgifter, tipsstruktur och sifferfält.
- Direkta anon-inserts till `participants` och `predictions` är indragna.

Jag skulle däremot åtgärda några viktiga saker innan den används skarpt:

- Adminfunktionen är kraftfull och skyddas bara av en enkel kod.
- Poänglogik finns fortfarande både i Edge Function och Postgres.

Inga kritiska personuppgiftsläckor hittades i den publika läsmodellen.

## Testmiljö

- Lokal repo: `/Users/wendefors/Documents/GitHub/fotbollsVM2026`
- Datum: 2026-05-11
- Byggkommando: `npm run build`
- Supabaseprojekt: befintlig `.env.local`
- Dev-server användes via Vite.
- Supabase-audit kördes read-only med `scripts/audit-readonly.mjs`.
- Inga destruktiva databasoperationer kördes.
- Admin `save` testades inte live, eftersom det ändrar resultat och poäng.

## Körda Kontroller

### Build och beroenden

- `npm run build`: OK
- `npm audit --omit=dev`: OK, `found 0 vulnerabilities`
- Vite `base` är korrekt satt till `/fotbollsVM2026/` för GitHub Pages.
- `.env.local` ligger i `.gitignore`.
- `.env.example` innehåller bara tomma nycklar.

### Supabase Read-Only Audit

Kört med `scripts/audit-readonly.mjs`.

Resultat:

- `public_predictions` är läsbar: OK, 32 rader vid testtillfället.
- `tournament_results` är läsbar: OK, 3 rader vid testtillfället.
- Direktläsning av `participants`: exponerade 0 rader.
- Direktläsning av `predictions`: exponerade 0 rader.
- Adminfunktion med fel kod: nekades med 401.
- Adminfunktion med rätt kod, `load`: OK, read-only.

Kommentar: Supabase gav tomma resultat snarare än ett tydligt permission error för vissa RLS-kontroller, men ingen kontaktdata exponerades.

## Kritiska Fynd

Inga fynd som jag bedömer som direkt lanseringsstoppande eller som bekräftad personuppgiftsläcka.

## Viktiga Fynd

### 1. Sampledata kan visas om Supabase-läsningen fallerar

**Status:** Åtgärdat efter rapporten.

**Ursprunglig risk:** Hög för förtroende/databasvisning.

`predictions` initieras med `samplePredictions`. Om Supabase är konfigurerat men läsningen från `public_predictions` misslyckas returnerar appen tyst och behåller sampledatan. Då kan användare se exempelpersoner/tips som om de vore riktiga.

Påverkar:

- räknaren för antal inskick
- poängligan
- statistikvyn
- samtliga tippningar

Åtgärdat:

- Appen initierar nu publika tips med `[]`.
- Publik hämtning har loading-state.
- Misslyckad hämtning visar felmeddelande.
- Sampledata används inte längre som fallback.

### 2. Inskick är inte atomärt

**Status:** Åtgärdat efter rapporten.

**Ursprunglig risk:** Medel/hög för datakvalitet.

Submitflödet gör först insert i `participants` och därefter insert i `predictions`. Om första insert lyckas men andra misslyckas skapas en deltagare utan tips. Eftersom e-postspärren sitter på `participants` kan användaren då blockeras från att försöka igen med samma e-post.

Åtgärdat:

- Inskick går nu via Postgres RPC `submit_prediction`.
- RPC:n sparar `participants` och `predictions` i samma transaktion.
- Direkta anon-inserts till tabellerna är indragna.

### 3. Server-side validering saknas för inskickens payload

**Status:** Åtgärdat efter rapporten.

**Ursprunglig risk:** Medel.

Frontend validerar att alla fält är ifyllda, att e-post är rimlig och att sifferfält bara är heltal. Men Supabase anon-rollen har insert-rättigheter på `participants` och `predictions` fram till deadline. En teknisk användare kan kringgå frontend och posta ofullständig eller orimlig JSON direkt till REST-API:t.

Möjlig påverkan:

- statistik kan förvrängas
- scoring-funktioner får oväntad data
- publika vyer kan innehålla skräpdata

Åtgärdat:

- RPC:n `submit_prediction` validerar kontaktfält, e-post, Sveriges matcher, grupper, Topp 3, turneringsfrågor och utslagsfråga server-side.
- Sifferfält måste vara heltal inom miniminivåerna.
- Grupp- och Topp 3-placeringar får fortfarande ha samma lag flera gånger, enligt produktbeslut.

### 4. Adminfunktionen är kraftfull och skyddas bara av enkel kod

**Risk:** Medel.

Adminfunktionen använder service-role-nyckel internt och kan spara/radera resultat samt räkna om poäng. Den skyddas av en kod i request body. Fel kod nekas korrekt, men det finns ingen rate limiting, ingen användaridentitet och CORS är öppen för alla origins.

Rekommendation:

- Byt till längre slumpad admin-token innan skarp drift.
- Lägg token i Supabase secret, inte i repo.
- Överväg rate limiting eller enkel server-side throttling.
- Fortsätt hålla adminvyn dold, men betrakta inte `?admin` som säkerhet.

### 5. Poänglogik finns på två ställen

**Risk:** Medel för framtida regressioner.

Poänglogiken finns både i Edge Function `admin-results` och i Postgres-funktioner för nya predictions. De är nära varandra, men dubblering gör att regler kan glida isär.

Exempel på känsligt område:

- gruppscoring med specialfall för omvänd placering
- statistikintervall
- tie-breaker-avstånd

Rekommendation:

- Ha en enda källa för scoring, helst Postgres-funktioner som både admin-recalc och insert-trigger använder.
- Alternativt lägg explicita testfall som jämför Edge Function-logik mot Postgres-logik.

## Mindre Fynd Och UX

### Native validation ger inte full kontroll över texten

Fält har `required`, `type=email` och `pattern`, vilket är bra. Men webbläsarens egna valideringsmeddelanden kan visas innan appens svenska `submitError`.

Rekommendation:

- Acceptera detta för enkelhet, eller bygg egen “visa alla fel”-sammanfattning längst ned vid submit.

### Sifferfält saknar rimliga övre gränser

Appen stoppar bokstäver och minusvärden, men tillåter mycket stora tal som `999999`.

Rekommendation:

- Överväg mjuka maxgränser:
  - matchmål: 0-20
  - gula kort: 0-1000
  - röda kort: 0-100
  - totalt antal mål: 0-300
  - finalens första mål: 1-130

### `min` används på textfält

Sifferfält är `type="text"` med `inputMode="numeric"` och `pattern`, vilket är bra för att slippa spinners. `min` har däremot ingen native effekt på textfält. Det fångas av custom-valideringen för utslagsfrågan, så detta är inte ett funktionsfel.

### Fel vid publikhämtning är tyst

Om `public_predictions` inte kan hämtas visas inget fel. I kombination med sampledata blir det särskilt riskabelt.

Rekommendation:

- Visa “Kunde inte hämta inskickade tips just nu.”
- Skilj på `loading`, `loaded`, `error`.

### Statistikens “mest eniga/splittrad” omfattar inte numeriska frågor

Logiken tittar på diskreta frågor som Sveriges matcher, grupper och Topp 3. Den omfattar inte gula/röda/mål/utslagsfråga. Det är okej, men bör vara medvetet.

Rekommendation:

- Behåll om det känns bra i UI.
- Alternativt byt rubrikerna till “Mest eniga valfråga” och “Mest splittrade valfråga”.

## Infosäk Och Integritet

### Kontaktuppgifter

Publika vyer visar:

- prediction-id
- initialer
- tips
- poäng
- skapad tid

Publika vyer visar inte:

- förnamn
- efternamn
- telefon
- e-post

Detta är bra.

### RLS

RLS är aktiverat för:

- `participants`
- `predictions`
- `tournament_results`
- `prediction_scores`

Anon kan:

- insert på participants/predictions fram till deadline
- läsa `public_predictions`
- läsa `tournament_results`
- läsa `prediction_scores`

Anon kunde inte läsa kontaktdata i audit-testet.

### Onödig läsning av `prediction_scores`

`prediction_scores` är publik. Det verkar inte innehålla personuppgifter, men eftersom `public_predictions` redan exponerar poäng kan direkt grant på `prediction_scores` vara onödig.

Rekommendation:

- Överväg att ta bort direkt `grant select on public.prediction_scores to anon` och låt poängen endast gå via `public_predictions`.

### Admin

Adminfunktionen är korrekt nekande vid fel kod och kräver secret-konfigurerad kod. Men den är fortfarande svag jämfört med riktig auth.

Rekommendation:

- Minst: längre token.
- Bättre: Supabase Auth eller GitHub/OAuth-skydd om appen växer.

### Hemligheter

- `.env.local` är ignorerad av git.
- `.env.example` har tomma värden.
- Supabase service-role-nyckel finns inte i repo.
- Admin-koden hittades inte hårdkodad i repo-filerna.

## Funktionella Testområden

### Formulär

Granskat:

- alla kontaktfält har `required`
- e-post är `type=email`
- sifferfält har `inputMode=numeric`, `pattern=[0-9]*` och custom-filter i state-uppdatering
- submit har custom-validering innan Supabase-insert
- gruppetta och grupptvåa får vara samma lag
- Topp 3 får samma lag på flera placeringar
- dubblett-e-post stoppas i Supabase-trigger

Ej live-insert-testat i denna passning för att undvika mer testdata i Supabase.

### Kvittosida

Kodgranskat:

- visas efter lyckad public prediction-hämtning
- formuläret rensas efter lyckat inskick
- visar initialer och sammanfattning
- har Swish-information och tillbaka-knapp

Risk:

- om prediction sparas men kvittot inte kan hämtas visas fel och användaren kan behöva kontrollera Samtliga tippningar.

### Poängliga

Kodgranskat:

- filter för Totalt, Sverige, Gruppspel, Topp 3, Statistik
- sorterar på valt poängfält
- klick på initialer växlar till Samtliga tippningar och fokuserar rätt kort

### Statistik

Kodgranskat:

- räknare i hero använder `predictions.length`
- Snabbkoll bygger på samma publika predictions
- Sveriges matcher visar topp 3 resultat utan staplar
- gruppspel räknar procent per placering
- gruppspel sorterar efter andel gruppettor
- ledande etta och ledande tvåa markeras
- Topp 3 visar topp fem
- statistik/utslag visar min/max och Q1-Q3-spann

Risk:

- om sampledata visas vid Supabase-fel blir hela statistikvyn missvisande.

### Admin

Testat read-only:

- fel kod nekas
- rätt kod kan läsa resultat

Kodgranskat:

- save skriver bara kompletta match-/grupp-/podiumresultat
- statistik kan sparas löpande men ger poäng först när `isFinal` är true
- tomma tidigare resultat kan raderas vid save
- poäng räknas om efter save

Ej live-testat:

- admin save
- admin tömning av resultat

Skäl: det ändrar befintliga resultat och poäng.

## Robusthet

### Nätverksfel

Submit fångar oväntade fel och visar:

`Något gick fel vid inskickningen. Kontrollera anslutningen och försök igen.`

Publik läsning av predictions fångar däremot fel tyst. Detta bör förbättras.

### Dubbelklick

`isSubmitting` används både som guard och för disabled state. Det minskar risk för dubbel-submit.

### Mobil

Mobilanpassningar finns i CSS:

- meny har kortare label för Samtliga tippningar
- gridar faller till en kolumn
- sifferfält använder numeric input mode
- telefonfält använder tel input mode

Ej fullständigt visuellt screenshot-testat i riktig mobilbrowser i denna passning.

## Rekommenderade Åtgärder Innan Skarp Drift

1. Byt admin-koden till en längre slumpad token.
2. Överväg att ta bort direkt publik läsrätt på `prediction_scores`.
3. Lägg rimliga maxgränser på sifferfält.
4. Skriv ett litet scoring-testpaket med konkreta exempel för Sverige, grupper, Topp 3 och statistik.

## Ej Testat / Kvarvarande Risk

- Ingen fullständig browserautomation med Playwright/Cypress kördes.
- Ingen live admin-save kördes.
- Ingen live submit-insert kördes under denna testomgång.
- Ingen visuell screenshot-verifiering på riktig mobil.
- Ingen lasttestning eller rate-limit-testning av adminfunktionen.

## Slutsats

Appen är nära redo, men jag rekommenderar att åtgärda framför allt sampledata-fallbacken och det icke-atomära submitflödet innan skarp lansering. Integritetsmässigt ser den publika datamodellen bra ut: kontaktuppgifter ligger inte i den publika vyn och read-only-auditen exponerade inga kontaktfält.
