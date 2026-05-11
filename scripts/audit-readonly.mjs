import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [key, ...valueParts] = line.split("=");
      return [key, valueParts.join("=")];
    }),
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const adminTestCode = process.env.ADMIN_TEST_CODE;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY saknas i .env.local");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check(name, action, expectation) {
  try {
    const result = await action();
    console.log(JSON.stringify({ name, result, expectation }));
  } catch (error) {
    console.log(
      JSON.stringify({
        name,
        result: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
        expectation,
      }),
    );
  }
}

await check(
  "public_predictions is readable",
  async () => {
    const { count, error } = await supabase
      .from("public_predictions")
      .select("id,initials,points", { count: "exact", head: true });

    return { ok: !error, count, error: error?.message ?? null };
  },
  "ok=true, count available",
);

await check(
  "tournament_results is readable",
  async () => {
    const { count, error } = await supabase
      .from("tournament_results")
      .select("result_type,result_key", { count: "exact", head: true });

    return { ok: !error, count, error: error?.message ?? null };
  },
  "ok=true, count available",
);

await check(
  "participants is not publicly readable",
  async () => {
    const { data, error } = await supabase.from("participants").select("email").limit(1);

    return { ok: Boolean(error), rows: data?.length ?? 0, error: error?.message ?? null };
  },
  "ok=true because RLS should reject the select",
);

await check(
  "predictions is not publicly readable",
  async () => {
    const { data, error } = await supabase.from("predictions").select("id").limit(1);

    return { ok: Boolean(error), rows: data?.length ?? 0, error: error?.message ?? null };
  },
  "ok=true because RLS should reject the select",
);

await check(
  "admin function rejects wrong code",
  async () => {
    const { data, error } = await supabase.functions.invoke("admin-results", {
      body: {
        action: "load",
        code: "definitely-wrong",
      },
    });

    return {
      ok: Boolean(error),
      status: error?.context?.status ?? null,
      data,
      error: error?.message ?? null,
    };
  },
  "ok=true because wrong code should be rejected",
);

await check(
  "submit rpc rejects invalid payload without inserting",
  async () => {
    const { data, error } = await supabase.rpc("submit_prediction", {
      contact_payload: {},
      prediction_payload: {},
    });

    return {
      ok: Boolean(error),
      data,
      error: error?.message ?? null,
    };
  },
  "ok=true because invalid payload should be rejected",
);

if (adminTestCode) {
  await check(
    "admin function accepts configured code for load",
    async () => {
      const { data, error } = await supabase.functions.invoke("admin-results", {
        body: {
          action: "load",
          code: adminTestCode,
        },
      });

      return {
        ok: !error,
        resultCount: data?.results?.length ?? null,
        error: error?.message ?? null,
      };
    },
    "ok=true, read-only load only",
  );
}
