export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type MatchPrediction = {
  id: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  kickoff?: string;
  venue?: string;
  homeGoals: number | "";
  awayGoals: number | "";
};

export type GroupPrediction = {
  group: GroupId;
  winner: string;
  runnerUp: string;
};

export type PodiumPrediction = {
  champion: string;
  runnerUp: string;
  thirdPlace: string;
};

export type TournamentQuestions = {
  yellowCards: number | "";
  redCards: number | "";
  totalGoals: number | "";
};

export type TieBreakerPrediction = {
  finalFirstGoalMinute: number | "";
};

export type ContactInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

export type PredictionForm = {
  contact: ContactInfo;
  swedenMatches: MatchPrediction[];
  groups: GroupPrediction[];
  podium: PodiumPrediction;
  tournamentQuestions: TournamentQuestions;
  tieBreaker: TieBreakerPrediction;
};

export type PublicPrediction = {
  id: string;
  initials: string;
  submittedAt: string;
  swedenMatches: MatchPrediction[];
  groups: GroupPrediction[];
  podium: PodiumPrediction;
  tournamentQuestions: TournamentQuestions;
  tieBreaker: TieBreakerPrediction;
  swedenPoints: number;
  groupPoints: number;
  podiumPoints: number;
  statisticsPoints: number;
  points: number;
  tieBreakerDistance: number | null;
};

export type ScoreRule = {
  label: string;
  points: string;
};
