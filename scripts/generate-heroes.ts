/**
 * One-time script: fetches heroes from OpenDota and writes heroes.json with RU names.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Official / community Russian names in Dota 2 RU client */
const RU_NAMES: Record<string, string> = {
  "Anti-Mage": "Антимаг",
  Axe: "Акс",
  Bane: "Бейн",
  Bloodseeker: "Кровопийца",
  "Crystal Maiden": "Кристалка",
  "Drow Ranger": "Дровка",
  Earthshaker: "Шейкер",
  Juggernaut: "Джаггер",
  Mirana: "Мирана",
  Morphling: "Морфлинг",
  "Shadow Fiend": "Шадоу Фиенд",
  "Phantom Lancer": "Пл",
  Puck: "Пак",
  Pudge: "Пудж",
  Razor: "Рейзор",
  "Sand King": "Санд Кинг",
  "Storm Spirit": "Шторм",
  Sven: "Свен",
  Tiny: "Тайни",
  "Vengeful Spirit": "Венга",
  Windranger: "Виндранер",
  Zeus: "Зевс",
  Kunkka: "Кункка",
  Lina: "Лина",
  Lion: "Лайон",
  "Shadow Shaman": "Шаман",
  Slardar: "Слардар",
  Tidehunter: "Тайдхунтер",
  "Witch Doctor": "Вд",
  Lich: "Лич",
  Riki: "Рики",
  Enigma: "Энигма",
  Tinker: "Тинкер",
  Sniper: "Снайпер",
  Necrophos: "Некрофос",
  Warlock: "Варлок",
  Beastmaster: "Бистмастер",
  "Queen of Pain": "Квопа",
  Venomancer: "Веномансер",
  "Faceless Void": "Войд",
  "Wraith King": "Вк",
  "Death Prophet": "Дп",
  "Phantom Assassin": "Па",
  Pugna: "Пугна",
  "Templar Assassin": "Та",
  Viper: "Вайпер",
  Luna: "Луна",
  "Dragon Knight": "Дк",
  Dazzle: "Дазл",
  Clockwerk: "Клокерк",
  "Nature's Prophet": "Фурик",
  Lifestealer: "Лайфстилер",
  "Dark Seer": "Дарк Сир",
  Clinkz: "Клинкз",
  Omniknight: "Омник",
  Enchantress: "Энча",
  Huskar: "Хускар",
  "Night Stalker": "Нс",
  "Broodmother": "Бруда",
  "Bounty Hunter": "Бх",
  Weaver: "Вивер",
  Jakiro: "Жакиро",
  Batrider: "Батрайдер",
  Chen: "Чен",
  Spectre: "Спектра",
  Doom: "Дум",
  "Ancient Apparition": "Аа",
  "Spirit Breaker": "Бара",
  "Gyrocopter": "Гиро",
  Alchemist: "Алхимик",
  Invoker: "Инвокер",
  Silencer: "Сайленсер",
  "Outworld Destroyer": "Од",
  "Lone Druid": "Лонг Друид",
  Brewmaster: "Панда",
  "Shadow Demon": "Сд",
  "Chaos Knight": "Чк",
  Meepo: "Мипо",
  "Treant Protector": "Треант",
  "Ogre Magi": "Огр",
  Undying: "Айо",
  Rubick: "Рубик",
  Disruptor: "Дизраптор",
  "Nyx Assassin": "Никс",
  "Naga Siren": "Нага",
  "Keeper of the Light": "Котл",
  Io: "Висп",
  Visage: "Висаж",
  Slark: "Сларк",
  Medusa: "Медуза",
  "Troll Warlord": "Тролль",
  "Centaur Warrunner": "Кентавр",
  Magnus: "Магнус",
  Timbersaw: "Тимбер",
  Bristleback: "Бристл",
  Tusk: "Туск",
  "Skywrath Mage": "Скай",
  Abaddon: "Абаддон",
  "Elder Titan": "Титан",
  "Legion Commander": "Легион",
  "Ember Spirit": "Эмбер",
  "Earth Spirit": "Эрт Спирит",
  "Underlord": "Андерлорд",
  Terrorblade: "Тб",
  Phoenix: "Феникс",
  Oracle: "Оракул",
  "Winter Wyvern": "Виверна",
  "Arc Warden": "Арк",
  "Monkey King": "Мк",
  "Dark Willow": "Виллоу",
  Pangolier: "Панго",
  Grimstroke: "Грим",
  Mars: "Марс",
  Snapfire: "Снап",
  Hoodwink: "Худвинк",
  Dawnbreaker: "Дб",
  Marci: "Марси",
  "Primal Beast": "Зверь",
  Muerta: "Муэрта",
  Ringmaster: "Рингмастер",
  Kez: "Кез",
  Largo: "Ларго",
};

const ALIASES: Record<string, string[]> = {
  "Anti-Mage": ["антимаг", "am", "ам"],
  Bloodseeker: ["бладсикер", "блодсикер", "блудсикер", "bs", "бс", "кровопий"],
  "Shadow Fiend": ["sf", "невермор", "shadowfiend", "шадоуфиенд"],
  "Crystal Maiden": ["cm", "кристал", "кристалмейден"],
  "Phantom Lancer": ["pl", "пл"],
  Pudge: ["пудж", "мясник"],
  Invoker: ["инв", "инвок"],
  "Faceless Void": ["войд", "void"],
  "Wraith King": ["вк", "скелет", "skeleton king"],
  "Queen of Pain": ["квопа", "qop", "квоп"],
  "Nature's Prophet": ["фурик", "фур", "np", "пророк"],
  "Outworld Destroyer": ["од", "od", "outworld"],
  "Spirit Breaker": ["бара", "баратрум", "charger"],
  "Bounty Hunter": ["бх", "bh", "гача"],
  "Night Stalker": ["нс", "ns", "сталкер"],
  "Witch Doctor": ["вд", "wd", "доктор"],
  "Templar Assassin": ["та", "ta"],
  "Phantom Assassin": ["па", "pa"],
  "Death Prophet": ["дп", "dp"],
  Io: ["висп", "wisp"],
  "Keeper of the Light": ["котл", "ezalor", "котёл"],
  "Lone Druid": ["друид", "ld", "медведь"],
  Brewmaster: ["панда", "panda"],
  Meepo: ["мипо", "мипы"],
  Rubick: ["руб", "рубик"],
  Terrorblade: ["тб", "tb"],
  "Monkey King": ["мк", "mk", "обезьяна"],
  Clockwerk: ["клок", "clock"],
  Windranger: ["винда", "wr"],
  Zeus: ["зевс", "zuus"],
  "Sand King": ["ск", "sandking"],
  "Storm Spirit": ["шторм", "storm"],
  Slark: ["сларк", "рыба"],
  Medusa: ["медуза", "горгона"],
  Magnus: ["маг", "магнус"],
  Timbersaw: ["тимбер", "тимбр"],
  "Ember Spirit": ["эмбер", "ember"],
  "Earth Spirit": ["эрт", "earthspirit"],
  Underlord: ["питлорд", "pitlord"],
  "Gyrocopter": ["гиро", "gyro"],
  "Skywrath Mage": ["скай", "sky"],
  "Elder Titan": ["титан", "et"],
  "Legion Commander": ["легион", "lc"],
  "Centaur Warrunner": ["кент", "cent"],
  "Nyx Assassin": ["никс", "nyx"],
  "Naga Siren": ["нага", "naga"],
  "Chaos Knight": ["чк", "ck", "хаос"],
  "Shadow Demon": ["сд", "sd"],
  "Dark Seer": ["сир", "seer"],
  Lifestealer: ["найкс", "naix", "лайф"],
  Omniknight: ["омни", "omni"],
  Enchantress: ["энча", "encha"],
  "Broodmother": ["бруда", "brood"],
  Spectre: ["спектра", "spec"],
  "Ancient Apparition": ["аа", "aa", "калдун"],
  Disruptor: ["диз", "disruptor"],
  Oracle: ["оракул"],
  "Winter Wyvern": ["виверна", "ww"],
  "Dark Willow": ["виллоу", "willow"],
  Pangolier: ["панго", "pango"],
  Grimstroke: ["грим", "grim"],
  Snapfire: ["снап", "бабка"],
  Hoodwink: ["худвинк", "белка"],
  Dawnbreaker: ["дб", "db", "заря"],
  "Primal Beast": ["зверь", "beast"],
  Ringmaster: ["ринг", "циркач"],
};

function buildAliases(nameEn: string, nameRu: string): string[] {
  const extra = ALIASES[nameEn] ?? [];
  const base = [
    nameEn.toLowerCase(),
    nameRu.toLowerCase(),
    nameEn.replace(/[\s'-]/g, "").toLowerCase(),
    nameRu.replace(/[\s'-]/g, "").toLowerCase(),
  ];
  return [...new Set([...base, ...extra])];
}

type OpenDotaHero = {
  id: number;
  localized_name: string;
  roles: string[];
  primary_attr: string;
};

async function main() {
  const res = await fetch("https://api.opendota.com/api/heroes");
  const heroes = (await res.json()) as OpenDotaHero[];

  const output = heroes.map((h) => {
    const nameEn = h.localized_name;
    const nameRu = RU_NAMES[nameEn] ?? nameEn;
    return {
      id: h.id,
      name_en: nameEn,
      name_ru: nameRu,
      roles: h.roles,
      primary_attr: h.primary_attr,
      aliases: buildAliases(nameEn, nameRu),
    };
  });

  const outPath = join(__dirname, "../src/heroes/heroes.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Wrote ${output.length} heroes to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
