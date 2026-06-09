import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Eye,
  BarChart3,
  Medal,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  SquareStack,
  Star,
  Table2,
  Trophy,
} from "lucide-react";
import {
  groupTeams,
  groups,
  initialSwedenMatches,
  scoreRules,
  submissionDeadline,
  teams,
} from "./data/tournament";
import { createId } from "./lib/id";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { GroupPrediction, PredictionForm, PublicPrediction } from "./lib/types";

type View = "submit" | "receipt" | "predictions" | "standings" | "statistics" | "messages";
type PredictionFilter =
  | "all"
  | "sweden"
  | "groups"
  | "podium"
  | "questions";
type PredictionLoadState = "idle" | "loading" | "loaded" | "error";
type MessageBoardLoadState = "idle" | "loading" | "loaded" | "error";
type MessageBoardPost = {
  id: string;
  displayName: string;
  message: string;
  createdAt: string;
};
type MessageBoardForm = {
  displayName: string;
  message: string;
};
type LiveTournamentStats = {
  yellowCards: number | "";
  redCards: number | "";
  totalGoals: number | "";
  updatedAt: string | null;
};
type PersistedAppState = {
  version: 1;
  view: View;
  form: PredictionForm;
  receipt: PublicPrediction | null;
};

type AdminResults = {
  swedenMatches: Array<{
    id: string;
    label: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number | "";
    awayGoals: number | "";
  }>;
  groups: Array<{
    group: GroupPrediction["group"];
    winner: string;
    runnerUp: string;
  }>;
  podium: {
    champion: string;
    runnerUp: string;
    thirdPlace: string;
  };
  statistics: {
    yellowCards: number | "";
    redCards: number | "";
    totalGoals: number | "";
    isFinal: boolean;
  };
  tieBreaker: {
    finalFirstGoalMinute: number | "";
  };
};
type AdminViewTab = "results" | "messages";
type AdminMessageBoardPost = MessageBoardPost & {
  isHidden: boolean;
};

const predictionFilters: Array<{ id: PredictionFilter; label: string }> = [
  { id: "all", label: "Totalt" },
  { id: "sweden", label: "Sverige" },
  { id: "groups", label: "Gruppspel" },
  { id: "podium", label: "Topp 3" },
  { id: "questions", label: "Statistik" },
];
const messageBoardPageSize = 25;

const formatDateOnly = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function getFilteredPoints(prediction: PublicPrediction, filter: PredictionFilter) {
  if (filter === "sweden") {
    return prediction.swedenPoints;
  }

  if (filter === "groups") {
    return prediction.groupPoints;
  }

  if (filter === "podium") {
    return prediction.podiumPoints;
  }

  if (filter === "questions") {
    return prediction.statisticsPoints;
  }

  return prediction.points;
}

function toNumericFormValue(value: string) {
  if (value === "") {
    return "";
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function isWholeNumber(value: number | ""): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateSubmission(form: PredictionForm) {
  const contactFields = [
    form.contact.firstName,
    form.contact.lastName,
    form.contact.phone,
    form.contact.email,
  ];

  if (contactFields.some((value) => value.trim() === "")) {
    return "Fyll i alla kontaktuppgifter.";
  }

  if (!isValidEmail(form.contact.email)) {
    return "Ange en korrekt e-postadress.";
  }

  if (
    form.swedenMatches.some(
      (match) => !isWholeNumber(match.homeGoals) || !isWholeNumber(match.awayGoals),
    )
  ) {
    return "Fyll i resultat för alla Sveriges matcher med heltal.";
  }

  const incompleteGroup = form.groups.find(
    (group) => group.winner === "" || group.runnerUp === "",
  );

  if (incompleteGroup) {
    return `Välj både etta och tvåa i grupp ${incompleteGroup.group}.`;
  }

  if (!form.podium.champion || !form.podium.runnerUp || !form.podium.thirdPlace) {
    return "Fyll i hela topp 3.";
  }

  if (
    !isWholeNumber(form.tournamentQuestions.yellowCards) ||
    !isWholeNumber(form.tournamentQuestions.redCards) ||
    !isWholeNumber(form.tournamentQuestions.totalGoals)
  ) {
    return "Fyll i alla turneringsfrågor med heltal.";
  }

  const finalFirstGoalMinute = form.tieBreaker.finalFirstGoalMinute;

  if (!isWholeNumber(finalFirstGoalMinute) || finalFirstGoalMinute < 1) {
    return "Fyll i utslagsfrågan med en matchminut från 1 och uppåt.";
  }

  return null;
}

function formatPredictionScore(homeGoals: number | "", awayGoals: number | "") {
  if (homeGoals === "" || awayGoals === "") {
    return "";
  }

  return `${homeGoals}-${awayGoals}`;
}

function getMatchSign(homeGoals: number | "", awayGoals: number | "") {
  if (homeGoals === "" || awayGoals === "") {
    return "";
  }

  if (homeGoals > awayGoals) return "1";
  if (homeGoals < awayGoals) return "2";
  return "X";
}

function formatComparisonValue(value: string | number | "") {
  if (value === "") {
    return "Ej valt";
  }

  return String(value);
}

function countMatchingChoices(first: PublicPrediction, second: PublicPrediction) {
  let same = 0;
  let different = 0;

  for (const match of initialSwedenMatches) {
    const firstMatch = first.swedenMatches.find((item) => item.id === match.id);
    const secondMatch = second.swedenMatches.find((item) => item.id === match.id);
    const firstValue = formatPredictionScore(firstMatch?.homeGoals ?? "", firstMatch?.awayGoals ?? "");
    const secondValue = formatPredictionScore(
      secondMatch?.homeGoals ?? "",
      secondMatch?.awayGoals ?? "",
    );

    if (firstValue === secondValue) {
      same += 1;
    } else {
      different += 1;
    }
  }

  for (const group of groups) {
    const firstGroup = first.groups.find((item) => item.group === group);
    const secondGroup = second.groups.find((item) => item.group === group);
    const sameWinner = (firstGroup?.winner ?? "") === (secondGroup?.winner ?? "");
    const sameRunnerUp = (firstGroup?.runnerUp ?? "") === (secondGroup?.runnerUp ?? "");

    same += Number(sameWinner) + Number(sameRunnerUp);
    different += Number(!sameWinner) + Number(!sameRunnerUp);
  }

  const podiumFields: Array<keyof PublicPrediction["podium"]> = [
    "champion",
    "runnerUp",
    "thirdPlace",
  ];

  for (const field of podiumFields) {
    if (first.podium[field] === second.podium[field]) {
      same += 1;
    } else {
      different += 1;
    }
  }

  const questionFields: Array<keyof PublicPrediction["tournamentQuestions"]> = [
    "yellowCards",
    "redCards",
    "totalGoals",
  ];

  for (const field of questionFields) {
    if (first.tournamentQuestions[field] === second.tournamentQuestions[field]) {
      same += 1;
    } else {
      different += 1;
    }
  }

  if (first.tieBreaker.finalFirstGoalMinute === second.tieBreaker.finalFirstGoalMinute) {
    same += 1;
  } else {
    different += 1;
  }

  return { same, different };
}

function getRoundedPercentages(items: Array<{ count: number }>, total: number) {
  if (total === 0) {
    return items.map(() => 0);
  }

  const rawPercentages = items.map((item) => (item.count / total) * 100);
  const flooredPercentages = rawPercentages.map(Math.floor);
  let remainder = 100 - flooredPercentages.reduce((sum, value) => sum + value, 0);
  const indexesByRemainder = rawPercentages
    .map((percentage, index) => ({
      index,
      remainder: percentage - Math.floor(percentage),
    }))
    .sort((first, second) => second.remainder - first.remainder);
  const indexesToRoundUp = new Set(
    indexesByRemainder.slice(0, remainder).map((item) => item.index),
  );

  return flooredPercentages.map((percentage, index) => {
    if (indexesToRoundUp.has(index)) {
      return percentage + 1;
    }

    return percentage;
  });
}

function getTopCounts(values: string[], limit: number) {
  const counts = new Map<string, number>();
  const answeredValues = values.filter(Boolean);

  for (const value of answeredValues) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const sortedItems = [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
    }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "sv-SE"));

  return sortedItems.slice(0, limit).map((item) => ({
    ...item,
    percentage: answeredValues.length > 0
      ? Math.round((item.count / answeredValues.length) * 100)
      : 0,
  }));
}

function getCountsForLabels(values: string[], labels: string[]) {
  const counts = new Map(labels.map((label) => [label, 0]));
  const answeredValues = values.filter((value) => labels.includes(value));

  for (const value of answeredValues) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const items = labels.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));
  const percentages = getRoundedPercentages(items, answeredValues.length);

  return items.map((item, index) => ({
    ...item,
    percentage: percentages[index],
  }));
}

function getQuartile(values: number[], quartile: 1 | 3) {
  if (values.length === 0) {
    return null;
  }

  const position = (values.length - 1) * (quartile === 1 ? 0.25 : 0.75);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return values[lower];
  }

  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function getNumericSummary(values: Array<number | "">) {
  const numericValues = values
    .filter((value): value is number => typeof value === "number")
    .sort((first, second) => first - second);

  if (numericValues.length === 0) {
    return null;
  }

  const sum = numericValues.reduce((total, value) => total + value, 0);
  const middle = Math.floor(numericValues.length / 2);
  const median =
    numericValues.length % 2 === 0
      ? (numericValues[middle - 1] + numericValues[middle]) / 2
      : numericValues[middle];

  return {
    min: numericValues[0],
    max: numericValues[numericValues.length - 1],
    average: Math.round(sum / numericValues.length),
    median: Math.round(median),
    typicalRange: {
      from: Math.round(getQuartile(numericValues, 1) ?? numericValues[0]),
      to: Math.round(getQuartile(numericValues, 3) ?? numericValues[numericValues.length - 1]),
    },
  };
}

function getSwedenPointsFromPrediction(prediction: PublicPrediction) {
  return prediction.swedenMatches.reduce((points, match) => {
    if (match.homeGoals === "" || match.awayGoals === "") {
      return points;
    }

    const swedenGoals =
      match.homeTeam === "Sverige" ? match.homeGoals : match.awayGoals;
    const opponentGoals =
      match.homeTeam === "Sverige" ? match.awayGoals : match.homeGoals;

    if (swedenGoals > opponentGoals) {
      return points + 3;
    }

    if (swedenGoals === opponentGoals) {
      return points + 1;
    }

    return points;
  }, 0);
}

function getConsensusItems(predictions: PublicPrediction[]) {
  const items: Array<{
    label: string;
    topLabel: string;
    percentage: number;
  }> = [];

  function addItem(label: string, values: string[]) {
    const topItem = getTopCounts(values, 1)[0];

    if (!topItem) {
      return;
    }

    items.push({
      label,
      topLabel: topItem.label,
      percentage: topItem.percentage,
    });
  }

  for (const match of initialSwedenMatches) {
    addItem(
      `${match.homeTeam} - ${match.awayTeam}`,
      predictions.map((prediction) => {
        const predictionMatch = prediction.swedenMatches.find(
          (candidate) => candidate.id === match.id,
        );

        return predictionMatch
          ? formatPredictionScore(predictionMatch.homeGoals, predictionMatch.awayGoals)
          : "";
      }),
    );
  }

  for (const group of groups) {
    addItem(
      `Grupp ${group}, etta`,
      predictions.map(
        (prediction) =>
          prediction.groups.find((groupPrediction) => groupPrediction.group === group)
            ?.winner ?? "",
      ),
    );
    addItem(
      `Grupp ${group}, tvåa`,
      predictions.map(
        (prediction) =>
          prediction.groups.find((groupPrediction) => groupPrediction.group === group)
            ?.runnerUp ?? "",
      ),
    );
  }

  addItem(
    "Världsmästare",
    predictions.map((prediction) => prediction.podium.champion),
  );
  addItem(
    "Finaltvåa",
    predictions.map((prediction) => prediction.podium.runnerUp),
  );
  addItem(
    "Trea",
    predictions.map((prediction) => prediction.podium.thirdPlace),
  );

  return items;
}

const emptyGroups: GroupPrediction[] = groups.map((group) => ({
  group,
  winner: "",
  runnerUp: "",
}));

const initialAdminResults: AdminResults = {
  swedenMatches: initialSwedenMatches.map((match) => ({
    id: match.id,
    label: match.label,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeGoals: "",
    awayGoals: "",
  })),
  groups: emptyGroups,
  podium: {
    champion: "",
    runnerUp: "",
    thirdPlace: "",
  },
  statistics: {
    yellowCards: "",
    redCards: "",
    totalGoals: "",
    isFinal: false,
  },
  tieBreaker: {
    finalFirstGoalMinute: "",
  },
};

const initialForm: PredictionForm = {
  contact: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  },
  swedenMatches: initialSwedenMatches,
  groups: emptyGroups,
  podium: {
    champion: "",
    runnerUp: "",
    thirdPlace: "",
  },
  tournamentQuestions: {
    yellowCards: "",
    redCards: "",
    totalGoals: "",
  },
  tieBreaker: {
    finalFirstGoalMinute: "",
  },
};

const appStateStorageKey = "fotbollsvm2026.appState.v1";

function cloneInitialForm(): PredictionForm {
  return {
    contact: {
      ...initialForm.contact,
    },
    swedenMatches: initialForm.swedenMatches.map((match) => ({ ...match })),
    groups: initialForm.groups.map((group) => ({ ...group })),
    podium: {
      ...initialForm.podium,
    },
    tournamentQuestions: {
      ...initialForm.tournamentQuestions,
    },
    tieBreaker: {
      ...initialForm.tieBreaker,
    },
  };
}

function normalizeNumericValue(value: unknown): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function normalizePersistedForm(value: unknown): PredictionForm {
  const fallback = cloneInitialForm();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const form = value as Partial<PredictionForm>;
  const contact = form.contact ?? fallback.contact;
  const swedenMatches = Array.isArray(form.swedenMatches) ? form.swedenMatches : [];
  const persistedGroups = Array.isArray(form.groups) ? form.groups : [];

  return {
    contact: {
      firstName: typeof contact.firstName === "string" ? contact.firstName : "",
      lastName: typeof contact.lastName === "string" ? contact.lastName : "",
      phone: typeof contact.phone === "string" ? contact.phone : "",
      email: typeof contact.email === "string" ? contact.email : "",
    },
    swedenMatches: fallback.swedenMatches.map((match) => {
      const persistedMatch = swedenMatches.find((item) => item?.id === match.id);

      return {
        ...match,
        homeGoals: normalizeNumericValue(persistedMatch?.homeGoals),
        awayGoals: normalizeNumericValue(persistedMatch?.awayGoals),
      };
    }),
    groups: fallback.groups.map((group) => {
      const persistedGroup = persistedGroups.find((item) => item?.group === group.group);

      return {
        ...group,
        winner: typeof persistedGroup?.winner === "string" ? persistedGroup.winner : "",
        runnerUp: typeof persistedGroup?.runnerUp === "string" ? persistedGroup.runnerUp : "",
      };
    }),
    podium: {
      champion: typeof form.podium?.champion === "string" ? form.podium.champion : "",
      runnerUp: typeof form.podium?.runnerUp === "string" ? form.podium.runnerUp : "",
      thirdPlace: typeof form.podium?.thirdPlace === "string" ? form.podium.thirdPlace : "",
    },
    tournamentQuestions: {
      yellowCards: normalizeNumericValue(form.tournamentQuestions?.yellowCards),
      redCards: normalizeNumericValue(form.tournamentQuestions?.redCards),
      totalGoals: normalizeNumericValue(form.tournamentQuestions?.totalGoals),
    },
    tieBreaker: {
      finalFirstGoalMinute: normalizeNumericValue(form.tieBreaker?.finalFirstGoalMinute),
    },
  };
}

function loadPersistedAppState(): PersistedAppState | null {
  try {
    const rawState = window.localStorage.getItem(appStateStorageKey);

    if (!rawState) {
      return null;
    }

    const parsed = JSON.parse(rawState) as Partial<PersistedAppState>;

    if (parsed.version !== 1) {
      return null;
    }

    const view: View =
      parsed.view === "receipt" ||
      parsed.view === "predictions" ||
      parsed.view === "standings" ||
      parsed.view === "statistics" ||
      parsed.view === "messages"
        ? parsed.view
        : "submit";

    return {
      version: 1,
      view,
      form: normalizePersistedForm(parsed.form),
      receipt: parsed.receipt ?? null,
    };
  } catch (error) {
    return null;
  }
}

function savePersistedAppState(state: PersistedAppState) {
  try {
    window.localStorage.setItem(appStateStorageKey, JSON.stringify(state));
  } catch (error) {
    // localStorage can fail in private browsing or when storage is full.
  }
}

function clearPersistedAppState() {
  try {
    window.localStorage.removeItem(appStateStorageKey);
  } catch (error) {
    // Ignore localStorage failures; persistence is only a convenience.
  }
}

const formatDateTime = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getInitials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

function getScoreRuleIcon(label: string) {
  if (label === "Sveriges matcher") {
    return <ShieldCheck />;
  }

  if (label === "Gruppspel") {
    return <SquareStack />;
  }

  if (label === "Topp 3") {
    return <Medal />;
  }

  if (label === "Turneringsfrågor") {
    return <Star />;
  }

  return <CircleHelp />;
}

function mapPublicPrediction(prediction: Record<string, any>): PublicPrediction {
  return {
    id: prediction.id,
    initials: prediction.initials,
    submittedAt: prediction.created_at,
    swedenMatches: prediction.sweden_matches,
    groups: prediction.group_predictions,
    podium: prediction.podium,
    tournamentQuestions: prediction.tournament_questions,
    tieBreaker: prediction.tie_breaker,
    swedenPoints: prediction.sweden_points ?? 0,
    groupPoints: prediction.group_points ?? 0,
    podiumPoints: prediction.podium_points ?? 0,
    statisticsPoints: prediction.statistics_points ?? 0,
    points: prediction.points,
    tieBreakerDistance: prediction.tie_breaker_distance ?? null,
  };
}

function mapMessageBoardPost(post: Record<string, any>): MessageBoardPost {
  return {
    id: post.id,
    displayName: post.display_name?.trim() || "Anonym",
    message: post.message,
    createdAt: post.created_at,
  };
}

function validateMessageBoardPost(form: MessageBoardForm) {
  const displayName = form.displayName.trim();
  const message = form.message.trim();

  if (displayName.length > 40) {
    return "Namnet får vara max 40 tecken.";
  }

  if (!message) {
    return "Skriv ett meddelande.";
  }

  if (message.length > 300) {
    return "Meddelandet får vara max 300 tecken.";
  }

  return null;
}

async function waitForPublicPrediction(predictionId: string) {
  if (!supabase) {
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data } = await supabase
      .from("public_predictions")
      .select("*")
      .eq("id", predictionId)
      .maybeSingle();

    if (data) {
      return mapPublicPrediction(data);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return null;
}

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isAdminRoute = searchParams.has("admin");
  const isClosedPreview = import.meta.env.DEV && searchParams.get("preview") === "closed";
  const persistedState = useMemo(() => (isAdminRoute ? null : loadPersistedAppState()), [isAdminRoute]);
  const [view, setView] = useState<View>(() => persistedState?.view ?? "submit");
  const [form, setForm] = useState<PredictionForm>(() => persistedState?.form ?? cloneInitialForm());
  const [predictions, setPredictions] = useState<PublicPrediction[]>([]);
  const [predictionLoadState, setPredictionLoadState] = useState<PredictionLoadState>(
    isSupabaseConfigured ? "loading" : "loaded",
  );
  const [predictionLoadError, setPredictionLoadError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<PublicPrediction | null>(() => persistedState?.receipt ?? null);
  const [focusedPredictionId, setFocusedPredictionId] = useState<string | null>(null);
  const [liveTournamentStats, setLiveTournamentStats] = useState<LiveTournamentStats | null>(null);
  const [messageBoardPosts, setMessageBoardPosts] = useState<MessageBoardPost[]>([]);
  const [messageBoardForm, setMessageBoardForm] = useState<MessageBoardForm>({
    displayName: "",
    message: "",
  });
  const [messageBoardLoadState, setMessageBoardLoadState] = useState<MessageBoardLoadState>(
    isSupabaseConfigured ? "loading" : "loaded",
  );
  const [messageBoardLoadError, setMessageBoardLoadError] = useState("");
  const [messageBoardError, setMessageBoardError] = useState("");
  const [isPostingMessage, setIsPostingMessage] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const isSubmissionOpen =
    !isClosedPreview && currentTime <= submissionDeadline.getTime();

  const standings = useMemo(
    () => [...predictions].sort((a, b) => b.points - a.points),
    [predictions],
  );

  useEffect(() => {
    async function loadPredictions() {
      if (!supabase) {
        setPredictionLoadState("loaded");
        return;
      }

      setPredictionLoadState("loading");
      setPredictionLoadError("");

      const { data, error } = await supabase
        .from("public_predictions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
        setPredictions([]);
        setPredictionLoadState("error");
        setPredictionLoadError("Kunde inte hämta inskickade tips just nu.");
        return;
      }

      setPredictions(
        data.map((prediction) => ({
          id: prediction.id,
          initials: prediction.initials,
          submittedAt: prediction.created_at,
          swedenMatches: prediction.sweden_matches,
          groups: prediction.group_predictions,
          podium: prediction.podium,
          tournamentQuestions: prediction.tournament_questions,
          tieBreaker: prediction.tie_breaker,
          swedenPoints: prediction.sweden_points ?? 0,
          groupPoints: prediction.group_points ?? 0,
          podiumPoints: prediction.podium_points ?? 0,
          statisticsPoints: prediction.statistics_points ?? 0,
          points: prediction.points,
          tieBreakerDistance: prediction.tie_breaker_distance ?? null,
        })),
      );
      setPredictionLoadState("loaded");
    }

    void loadPredictions();
  }, []);

  useEffect(() => {
    async function loadLiveTournamentStats() {
      if (!supabase) {
        return;
      }

      const { data, error } = await supabase
        .from("tournament_results")
        .select("result_payload,updated_at")
        .eq("result_type", "statistics")
        .eq("result_key", "totals")
        .maybeSingle();

      if (error || !data) {
        setLiveTournamentStats(null);
        return;
      }

      setLiveTournamentStats({
        yellowCards: data.result_payload?.yellowCards ?? "",
        redCards: data.result_payload?.redCards ?? "",
        totalGoals: data.result_payload?.totalGoals ?? "",
        updatedAt: data.updated_at ?? null,
      });
    }

    void loadLiveTournamentStats();
  }, []);

  useEffect(() => {
    async function loadMessageBoardPosts() {
      if (!supabase) {
        setMessageBoardLoadState("loaded");
        return;
      }

      setMessageBoardLoadState("loading");
      setMessageBoardLoadError("");

      const { data, error } = await supabase
        .from("message_board_posts")
        .select("id,display_name,message,created_at")
        .order("created_at", { ascending: false })
        .limit(messageBoardPageSize + 1);

      if (error || !data) {
        setMessageBoardPosts([]);
        setMessageBoardLoadState("error");
        setMessageBoardLoadError("Kunde inte hämta meddelanden just nu.");
        return;
      }

      setHasOlderMessages(data.length > messageBoardPageSize);
      setMessageBoardPosts(
        data.slice(0, messageBoardPageSize).map(mapMessageBoardPost),
      );
      setMessageBoardLoadState("loaded");
    }

    void loadMessageBoardPosts();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    savePersistedAppState({
      version: 1,
      view,
      form,
      receipt,
    });
  }, [form, isAdminRoute, receipt, view]);

  useEffect(() => {
    if (
      isSubmissionOpen &&
      (view === "predictions" || view === "statistics" || view === "messages")
    ) {
      setView("standings");
      return;
    }

    if (!isSubmissionOpen && view === "submit") {
      setView("standings");
    }
  }, [isSubmissionOpen, view]);

  function updateContact(field: keyof PredictionForm["contact"], value: string) {
    setForm((current) => ({
      ...current,
      contact: {
        ...current.contact,
        [field]: value,
      },
    }));
  }

  function updateMatch(index: number, field: "homeGoals" | "awayGoals", value: string) {
    const numericValue = toNumericFormValue(value);

    if (numericValue === null) {
      return;
    }

    setForm((current) => ({
      ...current,
      swedenMatches: current.swedenMatches.map((match, matchIndex) =>
        matchIndex === index
          ? { ...match, [field]: numericValue }
          : match,
      ),
    }));
  }

  function updateGroup(index: number, field: "winner" | "runnerUp", value: string) {
    setForm((current) => ({
      ...current,
      groups: current.groups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, [field]: value } : group,
      ),
    }));
  }

  function updatePodium(field: keyof PredictionForm["podium"], value: string) {
    setForm((current) => ({
      ...current,
      podium: {
        ...current.podium,
        [field]: value,
      },
    }));
  }

  function updateTournamentQuestion(
    field: keyof PredictionForm["tournamentQuestions"],
    value: string,
  ) {
    const numericValue = toNumericFormValue(value);

    if (numericValue === null) {
      return;
    }

    setForm((current) => ({
      ...current,
      tournamentQuestions: {
        ...current.tournamentQuestions,
        [field]: numericValue,
      },
    }));
  }

  function updateTieBreaker(
    field: keyof PredictionForm["tieBreaker"],
    value: string,
  ) {
    const numericValue = toNumericFormValue(value);

    if (numericValue === null) {
      return;
    }

    setForm((current) => ({
      ...current,
      tieBreaker: {
        ...current.tieBreaker,
        [field]: numericValue,
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (!isSubmissionOpen) {
      setSubmitError("Tippningen är stängd.");
      return;
    }

    const validationError = validateSubmission(form);

    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (supabase) {
        const { data: predictionId, error: submitPredictionError } = await supabase.rpc(
          "submit_prediction",
          {
            contact_payload: {
              firstName: form.contact.firstName.trim(),
              lastName: form.contact.lastName.trim(),
              phone: form.contact.phone.trim(),
              email: form.contact.email.trim().toLowerCase(),
            },
            prediction_payload: {
              swedenMatches: form.swedenMatches,
              groups: form.groups,
              podium: form.podium,
              tournamentQuestions: form.tournamentQuestions,
              tieBreaker: form.tieBreaker,
            },
          },
        );

        if (submitPredictionError || !predictionId) {
          if (submitPredictionError?.code === "23505") {
            setSubmitError("Den e-postadressen har redan använts för ett inskick.");
            return;
          }

          setSubmitError("Kunde inte spara tippningen. Försök igen.");
          return;
        }

        const submittedPrediction = await waitForPublicPrediction(predictionId);

        if (!submittedPrediction) {
          setSubmitError(
            "Tipset sparades, men kvittot kunde inte hämtas. Öppna Samtliga tippningar och kontrollera att det syns där.",
          );
          return;
        }

        setPredictions((current) => [
          submittedPrediction,
          ...current,
        ]);
        setPredictionLoadState("loaded");
        setPredictionLoadError("");
        setReceipt(submittedPrediction);
      } else {
        const initials = getInitials(form.contact.firstName, form.contact.lastName) || "XX";
        const nextPrediction: PublicPrediction = {
          id: createId(),
          initials,
          submittedAt: new Date().toISOString(),
          swedenMatches: form.swedenMatches,
          groups: form.groups,
          podium: form.podium,
          tournamentQuestions: form.tournamentQuestions,
          tieBreaker: form.tieBreaker,
          swedenPoints: 0,
          groupPoints: 0,
          podiumPoints: 0,
          statisticsPoints: 0,
          points: 0,
          tieBreakerDistance: null,
        };

        setPredictions((current) => [nextPrediction, ...current]);
        setReceipt(nextPrediction);
      }

      setIsSubmitted(true);
      setForm(cloneInitialForm());
      clearPersistedAppState();
      setView("receipt");
    } catch (error) {
      console.error("Submit failed", error);
      setSubmitError("Något gick fel vid inskickningen. Kontrollera anslutningen och försök igen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToSubmitForm() {
    setSubmitError("");
    setIsSubmitted(false);
    setReceipt(null);
    setView("submit");
  }

  function focusPrediction(predictionId: string) {
    setFocusedPredictionId(predictionId);
    setView("predictions");
  }

  async function handleMessageBoardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageBoardError("");

    const validationError = validateMessageBoardPost(messageBoardForm);

    if (validationError) {
      setMessageBoardError(validationError);
      return;
    }

    if (isPostingMessage) {
      return;
    }

    const displayName = messageBoardForm.displayName.trim() || "Anonym";
    const message = messageBoardForm.message.trim();
    setIsPostingMessage(true);

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("message_board_posts")
          .insert({
            display_name: displayName,
            message,
          })
          .select("id,display_name,message,created_at")
          .single();

        if (error || !data) {
          setMessageBoardError("Kunde inte skicka meddelandet. Försök igen.");
          return;
        }

        setMessageBoardPosts((current) => [
          mapMessageBoardPost(data),
          ...current,
        ]);
      } else {
        const post: MessageBoardPost = {
          id: createId(),
          displayName,
          message,
          createdAt: new Date().toISOString(),
        };

        setMessageBoardPosts((current) => [post, ...current]);
      }

      setMessageBoardForm((current) => ({
        ...current,
        message: "",
      }));
      setMessageBoardLoadState("loaded");
    } catch (error) {
      console.error("Message post failed", error);
      setMessageBoardError("Något gick fel när meddelandet skulle skickas.");
    } finally {
      setIsPostingMessage(false);
    }
  }

  async function loadOlderMessageBoardPosts() {
    if (!supabase || isLoadingOlderMessages || !hasOlderMessages) {
      return;
    }

    const oldestPost = messageBoardPosts[messageBoardPosts.length - 1];

    if (!oldestPost) {
      return;
    }

    setMessageBoardLoadError("");
    setIsLoadingOlderMessages(true);

    try {
      const { data, error } = await supabase
        .from("message_board_posts")
        .select("id,display_name,message,created_at")
        .lt("created_at", oldestPost.createdAt)
        .order("created_at", { ascending: false })
        .limit(messageBoardPageSize + 1);

      if (error || !data) {
        setMessageBoardLoadError("Kunde inte hämta äldre meddelanden just nu.");
        return;
      }

      setHasOlderMessages(data.length > messageBoardPageSize);
      setMessageBoardPosts((current) => [
        ...current,
        ...data.slice(0, messageBoardPageSize).map(mapMessageBoardPost),
      ]);
    } catch (error) {
      console.error("Older messages load failed", error);
      setMessageBoardLoadError("Kunde inte hämta äldre meddelanden just nu.");
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  if (isAdminRoute) {
    return (
      <main className="app-shell">
        <AdminView />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Fotbolls-VM 2026</p>
          <h1>VM-tipset</h1>
          <p className="hero-copy">
            Skicka in ditt tips, jämför med resten av deltagarna och följ poängligan
            under turneringen.
          </p>
        </div>

        <div className="hero-panels">
          {isSubmissionOpen && (
            <div className="deadline-panel">
              <CalendarClock aria-hidden="true" />
              <span>Tippningen stänger</span>
              <strong>{formatDateTime.format(submissionDeadline)}</strong>
            </div>
          )}

          <div className="deadline-panel">
            <SquareStack aria-hidden="true" />
            <span>
              {isSubmissionOpen
                ? "Inskickade tips just nu"
                : "Antal tippare i tävlingen"}
            </span>
            <strong>{predictions.length}</strong>
          </div>

          {!isSubmissionOpen && (
            <div className="deadline-panel live-stats-panel">
              <BarChart3 aria-hidden="true" />
              <span>Statistik</span>
              <div className="live-stat-grid">
                <div>
                  <strong>{liveTournamentStats?.yellowCards ?? "-"}</strong>
                  <small>Gula</small>
                </div>
                <div>
                  <strong>{liveTournamentStats?.redCards ?? "-"}</strong>
                  <small>Röda</small>
                </div>
                <div>
                  <strong>{liveTournamentStats?.totalGoals ?? "-"}</strong>
                  <small>Mål</small>
                </div>
              </div>
              {liveTournamentStats?.updatedAt && (
                <small className="updated-at-text">
                  Uppdaterad {formatDateOnly.format(new Date(liveTournamentStats.updatedAt))}
                </small>
              )}
            </div>
          )}
        </div>
      </section>

      <nav className="tabs" aria-label="Huvudvyer">
        {isSubmissionOpen && (
          <button
            className={view === "submit" ? "active" : ""}
            type="button"
            onClick={() => setView("submit")}
          >
            <Send aria-hidden="true" />
            <span>Skicka in</span>
          </button>
        )}
        {!isSubmissionOpen && (
          <button
            className={view === "predictions" ? "active" : ""}
            type="button"
            onClick={() => setView("predictions")}
          >
            <Eye aria-hidden="true" />
            <span className="desktop-label">Samtliga tippningar</span>
            <span className="mobile-label">Tips</span>
          </button>
        )}
        <button
          className={view === "standings" ? "active" : ""}
          type="button"
          onClick={() => setView("standings")}
        >
          <Trophy aria-hidden="true" />
          <span>Poängliga</span>
        </button>
        {!isSubmissionOpen && (
          <button
            className={view === "messages" ? "active" : ""}
            type="button"
            onClick={() => setView("messages")}
          >
            <MessageSquare aria-hidden="true" />
            <span>Snack</span>
          </button>
        )}
        {!isSubmissionOpen && (
          <button
            className={view === "statistics" ? "active" : ""}
            type="button"
            onClick={() => setView("statistics")}
          >
            <BarChart3 aria-hidden="true" />
            <span>Statistik</span>
          </button>
        )}
      </nav>

      {!isSupabaseConfigured && (
        <div className="notice">
          Supabase är förberett men inte anslutet. Formuläret sparar därför bara
          lokalt i denna session.
        </div>
      )}

      {predictionLoadState === "loading" && (
        <div className="notice">
          Hämtar inskickade tips...
        </div>
      )}

      {predictionLoadState === "error" && (
        <div className="notice warning">
          {predictionLoadError}
        </div>
      )}

      {view === "submit" && isSubmissionOpen && (
        <SubmitView
          form={form}
          isSubmissionOpen={isSubmissionOpen}
          isSubmitted={isSubmitted}
          onSubmit={handleSubmit}
          updateContact={updateContact}
          updateMatch={updateMatch}
          updateGroup={updateGroup}
          updatePodium={updatePodium}
          updateTournamentQuestion={updateTournamentQuestion}
          updateTieBreaker={updateTieBreaker}
          submitError={submitError}
          isSubmitting={isSubmitting}
        />
      )}

      {view === "receipt" && receipt && (
        <ReceiptView prediction={receipt} onBack={returnToSubmitForm} />
      )}

      {view === "predictions" && !isSubmissionOpen && (
        <PredictionsView
          focusedPredictionId={focusedPredictionId}
          predictions={predictions}
        />
      )}

      {view === "standings" && (
        <StandingsView onSelectPrediction={focusPrediction} standings={standings} />
      )}

      {view === "messages" && !isSubmissionOpen && (
        <MessageBoardView
          error={messageBoardError}
          form={messageBoardForm}
          hasOlderMessages={hasOlderMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          isPosting={isPostingMessage}
          loadError={messageBoardLoadError}
          loadState={messageBoardLoadState}
          posts={messageBoardPosts}
          onChange={setMessageBoardForm}
          onLoadOlder={loadOlderMessageBoardPosts}
          onSubmit={handleMessageBoardSubmit}
        />
      )}

      {view === "statistics" && !isSubmissionOpen && (
        <StatisticsView predictions={predictions} />
      )}
    </main>
  );
}

function MessageBoardView({
  error,
  form,
  hasOlderMessages,
  isLoadingOlderMessages,
  isPosting,
  loadError,
  loadState,
  posts,
  onChange,
  onLoadOlder,
  onSubmit,
}: {
  error: string;
  form: MessageBoardForm;
  hasOlderMessages: boolean;
  isLoadingOlderMessages: boolean;
  isPosting: boolean;
  loadError: string;
  loadState: MessageBoardLoadState;
  posts: MessageBoardPost[];
  onChange: (nextForm: MessageBoardForm) => void;
  onLoadOlder: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const remainingCharacters = 300 - form.message.length;

  return (
    <section className="message-board">
      <form className="panel message-composer" onSubmit={onSubmit}>
        <div className="section-heading with-icon">
          <MessageSquare aria-hidden="true" />
          <div>
            <h2>VM-snack</h2>
            <p>Skriv något om matcherna, tippningen eller turneringen.</p>
          </div>
        </div>

        <div className="message-form-grid">
          <label>
            Namn eller initialer, frivilligt
            <input
              autoComplete="name"
              maxLength={40}
              value={form.displayName}
              onChange={(event) =>
                onChange({ ...form, displayName: event.target.value })
              }
              placeholder="Lämna tomt för Anonym"
            />
          </label>
          <label>
            Meddelande
            <textarea
              maxLength={300}
              required
              rows={4}
              value={form.message}
              onChange={(event) =>
                onChange({ ...form, message: event.target.value })
              }
              placeholder="Skriv ditt meddelande"
            />
          </label>
        </div>

        <div className="message-submit-row">
          <span className={remainingCharacters < 20 ? "message-counter warning" : "message-counter"}>
            {remainingCharacters} tecken kvar
          </span>
          {error && <span className="error">{error}</span>}
          <button className="primary-button" disabled={isPosting} type="submit">
            <Send aria-hidden="true" />
            {isPosting ? "Skickar" : "Skicka"}
          </button>
        </div>
      </form>

      <section className="panel message-feed" aria-live="polite">
        <div className="section-heading">
          <h2>Senaste meddelanden</h2>
          <p>{posts.length === 0 ? "Inga meddelanden än." : `${posts.length} meddelanden visas.`}</p>
        </div>

        {loadState === "loading" && (
          <div className="notice">
            Hämtar meddelanden...
          </div>
        )}

        {loadState === "error" && (
          <div className="notice warning">
            {loadError || "Kunde inte hämta meddelanden just nu."}
          </div>
        )}

        {loadState !== "error" && loadError && (
          <div className="notice warning">
            {loadError}
          </div>
        )}

        <div className="message-list">
          {posts.map((post) => (
            <article className="message-card" key={post.id}>
              <div className="message-avatar" aria-hidden="true">
                {(post.displayName.trim() || "Anonym").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <header>
                  <strong>{post.displayName.trim() || "Anonym"}</strong>
                  <span>{formatDateTime.format(new Date(post.createdAt))}</span>
                </header>
                <p>{post.message}</p>
              </div>
            </article>
          ))}
        </div>

        {hasOlderMessages && (
          <div className="message-feed-actions">
            <button
              className="secondary-button"
              disabled={isLoadingOlderMessages}
              type="button"
              onClick={onLoadOlder}
            >
              {isLoadingOlderMessages ? "Hämtar" : "Visa äldre"}
            </button>
          </div>
        )}
      </section>
    </section>
  );
}

function ReceiptView({
  prediction,
  onBack,
}: {
  prediction: PublicPrediction;
  onBack: () => void;
}) {
  return (
    <section className="receipt-panel" aria-live="polite">
      <div className="receipt-hero">
        <div>
          <p className="eyebrow">Tack för att du är med och tippar</p>
          <h2>Ditt tips är inskickat</h2>
          <p>
            Håll koll på dina resultat med initialerna. De är det namn som
            syns i listor och poängliga.
          </p>
        </div>
        <div className="initials-badge">
          <span>Dina initialer</span>
          <strong>{prediction.initials}</strong>
        </div>
      </div>

      <div className="receipt-top-grid">
        <div className="payment-box receipt-feature">
          <h3>Swish</h3>
          <p>Swisha 50 kr till Gustav.</p>
          <strong>070-309 26 43</strong>
          <a className="swish-link" href="swish://">
            Öppna Swish
          </a>
          <span>
            Knappen öppnar Swish-appen om enheten och webbläsaren tillåter det.
            Nummer och summa fylls i manuellt.
          </span>
        </div>
      </div>

      <div className="receipt-grid">
        <div className="summary-box">
          <h3>Sveriges matcher</h3>
          {prediction.swedenMatches.map((match) => (
            <p key={match.id}>
              {match.homeTeam} {match.homeGoals || 0}-{match.awayGoals || 0}{" "}
              {match.awayTeam}
            </p>
          ))}
        </div>

        <div className="summary-box">
          <h3>Topp 3</h3>
          <p>1. {prediction.podium.champion || "Ej valt"}</p>
          <p>2. {prediction.podium.runnerUp || "Ej valt"}</p>
          <p>3. {prediction.podium.thirdPlace || "Ej valt"}</p>
        </div>

        <div className="summary-box">
          <h3>Turneringsfrågor</h3>
          <p>Gula kort: {prediction.tournamentQuestions.yellowCards || "Ej valt"}</p>
          <p>Röda kort: {prediction.tournamentQuestions.redCards || "Ej valt"}</p>
          <p>Totalt antal mål: {prediction.tournamentQuestions.totalGoals || "Ej valt"}</p>
        </div>

        <div className="summary-box">
          <h3>Utslagsfråga</h3>
          <p>
            Första målet i finalen:{" "}
            {prediction.tieBreaker.finalFirstGoalMinute
              ? `minut ${prediction.tieBreaker.finalFirstGoalMinute}`
              : "Ej valt"}
          </p>
        </div>
      </div>

      <details className="group-summary">
        <summary>Visa gruppspelstips</summary>
        <div className="group-summary-grid">
          {prediction.groups.map((group) => (
            <p key={group.group}>
              <strong>{group.group}</strong>
              <span>{group.winner || "Ej valt"}</span>
              <span>{group.runnerUp || "Ej valt"}</span>
            </p>
          ))}
        </div>
      </details>

      <div className="receipt-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          <RotateCcw aria-hidden="true" />
          Tillbaka till tippningsformuläret
        </button>
      </div>
    </section>
  );
}

function mergeAdminResults(rows: Array<Record<string, any>>) {
  const nextResults = structuredClone(initialAdminResults) as AdminResults;

  for (const row of rows) {
    if (row.result_type === "sweden_match") {
      nextResults.swedenMatches = nextResults.swedenMatches.map((match) =>
        match.id === row.result_key ? { ...match, ...row.result_payload } : match,
      );
    }

    if (row.result_type === "group") {
      nextResults.groups = nextResults.groups.map((group) =>
        group.group === row.result_key ? { ...group, ...row.result_payload } : group,
      );
    }

    if (row.result_type === "podium") {
      nextResults.podium = { ...nextResults.podium, ...row.result_payload };
    }

    if (row.result_type === "statistics") {
      nextResults.statistics = { ...nextResults.statistics, ...row.result_payload };
    }

    if (row.result_type === "tie_breaker") {
      nextResults.tieBreaker = { ...nextResults.tieBreaker, ...row.result_payload };
    }
  }

  return nextResults;
}

function mapAdminMessageBoardPost(post: Record<string, any>): AdminMessageBoardPost {
  return {
    ...mapMessageBoardPost(post),
    isHidden: Boolean(post.is_hidden),
  };
}

function AdminView() {
  const [code, setCode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminViewTab>("results");
  const [results, setResults] = useState<AdminResults>(initialAdminResults);
  const [adminMessages, setAdminMessages] = useState<AdminMessageBoardPost[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null);

  async function callAdminFunction(
    action: "load" | "save" | "load_messages" | "set_message_visibility",
    payload: Record<string, unknown> = {},
  ) {
    if (!supabase) {
      throw new Error("Supabase är inte konfigurerat.");
    }

    const { data, error: functionError } = await supabase.functions.invoke("admin-results", {
      body: {
        action,
        code,
        ...payload,
      },
    });

    if (functionError) {
      throw functionError;
    }

    return data;
  }

  async function unlockAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    try {
      const data = await callAdminFunction("load");
      setResults(mergeAdminResults(data.results ?? []));
      setIsUnlocked(true);
      setStatus("Adminläge upplåst.");
    } catch {
      setError("Koden stämmer inte eller så kunde adminläget inte öppnas.");
    }
  }

  async function saveAdminResults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSaving(true);

    try {
      await callAdminFunction("save", { results });
      setStatus("Resultaten är sparade och poängen har räknats om.");
    } catch {
      setError("Kunde inte spara resultaten.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateAdminMatch(
    index: number,
    field: "homeGoals" | "awayGoals",
    value: string,
  ) {
    setResults((current) => ({
      ...current,
      swedenMatches: current.swedenMatches.map((match, matchIndex) =>
        matchIndex === index
          ? { ...match, [field]: value === "" ? "" : Number(value) }
          : match,
      ),
    }));
  }

  function updateAdminGroup(index: number, field: "winner" | "runnerUp", value: string) {
    setResults((current) => ({
      ...current,
      groups: current.groups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, [field]: value } : group,
      ),
    }));
  }

  function updateAdminPodium(field: keyof AdminResults["podium"], value: string) {
    setResults((current) => ({
      ...current,
      podium: {
        ...current.podium,
        [field]: value,
      },
    }));
  }

  function updateAdminStatistics(
    field: keyof Omit<AdminResults["statistics"], "isFinal">,
    value: string,
  ) {
    setResults((current) => ({
      ...current,
      statistics: {
        ...current.statistics,
        [field]: value === "" ? "" : Number(value),
      },
    }));
  }

  function updateTieBreaker(value: string) {
    setResults((current) => ({
      ...current,
      tieBreaker: {
        finalFirstGoalMinute: value === "" ? "" : Number(value),
      },
    }));
  }

  async function loadAdminMessages() {
    setError("");
    setStatus("");
    setIsLoadingMessages(true);

    try {
      const data = await callAdminFunction("load_messages");
      setAdminMessages((data.messages ?? []).map(mapAdminMessageBoardPost));
    } catch {
      setError("Kunde inte hämta meddelanden.");
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function openAdminMessages() {
    setAdminTab("messages");

    if (adminMessages.length === 0) {
      await loadAdminMessages();
    }
  }

  async function setAdminMessageVisibility(messageId: string, isHidden: boolean) {
    setError("");
    setStatus("");
    setUpdatingMessageId(messageId);

    try {
      const data = await callAdminFunction("set_message_visibility", {
        isHidden,
        messageId,
      });
      setAdminMessages((data.messages ?? []).map(mapAdminMessageBoardPost));
      setStatus(isHidden ? "Meddelandet är dolt från flödet." : "Meddelandet visas igen.");
    } catch {
      setError(isHidden ? "Kunde inte dölja meddelandet." : "Kunde inte visa meddelandet igen.");
    } finally {
      setUpdatingMessageId(null);
    }
  }

  if (!isUnlocked) {
    return (
      <section className="panel admin-panel">
        <div className="section-heading">
          <h1>Admin</h1>
          <p>Skriv admin-koden för att lägga in resultat.</p>
        </div>
        <form className="admin-login" onSubmit={unlockAdmin}>
          <label>
            Kod
            <input
              autoFocus
              inputMode="numeric"
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          {error && <span className="error">{error}</span>}
          <button className="primary-button" type="submit">
            Öppna admin
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="content-grid">
      <section className="panel span-2">
        <div className="section-heading">
          <h1>Admin</h1>
          <p>Lägg in resultat och hantera meddelanden.</p>
        </div>
        <div className="admin-tabs" aria-label="Adminvyer">
          <button
            className={adminTab === "results" ? "active" : ""}
            type="button"
            onClick={() => setAdminTab("results")}
          >
            <Trophy aria-hidden="true" />
            Resultat
          </button>
          <button
            className={adminTab === "messages" ? "active" : ""}
            type="button"
            onClick={openAdminMessages}
          >
            <MessageSquare aria-hidden="true" />
            Meddelanden
          </button>
        </div>
        {status && <span className="success">{status}</span>}
        {error && <span className="error">{error}</span>}
      </section>

      {adminTab === "results" && (
        <form className="content-grid span-2" onSubmit={saveAdminResults}>
      <section className="panel span-2">
        <div className="section-heading">
          <h2>Sveriges matcher</h2>
          <p>När ett matchresultat är ifyllt gäller det direkt i poängräkningen.</p>
        </div>
        <div className="match-list">
          {results.swedenMatches.map((match, index) => (
            <div className="match-row" key={match.id}>
              <div>
                <strong>{match.label}</strong>
                <span>
                  {match.homeTeam} - {match.awayTeam}
                </span>
              </div>
              <div className="score-inputs">
                <input
                  aria-label={`${match.homeTeam} mål`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  value={match.homeGoals}
                  onChange={(event) => updateAdminMatch(index, "homeGoals", event.target.value)}
                />
                <input
                  aria-label={`${match.awayTeam} mål`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  value={match.awayGoals}
                  onChange={(event) => updateAdminMatch(index, "awayGoals", event.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel span-2">
        <div className="section-heading">
          <h2>Gruppspel</h2>
          <p>När gruppettor och grupptvåor är ifyllda gäller de direkt.</p>
        </div>
        <div className="group-grid">
          {results.groups.map((group, index) => (
            <div className="group-card" key={group.group}>
              <strong>Grupp {group.group}</strong>
              <select
                value={group.winner}
                onChange={(event) => updateAdminGroup(index, "winner", event.target.value)}
              >
                <option value="">Etta</option>
                {groupTeams[group.group].map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <select
                value={group.runnerUp}
                onChange={(event) => updateAdminGroup(index, "runnerUp", event.target.value)}
              >
                <option value="">Tvåa</option>
                {groupTeams[group.group].map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Topp 3</h2>
          <p>När slutplaceringarna är ifyllda gäller de direkt.</p>
        </div>
        <div className="form-grid three">
          {(["champion", "runnerUp", "thirdPlace"] as const).map((field, index) => (
            <label key={field}>
              {index === 0 ? "Vinnare" : index === 1 ? "Tvåa" : "Trea"}
              <select
                value={results.podium[field]}
                onChange={(event) => updateAdminPodium(field, event.target.value)}
              >
                <option value="">Välj lag</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Statistik</h2>
          <p>Löpande siffror kan sparas utan att ge poäng.</p>
        </div>
        <div className="form-grid three">
          <label>
            Gula kort
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              value={results.statistics.yellowCards}
              onChange={(event) => updateAdminStatistics("yellowCards", event.target.value)}
            />
          </label>
          <label>
            Röda kort
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              value={results.statistics.redCards}
              onChange={(event) => updateAdminStatistics("redCards", event.target.value)}
            />
          </label>
          <label>
            Totalt antal mål
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              value={results.statistics.totalGoals}
              onChange={(event) => updateAdminStatistics("totalGoals", event.target.value)}
            />
          </label>
        </div>
        <label className="checkbox-row">
          <input
            checked={results.statistics.isFinal}
            type="checkbox"
            onChange={(event) =>
              setResults((current) => ({
                ...current,
                statistics: {
                  ...current.statistics,
                  isFinal: event.target.checked,
                },
              }))
            }
          />
          Slutgiltigt resultat, räkna statistikpoäng
        </label>
      </section>

      <section className="panel span-2 tiebreaker-panel">
        <div className="section-heading">
          <h2>Utslagsfråga</h2>
          <p>Matchminut för första målet i finalen. Ger inte poäng.</p>
        </div>
        <label className="compact-field">
          Matchminut
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            type="text"
            value={results.tieBreaker.finalFirstGoalMinute}
            onChange={(event) => updateTieBreaker(event.target.value)}
          />
        </label>
      </section>

      <div className="submit-bar span-2">
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Sparar" : "Spara resultat och räkna om"}
        </button>
      </div>
        </form>
      )}

      {adminTab === "messages" && (
        <section className="panel span-2 admin-message-panel">
          <div className="section-heading">
            <h2>Meddelanden</h2>
            <p>Dolda meddelanden visas inte i publika flödet.</p>
          </div>
          <div className="submit-bar">
            <button
              className="secondary-button"
              disabled={isLoadingMessages}
              type="button"
              onClick={loadAdminMessages}
            >
              <RotateCcw aria-hidden="true" />
              {isLoadingMessages ? "Hämtar" : "Uppdatera"}
            </button>
          </div>
          {isLoadingMessages && (
            <div className="notice">
              Hämtar meddelanden...
            </div>
          )}
          <div className="admin-message-list">
            {adminMessages.length === 0 && !isLoadingMessages && (
              <div className="notice">
                Det finns inga meddelanden än.
              </div>
            )}
            {adminMessages.map((message) => (
              <article
                className={message.isHidden ? "admin-message-card hidden" : "admin-message-card"}
                key={message.id}
              >
                <div>
                  <header>
                    <strong>{message.displayName}</strong>
                    <span>{formatDateTime.format(new Date(message.createdAt))}</span>
                  </header>
                  <p>{message.message}</p>
                  {message.isHidden && <small>Dolt från publika flödet</small>}
                </div>
                <button
                  className="secondary-button"
                  disabled={updatingMessageId === message.id}
                  type="button"
                  onClick={() => setAdminMessageVisibility(message.id, !message.isHidden)}
                >
                  {updatingMessageId === message.id
                    ? "Sparar"
                    : message.isHidden
                      ? "Visa igen"
                      : "Dölj"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type SubmitViewProps = {
  form: PredictionForm;
  isSubmissionOpen: boolean;
  isSubmitted: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  updateContact: (field: keyof PredictionForm["contact"], value: string) => void;
  updateMatch: (index: number, field: "homeGoals" | "awayGoals", value: string) => void;
  updateGroup: (index: number, field: "winner" | "runnerUp", value: string) => void;
  updatePodium: (field: keyof PredictionForm["podium"], value: string) => void;
  updateTournamentQuestion: (
    field: keyof PredictionForm["tournamentQuestions"],
    value: string,
  ) => void;
  updateTieBreaker: (field: keyof PredictionForm["tieBreaker"], value: string) => void;
  submitError: string;
  isSubmitting: boolean;
};

function SubmitView({
  form,
  isSubmissionOpen,
  isSubmitted,
  onSubmit,
  updateContact,
  updateMatch,
  updateGroup,
  updatePodium,
  updateTournamentQuestion,
  updateTieBreaker,
  submitError,
  isSubmitting,
}: SubmitViewProps) {
  return (
    <form className="content-grid" onSubmit={onSubmit}>
      <section className="panel span-2">
        <div className="section-heading">
          <h2>Kontaktuppgifter</h2>
          <p>Visas inte publikt. Publika tips märks med initialer.</p>
        </div>
        <div className="form-grid">
          <label>
            Förnamn
            <input
              required
              value={form.contact.firstName}
              onChange={(event) => updateContact("firstName", event.target.value)}
            />
          </label>
          <label>
            Efternamn
            <input
              required
              value={form.contact.lastName}
              onChange={(event) => updateContact("lastName", event.target.value)}
            />
          </label>
          <label>
            Telefon
            <input
              inputMode="tel"
              required
              value={form.contact.phone}
              onChange={(event) => updateContact("phone", event.target.value)}
            />
          </label>
          <label>
            E-post
            <input
              required
              type="email"
              value={form.contact.email}
              onChange={(event) => updateContact("email", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="panel span-2">
        <div className="section-heading">
          <h2>Regler och poäng</h2>
          <p>
            Det kostar 50 kr att vara med. Swisha till Gustav på 070-309 26 43.
            Vinnaren tar allt.
          </p>
        </div>
        <ul className="rule-list">
          {scoreRules.map((rule) => (
            <li key={rule.label}>
              <div className="rule-icon" aria-hidden="true">
                {getScoreRuleIcon(rule.label)}
              </div>
              <div>
                <span>{rule.label}</span>
                <strong>{rule.points}</strong>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel span-2">
        <div className="section-heading">
          <h2>Sveriges matcher</h2>
          <p>Tippa slutresultatet i gruppspelsmatcherna.</p>
        </div>
        <div className="match-list">
          {form.swedenMatches.map((match, index) => (
            <div className="match-row" key={match.id}>
              <div>
                <strong>{match.label}</strong>
                <span>
                  {match.homeTeam} - {match.awayTeam}
                </span>
                {match.venue && <small>{match.venue}</small>}
              </div>
              <div className="score-inputs">
                <input
                  aria-label={`${match.homeTeam} mål`}
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  required
                  type="text"
                  value={match.homeGoals}
                  onChange={(event) =>
                    updateMatch(index, "homeGoals", event.target.value)
                  }
                />
                <input
                  aria-label={`${match.awayTeam} mål`}
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  required
                  type="text"
                  value={match.awayGoals}
                  onChange={(event) =>
                    updateMatch(index, "awayGoals", event.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel span-2">
        <div className="section-heading">
          <h2>Gruppspel</h2>
          <p>Välj gruppetta och grupptvåa i alla 12 grupper.</p>
        </div>
        <div className="group-grid">
          {form.groups.map((group, index) => (
            <div className="group-card" key={group.group}>
              <strong>Grupp {group.group}</strong>
              <select
                required
                value={group.winner}
                onChange={(event) => updateGroup(index, "winner", event.target.value)}
              >
                <option value="">Etta</option>
                {groupTeams[group.group].map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <select
                required
                value={group.runnerUp}
                onChange={(event) =>
                  updateGroup(index, "runnerUp", event.target.value)
                }
              >
                <option value="">Tvåa</option>
                {groupTeams[group.group].map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Topp 3</h2>
          <p>Tippa slutplaceringarna i turneringen.</p>
        </div>
        <div className="form-grid three">
          <label>
            Världsmästare
            <select
              required
              value={form.podium.champion}
              onChange={(event) => updatePodium("champion", event.target.value)}
            >
              <option value="">Välj lag</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tvåa
            <select
              required
              value={form.podium.runnerUp}
              onChange={(event) => updatePodium("runnerUp", event.target.value)}
            >
              <option value="">Välj lag</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trea
            <select
              required
              value={form.podium.thirdPlace}
              onChange={(event) => updatePodium("thirdPlace", event.target.value)}
            >
              <option value="">Välj lag</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Turneringsfrågor</h2>
          <p>Tippa totalsiffror för hela turneringen.</p>
        </div>
        <div className="form-grid three">
          <label>
            Gula kort totalt
            <input
              inputMode="numeric"
              min="0"
              pattern="[0-9]*"
              required
              type="text"
              value={form.tournamentQuestions.yellowCards}
              onChange={(event) =>
                updateTournamentQuestion("yellowCards", event.target.value)
              }
            />
          </label>
          <label>
            Röda kort totalt
            <input
              inputMode="numeric"
              min="0"
              pattern="[0-9]*"
              required
              type="text"
              value={form.tournamentQuestions.redCards}
              onChange={(event) =>
                updateTournamentQuestion("redCards", event.target.value)
              }
            />
          </label>
          <label>
            Totalt antal mål
            <input
              inputMode="numeric"
              min="0"
              pattern="[0-9]*"
              required
              type="text"
              value={form.tournamentQuestions.totalGoals}
              onChange={(event) =>
                updateTournamentQuestion("totalGoals", event.target.value)
              }
            />
          </label>
        </div>
      </section>

      <section className="panel span-2 tiebreaker-panel">
        <div className="section-heading">
          <h2>Utslagsfråga</h2>
          <p>
            I vilken matchminut görs första målet i finalen? Används bara för att
            skilja tippare åt vid lika många poäng.
          </p>
        </div>
        <label className="compact-field">
          Matchminut
          <input
            inputMode="numeric"
            min="1"
            pattern="[0-9]*"
            required
            type="text"
            value={form.tieBreaker.finalFirstGoalMinute}
            onChange={(event) =>
              updateTieBreaker("finalFirstGoalMinute", event.target.value)
            }
          />
        </label>
      </section>

      <div className="submit-bar span-2">
        {submitError && <span className="error">{submitError}</span>}
        {isSubmitted && (
          <span className="success">
            <CheckCircle2 aria-hidden="true" />
            Tipset är inskickat i denna session.
          </span>
        )}
        <button
          className="primary-button"
          disabled={!isSubmissionOpen || isSubmitting}
          type="submit"
        >
          <Send aria-hidden="true" />
          {isSubmitting
            ? "Skickar"
            : isSubmissionOpen
              ? "Skicka in tips"
              : "Tippningen är stängd"}
        </button>
      </div>
    </form>
  );
}

function PredictionsView({
  focusedPredictionId,
  predictions,
}: {
  focusedPredictionId: string | null;
  predictions: PublicPrediction[];
}) {
  const [selectedPredictionIds, setSelectedPredictionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const comparisonVisible = selectedPredictionIds.length === 2;
  const normalizedSearchQuery = searchQuery.trim().toUpperCase();
  const visiblePredictions = normalizedSearchQuery
    ? predictions.filter((prediction) =>
        prediction.initials.toUpperCase().includes(normalizedSearchQuery),
      )
    : predictions;

  useEffect(() => {
    if (!focusedPredictionId) {
      return;
    }

    const element = document.getElementById(`prediction-${focusedPredictionId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
  }, [focusedPredictionId]);

  const selectedPredictions = selectedPredictionIds
    .map((predictionId) => predictions.find((prediction) => prediction.id === predictionId))
    .filter((prediction): prediction is PublicPrediction => Boolean(prediction));

  useEffect(() => {
    setSelectedPredictionIds((current) =>
      current.filter((predictionId) =>
        predictions.some((prediction) => prediction.id === predictionId),
      ),
    );
  }, [predictions]);

  useEffect(() => {
    if (!comparisonVisible) {
      return;
    }

    const element = document.getElementById("prediction-comparison");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [comparisonVisible, selectedPredictionIds]);

  function togglePredictionSelection(predictionId: string) {
    setSelectedPredictionIds((current) => {
      if (current.includes(predictionId)) {
        return current.filter((item) => item !== predictionId);
      }

      if (current.length < 2) {
        return [...current, predictionId];
      }

      return current;
    });
  }

  function clearPredictionSelection() {
    setSelectedPredictionIds([]);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Allas inskickade tips</h2>
        <p>Kontaktuppgifter visas inte publikt.</p>
      </div>
      <div className="compare-toolbar">
        <p>
          Välj två tippningar för att jämföra dem sida vid sida.
        </p>
        {selectedPredictions.length > 0 && (
          <button className="secondary-button" type="button" onClick={clearPredictionSelection}>
            <RotateCcw aria-hidden="true" />
            Rensa val
          </button>
        )}
      </div>
      <label className="prediction-search">
        Sök initialer
        <input
          autoComplete="off"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Skriv initialer för att filtrera listan"
        />
      </label>
      {selectedPredictions.length === 1 && (
        <div className="notice">
          {selectedPredictions[0].initials} är vald. Välj en till tippning för att se jämförelsen.
        </div>
      )}
      {selectedPredictions.length === 2 && (
        <PredictionComparisonView
          firstPrediction={selectedPredictions[0]}
          secondPrediction={selectedPredictions[1]}
        />
      )}
      <div className="prediction-list">
        {visiblePredictions.length === 0 && (
          <div className="notice">
            Inga tippningar matchar sökningen.
          </div>
        )}
        {visiblePredictions.map((prediction) => (
          <article
            className={
              prediction.id === focusedPredictionId
                ? "prediction-card focused"
                : "prediction-card"
            }
            id={`prediction-${prediction.id}`}
            key={prediction.id}
            tabIndex={-1}
          >
            <header>
              <div className="prediction-card-heading">
                <strong>{prediction.initials}</strong>
                <span>{formatDateTime.format(new Date(prediction.submittedAt))}</span>
              </div>
              <button
                className={
                  selectedPredictionIds.includes(prediction.id)
                    ? "select-compare-button active"
                    : "select-compare-button"
                }
                disabled={
                  selectedPredictionIds.length === 2 &&
                  !selectedPredictionIds.includes(prediction.id)
                }
                type="button"
                onClick={() => togglePredictionSelection(prediction.id)}
              >
                {selectedPredictionIds.includes(prediction.id)
                  ? "Vald för jämförelse"
                  : "Jämför"}
              </button>
            </header>
            <div className="prediction-columns">
              <div>
                <h3>Sverige</h3>
                {prediction.swedenMatches.map((match) => (
                  <p key={match.id}>
                    {match.homeTeam} {match.homeGoals}-{match.awayGoals}{" "}
                    {match.awayTeam}
                  </p>
                ))}
              </div>
              <div>
                <h3>Grupper</h3>
                {prediction.groups.map((group) => (
                  <p key={group.group}>
                    {group.group}: {group.winner}, {group.runnerUp}
                  </p>
                ))}
              </div>
              <div>
                <h3>Topp 3</h3>
                <p>1. {prediction.podium.champion}</p>
                <p>2. {prediction.podium.runnerUp}</p>
                <p>3. {prediction.podium.thirdPlace}</p>
              </div>
              <div>
                <h3>Turneringsfrågor</h3>
                <p>Gula kort: {prediction.tournamentQuestions.yellowCards}</p>
                <p>Röda kort: {prediction.tournamentQuestions.redCards}</p>
                <p>Mål totalt: {prediction.tournamentQuestions.totalGoals}</p>
                <p>
                  Finalens första mål: minut{" "}
                  {prediction.tieBreaker.finalFirstGoalMinute}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PredictionComparisonView({
  firstPrediction,
  secondPrediction,
}: {
  firstPrediction: PublicPrediction;
  secondPrediction: PublicPrediction;
}) {
  const summary = countMatchingChoices(firstPrediction, secondPrediction);
  const renderAnswer = (initials: string, value: string) => (
    <strong>
      <span className="comparison-mobile-label">{initials}</span>
      {value}
    </strong>
  );
  const podiumRows = [
    {
      label: "Världsmästare",
      first: firstPrediction.podium.champion,
      second: secondPrediction.podium.champion,
    },
    {
      label: "Tvåa",
      first: firstPrediction.podium.runnerUp,
      second: secondPrediction.podium.runnerUp,
    },
    {
      label: "Trea",
      first: firstPrediction.podium.thirdPlace,
      second: secondPrediction.podium.thirdPlace,
    },
  ];
  const questionRows = [
    {
      label: "Gula kort",
      first: formatComparisonValue(firstPrediction.tournamentQuestions.yellowCards),
      second: formatComparisonValue(secondPrediction.tournamentQuestions.yellowCards),
    },
    {
      label: "Röda kort",
      first: formatComparisonValue(firstPrediction.tournamentQuestions.redCards),
      second: formatComparisonValue(secondPrediction.tournamentQuestions.redCards),
    },
    {
      label: "Totalt antal mål",
      first: formatComparisonValue(firstPrediction.tournamentQuestions.totalGoals),
      second: formatComparisonValue(secondPrediction.tournamentQuestions.totalGoals),
    },
    {
      label: "Finalens första mål",
      first: `Minut ${formatComparisonValue(firstPrediction.tieBreaker.finalFirstGoalMinute)}`,
      second: `Minut ${formatComparisonValue(secondPrediction.tieBreaker.finalFirstGoalMinute)}`,
    },
  ];

  return (
    <section className="comparison-panel" id="prediction-comparison">
      <div className="comparison-header">
        <div>
          <h3>Jämförelse</h3>
          <p>
            {firstPrediction.initials} mot {secondPrediction.initials}
          </p>
        </div>
        <div className="comparison-summary">
          <span>{summary.same} lika</span>
          <span>{summary.different} olika</span>
        </div>
      </div>

      <div className="comparison-section">
        <h4>Sveriges matcher</h4>
        <div className="comparison-grid comparison-grid-head">
          <span />
          <strong>{firstPrediction.initials}</strong>
          <strong>{secondPrediction.initials}</strong>
        </div>
        {initialSwedenMatches.map((match) => {
          const firstMatch = firstPrediction.swedenMatches.find((item) => item.id === match.id);
          const secondMatch = secondPrediction.swedenMatches.find((item) => item.id === match.id);
          const firstValue = formatComparisonValue(
            formatPredictionScore(firstMatch?.homeGoals ?? "", firstMatch?.awayGoals ?? ""),
          );
          const secondValue = formatComparisonValue(
            formatPredictionScore(secondMatch?.homeGoals ?? "", secondMatch?.awayGoals ?? ""),
          );
          const firstSign = getMatchSign(firstMatch?.homeGoals ?? "", firstMatch?.awayGoals ?? "");
          const secondSign = getMatchSign(secondMatch?.homeGoals ?? "", secondMatch?.awayGoals ?? "");
          const comparisonClass =
            firstValue === secondValue
              ? "comparison-grid same"
              : firstSign !== "" && firstSign === secondSign
                ? "comparison-grid partial"
                : "comparison-grid different";

          return (
            <div className={comparisonClass} key={match.id}>
              <span>{match.homeTeam} - {match.awayTeam}</span>
              {renderAnswer(firstPrediction.initials, firstValue)}
              {renderAnswer(secondPrediction.initials, secondValue)}
            </div>
          );
        })}
      </div>

      <div className="comparison-section">
        <h4>Gruppspel</h4>
        <div className="comparison-grid comparison-grid-head">
          <span />
          <strong>{firstPrediction.initials}</strong>
          <strong>{secondPrediction.initials}</strong>
        </div>
        {groups.map((group) => {
          const firstGroup = firstPrediction.groups.find((item) => item.group === group);
          const secondGroup = secondPrediction.groups.find((item) => item.group === group);
          const firstValue = `${firstGroup?.winner ?? "Ej valt"} / ${firstGroup?.runnerUp ?? "Ej valt"}`;
          const secondValue = `${secondGroup?.winner ?? "Ej valt"} / ${secondGroup?.runnerUp ?? "Ej valt"}`;
          const sameTeams =
            firstGroup?.winner === secondGroup?.runnerUp &&
            firstGroup?.runnerUp === secondGroup?.winner;
          const comparisonClass =
            firstValue === secondValue
              ? "comparison-grid same"
              : sameTeams
                ? "comparison-grid partial"
                : "comparison-grid different";

          return (
            <div className={comparisonClass} key={group}>
              <span>Grupp {group}</span>
              {renderAnswer(firstPrediction.initials, firstValue)}
              {renderAnswer(secondPrediction.initials, secondValue)}
            </div>
          );
        })}
      </div>

      <div className="comparison-section comparison-two-column">
        <div>
          <h4>Topp 3</h4>
          <div className="comparison-grid comparison-grid-head">
            <span />
            <strong>{firstPrediction.initials}</strong>
            <strong>{secondPrediction.initials}</strong>
          </div>
          {podiumRows.map((row) => (
            <div
              className={row.first === row.second ? "comparison-grid same" : "comparison-grid different"}
              key={row.label}
            >
              <span>{row.label}</span>
              {renderAnswer(firstPrediction.initials, row.first)}
              {renderAnswer(secondPrediction.initials, row.second)}
            </div>
          ))}
        </div>
        <div>
          <h4>Turneringsfrågor</h4>
          <div className="comparison-grid comparison-grid-head">
            <span />
            <strong>{firstPrediction.initials}</strong>
            <strong>{secondPrediction.initials}</strong>
          </div>
          {questionRows.map((row) => (
            <div
              className={row.first === row.second ? "comparison-grid same" : "comparison-grid different"}
              key={row.label}
            >
              <span>{row.label}</span>
              {renderAnswer(firstPrediction.initials, row.first)}
              {renderAnswer(secondPrediction.initials, row.second)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatisticsView({ predictions }: { predictions: PublicPrediction[] }) {
  const total = predictions.length;
  const swedenGroupPredictions = predictions
    .map((prediction) =>
      prediction.groups.find((groupPrediction) => groupPrediction.group === "F"),
    )
    .filter((prediction): prediction is GroupPrediction => Boolean(prediction));
  const swedenAsWinner = swedenGroupPredictions.filter(
    (prediction) => prediction.winner === "Sverige",
  ).length;
  const swedenAsRunnerUp = swedenGroupPredictions.filter(
    (prediction) => prediction.runnerUp === "Sverige",
  ).length;
  const swedenAdvanceCount = swedenAsWinner + swedenAsRunnerUp;
  const swedenAdvancePercentage =
    swedenGroupPredictions.length > 0
      ? Math.round((swedenAdvanceCount / swedenGroupPredictions.length) * 100)
      : 0;
  const swedenExpectedPoints =
    total > 0
      ? Math.round(
          predictions.reduce(
            (sum, prediction) => sum + getSwedenPointsFromPrediction(prediction),
            0,
          ) / total,
        )
      : 0;
  const commonFinals = getTopCounts(
    predictions.map((prediction) =>
      prediction.podium.champion && prediction.podium.runnerUp
        ? `${prediction.podium.champion} - ${prediction.podium.runnerUp}`
        : "",
    ),
    3,
  );
  const consensusItems = getConsensusItems(predictions);
  const mostAgreedItem = [...consensusItems].sort(
    (first, second) => second.percentage - first.percentage,
  )[0];
  const mostSplitItem = [...consensusItems].sort(
    (first, second) => first.percentage - second.percentage,
  )[0];

  const numericSummaries = [
    {
      label: "Gula kort",
      summary: getNumericSummary(
        predictions.map((prediction) => prediction.tournamentQuestions.yellowCards),
      ),
    },
    {
      label: "Röda kort",
      summary: getNumericSummary(
        predictions.map((prediction) => prediction.tournamentQuestions.redCards),
      ),
    },
    {
      label: "Totalt antal mål",
      summary: getNumericSummary(
        predictions.map((prediction) => prediction.tournamentQuestions.totalGoals),
      ),
    },
    {
      label: "Finalens första mål",
      summary: getNumericSummary(
        predictions.map((prediction) => prediction.tieBreaker.finalFirstGoalMinute),
      ),
    },
  ];

  return (
    <section className="panel statistics-page">
      <div className="section-heading with-icon">
        <BarChart3 aria-hidden="true" />
        <div>
          <h2>Statistik</h2>
          <p>Sammanställning av inskickade tips. Baserat på {total} inskick.</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="notice">Det finns inga inskickade tips att sammanställa ännu.</div>
      ) : (
        <div className="statistics-sections">
          <section>
            <h3>Snabbkoll</h3>
            <div className="insight-grid">
              <article className="insight-card">
                <span>Vanligaste finalen</span>
                <strong>{commonFinals[0]?.label ?? "Saknas"}</strong>
                <p>{commonFinals[0]?.percentage ?? 0}% har tippat så.</p>
              </article>
              <article className="insight-card">
                <span>Sverige vidare</span>
                <strong>{swedenAdvancePercentage}%</strong>
                <p>
                  {swedenAsWinner} som gruppetta, {swedenAsRunnerUp} som grupptvåa.
                </p>
              </article>
              <article className="insight-card">
                <span>Sveriges förväntade gruppoäng</span>
                <strong>{swedenExpectedPoints} p</strong>
                <p>Baserat på de tippade resultaten i Sveriges matcher.</p>
              </article>
              <article className="insight-card">
                <span>Mest eniga fråga</span>
                <strong>{mostAgreedItem?.label ?? "Saknas"}</strong>
                <p>
                  {mostAgreedItem?.topLabel ?? ""} leder med{" "}
                  {mostAgreedItem?.percentage ?? 0}%.
                </p>
              </article>
              <article className="insight-card">
                <span>Mest splittrad fråga</span>
                <strong>{mostSplitItem?.label ?? "Saknas"}</strong>
                <p>
                  {mostSplitItem?.topLabel ?? ""} är vanligast, men bara med{" "}
                  {mostSplitItem?.percentage ?? 0}%.
                </p>
              </article>
            </div>
          </section>

          <section>
            <h3>Sveriges matcher</h3>
            <div className="stats-card-grid">
              {initialSwedenMatches.map((match) => {
                const topResults = getTopCounts(
                  predictions.map((prediction) => {
                    const predictionMatch = prediction.swedenMatches.find(
                      (candidate) => candidate.id === match.id,
                    );

                    return predictionMatch
                      ? formatPredictionScore(
                          predictionMatch.homeGoals,
                          predictionMatch.awayGoals,
                        )
                      : "";
                  }),
                  3,
                );

                return (
                  <article className="stats-card" key={match.id}>
                    <h4>
                      {match.homeTeam} - {match.awayTeam}
                    </h4>
                    <div className="result-percent-list">
                      {topResults.map((result, index) => (
                        <div
                          className={
                            index === 0
                              ? "result-percent-row leading"
                              : "result-percent-row"
                          }
                          key={result.label}
                        >
                          <span>{result.label}</span>
                          <strong>{result.percentage}%</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Gruppspel</h3>
            <div className="group-stat-grid">
              {groups.map((group) => {
                const winnerCounts = getCountsForLabels(
                  predictions.map(
                    (prediction) =>
                      prediction.groups.find((groupPrediction) => groupPrediction.group === group)
                        ?.winner ?? "",
                  ),
                  groupTeams[group],
                );
                const runnerUpCounts = getCountsForLabels(
                  predictions.map(
                    (prediction) =>
                      prediction.groups.find((groupPrediction) => groupPrediction.group === group)
                        ?.runnerUp ?? "",
                  ),
                  groupTeams[group],
                );
                const leadingRunnerUpPercentage = Math.max(
                  ...runnerUpCounts.map((item) => item.percentage),
                );
                const sortedTeams = [...groupTeams[group]].sort((firstTeam, secondTeam) => {
                  const firstWinner = winnerCounts.find((item) => item.label === firstTeam);
                  const secondWinner = winnerCounts.find((item) => item.label === secondTeam);
                  const firstRunnerUp = runnerUpCounts.find((item) => item.label === firstTeam);
                  const secondRunnerUp = runnerUpCounts.find((item) => item.label === secondTeam);
                  const winnerDifference =
                    (secondWinner?.percentage ?? 0) - (firstWinner?.percentage ?? 0);

                  if (winnerDifference !== 0) {
                    return winnerDifference;
                  }

                  const runnerUpDifference =
                    (secondRunnerUp?.percentage ?? 0) - (firstRunnerUp?.percentage ?? 0);

                  if (runnerUpDifference !== 0) {
                    return runnerUpDifference;
                  }

                  return firstTeam.localeCompare(secondTeam, "sv-SE");
                });

                return (
                  <article className="stats-card" key={group}>
                    <h4>Grupp {group}</h4>
                    <div className="grouped-bars">
                      {sortedTeams.map((team, index) => {
                        const winner = winnerCounts.find((item) => item.label === team);
                        const runnerUp = runnerUpCounts.find((item) => item.label === team);
                        const runnerUpPercentage = runnerUp?.percentage ?? 0;

                        return (
                          <div className="team-bar-row" key={team}>
                            <strong>{team}</strong>
                            <div className="dual-bars">
                              <BarRow
                                item={{
                                  label: "Etta",
                                  count: winner?.count ?? 0,
                                  percentage: winner?.percentage ?? 0,
                                }}
                                isLeading={index === 0}
                              />
                              <BarRow
                                item={{
                                  label: "Tvåa",
                                  count: runnerUp?.count ?? 0,
                                  percentage: runnerUpPercentage,
                                }}
                                isLeading={
                                  runnerUpPercentage === leadingRunnerUpPercentage &&
                                  leadingRunnerUpPercentage > 0
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Topp 3</h3>
            <div className="stats-card-grid">
              {[
                { label: "Världsmästare", field: "champion" as const },
                { label: "Tvåa", field: "runnerUp" as const },
                { label: "Trea", field: "thirdPlace" as const },
              ].map((podiumSlot) => (
                <article className="stats-card" key={podiumSlot.field}>
                  <h4>{podiumSlot.label}</h4>
                  <div className="bar-list">
                    {getTopCounts(
                      predictions.map((prediction) => prediction.podium[podiumSlot.field]),
                      5,
                    ).map((item, index) => (
                      <BarRow item={item} isLeading={index === 0} key={item.label} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Statistik och utslagsfråga</h3>
            <div className="summary-stat-grid">
              {numericSummaries.map((entry) => (
                <article className="stats-card" key={entry.label}>
                  <h4>{entry.label}</h4>
                  {entry.summary ? (
                    <div className="summary-stat-table">
                      <span>Min</span>
                      <strong>{entry.summary.min}</strong>
                      <span>Max</span>
                      <strong>{entry.summary.max}</strong>
                      <span>Vanligast spann</span>
                      <strong>
                        {entry.summary.typicalRange.from}-{entry.summary.typicalRange.to}
                      </strong>
                    </div>
                  ) : (
                    <p>Inga svar ännu.</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function BarRow({
  isLeading = false,
  item,
}: {
  isLeading?: boolean;
  item: {
    label: string;
    count: number;
    percentage: number;
  };
}) {
  return (
    <div className={isLeading ? "bar-row leading" : "bar-row"}>
      <div className="bar-row-label">
        <span>{item.label}</span>
        <strong>{item.percentage}%</strong>
      </div>
      <div className="bar-track">
        <span style={{ width: `${item.percentage}%` }} />
      </div>
    </div>
  );
}

function StandingsView({
  onSelectPrediction,
  standings,
}: {
  onSelectPrediction: (predictionId: string) => void;
  standings: PublicPrediction[];
}) {
  const [filter, setFilter] = useState<PredictionFilter>("all");
  const filteredStandings = useMemo(
    () =>
      [...standings].sort((firstPrediction, secondPrediction) => {
        const pointDifference =
          getFilteredPoints(secondPrediction, filter) -
          getFilteredPoints(firstPrediction, filter);

        if (pointDifference !== 0) {
          return pointDifference;
        }

        return firstPrediction.initials.localeCompare(secondPrediction.initials, "sv-SE");
      }),
    [filter, standings],
  );
  const activeFilterLabel =
    predictionFilters.find((predictionFilter) => predictionFilter.id === filter)?.label ??
    "Totalt";

  return (
    <section className="panel">
      <div className="section-heading with-icon">
        <Table2 aria-hidden="true" />
        <div>
          <h2>Poängliga</h2>
          <p>
            Sortera på totalpoäng eller ett enskilt poängområde.
          </p>
        </div>
      </div>
      <div className="prediction-filters" aria-label="Filtrera poängliga">
        {predictionFilters.map((predictionFilter) => (
          <button
            className={filter === predictionFilter.id ? "active" : ""}
            key={predictionFilter.id}
            type="button"
            onClick={() => setFilter(predictionFilter.id)}
          >
            {predictionFilter.label}
          </button>
        ))}
      </div>
      <div className="standings-table" role="table" aria-label="Poängliga">
        <div className="table-row table-head" role="row">
          <span>Placering</span>
          <span>Deltagare</span>
          <span>{activeFilterLabel}</span>
        </div>
        {filteredStandings.map((prediction, index) => (
          <div className="table-row" role="row" key={prediction.id}>
            <span>{index + 1}</span>
            <button
              className="initials-link"
              type="button"
              onClick={() => onSelectPrediction(prediction.id)}
            >
              {prediction.initials}
            </button>
            <span>{getFilteredPoints(prediction, filter)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export { App };
