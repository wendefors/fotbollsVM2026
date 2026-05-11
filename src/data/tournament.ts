import type { GroupId, MatchPrediction, ScoreRule } from "../lib/types";

export const submissionDeadline = new Date("2026-06-11T22:00:00+02:00");

export const groups: GroupId[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
];

export const groupTeams: Record<GroupId, string[]> = {
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

export const teams = Object.values(groupTeams)
  .flat()
  .sort((firstTeam, secondTeam) => firstTeam.localeCompare(secondTeam, "sv-SE"));

export const initialSwedenMatches: MatchPrediction[] = [
  {
    id: "sweden-match-1",
    label: "15 juni 04.00",
    homeTeam: "Sverige",
    awayTeam: "Tunisien",
    kickoff: "2026-06-15T04:00:00+02:00",
    venue: "Estadio BBVA, Monterrey",
    homeGoals: "",
    awayGoals: "",
  },
  {
    id: "sweden-match-2",
    label: "21 juni 19.00",
    homeTeam: "Nederländerna",
    awayTeam: "Sverige",
    kickoff: "2026-06-21T19:00:00+02:00",
    venue: "NRG Stadium, Houston",
    homeGoals: "",
    awayGoals: "",
  },
  {
    id: "sweden-match-3",
    label: "26 juni 01.00",
    homeTeam: "Japan",
    awayTeam: "Sverige",
    kickoff: "2026-06-26T01:00:00+02:00",
    venue: "AT&T Stadium, Dallas",
    homeGoals: "",
    awayGoals: "",
  },
];

export const scoreRules: ScoreRule[] = [
  {
    label: "Sveriges matcher",
    points: "3 p för exakt resultat, 1 p för rätt tecken (1, X eller 2).",
  },
  {
    label: "Gruppspel",
    points:
      "1 p för rätt gruppetta och 1 p för rätt grupptvåa. Om båda lagen är rätt men i fel ordning ges 1 p totalt för gruppen.",
  },
  {
    label: "Topp 3",
    points: "5 p för rätt världsmästare, 3 p för rätt tvåa, 2 p för rätt trea.",
  },
  {
    label: "Turneringsfrågor",
    points:
      "Gula kort och totalt antal mål: 3 p inom 3%, 2 p inom 5% och 1 p inom 10% från utfallet. Röda kort: 3 p inom 1 kort, 2 p inom 2 kort och 1 p inom 3 kort.",
  },
  {
    label: "Utslagsfråga",
    points:
      "Matchminuten för första målet i finalen. Detta är inte poänggivande utan används bara för att skilja tippare åt vid lika många poäng.",
  },
];
