# RICH HALL Admin API

Cloudflare Worker проверяет вход в админку и одним коммитом сохраняет список залов и новые фотографии в GitHub.

Также Worker принимает заявки бронирования по адресу `/api/booking` и пересылает их в Telegram.

## Секреты

Перед публикацией Worker должны быть заданы:

- `ADMIN_PASSWORD_HASH` — SHA-256-хеш случайного пароля администратора;
- `SESSION_SECRET` — случайная строка для подписи сессий;
- `GITHUB_TOKEN` — fine-grained GitHub token с доступом `Contents: Read and write` только к репозиторию `rich-hall-minsk`.
- `TELEGRAM_BOT_TOKEN` — токен Telegram-бота для уведомлений о заявках;
- `TELEGRAM_CHAT_ID` — ID чата, куда отправлять заявки.

Секреты нельзя добавлять в файлы проекта или отправлять в чат.

## Команды

```bash
npm install
npm run worker:login
npm run worker:secret:password
npm run worker:secret:session
npm run worker:secret:github
npm run worker:secret:telegram-token
npm run worker:secret:telegram-chat
npm run worker:deploy
```

Чтобы безопасно сгенерировать 192-битный пароль и его хеш, выполните `npm run worker:password:generate`. В Cloudflare передаётся только значение поля `hash`; пароль не добавляется в репозиторий. Сам пароль сохраните в менеджере паролей.

После первой публикации адрес Worker нужно указать в `admin/config.js`.
