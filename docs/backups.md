# Backups

Tävlingsdata ska säkerhetskopieras löpande när skarpa inskick börjar komma in.

## Manuell backup

Kör:

```sh
npm run backup:supabase
```

Scriptet kräver:

- `VITE_SUPABASE_URL` eller `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Nycklarna kan ligga i `.env.local` lokalt eller skickas in som miljövariabler. Service role-nyckeln får inte checkas in.

Backupen sparas som tidsstämplad JSON i `backups/`, som är git-ignorerad.

## Innehåll

Exporten är read-only och innehåller:

- `participants`, inklusive kontaktuppgifter.
- `predictions`, inklusive alla tippningar.
- `prediction_scores`, inklusive poäng.
- `tournament_results`, inklusive inlagda resultat.
- `public_predictions`, som kontrollvy av den publika datan.

Filerna kan innehålla personuppgifter och ska hanteras varsamt.

## Rekommenderad rutin

- Kör backup efter varje större våg av inskick.
- Kör backup innan ändringar i Supabase, migrationer eller adminresultat.
- Spara gärna en kopia på en annan plats än projektmappen, till exempel i en privat molnmapp.
- Radera inte skarp data utan att följa `docs/data-safety.md`.
