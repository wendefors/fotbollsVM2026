import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const [key, ...valueParts] = line.split("=");
          return [key, valueParts.join("=")];
        }),
    );
  } catch (error) {
    return {};
  }
}

const localEnv = loadLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL ?? localEnv.SUPABASE_URL ?? localEnv.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL/VITE_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY krävs. Lägg service role-nyckeln i miljön eller lokalt i .env.local.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const tables = [
  "participants",
  "predictions",
  "prediction_scores",
  "tournament_results",
  "public_predictions",
];

async function fetchAllRows(table) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, to);

    if (error) {
      throw new Error(`Kunde inte exportera ${table}: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

const createdAt = new Date();
const timestamp = createdAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const backup = {
  metadata: {
    createdAt: createdAt.toISOString(),
    source: supabaseUrl,
    tables,
    note: "Read-only export av tävlingsdata. Filen kan innehålla personuppgifter och ska inte versioneras.",
  },
  data: {},
  counts: {},
};

for (const table of tables) {
  const rows = await fetchAllRows(table);
  backup.data[table] = rows;
  backup.counts[table] = rows.length;
}

mkdirSync("backups", { recursive: true });
const filePath = `backups/supabase-backup-${timestamp}.json`;
writeFileSync(`${filePath}.tmp`, `${JSON.stringify(backup, null, 2)}\n`);
renameSync(`${filePath}.tmp`, filePath);

console.log(`Backup skapad: ${filePath}`);
console.log(JSON.stringify(backup.counts, null, 2));
