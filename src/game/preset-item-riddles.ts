import type { Item } from "../items/match.js";

const BY_ITEM_ID: Record<number, string[]> = {
  8: [
    `Чёрный посох, что дарует краткую неуязвимость к магии. В тимфайте его звон слышен за километр.`,
  ],
  5: [
    `Мгновенный скачок сквозь пространство — любимая игрушка инициаторов с плохим позиционированием.`,
  ],
  1: [
    `Съедаемое дерево, что лечит раны на линии. Пабы жуют его с первой минуты.`,
  ],
};

function genericItem(item: Item): string {
  return `Предмет из лавки, без которого паб не представить. Подсказка в названии: ${item.name_ru}. (Тестовая загадка)`;
}

export function getPresetItemRiddle(item: Item): string {
  const pool = BY_ITEM_ID[item.id];
  if (pool?.length) {
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
  return genericItem(item);
}
