// Every opening in the library, with or without a full lesson yet.
// `variations` are official names from the Lichess opening list (checked by
// tests); the Recognize quiz plays their moves and asks for the name.

import { e5Black } from './e5Black';
import { italian } from './italian';
import { qgd } from './qgd';
import type { Group, OpeningLesson, Side } from './types';

export interface CatalogEntry {
  id: string;
  name: string;
  side: Side;
  group: Group;
  eco: string;
  /** Full lesson, once written. */
  lesson?: OpeningLesson;
  variations: string[];
}

export const CATALOG: CatalogEntry[] = [
  // White
  { id: 'italian', name: 'Italian Game', side: 'white', group: 'white', eco: 'C50', lesson: italian,
    variations: ['Italian Game: Giuoco Piano', 'Italian Game: Evans Gambit', 'Italian Game: Two Knights Defense', 'Italian Game: Two Knights Defense, Fried Liver Attack'] },
  { id: 'ruy-lopez', name: 'Ruy Lopez', side: 'white', group: 'white', eco: 'C60',
    variations: ['Ruy Lopez: Berlin Defense', 'Ruy Lopez: Morphy Defense', 'Ruy Lopez: Exchange Variation'] },
  { id: 'scotch', name: 'Scotch Game', side: 'white', group: 'white', eco: 'C44', variations: ['Scotch Game'] },
  { id: 'vienna', name: 'Vienna Game', side: 'white', group: 'white', eco: 'C25', variations: ['Vienna Game'] },
  { id: 'kings-gambit', name: 'King’s Gambit', side: 'white', group: 'white', eco: 'C30', variations: ["King's Gambit", "King's Gambit Accepted"] },
  { id: 'london', name: 'London System', side: 'white', group: 'white', eco: 'D02', variations: ["Queen's Pawn Game: London System"] },
  { id: 'queens-gambit', name: 'Queen’s Gambit', side: 'white', group: 'white', eco: 'D06', variations: ["Queen's Gambit"] },
  { id: 'english', name: 'English Opening', side: 'white', group: 'white', eco: 'A10', variations: ['English Opening', "English Opening: King's English Variation"] },
  { id: 'catalan', name: 'Catalan', side: 'white', group: 'white', eco: 'E00', variations: ['Catalan Opening'] },
  // Black against 1.e4
  { id: 'e5-black', name: '1...e5: Petrov & Philidor', side: 'black', group: 'black-e4', eco: 'C42', lesson: e5Black,
    variations: ["Petrov's Defense", 'Philidor Defense'] },
  { id: 'sicilian', name: 'Sicilian Defense', side: 'black', group: 'black-e4', eco: 'B20',
    variations: ['Sicilian Defense: Open', 'Sicilian Defense: Dragon Variation', 'Sicilian Defense: Accelerated Dragon', 'Sicilian Defense: Najdorf Variation'] },
  { id: 'french', name: 'French Defense', side: 'black', group: 'black-e4', eco: 'C00',
    variations: ['French Defense: Advance Variation', 'French Defense: Exchange Variation', 'French Defense: Winawer Variation'] },
  { id: 'caro-kann', name: 'Caro-Kann Defense', side: 'black', group: 'black-e4', eco: 'B10',
    variations: ['Caro-Kann Defense: Advance Variation', 'Caro-Kann Defense: Classical Variation'] },
  { id: 'scandinavian', name: 'Scandinavian Defense', side: 'black', group: 'black-e4', eco: 'B01', variations: ['Scandinavian Defense'] },
  { id: 'pirc', name: 'Pirc & Modern Defense', side: 'black', group: 'black-e4', eco: 'B07', variations: ['Pirc Defense', 'Modern Defense'] },
  { id: 'alekhine', name: 'Alekhine’s Defense', side: 'black', group: 'black-e4', eco: 'B02', variations: ['Alekhine Defense'] },
  // Black against 1.d4
  { id: 'qgd', name: 'Queen’s Gambit Declined', side: 'black', group: 'black-d4', eco: 'D30', lesson: qgd,
    variations: ["Queen's Gambit Declined"] },
  { id: 'qga', name: 'Queen’s Gambit Accepted', side: 'black', group: 'black-d4', eco: 'D20', variations: ["Queen's Gambit Accepted"] },
  { id: 'slav', name: 'Slav Defense', side: 'black', group: 'black-d4', eco: 'D10', variations: ['Slav Defense'] },
  { id: 'kings-indian', name: 'King’s Indian Defense', side: 'black', group: 'black-d4', eco: 'E60', variations: ["King's Indian Defense"] },
  { id: 'nimzo-indian', name: 'Nimzo-Indian Defense', side: 'black', group: 'black-d4', eco: 'E20', variations: ['Nimzo-Indian Defense'] },
  { id: 'grunfeld', name: 'Grünfeld Defense', side: 'black', group: 'black-d4', eco: 'D80', variations: ['Grünfeld Defense'] },
  { id: 'dutch', name: 'Dutch Defense', side: 'black', group: 'black-d4', eco: 'A80', variations: ['Dutch Defense'] },
  { id: 'benoni', name: 'Benoni Defense', side: 'black', group: 'black-d4', eco: 'A56',
    variations: ['Benoni Defense', 'Benoni Defense: Modern Variation'] },
];

export const GROUP_LABEL: Record<Group, string> = {
  white: 'White openings',
  'black-e4': 'Black against 1.e4',
  'black-d4': 'Black against 1.d4',
};

export function entry(id: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.id === id);
}

export interface PathStep {
  id: string;
  title: string;
  openings: string[];
}

/** Default learning order, easiest first. The user can reorder it. */
export const DEFAULT_PATH: PathStep[] = [
  { id: 's1', title: 'Italian Game (White)', openings: ['italian'] },
  { id: 's2', title: '1...e5 against 1.e4 (Black)', openings: ['e5-black'] },
  { id: 's3', title: 'Queen’s Gambit Declined (Black vs 1.d4)', openings: ['qgd'] },
  { id: 's4', title: 'London System (White)', openings: ['london'] },
  { id: 's5', title: 'Scotch Game (White)', openings: ['scotch'] },
  { id: 's6', title: 'Caro-Kann (Black)', openings: ['caro-kann'] },
  { id: 's7', title: 'Queen’s Gambit (White)', openings: ['queens-gambit'] },
  { id: 's8', title: 'Slav Defense (Black)', openings: ['slav'] },
  { id: 's9', title: 'Ruy Lopez (White)', openings: ['ruy-lopez'] },
  { id: 's10', title: 'French Defense (Black)', openings: ['french'] },
  { id: 's11', title: 'Vienna Game and King’s Gambit (White, attacking ideas)', openings: ['vienna', 'kings-gambit'] },
  { id: 's12', title: 'Scandinavian, Pirc, Alekhine (Black, to recognize them)', openings: ['scandinavian', 'pirc', 'alekhine'] },
  { id: 's13', title: 'Sicilian Defense (Black)', openings: ['sicilian'] },
  { id: 's14', title: 'King’s Indian and Nimzo-Indian (Black)', openings: ['kings-indian', 'nimzo-indian'] },
  { id: 's15', title: 'English, Catalan, Grünfeld, Dutch, Benoni (advanced)', openings: ['english', 'catalan', 'grunfeld', 'dutch', 'benoni'] },
];

export const LESSONS: OpeningLesson[] = CATALOG.flatMap((c) => (c.lesson ? [c.lesson] : []));

export function lesson(id: string): OpeningLesson | undefined {
  return entry(id)?.lesson;
}
