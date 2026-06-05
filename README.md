# Telegram-бот «Угадай героя Dota 2»

Групповой бот: нейросеть (Google Gemini) придумывает загадку о случайном герое, игроки отвечают в чат, очки копятся в таблице лидеров чата.

## Безопасность

Если токен бота или ключ Gemini попадали в чат или в git — **смените их**:

1. [@BotFather](https://t.me/BotFather) → `/revoke` → новый токен
2. [Google AI Studio](https://aistudio.google.com/apikey) → отозвать старый ключ → создать новый

Секреты только в файле `.env` (не коммитить).

## Требования

- Node.js 20+
- Токен Telegram-бота
- API-ключ Google Gemini (бесплатный tier)

## Установка

```bash
npm install
cp .env.example .env
# Заполните TELEGRAM_BOT_TOKEN и GEMINI_API_KEY в .env
npm run dev
```

Продакшен:

```bash
npm run build
npm start
```

Тесты:

```bash
npm test
```

## Docker (деплой на сервер)

1. Скопируйте проект на сервер и создайте `.env` из `.env.example` (токены и ключи).
2. Соберите и запустите:

```bash
docker compose up -d --build
```

3. Логи: `docker compose logs -f bot`
4. Остановка: `docker compose down` (данные SQLite остаются в volume `bot-data`).

Без compose:

```bash
docker build -t dota2heroes-bot .
docker run -d --name dota2heroes-bot --restart unless-stopped \
  --env-file .env \
  -e DATABASE_PATH=/app/data/bot.db \
  -v dota2heroes-data:/app/data \
  dota2heroes-bot
```

## Настройка бота в группе

1. Добавьте бота в группу.
2. В [@BotFather](https://t.me/BotFather): `/setprivacy` → **Disable**, чтобы бот видел ответы вида `!пудж` в чате. Либо оставьте privacy включённым и отвечайте **реплаем** на сообщение с загадкой.
3. При необходимости сделайте бота администратором (для `/cancel` админами чата).

## Команды

| Команда | Описание |
|---------|----------|
| `/riddle` | Новая текстовая загадка |
| `/emo_riddle` | Эмо-загадка (скиллы эмодзи) |
| `/hint` | Более явная подсказка |
| `/nick` | Дотаник на сегодня (Gemini) |
| `/nick new` | Перекатить ник |
| `/top` | Топ-10 за всё время |
| `/top week` | Топ недели |
| `/top month` | Топ месяца |
| `/me` | Профиль: титул, очки, серия |
| `/achievements` | Все достижения |
| `/cancel` | Сдаться (автор или админ) |
| `/help` | Правила |

Ответы — только `!имя` в чате, например `!пудж`, `!largo`.

## Система очков (Пакет C)

Очки за победу зависят от:

- **Скорость** — ≤30 сек (+5), ≤2 мин (+2)
- **Подсказки** — −2 за каждую (макс. −6)
- **Серия** — 3/5/10 побед подряд (+2/+5/+10)
- **Сложность героя** — easy ×0.8, hard ×1.2, expert ×1.5

В сообщении победы показывается разбивка: `+14 (10 база, +4 скорость, …)`.

**Ранги (как в Dota 2):** пороги медалей = MMR-границы (0 / 620 / 1380 / 2140 / 2900 / 3660 / 4420 / 5420), потолок лестницы — **15 000** очков. Отображение: «Легенда 5», «Титан 3» и т.д.

**Достижения:** 13 штук (первая кровь, демон скорости, снайпер, серии, божество, титан и др.).

**Титул недели:** победитель прошлой недели получает префикс `👑 [Король недели]` в `/nick` и `/me` на 7 дней.

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен от BotFather |
| `GEMINI_API_KEY` | Ключ Gemini API |
| `GEMINI_MODEL` | Модель (по умолчанию `gemini-flash-latest`) |
| `POINTS_PER_WIN` | Базовые очки за победу (10) |
| `MIN_POINTS_PER_WIN` | Минимум очков (1) |
| `HINT_PENALTY` | Штраф за подсказку (2) |
| `MAX_HINT_PENALTY` | Потолок штрафа (6) |
| `SPEED_BONUS_FAST` | Бонус ≤30 сек (5) |
| `SPEED_BONUS_MED` | Бонус ≤2 мин (2) |
| `STREAK_BONUS_3/5/10` | Бонусы серии |
| `DATABASE_PATH` | Путь к SQLite |
| `RIDDLE_SOURCE` | `preset` или `ai` |
| `SHOW_ANSWER` | `true` — показать ответ (тест) |
| `NICK_TIMEZONE` | Часовой пояс (`Europe/Moscow`) |
| `WEEKLY_TITLE_ENABLED` | Титул недели (true) |
| `ACHIEVEMENTS_ANNOUNCE` | Анонсы достижений (true) |
| `TITLE_EMOJI_*` | ID кастомных эмодзи для титулов |

## Скрипты

```bash
npm run generate-heroes      # обновить heroes.json с OpenDota
npm run assign-difficulty    # разметить сложность героев
npm test                     # unit-тесты scoring/titles/periods
```

## Стек

- [grammY](https://grammy.dev/) — Telegram Bot API
- [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) — Gemini
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — очки и раунды
