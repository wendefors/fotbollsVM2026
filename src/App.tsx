import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Eye,
  Medal,
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
import { samplePredictions } from "./data/samplePredictions";
import { createId } from "./lib/id";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { GroupPrediction, PredictionForm, PublicPrediction } from "./lib/types";

type View = "submit" | "receipt" | "predictions" | "standings";
type PredictionFilter =
  | "all"
  | "sweden"
  | "groups"
  | "podium"
  | "questions";

const predictionFilters: Array<{ id: PredictionFilter; label: string }> = [
  { id: "all", label: "Totalt" },
  { id: "sweden", label: "Sverige" },
  { id: "groups", label: "Gruppspel" },
  { id: "podium", label: "Topp 3" },
  { id: "questions", label: "Statistik" },
];

const emptyGroups: GroupPrediction[] = groups.map((group) => ({
  group,
  winner: "",
  runnerUp: "",
}));

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
    points: prediction.points,
  };
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
  const [view, setView] = useState<View>("submit");
  const [form, setForm] = useState<PredictionForm>(initialForm);
  const [predictions, setPredictions] = useState<PublicPrediction[]>(samplePredictions);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<PublicPrediction | null>(null);
  const isSubmissionOpen = Date.now() <= submissionDeadline.getTime();

  const standings = useMemo(
    () => [...predictions].sort((a, b) => b.points - a.points),
    [predictions],
  );

  useEffect(() => {
    async function loadPredictions() {
      if (!supabase) {
        return;
      }

      const { data, error } = await supabase
        .from("public_predictions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
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
          points: prediction.points,
        })),
      );
    }

    void loadPredictions();
  }, []);

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
    setForm((current) => ({
      ...current,
      swedenMatches: current.swedenMatches.map((match, matchIndex) =>
        matchIndex === index
          ? { ...match, [field]: value === "" ? "" : Number(value) }
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
    setForm((current) => ({
      ...current,
      tournamentQuestions: {
        ...current.tournamentQuestions,
        [field]: value === "" ? "" : Number(value),
      },
    }));
  }

  function updateTieBreaker(
    field: keyof PredictionForm["tieBreaker"],
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      tieBreaker: {
        ...current.tieBreaker,
        [field]: value === "" ? "" : Number(value),
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

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (supabase) {
        const participantId = createId();
        const { error: participantError } = await supabase.from("participants").insert({
          id: participantId,
          first_name: form.contact.firstName,
          last_name: form.contact.lastName,
          phone: form.contact.phone,
          email: form.contact.email,
        });

        if (participantError) {
          if (participantError.code === "23505") {
            setSubmitError("Den e-postadressen har redan använts för ett inskick.");
            return;
          }

          setSubmitError("Kunde inte spara kontaktuppgifterna. Försök igen.");
          return;
        }

        const predictionId = createId();
        const { error: predictionError } = await supabase.from("predictions").insert({
          id: predictionId,
          participant_id: participantId,
          sweden_matches: form.swedenMatches,
          group_predictions: form.groups,
          podium: form.podium,
          tournament_questions: form.tournamentQuestions,
          tie_breaker: form.tieBreaker,
        });

        if (predictionError) {
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
          points: 0,
        };

        setPredictions((current) => [nextPrediction, ...current]);
        setReceipt(nextPrediction);
      }

      setIsSubmitted(true);
      setForm(initialForm);
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

        <div className="deadline-panel">
          <CalendarClock aria-hidden="true" />
          <span>Tippningen stänger</span>
          <strong>{formatDateTime.format(submissionDeadline)}</strong>
        </div>
      </section>

      <nav className="tabs" aria-label="Huvudvyer">
        <button
          className={view === "submit" ? "active" : ""}
          type="button"
          onClick={() => setView("submit")}
        >
          <Send aria-hidden="true" />
          <span>Skicka in</span>
        </button>
        <button
          className={view === "predictions" ? "active" : ""}
          type="button"
          onClick={() => setView("predictions")}
        >
          <Eye aria-hidden="true" />
          <span className="desktop-label">Samtliga tippningar</span>
          <span className="mobile-label">Tips</span>
        </button>
        <button
          className={view === "standings" ? "active" : ""}
          type="button"
          onClick={() => setView("standings")}
        >
          <Trophy aria-hidden="true" />
          <span>Poängliga</span>
        </button>
      </nav>

      {!isSupabaseConfigured && (
        <div className="notice">
          Supabase är förberett men inte anslutet. Formuläret sparar därför lokalt i
          denna session tills miljövariabler och tabeller är på plats.
        </div>
      )}

      {view === "submit" && (
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

      {view === "predictions" && <PredictionsView predictions={predictions} />}

      {view === "standings" && <StandingsView standings={standings} />}
    </main>
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
              value={form.contact.firstName}
              onChange={(event) => updateContact("firstName", event.target.value)}
            />
          </label>
          <label>
            Efternamn
            <input
              value={form.contact.lastName}
              onChange={(event) => updateContact("lastName", event.target.value)}
            />
          </label>
          <label>
            Telefon
            <input
              inputMode="tel"
              value={form.contact.phone}
              onChange={(event) => updateContact("phone", event.target.value)}
            />
          </label>
          <label>
            E-post
            <input
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

function PredictionsView({ predictions }: { predictions: PublicPrediction[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Allas inskickade tips</h2>
        <p>Kontaktuppgifter visas inte publikt.</p>
      </div>
      <div className="prediction-list">
        {predictions.map((prediction) => (
          <article className="prediction-card" key={prediction.id}>
            <header>
              <strong>{prediction.initials}</strong>
              <span>{formatDateTime.format(new Date(prediction.submittedAt))}</span>
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

function StandingsView({ standings }: { standings: PublicPrediction[] }) {
  const [filter, setFilter] = useState<PredictionFilter>("all");

  return (
    <section className="panel">
      <div className="section-heading with-icon">
        <Table2 aria-hidden="true" />
        <div>
          <h2>Poängliga</h2>
          <p>
            Sorterad efter totalpoäng. Filtren för delområden aktiveras när
            poängberäkningen är uppdelad per område.
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
          <span>Poäng</span>
        </div>
        {standings.map((prediction, index) => (
          <div className="table-row" role="row" key={prediction.id}>
            <span>{index + 1}</span>
            <strong>{prediction.initials}</strong>
            <span>{prediction.points}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export { App };
