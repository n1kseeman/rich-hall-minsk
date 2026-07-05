(() => {
  const config = window.RICH_HALL_ADMIN_CONFIG || {};
  const apiUrl = String(config.apiUrl || "").replace(/\/+$/, "");
  const siteRoot = new URL("../", window.location.href);
  const contentUrl = new URL("content/halls.json", siteRoot);
  const placeholderImage = "assets/hall-placeholder.svg";
  const sessionKey = "richhall-admin-session";

  const loginView = document.querySelector("[data-login-view]");
  const editorView = document.querySelector("[data-editor-view]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginButton = document.querySelector("[data-login-button]");
  const loginStatus = document.querySelector("[data-login-status]");
  const editorStatus = document.querySelector("[data-editor-status]");
  const hallsList = document.querySelector("[data-halls-list]");
  const addHallButton = document.querySelector("[data-add-hall]");
  const saveButton = document.querySelector("[data-save]");
  const logoutButton = document.querySelector("[data-logout]");

  const state = {
    halls: [],
    originalImages: new Set(),
    token: sessionStorage.getItem(sessionKey) || "",
    isSaving: false
  };

  function setStatus(element, message = "", type = "") {
    element.textContent = message;
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }

  function isManagedImage(path) {
    return typeof path === "string" && path.startsWith("assets/halls/");
  }

  function resolveImageUrl(path) {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return new URL(path, siteRoot).href;
  }

  function createHallId() {
    const suffix = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `hall-${suffix}`;
  }

  function markChanged() {
    setStatus(editorStatus, "Есть несохранённые изменения.");
  }

  async function request(path, options = {}) {
    if (!apiUrl) {
      throw new Error("Сервис публикации ещё не подключён.");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    if (state.token) {
      headers.set("Authorization", `Bearer ${state.token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error = new Error(payload.error || "Не удалось выполнить запрос.");
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  async function loadHalls() {
    const url = new URL(contentUrl);
    url.searchParams.set("v", Date.now().toString());

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить список залов.");

    const content = await response.json();
    if (!Array.isArray(content.halls)) throw new Error("Некорректный формат списка залов.");

    state.halls = content.halls.map((hall) => ({
      id: String(hall.id || createHallId()),
      title: String(hall.title || ""),
      description: String(hall.description || ""),
      image: String(hall.image || placeholderImage),
      tagline: String(hall.tagline || "банкетное пространство"),
      upload: null,
      previewUrl: ""
    }));

    state.originalImages = new Set(
      state.halls.map((hall) => hall.image).filter(isManagedImage)
    );

    renderHalls();
  }

  function makeIconButton(symbol, label, className = "") {
    const button = document.createElement("button");
    button.className = `icon-button ${className}`.trim();
    button.type = "button";
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
  }

  function renderHalls() {
    hallsList.replaceChildren();

    state.halls.forEach((hall, index) => {
      const article = document.createElement("article");
      const photoEditor = document.createElement("div");
      const image = document.createElement("img");
      const photoActions = document.createElement("div");
      const uploadButton = document.createElement("button");
      const removePhotoButton = document.createElement("button");
      const fileInput = document.createElement("input");
      const fields = document.createElement("div");
      const head = document.createElement("div");
      const heading = document.createElement("h2");
      const controls = document.createElement("div");
      const upButton = makeIconButton("↑", "Переместить зал выше");
      const downButton = makeIconButton("↓", "Переместить зал ниже");
      const deleteButton = makeIconButton("×", "Удалить зал", "danger");
      const titleLabel = document.createElement("label");
      const titleCaption = document.createElement("span");
      const titleInput = document.createElement("input");
      const descriptionLabel = document.createElement("label");
      const descriptionCaption = document.createElement("span");
      const descriptionInput = document.createElement("textarea");

      article.className = "hall-editor";
      photoEditor.className = "photo-editor";
      photoActions.className = "photo-actions";
      fields.className = "hall-fields";
      head.className = "hall-card-head";
      controls.className = "hall-controls";
      uploadButton.className = "button button-secondary";
      removePhotoButton.className = "button button-secondary";
      fileInput.className = "file-input";

      heading.textContent = `Зал ${index + 1}`;
      image.src = hall.previewUrl || resolveImageUrl(hall.image);
      image.alt = hall.title ? `Фото: ${hall.title}` : "Фото зала";

      uploadButton.type = "button";
      uploadButton.textContent = "Загрузить фото";
      removePhotoButton.type = "button";
      removePhotoButton.textContent = "Удалить фото";

      fileInput.type = "file";
      fileInput.accept = "image/jpeg,image/png,image/webp";
      fileInput.setAttribute("aria-label", `Загрузить фотографию для зала ${index + 1}`);

      titleCaption.textContent = "Название";
      titleInput.type = "text";
      titleInput.value = hall.title;
      titleInput.maxLength = 80;
      titleInput.required = true;

      descriptionCaption.textContent = "Описание";
      descriptionInput.value = hall.description;
      descriptionInput.maxLength = 1000;
      descriptionInput.required = true;

      upButton.disabled = index === 0;
      downButton.disabled = index === state.halls.length - 1;

      uploadButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => handleImageSelection(hall, fileInput.files?.[0]));

      removePhotoButton.addEventListener("click", () => {
        if (hall.previewUrl) URL.revokeObjectURL(hall.previewUrl);
        hall.previewUrl = "";
        hall.upload = null;
        hall.image = placeholderImage;
        renderHalls();
        markChanged();
      });

      titleInput.addEventListener("input", () => {
        hall.title = titleInput.value;
        markChanged();
      });

      descriptionInput.addEventListener("input", () => {
        hall.description = descriptionInput.value;
        markChanged();
      });

      upButton.addEventListener("click", () => moveHall(index, -1));
      downButton.addEventListener("click", () => moveHall(index, 1));
      deleteButton.addEventListener("click", () => deleteHall(index));

      photoActions.append(uploadButton, removePhotoButton, fileInput);
      photoEditor.append(image, photoActions);
      controls.append(upButton, downButton, deleteButton);
      head.append(heading, controls);
      titleLabel.append(titleCaption, titleInput);
      descriptionLabel.append(descriptionCaption, descriptionInput);
      fields.append(head, titleLabel, descriptionLabel);
      article.append(photoEditor, fields);
      hallsList.append(article);
    });
  }

  function moveHall(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.halls.length) return;

    const [hall] = state.halls.splice(index, 1);
    state.halls.splice(nextIndex, 0, hall);
    renderHalls();
    markChanged();
  }

  function deleteHall(index) {
    const hall = state.halls[index];
    const label = hall.title || `зал ${index + 1}`;

    if (!window.confirm(`Удалить «${label}»? Изменение вступит в силу после сохранения.`)) {
      return;
    }

    if (hall.previewUrl) URL.revokeObjectURL(hall.previewUrl);
    state.halls.splice(index, 1);
    renderHalls();
    markChanged();
  }

  function addHall() {
    state.halls.push({
      id: createHallId(),
      title: "Новый зал",
      description: "Добавьте описание зала.",
      image: placeholderImage,
      tagline: "банкетное пространство",
      upload: null,
      previewUrl: ""
    });

    renderHalls();
    markChanged();

    const cards = hallsList.querySelectorAll(".hall-editor");
    cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function optimizeImage(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Поддерживаются только JPG, PNG и WebP.");
    }

    if (file.size > 12 * 1024 * 1024) {
      throw new Error("Фотография должна быть меньше 12 МБ.");
    }

    const bitmap = await createImageBitmap(file);
    const maxWidth = 1600;
    const maxHeight = 1200;
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.84);
    });

    if (!blob) throw new Error("Не удалось обработать фотографию.");
    return blob;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Не удалось прочитать фотографию."));
      reader.readAsDataURL(blob);
    });
  }

  async function handleImageSelection(hall, file) {
    if (!file) return;

    setStatus(editorStatus, "Обрабатываем фотографию…");

    try {
      const blob = await optimizeImage(file);
      const content = await blobToBase64(blob);
      const path = `assets/halls/${hall.id}-${Date.now()}.webp`;

      if (hall.previewUrl) URL.revokeObjectURL(hall.previewUrl);

      hall.previewUrl = URL.createObjectURL(blob);
      hall.image = path;
      hall.upload = { path, content };
      renderHalls();
      markChanged();
    } catch (error) {
      setStatus(editorStatus, error.message, "error");
    }
  }

  function validateHalls() {
    for (const hall of state.halls) {
      hall.title = hall.title.trim();
      hall.description = hall.description.trim();

      if (!hall.title || !hall.description) {
        throw new Error("У каждого зала должны быть название и описание.");
      }
    }
  }

  async function saveHalls() {
    if (state.isSaving) return;

    try {
      validateHalls();
    } catch (error) {
      setStatus(editorStatus, error.message, "error");
      return;
    }

    if (!state.halls.length && !window.confirm("Опубликовать сайт без залов?")) {
      return;
    }

    state.isSaving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Публикуем…";
    setStatus(editorStatus, "Сохраняем изменения в GitHub…");

    const publicHalls = state.halls.map((hall) => ({
      id: hall.id,
      title: hall.title,
      description: hall.description,
      image: hall.image,
      tagline: hall.tagline
    }));

    const uploads = state.halls
      .filter((hall) => hall.upload && hall.upload.path === hall.image)
      .map((hall) => hall.upload);

    const currentImages = new Set(publicHalls.map((hall) => hall.image).filter(isManagedImage));
    const deletedImages = [...state.originalImages].filter((path) => !currentImages.has(path));

    try {
      const result = await request("/api/publish", {
        method: "POST",
        body: JSON.stringify({
          halls: publicHalls,
          uploads,
          deletedImages
        })
      });

      state.originalImages = currentImages;
      state.halls.forEach((hall) => {
        hall.upload = null;
      });

      const shortSha = result.commitSha ? ` Коммит ${result.commitSha.slice(0, 7)}.` : "";
      setStatus(
        editorStatus,
        `Сохранено.${shortSha} Сайт обновится примерно через 1–2 минуты.`,
        "success"
      );
    } catch (error) {
      if (error.status === 401) {
        logout("Сессия истекла. Войдите ещё раз.");
      } else {
        setStatus(editorStatus, error.message, "error");
      }
    } finally {
      state.isSaving = false;
      saveButton.disabled = false;
      saveButton.textContent = "Сохранить и опубликовать";
    }
  }

  async function showEditor() {
    loginView.hidden = true;
    editorView.hidden = false;
    setStatus(editorStatus, "Загружаем данные…");

    try {
      await loadHalls();
      setStatus(editorStatus);
    } catch (error) {
      setStatus(editorStatus, error.message, "error");
    }
  }

  function logout(message = "") {
    state.token = "";
    sessionStorage.removeItem(sessionKey);
    editorView.hidden = true;
    loginView.hidden = false;
    loginForm.reset();
    loginForm.elements.username.value = "admin";
    setStatus(loginStatus, message, message ? "error" : "");
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    loginButton.disabled = true;
    loginButton.textContent = "Входим…";
    setStatus(loginStatus);

    try {
      const result = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password")
        })
      });

      state.token = result.token;
      sessionStorage.setItem(sessionKey, state.token);
      await showEditor();
    } catch (error) {
      setStatus(loginStatus, error.message, "error");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Войти";
    }
  });

  addHallButton.addEventListener("click", addHall);
  saveButton.addEventListener("click", saveHalls);
  logoutButton.addEventListener("click", () => logout());

  async function restoreSession() {
    if (!state.token || !apiUrl) return;

    try {
      await request("/api/session", { method: "GET" });
      await showEditor();
    } catch {
      logout();
    }
  }

  restoreSession();
})();
