const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowedOrigins = getAllowedOrigins(env);

    if (request.method === "OPTIONS") {
      if (origin && !allowedOrigins.has(origin)) {
        return jsonResponse(request, env, { error: "Origin is not allowed." }, 403);
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/login" && request.method === "POST") {
        return await handleLogin(request, env);
      }

      if (url.pathname === "/api/session" && request.method === "GET") {
        await requireSession(request, env);
        return jsonResponse(request, env, { authenticated: true });
      }

      if (url.pathname === "/api/publish" && request.method === "POST") {
        await requireSession(request, env);
        return await handlePublish(request, env);
      }

      if (url.pathname === "/api/booking" && request.method === "POST") {
        return await handleBooking(request, env);
      }

      return jsonResponse(request, env, { error: "Not found." }, 404);
    } catch (error) {
      console.error(error);

      if (error instanceof HttpError) {
        return jsonResponse(request, env, { error: error.message }, error.status);
      }

      return jsonResponse(
        request,
        env,
        { error: "Не удалось выполнить запрос. Попробуйте ещё раз." },
        500
      );
    }
  }
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getAllowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function corsHeaders(request, env) {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  });

  const origin = request.headers.get("Origin");
  if (origin && getAllowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function jsonResponse(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request, env)
  });
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 16 * 1024 * 1024) {
    throw new HttpError(413, "Слишком большой объём фотографий.");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Некорректный запрос.");
  }
}

async function readFormOrJson(request, maxLength = 64 * 1024) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > maxLength) {
    throw new HttpError(413, "Слишком большой запрос.");
  }

  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    return await readJson(request);
  }

  if (
    contentType.includes("application/x-www-form-urlencoded")
    || contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [
        key,
        typeof value === "string" ? value : ""
      ])
    );
  }

  throw new HttpError(415, "Некорректный формат заявки.");
}

function assertAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !getAllowedOrigins(env).has(origin)) {
    throw new HttpError(403, "Origin is not allowed.");
  }
}

async function handleBooking(request, env) {
  assertAllowedOrigin(request, env);

  const payload = await readFormOrJson(request);
  if (cleanText(payload.website, 120)) {
    return jsonResponse(request, env, { ok: true });
  }

  const booking = validateBookingPayload(payload);
  await sendBookingToTelegram(env, formatBookingMessage(booking, request));

  return jsonResponse(request, env, { ok: true });
}

function validateBookingPayload(payload) {
  const name = cleanText(payload.name, 80);
  const phone = normalizePhone(cleanText(payload.phone, 24));
  const eventType = cleanText(payload.eventType, 80);
  const guests = Number.parseInt(cleanText(payload.guests, 6), 10);
  const date = cleanText(payload.date, 20);
  const comment = cleanText(payload.comment, 1000);

  if (!name) {
    throw new HttpError(400, "Укажите имя.");
  }

  if (!/^\+?[0-9]{7,15}$/.test(phone)) {
    throw new HttpError(400, "Укажите корректный телефон.");
  }

  if (!eventType) {
    throw new HttpError(400, "Укажите тип мероприятия.");
  }

  if (!Number.isInteger(guests) || guests < 1 || guests > 300) {
    throw new HttpError(400, "Укажите корректное количество гостей.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, "Укажите дату мероприятия.");
  }

  return { name, phone, eventType, guests, date, comment };
}

function normalizePhone(value) {
  const text = String(value || "").trim();
  const digits = text.replace(/\D/g, "").slice(0, 15);
  return `${text.startsWith("+") ? "+" : ""}${digits}`;
}

function formatBookingMessage(booking, request) {
  const source = request.headers.get("Referer") || "Сайт RICH HALL";
  const createdAt = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Minsk",
    dateStyle: "short",
    timeStyle: "short"
  });

  return [
    "Новая заявка RICH HALL",
    "",
    `Имя: ${booking.name}`,
    `Телефон: ${booking.phone}`,
    `Тип мероприятия: ${booking.eventType}`,
    `Гостей: ${booking.guests}`,
    `Дата: ${booking.date}`,
    booking.comment ? `Комментарий: ${booking.comment}` : "",
    "",
    `Источник: ${source}`,
    `Время: ${createdAt}`
  ].filter(Boolean).join("\n");
}

async function sendBookingToTelegram(env, text) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || "").trim();

  if (!token || !chatId) {
    throw new HttpError(503, "Приём заявок не настроен.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Telegram API error", response.status, body);
    throw new HttpError(502, "Не удалось отправить заявку.");
  }
}

async function handleLogin(request, env) {
  const body = await readJson(request);
  const username = String(body.username || "");
  const password = String(body.password || "");
  const suppliedHash = await sha256Hex(password);
  const validUsername = timingSafeEqual(username, String(env.ADMIN_USERNAME || ""));
  const validPassword = timingSafeEqual(
    suppliedHash,
    String(env.ADMIN_PASSWORD_HASH || "").toLowerCase()
  );

  if (!validUsername || !validPassword) {
    throw new HttpError(401, "Неверный логин или пароль.");
  }

  const token = await createSessionToken(env);
  return jsonResponse(request, env, { token });
}

async function requireSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token || !(await verifySessionToken(token, env))) {
    throw new HttpError(401, "Сессия истекла. Войдите ещё раз.");
  }
}

async function createSessionToken(env) {
  const payload = {
    sub: "rich-hall-admin",
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(encodedPayload, env.SESSION_SECRET);
  return `${encodedPayload}.${signature}`;
}

async function verifySessionToken(token, env) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  const expectedSignature = await signValue(encodedPayload, env.SESSION_SECRET);
  if (!timingSafeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    return payload.sub === "rich-hall-admin" && Number(payload.exp) > Date.now() / 1000;
  } catch {
    return false;
  }
}

async function signValue(value, secret) {
  if (!secret) throw new Error("SESSION_SECRET is not configured.");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left, right) {
  const leftBytes = encoder.encode(String(left));
  const rightBytes = encoder.encode(String(right));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return difference === 0;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function handlePublish(request, env) {
  const payload = validatePublishPayload(await readJson(request));
  const result = await publishToGitHub(env, payload);

  return jsonResponse(request, env, {
    ok: true,
    commitSha: result.sha,
    commitUrl: result.htmlUrl
  });
}

function validatePublishPayload(payload) {
  if (!payload || !Array.isArray(payload.halls)) {
    throw new HttpError(400, "Список залов не передан.");
  }

  if (payload.halls.length > 30) {
    throw new HttpError(400, "Можно добавить не более 30 залов.");
  }

  const ids = new Set();
  const halls = payload.halls.map((hall) => {
    const id = cleanText(hall.id, 90);
    const title = cleanText(hall.title, 80);
    const description = cleanText(hall.description, 1000);
    const imageInput = Array.isArray(hall.images) ? hall.images : [hall.image];
    const images = imageInput
      .map((image) => cleanText(image, 500))
      .filter(Boolean);
    const tagline = cleanText(hall.tagline || "банкетное пространство", 80);

    if (!/^[a-z0-9-]+$/i.test(id) || ids.has(id)) {
      throw new HttpError(400, "Некорректный идентификатор зала.");
    }

    if (
      !title
      || !description
      || !images.length
      || images.length > 10
      || images.some((image) => !isAllowedImage(image))
    ) {
      throw new HttpError(400, "Проверьте название, описание и фотографии зала.");
    }

    ids.add(id);
    return { id, title, description, image: images[0], images, tagline };
  });

  const uploadsInput = Array.isArray(payload.uploads) ? payload.uploads : [];
  if (uploadsInput.length > 30) {
    throw new HttpError(400, "За один раз можно загрузить не более 30 фотографий.");
  }

  const uploadPaths = new Set();
  let totalUploadLength = 0;
  const uploads = uploadsInput.map((upload) => {
    const path = cleanText(upload.path, 220);
    const content = String(upload.content || "");

    if (
      !/^assets\/halls\/[a-z0-9-]+\.webp$/i.test(path)
      || uploadPaths.has(path)
      || !/^[a-zA-Z0-9+/=]+$/.test(content)
    ) {
      throw new HttpError(400, "Некорректная фотография.");
    }

    if (content.length > 4 * 1024 * 1024) {
      throw new HttpError(413, "Одна из фотографий слишком большая.");
    }

    totalUploadLength += content.length;
    uploadPaths.add(path);
    return { path, content };
  });

  if (totalUploadLength > 14 * 1024 * 1024) {
    throw new HttpError(413, "Общий объём фотографий слишком большой.");
  }

  const referencedImages = new Set(halls.flatMap((hall) => hall.images));
  for (const path of uploadPaths) {
    if (!referencedImages.has(path)) {
      throw new HttpError(400, "Загружена фотография, которая не используется.");
    }
  }

  const deletedImages = [
    ...new Set(
      (Array.isArray(payload.deletedImages) ? payload.deletedImages : [])
        .map((path) => cleanText(path, 220))
        .filter((path) => /^assets\/halls\/[a-z0-9-]+\.webp$/i.test(path))
    )
  ].filter((path) => !referencedImages.has(path) && !uploadPaths.has(path));

  return { halls, uploads, deletedImages };
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isAllowedImage(value) {
  return (
    /^https:\/\/[^\s]+$/i.test(value)
    || value === "assets/hall-placeholder.svg"
    || /^assets\/halls\/[a-z0-9-]+\.webp$/i.test(value)
    || /^assets\/images\/[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(value)
  );
}

async function publishToGitHub(env, payload) {
  const owner = encodeURIComponent(env.GITHUB_OWNER);
  const repo = encodeURIComponent(env.GITHUB_REPO);
  const branch = env.GITHUB_BRANCH || "main";
  const repoPath = `/repos/${owner}/${repo}`;

  const reference = await githubRequest(env, `${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`);
  const headSha = reference.object.sha;
  const commit = await githubRequest(env, `${repoPath}/git/commits/${headSha}`);
  const baseTreeSha = commit.tree.sha;
  const fullTree = await githubRequest(env, `${repoPath}/git/trees/${baseTreeSha}?recursive=1`);
  const existingPaths = new Set((fullTree.tree || []).map((entry) => entry.path));

  const content = `${JSON.stringify({ halls: payload.halls }, null, 2)}\n`;
  const contentBlob = await githubRequest(env, `${repoPath}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" })
  });

  const uploadEntries = await Promise.all(
    payload.uploads.map(async (upload) => {
      const blob = await githubRequest(env, `${repoPath}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: upload.content, encoding: "base64" })
      });

      return {
        path: upload.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      };
    })
  );

  const deleteEntries = payload.deletedImages
    .filter((path) => existingPaths.has(path))
    .map((path) => ({
      path,
      mode: "100644",
      type: "blob",
      sha: null
    }));

  const tree = await githubRequest(env, `${repoPath}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [
        {
          path: "content/halls.json",
          mode: "100644",
          type: "blob",
          sha: contentBlob.sha
        },
        ...uploadEntries,
        ...deleteEntries
      ]
    })
  });

  const newCommit = await githubRequest(env, `${repoPath}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: "Update halls from admin",
      tree: tree.sha,
      parents: [headSha]
    })
  });

  await githubRequest(env, `${repoPath}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({
      sha: newCommit.sha,
      force: false
    })
  });

  return {
    sha: newCommit.sha,
    htmlUrl: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${newCommit.sha}`
  };
}

async function githubRequest(env, path, options = {}) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "rich-hall-admin-worker",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const body = await response.text();
  let data = {};

  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    console.error("GitHub API error", response.status, data.message || body);

    if (response.status === 409 || response.status === 422) {
      throw new HttpError(409, "Сайт изменился во время сохранения. Обновите страницу и повторите.");
    }

    throw new Error(`GitHub API request failed: ${response.status}`);
  }

  return data;
}
