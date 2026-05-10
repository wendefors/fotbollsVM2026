# Projektkontext: Fotbolls-VM 2026

## 1. Översikt

Projektet är en webbapp för en tippningstävling kring herrarnas fotbolls-VM 2026. Deltagare ska kunna skicka in sina tips före turneringsstart och därefter följa resultat, poängställning och andra deltagares inskickade tippningar.

Appen riktar sig till ett kompisgäng med ungefär 50 deltagare. Fokus är enkelhet, tydlighet och låg tröskel snarare än avancerad betting- eller kontohantering.

Problemet som löses är att samla in, visa och poängberäkna tippningar på ett mer strukturerat sätt än manuella formulär, kalkylark eller chatttrådar.

## 2. Nuvarande status

Projektet har en första implementerad webbapp baserad på Vite, React och TypeScript. Appen innehåller första versionen av inskickningsflöde, publik tipsöversikt och poängliga.

Implementerade huvudfunktioner:

- Inskickningssida för tippningar och kontaktuppgifter.
- Deadline för tippning: 2026-06-11 kl. 22.00 svensk tid.
- Publik sida där inskickade tippningar visas med initialer.
- Poängliga som sorterar deltagare efter totalpoäng.
- Supabase-koppling är konfigurerad mot projektet `ejvqwrfventvupkljltb`.
- Supabase-migrationen är pushad till fjärrdatabasen.
- Lokal sessionsfallback finns kvar om miljövariabler saknas.
- VM-grupper, lag och Sveriges gruppspelsmatcher är inlagda manuellt utifrån FotbollDirekts VM-sidor.
- Formulärvalideringen är tillfälligt avslappnad för testning: inga fält är obligatoriska i UI:t, och kontaktfält i Supabase tillåter null.
- Publika initialer är unika. Vid dublett får senare deltagare löpnummer, t.ex. `GW1`.
- Efter inskick navigeras deltagaren till en egen tack-/kvittovy med publika initialer, Swish-info och sammanställning av tipset. Formuläret rensas direkt efter lyckad inskickning.
- Kvittovyn är strukturerad med initialer i hero, separat Swish-ruta och en tvåspaltig sammanfattning av tipset för bättre läsbarhet.
- Mobilflödet har tydligare submit-status: knappen visar `Skickar`, fel visas vid nätverks-/Supabaseproblem och appen navigerar inte till kvittovyn utan kvittodata.
- UUID skapas via `src/lib/id.ts`, med fallback för mobiltest över lokal HTTP där `crypto.randomUUID()` kan saknas.
- Nya inskick stoppas om samma ifyllda e-postadress redan finns i `participants`.
- Tippningsformuläret innehåller nu extra turneringsfrågor: totalt antal gula kort, röda kort och mål i hela turneringen.
- Formuläret innehåller även en utslagsfråga: matchminut för första målet i finalen, endast för att skilja tippare åt vid lika poäng.
- Tippningssidans blockordning är: kontakt, poängregler, Sveriges matcher, gruppspel, topp 3, turneringsfrågor och utslagsfråga.
- Regelblocket heter `Regler och poäng`. Ingressen innehåller deltagaravgift: 50 kr via Swish till Gustav, 070-309 26 43, samt att vinnaren tar allt. Brickorna i blocket visar endast poängreglerna.
- Alla gamla dummy-inskick i Supabase är rensade.

Kända begränsningar:

- Ingen inloggning är planerad för deltagare.
- Personuppgifter ska hanteras varsamt och inte visas publikt.
- Adminfunktionalitet är låg prioritet och kan byggas senare.
- VM-data är fortfarande manuell och behöver kontrolleras om FotbollDirekt/FIFA ändrar spelschema, stavning eller gruppinformation.
- Tillfällig testskuld: obligatorisk validering behöver återinföras före skarp användning.

## 3. Teknisk arkitektur

Teknisk stack:

- Vite för snabb och enkel frontendutveckling.
- React och TypeScript för komponentbaserad UI och typad domänmodell.
- Supabase för lagring av kontaktuppgifter, tippningar, resultat och publik läsdata.

Övergripande arkitektur:

- `src/App.tsx` innehåller första versionen av applikationens vyer och formulärlogik.
- `src/data/tournament.ts` innehåller deadline, manuella VM-grupper, gruppspecifika laglistor, Sveriges matcher och poängregler.
- `src/data/samplePredictions.ts` ger lokal exempeldata när Supabase inte är anslutet.
- `src/lib/supabase.ts` skapar Supabase-klienten när `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` finns.
- `supabase/migrations/20260508190000_initial_schema.sql` definierar första databasschemat.
- `.env.local` används lokalt för Supabase URL och anon/public key och ska inte versioneras.

Viktiga preliminära designbeslut:

- Appen ska vara enkel och underhållbar.
- Deltagarnas publika identitet ska visas som initialer av GDPR-skäl.
- Tippningsformuläret stängs 2026-06-11 kl. 22.00 svensk tid, både i frontend och i Supabase insert-policy.
- Läs- och resultatsidor ska vara öppna utan inloggning.
- Kontaktuppgifter och tippningar lagras i separata tabeller (`participants` och `predictions`).
- Publik läsning sker via vyn `public_predictions`, där kontaktuppgifter inte exponeras.
- Frontend skapar `participant_id` med `crypto.randomUUID()` innan insert, så appen inte behöver läsa tillbaka något från den privata `participants`-tabellen.
- Supabase sätter `participants.public_initials` via trigger före insert. Den publika vyn använder detta värde istället för råa initialer.
- Resultat och poänginmatning är förberett i tabellen `tournament_results`, men admin-UI är ännu inte byggt.
- Supabase CLI är initierat i projektet med `supabase/config.toml`.
- Gruppspelsval använder respektive grupps fyra lag, inte en global laglista.
- Förifylld Swish-app-länk är inte införd. En pålitlig lösning kräver Swish handel/API som skapar en payment request-token; med bara ett privat mobilnummer visas betalningsinfo manuellt. Kvittot har en enkel best-effort-länk med `swish://` för att öppna appen på mobil.
- Dubbla e-postadresser stoppas med Supabase-triggern `prevent_duplicate_participant_email_before_insert`, eftersom databasen redan kan innehålla testdubletter och en unik indexmigration därför inte är lämplig just nu.
- Extra frågor sparas i `predictions.tournament_questions` och utslagsfrågan i `predictions.tie_breaker`, båda som JSONB och exponerade via `public_predictions`.

## 4. Sprint- och utvecklingshistorik

Första implementationen är genomförd:

- Projektet startade från en markdown-baserad kravbeskrivning.
- Grundstacken valdes till Vite, React, TypeScript och Supabase.
- Första produktflödet byggdes med tre huvudvyer: skicka in, allas tips och poängliga.
- Datamodellen delades mellan privata kontaktuppgifter och publika tippningar.
- Supabase-projektet länkades och första migrationen kördes mot fjärrdatabasen.
- VM-grupperna A-L och Sveriges matcher mot Tunisien, Nederländerna och Japan lades in från FotbollDirekt.
- Submitflödet justerades så `participants` bara skrivs, inte läses, för att behålla starkare GDPR-skydd i RLS.
- Valideringskrav togs tillfälligt bort för att förenkla testinlämningar.
- Initialdubletter hanteras i databasen med löpnummer och befintliga dubletter uppdaterades, t.ex. `GW` och `GW1`.
- Tack-/kvittovyn lades till som egen vy så deltagaren ser sina initialer, betalningsinformation och inskickad sammanställning direkt efter submit.
- Mobilknappar justerades för att undvika radbrytning i fliknavigering och submitknappar.
- UUID-fallback lades till efter att mobiltest i devläge över lokal IP kunde krascha innan Supabase-anropet.
- E-postspärr lades till för nya inskick och appen visar ett specifikt fel om adressen redan använts.
- Dummy-inskick rensades i Supabase och datamodellen utökades med turneringsfrågor och utslagsfråga.

Poängförslag som gäller tills vidare:

- Sveriges matcher: 3 poäng för exakt resultat, 1 poäng för rätt tecken.
- Gruppspel: 1 poäng för rätt gruppetta och 1 poäng för rätt grupptvåa. Om deltagaren har med båda lagen som går vidare men placerar dem omvänt, ges 1 poäng totalt för gruppen.
- Topp 3: 5 poäng för rätt världsmästare, 3 poäng för rätt tvåa, 2 poäng för rätt trea.

## 5. Arbetsprinciper

Arbetet ska följa projektets angivna principer:

- Kommunicera på svenska.
- Håll lösningen pragmatisk och undvik överengineering.
- Prioritera läsbar, ren och produktionsredo kod.
- Använd vanliga, välstödda mönster och minimera onödiga beroenden.
- Bygg responsivt och mobile-first.
- Håll UI:t modernt, rent och lättläst med DM Sans som primär typografi.
- Uppdatera denna kontextfil löpande när beslut, arkitektur eller status förändras.

## 6. Nästa steg

Prioriterade nästa steg:

- Implementera faktisk resultatinmatning och poängberäkning.
- Bestämma exakt poängsättning för turneringsfrågorna.
- Återinföra obligatorisk validering innan appen används skarpt.
- Utvärdera om adminflödet ska byggas som enkel skyddad sida eller hanteras direkt i Supabase initialt.

Pågående arbete:

- Verifiera första appversionen med riktig Supabase-sparning genom att skicka in ett testtips i UI:t.
