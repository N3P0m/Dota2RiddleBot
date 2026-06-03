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

| Команда   | Описание                          |
|-----------|-----------------------------------|
| `/riddle` | Новая загадка                     |
| `/hint`   | Более явная короткая подсказка    |
| `/nick`   | Дотаник на сегодня (Gemini), один на человека в день |
| `/nick new` | Перекатить ник на сегодня       |
| `/top`    | Топ-10 по очкам в этом чате       |
| `/me`     | Ваши очки                         |
| `/cancel` | Отмена раунда (автор или админ)   |
| `/help`   | Правила                           |

Ответы — только `!имя` в чате, например `!пудж`, `!largo` (обычные сообщения бот не обрабатывает).

## Переменные окружения

| Переменная           | Описание                    |
|----------------------|-----------------------------|
| `TELEGRAM_BOT_TOKEN` | Токен от BotFather          |
| `GEMINI_API_KEY`     | Ключ Gemini API             |
| `GEMINI_MODEL`       | Модель (по умолчанию `gemini-flash-latest`) |
| `POINTS_PER_WIN`     | Очки за победу (10)         |
| `DATABASE_PATH`      | Путь к SQLite (`./data/bot.db`) |
| `RIDDLE_SOURCE`      | `preset` (готовые) или `ai` (Gemini) |
| `SHOW_ANSWER`        | `true` — показывать ответ под загадкой (тест) |
| `NICK_TIMEZONE`      | Часовой пояс для «сегодня» (`Europe/Moscow`) |

## Обновление списка героев

```bash
npm run generate-heroes
```

Скрипт подтягивает героев с OpenDota API и пересобирает `src/heroes/heroes.json`.

## Стек

- [grammY](https://grammy.dev/) — Telegram Bot API
- [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) — Gemini
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — очки и раунды
