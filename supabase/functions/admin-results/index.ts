import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type MatchResult = {
  id: string;
  homeGoals: number | "";
  awayGoals: number | "";
};

type GroupResult = {
  group: string;
  winner: string;
  runnerUp: string;
};

type PodiumResult = {
  champion: string;
  runnerUp: string;
  thirdPlace: string;
};

type StatisticsResult = {
  yellowCards: number | "";
  redCards: number | "";
  totalGoals: number | "";
  isFinal: boolean;
};

type TieBreakerResult = {
  finalFirstGoalMinute: number | "";
};

type AdminResults = {
  swedenMatches: MatchResult[];
  groups: GroupResult[];
  podium: PodiumResult;
  statistics: StatisticsResult;
  tieBreaker: TieBreakerResult;
};

type AdminAction = "load" | "save" | "load_messages" | "set_message_visibility";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function matchSign(homeGoals: number, awayGoals: number) {
  if (homeGoals > awayGoals) return "1";
  if (homeGoals < awayGoals) return "2";
  return "X";
}

function scoreSwedenMatches(predictionMatches: MatchResult[], resultMatches: MatchResult[]) {
  return predictionMatches.reduce((sum, predictionMatch) => {
    const resultMatch = resultMatches.find((match) => match.id === predictionMatch.id);
    const predictedHome = toNumber(predictionMatch.homeGoals);
    const predictedAway = toNumber(predictionMatch.awayGoals);
    const actualHome = toNumber(resultMatch?.homeGoals);
    const actualAway = toNumber(resultMatch?.awayGoals);

    if (
      predictedHome === null ||
      predictedAway === null ||
      actualHome === null ||
      actualAway === null
    ) {
      return sum;
    }

    if (predictedHome === actualHome && predictedAway === actualAway) {
      return sum + 3;
    }

    if (matchSign(predictedHome, predictedAway) === matchSign(actualHome, actualAway)) {
      return sum + 1;
    }

    return sum;
  }, 0);
}

function scoreGroups(predictionGroups: GroupResult[], resultGroups: GroupResult[]) {
  return predictionGroups.reduce((sum, predictionGroup) => {
    const resultGroup = resultGroups.find((group) => group.group === predictionGroup.group);

    if (!resultGroup?.winner || !resultGroup.runnerUp) {
      return sum;
    }

    const winnerCorrect = predictionGroup.winner === resultGroup.winner;
    const runnerUpCorrect = predictionGroup.runnerUp === resultGroup.runnerUp;
    const swapped =
      predictionGroup.winner === resultGroup.runnerUp &&
      predictionGroup.runnerUp === resultGroup.winner;

    if (winnerCorrect || runnerUpCorrect) {
      return sum + Number(winnerCorrect) + Number(runnerUpCorrect);
    }

    return swapped ? sum + 1 : sum;
  }, 0);
}

function scorePodium(predictionPodium: PodiumResult, resultPodium: PodiumResult) {
  let points = 0;

  if (predictionPodium.champion && predictionPodium.champion === resultPodium.champion) {
    points += 5;
  }

  if (predictionPodium.runnerUp && predictionPodium.runnerUp === resultPodium.runnerUp) {
    points += 3;
  }

  if (predictionPodium.thirdPlace && predictionPodium.thirdPlace === resultPodium.thirdPlace) {
    points += 2;
  }

  return points;
}

function percentagePoints(predicted: unknown, actual: unknown) {
  const predictedNumber = toNumber(predicted);
  const actualNumber = toNumber(actual);

  if (predictedNumber === null || actualNumber === null || actualNumber === 0) {
    return 0;
  }

  const percentageDifference = (Math.abs(predictedNumber - actualNumber) / actualNumber) * 100;

  if (percentageDifference <= 3) return 3;
  if (percentageDifference <= 5) return 2;
  if (percentageDifference <= 10) return 1;
  return 0;
}

function redCardPoints(predicted: unknown, actual: unknown) {
  const predictedNumber = toNumber(predicted);
  const actualNumber = toNumber(actual);

  if (predictedNumber === null || actualNumber === null) {
    return 0;
  }

  const difference = Math.abs(predictedNumber - actualNumber);

  if (difference <= 1) return 3;
  if (difference <= 2) return 2;
  if (difference <= 3) return 1;
  return 0;
}

function scoreStatistics(prediction: StatisticsResult, result: StatisticsResult) {
  if (!result.isFinal) {
    return 0;
  }

  return (
    percentagePoints(prediction.yellowCards, result.yellowCards) +
    redCardPoints(prediction.redCards, result.redCards) +
    percentagePoints(prediction.totalGoals, result.totalGoals)
  );
}

function getTieBreakerDistance(prediction: TieBreakerResult, result: TieBreakerResult) {
  const predictedMinute = toNumber(prediction.finalFirstGoalMinute);
  const actualMinute = toNumber(result.finalFirstGoalMinute);

  if (predictedMinute === null || actualMinute === null) {
    return null;
  }

  return Math.abs(predictedMinute - actualMinute);
}

async function upsertResult(
  supabase: ReturnType<typeof createClient>,
  resultType: string,
  resultKey: string,
  resultPayload: unknown,
) {
  const { error } = await supabase.from("tournament_results").upsert(
    {
      result_type: resultType,
      result_key: resultKey,
      result_payload: resultPayload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "result_type,result_key" },
  );

  if (error) {
    throw error;
  }
}

async function deleteResult(
  supabase: ReturnType<typeof createClient>,
  resultType: string,
  resultKey: string,
) {
  const { error } = await supabase
    .from("tournament_results")
    .delete()
    .eq("result_type", resultType)
    .eq("result_key", resultKey);

  if (error) {
    throw error;
  }
}

async function saveOrDeleteResult(
  supabase: ReturnType<typeof createClient>,
  resultType: string,
  resultKey: string,
  resultPayload: unknown,
  shouldSave: boolean,
) {
  if (shouldSave) {
    await upsertResult(supabase, resultType, resultKey, resultPayload);
    return;
  }

  await deleteResult(supabase, resultType, resultKey);
}

function hasCompleteMatchResult(match: MatchResult) {
  return toNumber(match.homeGoals) !== null && toNumber(match.awayGoals) !== null;
}

function hasCompleteGroupResult(group: GroupResult) {
  return Boolean(group.winner && group.runnerUp);
}

function hasCompletePodiumResult(podium: PodiumResult) {
  return Boolean(podium.champion && podium.runnerUp && podium.thirdPlace);
}

function hasAnyStatisticsResult(statistics: StatisticsResult) {
  return (
    toNumber(statistics.yellowCards) !== null ||
    toNumber(statistics.redCards) !== null ||
    toNumber(statistics.totalGoals) !== null ||
    statistics.isFinal
  );
}

function hasTieBreakerResult(tieBreaker: TieBreakerResult) {
  return toNumber(tieBreaker.finalFirstGoalMinute) !== null;
}

async function saveResults(supabase: ReturnType<typeof createClient>, results: AdminResults) {
  for (const match of results.swedenMatches) {
    await saveOrDeleteResult(
      supabase,
      "sweden_match",
      match.id,
      match,
      hasCompleteMatchResult(match),
    );
  }

  for (const group of results.groups) {
    await saveOrDeleteResult(
      supabase,
      "group",
      group.group,
      group,
      hasCompleteGroupResult(group),
    );
  }

  await saveOrDeleteResult(
    supabase,
    "podium",
    "final",
    results.podium,
    hasCompletePodiumResult(results.podium),
  );
  await saveOrDeleteResult(
    supabase,
    "statistics",
    "totals",
    results.statistics,
    hasAnyStatisticsResult(results.statistics),
  );
  await saveOrDeleteResult(
    supabase,
    "tie_breaker",
    "final_first_goal",
    results.tieBreaker,
    hasTieBreakerResult(results.tieBreaker),
  );
}

async function loadResults(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("tournament_results")
    .select("result_type,result_key,result_payload");

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadMessageBoardPosts(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("message_board_posts")
    .select("id,display_name,message,created_at,is_hidden")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function setMessageBoardPostVisibility(
  supabase: ReturnType<typeof createClient>,
  messageId: unknown,
  isHidden: unknown,
) {
  if (typeof messageId !== "string" || !messageId) {
    throw new Error("Message id is required");
  }

  if (typeof isHidden !== "boolean") {
    throw new Error("Message visibility is required");
  }

  const { error } = await supabase
    .from("message_board_posts")
    .update({ is_hidden: isHidden })
    .eq("id", messageId);

  if (error) {
    throw error;
  }
}

async function recalculateScores(supabase: ReturnType<typeof createClient>, results: AdminResults) {
  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("id,sweden_matches,group_predictions,podium,tournament_questions,tie_breaker");

  if (error) {
    throw error;
  }

  const scoreRows = (predictions ?? []).map((prediction) => ({
    prediction_id: prediction.id,
    sweden_points: scoreSwedenMatches(prediction.sweden_matches ?? [], results.swedenMatches),
    group_points: scoreGroups(prediction.group_predictions ?? [], results.groups),
    podium_points: scorePodium(prediction.podium ?? {}, results.podium),
    statistics_points: scoreStatistics(
      prediction.tournament_questions ?? {},
      results.statistics,
    ),
    tie_breaker_distance: getTieBreakerDistance(
      prediction.tie_breaker ?? {},
      results.tieBreaker,
    ),
    updated_at: new Date().toISOString(),
  }));

  if (scoreRows.length === 0) {
    return;
  }

  const { error: scoreError } = await supabase
    .from("prediction_scores")
    .upsert(scoreRows, { onConflict: "prediction_id" });

  if (scoreError) {
    throw scoreError;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminCode = Deno.env.get("ADMIN_CODE");

  if (!supabaseUrl || !serviceRoleKey || !adminCode) {
    return jsonResponse({ error: "Admin function is not configured" }, 500);
  }

  const body = await request.json().catch(() => null);

  if (!body || body.code !== adminCode) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const action = body.action as AdminAction;

    if (action === "load") {
      const results = await loadResults(supabase);
      return jsonResponse({ results });
    }

    if (action === "save") {
      await saveResults(supabase, body.results);
      await recalculateScores(supabase, body.results);
      return jsonResponse({ ok: true });
    }

    if (action === "load_messages") {
      const messages = await loadMessageBoardPosts(supabase);
      return jsonResponse({ messages });
    }

    if (action === "set_message_visibility") {
      await setMessageBoardPostVisibility(supabase, body.messageId, body.isHidden);
      const messages = await loadMessageBoardPosts(supabase);
      return jsonResponse({ messages });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Admin operation failed" }, 500);
  }
});
