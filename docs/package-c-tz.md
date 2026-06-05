# Техническое задание: Пакет C — «Глубокая мета»

**Проект:** dota2heroes-bot (Telegram-бот «Угадай героя Dota 2»)  
**Версия ТЗ:** 1.0  
**Оценка:** 1–2 недели  
**Зависимости:** включает полностью Пакеты A и B

---

## 1. Цель и контекст

### 1.1. Проблема

Текущая рейтинговая система — плоский счётчик: фиксированные `+10` очков за победу, топ по `points`/`wins`. Не учитываются подсказки, скорость, сложность героя, серии побед, периоды и долгосрочная мотивация.

### 1.2. Цель Пакета C

Построить **полноценную мета-систему прогрессии** для групповых чатов:

- честное начисление очков;
- сезонные и вечные рейтинги;
- ранги с визуальными титулами;
- сложность героев;
- достижения;
- связь с системой дотаников.

### 1.3. Границы (out of scope)

- Elo/MMR и PvP-рейтинг между игроками
- Глобальный кросс-чатовый топ
- Штрафы за неверные ответы
- Web-дашборд / админ-панель
- Платные награды (Stars)
- Автоматическая генерация кастомных эмодзи (только интеграция готовых ID)

---

## 2. Текущее состояние (as-is)

| Компонент | Файл | Поведение |
|-----------|------|-----------|
| Очки | `src/game/round.ts` → `addWin()` | Фикс `config.pointsPerWin` (10) |
| Счёт | `scores` | `points`, `wins` на `(chat_id, user_id)` |
| Раунд | `rounds` | Есть `started_at`, `hints_used`, но не влияют на очки |
| Топ | `/top`, `formatLeaderboard()` | Топ-10 all-time |
| Профиль | `/me`, `formatMe()` | Очки + победы |
| Герои | `heroes.json` | `id`, имена, `roles`, `aliases` — без сложности |
| Дотаники | `DailyNickService` | Отдельно от рейтинга; `nick_profiles` для отображения в топе |

---

## 3. Состав пакета

Пакет C = **A + B + расширения C**.

### Пакет A (база)

1. Динамические очки (подсказки + скорость)
2. Ранги/титулы в `/me` и `/top`

### Пакет B (сезоны)

3. Таблица истории раундов `round_results`
4. Серии побед (streak)
5. `/top week`, `/top month`

### Пакет C (мета)

6. Коэффициент сложности героя
7. Система достижений
8. Интеграция титула недели с дотаниками
9. Кастомные Telegram-эмодзи для титулов (опционально, с fallback)

---

## 4. Функциональные требования

### 4.1. FR-A1: Расчёт очков за раунд

**Триггер:** успешный `checkAnswer()` в `GameService`.

**Формула (базовая, настраиваемая):**

```
base        = POINTS_PER_WIN (10)
hintPenalty = min(hints_used * HINT_PENALTY, MAX_HINT_PENALTY)
speedBonus  = f(elapsed_ms)   // ступенчато
diffMult    = hero.difficulty_multiplier
streakBonus = f(current_streak)

points = round((base - hintPenalty + speedBonus + streakBonus) * diffMult)
min_points = MIN_POINTS_PER_WIN (1)
```

**Ступени скорости (по умолчанию):**

| Время от `started_at` | Бонус |
|----------------------|-------|
| ≤ 30 сек | +5 |
| ≤ 2 мин | +2 |
| > 2 мин | 0 |

**Штраф за подсказки (по умолчанию):**

| `hints_used` | Штраф |
|--------------|-------|
| 0 | 0 |
| 1 | −2 |
| 2 | −4 |
| 3+ | −6 (cap) |

**Отображение:** в `formatWin()` показывать разбивку:  
`+12 (база 10, −2 подсказка, +4 скорость, ×1.2 сложность)`

**Критерий:** при 0 подсказок и быстром ответе очки > базовых; при 3+ подсказках — меньше базовых.

---

### 4.2. FR-A2: Ранги (титулы)

**Пороги (настраиваемые):**

| ID | Название | min points | Fallback emoji |
|----|----------|------------|----------------|
| `creep` | Крип | 0 | 🐾 |
| `support` | Саппорт | 50 | 🛡 |
| `carry` | Керри | 150 | ⚔️ |
| `core` | Кор | 300 | 🔥 |
| `divine` | Божество | 500 | 👑 |

**Отображение:**

- `/me` — титул + очки + победы + streak + топ-3 достижения
- `/top` — титул перед именем
- `getLeaderboard()` — JOIN с `nick_profiles` (уже есть)

**Кастомные эмодзи (опционально):**

- `<tg-emoji emoji-id="...">⚔️</tg-emoji>` если задан `TITLE_EMOJI_<ID>` в env
- иначе fallback Unicode

---

### 4.3. FR-B1: История раундов

Каждая завершённая победа пишется в `round_results`.

**Поля события:**

- `chat_id`, `user_id`, `hero_id`
- `points_earned`, `hints_used`, `elapsed_ms`
- `difficulty_multiplier`
- `streak_after` (серия после победы)
- `won_at` (Unix ms)
- `period_week`, `period_month` (строки для индексации, TZ из `NICK_TIMEZONE`)

**Не писать:** сдачи (`/cancel`), раунды без победителя.

---

### 4.4. FR-B2: Серии побед (streak)

**Правила:**

- Победа игрока X → `current_streak + 1` для X в этом `chat_id`
- Победа другого игрока Y → streak всех остальных в чате сбрасывается в 0
- Сдача без победителя → streak не меняется

**Бонус к очкам (по умолчанию):**

| Streak | Бонус |
|--------|-------|
| 3 | +2 |
| 5 | +5 |
| 10 | +10 |

**Хранение:** `scores.current_streak`, `scores.best_streak`.

**UI:** при streak ≥ 3 — строка в `formatWin()`: `🔥 Серия: 5 подряд!`

---

### 4.5. FR-B3: Периодические топы

**Новые команды:**

| Команда | Описание |
|---------|----------|
| `/top week` | Топ-10 за текущую неделю (пн 00:00 — вс 23:59, `NICK_TIMEZONE`) |
| `/top month` | Топ-10 за текущий месяц |
| `/top` | All-time (как сейчас) |

**Callback-кнопки:** под сообщением топа — `Неделя | Месяц | Всё время`.

**Агрегация:** `SUM(points_earned)` из `round_results` за период, tie-break: `COUNT(*)`, затем `MAX(won_at)`.

---

### 4.6. FR-C1: Сложность героя

**Источник:** поле `difficulty` в `heroes.json` + runtime-статистика.

**Уровни:**

| Уровень | multiplier | Критерий (стартовый) |
|---------|------------|----------------------|
| `easy` | 0.8 | Топ-30 по пикрейту / ручной список |
| `normal` | 1.0 | По умолчанию |
| `hard` | 1.2 | Новые/нишевые герои |
| `expert` | 1.5 | Ручной список (Kez, Largo и т.д.) |

**Адаптивная донастройка (фаза 2 внутри C):**

- Раз в N раундов пересчитывать по чату: `% побед без подсказок за 30 дней`
- Если < 40% без подсказок → `hard`; если > 70% → `easy`
- Хранить в `hero_chat_stats` (опционально, можно отложить на C.2)

**Отображение:** в `formatWin()` при `multiplier ≠ 1.0` — `×1.2 сложный герой`.

---

### 4.7. FR-C2: Достижения

**Новая команда:** `/achievements` (алиас `/ach`).

**Каталог (MVP, 12 штук):**

| ID | Название | Условие |
|----|----------|---------|
| `first_blood` | Первая кровь | Первая победа в чате |
| `speed_demon` | Демон скорости | Победа < 15 сек без подсказок |
| `no_hints_10` | Снайпер | 10 побед без подсказок (суммарно) |
| `streak_5` | В ударе | Серия 5 |
| `streak_10` | Неостановимый | Серия 10 |
| `hard_hero_5` | Знаток ниши | 5 побед на героях `hard`/`expert` |
| `weekly_king` | Король недели | #1 в `/top week` |
| `monthly_legend` | Легенда месяца | #1 в `/top month` |
| `centurion` | Сотня | 100 побед в чате |
| `riddle_starter` | Загадыватель | 50 запущенных `/riddle` |
| `all_roles` | Универсал | Победы на 5+ разных `primary_attr` |
| `divine_rank` | Божество | Достичь титула Divine |

**Поведение:**

- Проверка после каждой победы + при закрытии недели/месяца (лениво при следующем `/top week`)
- При разблокировке — отдельное короткое сообщение в чат: `🏅 Иван получил достижение «Снайпер»!`
- В `/me` — 3 последних; в `/achievements` — полный список (полученные / не полученные)

**Хранение:** `user_achievements (user_id, chat_id, achievement_id, unlocked_at)`.

---

### 4.8. FR-C3: Интеграция с дотаниками

**Механика «Титул недели»:**

1. В понедельник 00:05 (`NICK_TIMEZONE`) определяется #1 прошлой недели по `round_results`.
2. Победителю выставляется `weekly_title` на 7 дней.
3. В `/nick` и `/me` к дотанику добавляется префикс титула.

**Пример:**

```
📛 Твой дотаник на 5 июня

👑 [Король недели] ShadowFiend_420

230 очков · Керри · серия 3
```

**Хранение:** `weekly_titles (user_id, chat_id, title, week_key, expires_at)`.

**Правила:**

- Один титул на пользователя на чат
- При ничьей по очкам — больше побед за неделю
- Титул не меняет сам ник в БД, только отображение (prefix в `formatDailyNick` / `formatMe`)
- Опционально: при выдаче титула — 1 бесплатный перекат ника (`bonus_reroll`)

---

## 5. Модель данных

### 5.1. Изменения `scores`

```sql
ALTER TABLE scores ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN riddles_started INTEGER NOT NULL DEFAULT 0;
```

### 5.2. Новая таблица `round_results`

```sql
CREATE TABLE round_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  hero_id INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER NOT NULL,
  difficulty_multiplier REAL NOT NULL DEFAULT 1.0,
  streak_after INTEGER NOT NULL DEFAULT 0,
  won_at INTEGER NOT NULL,
  period_week TEXT NOT NULL,
  period_month TEXT NOT NULL
);
CREATE INDEX idx_round_results_chat_week ON round_results(chat_id, period_week);
CREATE INDEX idx_round_results_chat_month ON round_results(chat_id, period_month);
CREATE INDEX idx_round_results_user ON round_results(user_id, won_at DESC);
```

### 5.3. Новая таблица `user_achievements`

```sql
CREATE TABLE user_achievements (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id, achievement_id)
);
```

### 5.4. Новая таблица `weekly_titles`

```sql
CREATE TABLE weekly_titles (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  week_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
```

### 5.5. Опционально `hero_chat_stats` (фаза C.2)

```sql
CREATE TABLE hero_chat_stats (
  chat_id TEXT NOT NULL,
  hero_id INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  wins_no_hints INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, hero_id)
);
```

### 5.6. Расширение `heroes.json`

```json
{
  "id": 137,
  "name_en": "Largo",
  "difficulty": "expert"
}
```

Дефолт при отсутствии поля: `"normal"`.

---

## 6. Архитектура кода

### 6.1. Новые модули

| Модуль | Ответственность |
|--------|-----------------|
| `src/game/scoring.ts` | `calculateRoundPoints()`, `formatPointsBreakdown()` |
| `src/game/titles.ts` | Пороги, `getTitleByPoints()`, `formatTitleBadge()` |
| `src/game/achievements.ts` | Каталог, `checkAchievements()`, `formatAchievements()` |
| `src/game/hero-difficulty.ts` | Множители, чтение из `heroes.json` |
| `src/game/periods.ts` | `weekKey()`, `monthKey()` по `NICK_TIMEZONE` |
| `src/game/weekly-title.ts` | Выдача/чтение титула недели |
| `scripts/assign-hero-difficulty.ts` | Разовая разметка героев |

### 6.2. Изменяемые модули

| Модуль | Изменения |
|--------|-----------|
| `src/game/round.ts` | Расчёт очков, запись `round_results`, streak, achievements hook |
| `src/db/repository.ts` | CRUD для новых таблиц, периодические топы, миграции |
| `src/db/schema.sql` | Новые таблицы и колонки |
| `src/bot/format.ts` | `formatMe`, `formatLeaderboard`, `formatWin`, `formatAchievements` |
| `src/bot/handlers.ts` | `/top week`, `/top month`, `/achievements` |
| `src/bot/commands.ts` | Регистрация команд в BotFather |
| `src/bot/keyboards.ts` | Переключатель периода в топе |
| `src/config.ts` | Параметры scoring, emoji IDs |
| `src/index.ts` | Планировщик weekly title (setInterval / cron) |

### 6.3. Поток победы (to-be)

```
!пудж → checkAnswer()
  → calculateRoundPoints(round, hero)
  → addWin(points)
  → recordRoundResult(...)
  → updateStreaks(winner, chat)
  → checkAchievements(winner, chat, context)
  → maybe announce new achievements
  → formatWin(with breakdown)
```

---

## 7. Конфигурация (env)

| Переменная | Default | Описание |
|------------|---------|----------|
| `POINTS_PER_WIN` | 10 | База |
| `MIN_POINTS_PER_WIN` | 1 | Минимум за победу |
| `HINT_PENALTY` | 2 | Штраф за подсказку |
| `MAX_HINT_PENALTY` | 6 | Потолок штрафа |
| `SPEED_BONUS_FAST` | 5 | ≤ 30 сек |
| `SPEED_BONUS_MED` | 2 | ≤ 120 сек |
| `STREAK_BONUS_3` | 2 | |
| `STREAK_BONUS_5` | 5 | |
| `STREAK_BONUS_10` | 10 | |
| `TITLE_EMOJI_CARRY` | — | custom_emoji_id |
| `TITLE_EMOJI_DIVINE` | — | custom_emoji_id |
| `WEEKLY_TITLE_ENABLED` | true | Титул недели |
| `ACHIEVEMENTS_ANNOUNCE` | true | Публичное объявление |

---

## 8. UX / тексты

### 8.1. Обновить `HELP_TEXT`

Добавить:

- `/top week`, `/top month`
- `/achievements`
- кратко: очки зависят от скорости и подсказок
- титулы и достижения

### 8.2. Примеры сообщений

**Победа:**

```
✅ Иван угадал(а): Пудж (Pudge)!
+14 очков (10 база, +4 скорость, 🔥 серия +2)
🐾 → ⚔️ Новый титул: Керри!
```

**Топ недели:**

```
🏆 Топ недели (2–8 июня)

1. ⚔️ ShadowFiend — 84 очка (7 побед)
2. 🛡 SupportGuy — 61 очко (6 побед)
```

---

## 9. Нефункциональные требования

| ID | Требование |
|----|------------|
| NFR-1 | Обратная совместимость: старые `scores` без миграции данных |
| NFR-2 | Миграции через `Repository.migrate()` (как сейчас) |
| NFR-3 | Все расчёты детерминированы и покрыты unit-тестами |
| NFR-4 | Запрос топа недели < 50 ms на SQLite до 10k `round_results` |
| NFR-5 | Не ломать текущие команды `/riddle`, `/nick`, `/cancel` |
| NFR-6 | Логирование: `[Scoring]`, `[Achievement]`, `[WeeklyTitle]` |

---

## 10. План реализации

### Этап 1 — Scoring + Titles (2–3 дня)

- [ ] `scoring.ts`, `titles.ts`
- [ ] Расширить `checkAnswer()` / `addWin()`
- [ ] Обновить `formatWin`, `formatMe`, `formatLeaderboard`
- [ ] Unit-тесты формулы

### Этап 2 — История + Streak + Периоды (2–3 дня)

- [ ] `round_results`, миграции
- [ ] Streak-логика
- [ ] `/top week`, `/top month`, кнопки
- [ ] `periods.ts`

### Этап 3 — Сложность героев (1–2 дня)

- [ ] `difficulty` в `heroes.json`
- [ ] `hero-difficulty.ts`
- [ ] Скрипт первичной разметки
- [ ] Отображение в breakdown

### Этап 4 — Достижения (2–3 дня)

- [ ] `achievements.ts`, `user_achievements`
- [ ] `/achievements`
- [ ] Проверка после победы
- [ ] Публичные анонсы

### Этап 5 — Дотаники + Weekly Title (1–2 дня)

- [ ] `weekly_titles`, планировщик
- [ ] Префикс в `formatDailyNick`, `formatMe`
- [ ] Опционально bonus reroll

### Этап 6 — Кастомные эмодзи (0.5–1 день, опционально)

- [ ] `formatTitleBadge()` с `<tg-emoji>`
- [ ] env-маппинг ID
- [ ] Fallback на Unicode

### Этап 7 — Полировка (1 день)

- [ ] HELP, BotFather commands
- [ ] README
- [ ] Ручной тест в группе

---

## 11. Критерии приёмки

### Scoring

- [ ] 0 подсказок, ответ за 20 сек → очки > 10
- [ ] 3 подсказки → очки < 10
- [ ] Breakdown виден в сообщении победы

### Streak

- [ ] 3 победы подряд одним игроком → бонус с 3-й
- [ ] Победа другого → streak первого = 0

### Периоды

- [ ] `/top week` не включает победы прошлого месяца
- [ ] All-time топ не меняет логику сортировки

### Сложность

- [ ] `expert` герой даёт ×1.5 к итоговым очкам
- [ ] В `heroes.json` ≥ 90% героев имеют `difficulty`

### Достижения

- [ ] `speed_demon` срабатывает при < 15 сек, 0 подсказок
- [ ] Повторно одно достижение не выдаётся
- [ ] `/achievements` показывает прогресс

### Дотаники

- [ ] Победитель прошлой недели видит `👑 [Король недели]` в `/nick`
- [ ] Через 7 дней префикс исчезает автоматически

### Регрессия

- [ ] `/riddle`, `/hint`, `/cancel`, `/nick` работают как раньше
- [ ] Существующая БД мигрирует без потери данных

---

## 12. Тестирование

### Unit-тесты

- `calculateRoundPoints` — все комбинации
- `getTitleByPoints` — границы порогов
- `checkAchievements` — каждое условие
- `weekKey` / `monthKey` — DST и `NICK_TIMEZONE`

### Интеграционные (ручные)

1. Два игрока, серия и сброс
2. Победа с подсказкой vs без
3. `/top week` после 3 побед в разные дни
4. Достижение + анонс в чат
5. Weekly title в `/nick`

---

## 13. Риски

| Риск | Митигация |
|------|-----------|
| Сложная формула путает игроков | Breakdown в сообщении + `/help` |
| Спам анонсами достижений | Флаг `ACHIEVEMENTS_ANNOUNCE`, батчинг |
| Ручная разметка сложности субъективна | Позже — адаптивная статистика (C.2) |
| Кастомные эмодзи не работают без Premium | Fallback Unicode всегда |
| Планировщик weekly title при рестарте | Проверка при старте: «пропущена ли прошлая неделя» |

---

## 14. Deliverables

1. Код всех этапов 1–7
2. Миграции SQLite
3. Обновлённый `heroes.json` с `difficulty`
4. Скрипт `assign-hero-difficulty.ts`
5. Unit-тесты scoring/achievements/periods
6. Обновлённые `README.md` и `HELP_TEXT`
7. (Опционально) `scripts/create-rank-emojis.ts` + ассеты
