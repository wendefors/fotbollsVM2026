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
- Skarp formulärvalidering är återinförd: alla fält krävs, e-post måste ha korrekt format och sifferfält accepterar bara heltal. Gruppetta/grupptvåa och Topp 3 tillåter samma lag på flera placeringar.
- Tippningsformuläret innehåller nu extra turneringsfrågor: totalt antal gula kort, röda kort och mål i hela turneringen.
- Formuläret innehåller även en utslagsfråga: matchminut för första målet i finalen, endast för att skilja tippare åt vid lika poäng.
- Heroytan visar både deadline och aktuellt antal inskickade tips.
- Viktad testdata kan skapas med `scripts/seed-weighted-test-data.mjs`. Scriptet gör endast inserts av nya testdeltagare/tips och använder unika e-postadresser per körning.
- Tippningssidans blockordning är: kontakt, poängregler, Sveriges matcher, gruppspel, topp 3, turneringsfrågor och utslagsfråga.
- Regelblocket heter `Regler och poäng`. Ingressen innehåller deltagaravgift: 50 kr via Swish till Gustav, 070-309 26 43, samt att vinnaren tar allt. Brickorna i blocket visar endast poängreglerna.
- Alla gamla dummy-inskick i Supabase är rensade.
- Poängligan har filter för Totalt, Sverige, Gruppspel, Topp 3 och Statistik. Filtren sorterar på kategoriuppdelade poäng.
- Menyn innehåller en Statistik-vy som sammanställer inskickade tips: Sveriges matcher visar de tre vanligaste resultaten som procentlista utan staplar, gruppspel/topp 3 visas med staplar utan antalstext, och statistikfrågor/utslagsfrågan visar min/max samt vanligast spann utan decimaler. Gruppspel räknar procent per ifylld placering, avrundas så varje plats summerar till 100%, sorterar lagen efter störst andel gruppettor och markerar både ledande etta och ledande tvåa. Topp 3 visar bara topp fem per placering. Statistikvyn har även en snabbkoll med vanligaste finalen, Sverige vidare, Sveriges förväntade grupppoäng, mest eniga fråga och mest splittrade fråga.
- I poängligan är initialerna klickbara. Klick växlar till Samtliga tippningar, scrollar till rätt tippning och markerar kortet.
- Dold adminvy finns via `?admin`. Den skyddas av en enkel kod och använder Supabase Edge Function `admin-results` för att spara resultat och räkna om poäng.
- Admin kan lägga in Sveriges matchresultat, gruppettor/grupptvåor, topp 3, löpande statistik och utslagsfråga.
- Statistikresultat kan sparas löpande, men genererar poäng först när `Slutgiltigt resultat` är markerat.
- Adminfunktionen sparar bara ifyllda resultat. Om ett tidigare sparat resultat töms i admin tas motsvarande rad bort från `tournament_results` vid nästa sparning.
- Nya inskick får automatiskt kategoriuppdelade poäng mot redan inlagda resultat.

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
- Resultat sparas i `tournament_results` och skrivs endast via Edge Function `admin-results`.
- Supabase CLI är initierat i projektet med `supabase/config.toml`.
- Gruppspelsval använder respektive grupps fyra lag, inte en global laglista.
- Förifylld Swish-app-länk är inte införd. En pålitlig lösning kräver Swish handel/API som skapar en payment request-token; med bara ett privat mobilnummer visas betalningsinfo manuellt. Kvittot har en enkel best-effort-länk med `swish://` för att öppna appen på mobil.
- Dubbla e-postadresser stoppas med Supabase-triggern `prevent_duplicate_participant_email_before_insert`, eftersom databasen redan kan innehålla testdubletter och en unik indexmigration därför inte är lämplig just nu.
- Extra frågor sparas i `predictions.tournament_questions` och utslagsfrågan i `predictions.tie_breaker`, båda som JSONB och exponerade via `public_predictions`.
- Kategoriuppdelade poäng lagras i `prediction_scores`: `sweden_points`, `group_points`, `podium_points`, `statistics_points`, genererad `total_points` och `tie_breaker_distance`.
- Nya predictions får automatiskt en score-rad via triggern `create_prediction_score_after_insert`, och score-raden räknas mot redan inlagda resultat direkt vid insert.
- Supabase timestamps lagras i UTC. Appen ska formatera tider för svensk visning där det behövs, inte ändra databasens timezone.

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
- `prediction_scores` lades till som grund för kategoriuppdelad poängliga.
- Adminvy och Edge Function för resultatinmatning lades till. Funktionen räknar om `prediction_scores` vid sparning.
- Server-side score-funktioner i Postgres lades till så nya testinskick får poäng automatiskt även om resultat redan är inlagda.
- Statistikvyn lades till med CSS-baserade staplar och sammanfattning direkt från `public_predictions`.

Poängförslag som gäller tills vidare:

- Sveriges matcher: 3 poäng för exakt resultat, 1 poäng för rätt tecken.
- Gruppspel: 1 poäng för rätt gruppetta och 1 poäng för rätt grupptvåa. Om deltagaren har med båda lagen som går vidare men placerar dem omvänt, ges 1 poäng totalt för gruppen.
- Topp 3: 5 poäng för rätt världsmästare, 3 poäng för rätt tvåa, 2 poäng för rätt trea.
- Turneringsfrågor: gula kort och totalt antal mål ger 3 poäng inom 3%, 2 poäng inom 5% och 1 poäng inom 10% från utfallet. Röda kort ger 3 poäng inom 1 kort, 2 poäng inom 2 kort och 1 poäng inom 3 kort.

## 5. Arbetsprinciper

Arbetet ska följa projektets angivna principer:

- Kommunicera på svenska.
- Håll lösningen pragmatisk och undvik överengineering.
- Prioritera läsbar, ren och produktionsredo kod.
- Använd vanliga, välstödda mönster och minimera onödiga beroenden.
- Bygg responsivt och mobile-first.
- Håll UI:t modernt, rent och lättläst med DM Sans som primär typografi.
- Uppdatera denna kontextfil löpande när beslut, arkitektur eller status förändras.
- Kör aldrig destruktiv datarensning i Supabase utan verifierad read-only kontroll, backup/arkivering och uttrycklig bekräftelse efter att kandidatlistan visats. Data cleanup ska inte ske via migrationer; följ `docs/data-safety.md`.

## 6. Nästa steg

Prioriterade nästa steg:

- Testa adminflödet med riktiga inskick och verifiera poängreglerna mot exempeldata.
- Återinföra obligatorisk validering innan appen används skarpt.
- Utvärdera om adminflödet ska byggas som enkel skyddad sida eller hanteras direkt i Supabase initialt.

Pågående arbete:

- Verifiera första appversionen med riktig Supabase-sparning genom att skicka in ett testtips i UI:t.
