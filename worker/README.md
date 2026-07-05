# RICH HALL Admin API

Cloudflare Worker проверяет вход в админку и одним коммитом сохраняет список залов и новые фотографии в GitHub.

## Секреты

Перед публикацией Worker должны быть заданы:

- `ADMIN_PASSWORD_HASH` — SHA-256 пароля администратора;
- `SESSION_SECRET` — случайная строка для подписи сессий;
- `GITHUB_TOKEN` — fine-grained GitHub token с доступом `Contents: Read and write` только к репозиторию `rich-hall-minsk`.

Секреты нельзя добавлять в файлы проекта или отправлять в чат.

## Команды

```bash
npm install
npm run worker:login
npm run worker:secret:password
npm run worker:secret:session
npm run worker:secret:github
npm run worker:deploy
```

После первой публикации адрес Worker нужно указать в `admin/config.js`.
