/**
 * One-time script: assign difficulty to all heroes in heroes.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const heroesPath = join(__dirname, "../src/heroes/heroes.json");

type HeroDifficulty = "easy" | "normal" | "hard" | "expert";

type Hero = {
  id: number;
  name_en: string;
  difficulty?: HeroDifficulty;
  [key: string]: unknown;
};

/** Top pick rate / iconic heroes — easy to guess. */
const EASY = new Set([
  "Pudge",
  "Invoker",
  "Phantom Assassin",
  "Shadow Fiend",
  "Juggernaut",
  "Anti-Mage",
  "Crystal Maiden",
  "Drow Ranger",
  "Sniper",
  "Axe",
  "Lina",
  "Lion",
  "Windranger",
  "Zeus",
  "Earthshaker",
  "Tidehunter",
  "Witch Doctor",
  "Omniknight",
  "Slark",
  "Faceless Void",
  "Tinker",
  "Rubick",
  "Mirana",
  "Queen of Pain",
  "Templar Assassin",
  "Ursa",
  "Wraith King",
  "Dragon Knight",
  "Viper",
  "Bounty Hunter",
]);

/** Niche / newest / rarely picked — expert. */
const EXPERT = new Set([
  "Kez",
  "Largo",
  "Ringmaster",
  "Muerta",
  "Marci",
  "Dawnbreaker",
  "Hoodwink",
  "Primal Beast",
]);

/** Recent or less common — hard. */
const HARD = new Set([
  "Snapfire",
  "Void Spirit",
  "Grimstroke",
  "Mars",
  "Pangolier",
  "Dark Willow",
  "Monkey King",
  "Arc Warden",
  "Oracle",
  "Winter Wyvern",
  "Phoenix",
  "Terrorblade",
  "Ember Spirit",
  "Earth Spirit",
  "Abaddon",
  "Elder Titan",
  "Visage",
  "Chen",
  "Enchantress",
  "Io",
  "Meepo",
  "Broodmother",
  "Arc Warden",
  "Lone Druid",
  "Beastmaster",
  "Brewmaster",
  "Clockwerk",
  "Dark Seer",
  "Magnus",
  "Timbersaw",
  "Undying",
  "Nyx Assassin",
  "Weaver",
  "Spectre",
  "Medusa",
  "Naga Siren",
  "Outworld Destroyer",
  "Silencer",
  "Disruptor",
  "Keeper of the Light",
  "Skywrath Mage",
  "Ogre Magi",
  "Batrider",
  "Huskar",
  "Night Stalker",
  "Spirit Breaker",
  "Centaur Warrunner",
  "Treant Protector",
  "Ogre Magi",
]);

const heroes = JSON.parse(readFileSync(heroesPath, "utf-8")) as Hero[];

let easy = 0;
let hard = 0;
let expert = 0;
let normal = 0;

for (const hero of heroes) {
  if (EXPERT.has(hero.name_en)) {
    hero.difficulty = "expert";
    expert++;
  } else if (EASY.has(hero.name_en)) {
    hero.difficulty = "easy";
    easy++;
  } else if (HARD.has(hero.name_en)) {
    hero.difficulty = "hard";
    hard++;
  } else {
    hero.difficulty = "normal";
    normal++;
  }
}

writeFileSync(heroesPath, JSON.stringify(heroes, null, 2) + "\n", "utf-8");

const total = heroes.length;
const withDiff = heroes.filter((h) => h.difficulty).length;
console.log(
  `Assigned difficulty to ${total} heroes: easy=${easy}, normal=${normal}, hard=${hard}, expert=${expert}`,
);
console.log(`Coverage: ${((withDiff / total) * 100).toFixed(1)}%`);
