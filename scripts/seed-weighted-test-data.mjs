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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY saknas i .env.local");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const groupTeams = {
  A: ["Mexiko", "Sydkorea", "Sydafrika", "Tjeckien"],
  B: ["Kanada", "Schweiz", "Qatar", "Bosnien och Hercegovina"],
  C: ["Brasilien", "Marocko", "Skottland", "Haiti"],
  D: ["USA", "Australien", "Paraguay", "Turkiet"],
  E: ["Tyskland", "Ecuador", "Elfenbenskusten", "Curaçao"],
  F: ["Nederländerna", "Japan", "Tunisien", "Sverige"],
  G: ["Belgien", "Iran", "Egypten", "Nya Zeeland"],
  H: ["Spanien", "Uruguay", "Saudiarabien", "Kap Verde"],
  I: ["Frankrike", "Senegal", "Norge", "Irak"],
  J: ["Argentina", "Österrike", "Algeriet", "Jordanien"],
  K: ["Portugal", "Colombia", "Uzbekistan", "DR Kongo"],
  L: ["England", "Kroatien", "Panama", "Ghana"],
};

const favoritePairs = {
  A: [["Mexiko", "Sydkorea"], ["Mexiko", "Tjeckien"], ["Sydkorea", "Mexiko"]],
  B: [["Kanada", "Schweiz"], ["Schweiz", "Kanada"], ["Kanada", "Bosnien och Hercegovina"]],
  C: [["Brasilien", "Marocko"], ["Brasilien", "Skottland"], ["Marocko", "Brasilien"]],
  D: [["USA", "Australien"], ["USA", "Paraguay"], ["Australien", "USA"]],
  E: [["Tyskland", "Ecuador"], ["Tyskland", "Elfenbenskusten"], ["Ecuador", "Tyskland"]],
  F: [["Nederländerna", "Sverige"], ["Nederländerna", "Japan"], ["Sverige", "Nederländerna"]],
  G: [["Belgien", "Egypten"], ["Belgien", "Iran"], ["Egypten", "Belgien"]],
  H: [["Spanien", "Uruguay"], ["Spanien", "Saudiarabien"], ["Uruguay", "Spanien"]],
  I: [["Frankrike", "Norge"], ["Frankrike", "Senegal"], ["Norge", "Frankrike"]],
  J: [["Argentina", "Österrike"], ["Argentina", "Algeriet"], ["Österrike", "Argentina"]],
  K: [["Portugal", "Colombia"], ["Portugal", "Uzbekistan"], ["Colombia", "Portugal"]],
  L: [["England", "Kroatien"], ["England", "Ghana"], ["Kroatien", "England"]],
};

const swedenScoreSets = [
  [[2, 0], [2, 1], [1, 1]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 1], [2, 2], [1, 1]],
  [[3, 1], [1, 2], [0, 1]],
  [[1, 1], [2, 1], [2, 2]],
];

const podiumSets = [
  ["Frankrike", "Brasilien", "Spanien"],
  ["Brasilien", "Frankrike", "Argentina"],
  ["Argentina", "Frankrike", "England"],
  ["Spanien", "Brasilien", "Frankrike"],
  ["England", "Frankrike", "Portugal"],
  ["Portugal", "Argentina", "Brasilien"],
  ["Tyskland", "Spanien", "Brasilien"],
];

const names = [
  ["Albin", "Sundberg"],
  ["Beatrice", "Holm"],
  ["Carl", "Lind"],
  ["Diana", "Berg"],
  ["Elias", "Nygren"],
  ["Frida", "Ek"],
  ["Gabriel", "Lund"],
  ["Hanna", "Björk"],
  ["Isak", "Fors"],
  ["Julia", "Vik"],
  ["Klara", "Sjö"],
  ["Lukas", "Dahl"],
  ["Maja", "Strand"],
  ["Nils", "Hed"],
  ["Olivia", "Nor"],
  ["Petter", "Wall"],
  ["Qarin", "Roos"],
  ["Rasmus", "Sand"],
  ["Sara", "Lindell"],
  ["Theo", "Gran"],
];

function createSwedenMatches(index) {
  const scores = swedenScoreSets[index % swedenScoreSets.length];
  return [
    {
      id: "sweden-match-1",
      label: "15 juni 04.00",
      homeTeam: "Sverige",
      awayTeam: "Tunisien",
      kickoff: "2026-06-15T04:00:00+02:00",
      venue: "Estadio BBVA, Monterrey",
      homeGoals: scores[0][0],
      awayGoals: scores[0][1],
    },
    {
      id: "sweden-match-2",
      label: "21 juni 19.00",
      homeTeam: "Nederländerna",
      awayTeam: "Sverige",
      kickoff: "2026-06-21T19:00:00+02:00",
      venue: "NRG Stadium, Houston",
      homeGoals: scores[1][0],
      awayGoals: scores[1][1],
    },
    {
      id: "sweden-match-3",
      label: "26 juni 01.00",
      homeTeam: "Japan",
      awayTeam: "Sverige",
      kickoff: "2026-06-26T01:00:00+02:00",
      venue: "AT&T Stadium, Dallas",
      homeGoals: scores[2][0],
      awayGoals: scores[2][1],
    },
  ];
}

function createGroups(index) {
  return Object.entries(groupTeams).map(([group, teams], groupIndex) => {
    const commonPairs = favoritePairs[group];
    const pair =
      index % 10 === groupIndex % 10
        ? [teams[2], teams[0]]
        : commonPairs[(index + groupIndex) % commonPairs.length];

    return {
      group,
      winner: pair[0],
      runnerUp: pair[1],
    };
  });
}

function createQuestions(index) {
  return {
    yellowCards: 330 + ((index * 11) % 95),
    redCards: 15 + ((index * 3) % 14),
    totalGoals: 150 + ((index * 7) % 48),
  };
}

function createTieBreaker(index) {
  return {
    finalFirstGoalMinute: 8 + ((index * 5) % 73),
  };
}

const batchId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const insertedIds = [];

for (let index = 0; index < names.length; index += 1) {
  const [firstName, lastName] = names[index];
  const participantId = crypto.randomUUID();
  const predictionId = crypto.randomUUID();
  const podium = podiumSets[index % podiumSets.length];

  const { error: participantError } = await supabase.from("participants").insert({
    id: participantId,
    first_name: firstName,
    last_name: lastName,
    phone: `070-555 ${String(1000 + index).slice(0, 2)} ${String(1000 + index).slice(2)}`,
    email: `weighted-${batchId}-${index + 1}@example.com`,
  });

  if (participantError) {
    throw new Error(`Kunde inte skapa deltagare ${index + 1}: ${participantError.message}`);
  }

  const { error: predictionError } = await supabase.from("predictions").insert({
    id: predictionId,
    participant_id: participantId,
    sweden_matches: createSwedenMatches(index),
    group_predictions: createGroups(index),
    podium: {
      champion: podium[0],
      runnerUp: podium[1],
      thirdPlace: podium[2],
    },
    tournament_questions: createQuestions(index),
    tie_breaker: createTieBreaker(index),
  });

  if (predictionError) {
    throw new Error(`Kunde inte skapa tips ${index + 1}: ${predictionError.message}`);
  }

  insertedIds.push(predictionId);
}

console.log(`Skapade ${insertedIds.length} viktade testinskick.`);
console.log(insertedIds.join("\n"));
