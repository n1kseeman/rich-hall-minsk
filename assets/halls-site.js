(() => {
  const grid = document.querySelector("[data-halls-grid]");
  if (!grid) return;

  const placeholder = "assets/hall-placeholder.svg";
  let activeHall = null;
  let activeIndex = 0;
  let touchStartX = 0;

  const dialog = document.createElement("dialog");
  dialog.className = "hall-gallery-dialog";
  dialog.setAttribute("aria-label", "Галерея зала");
  dialog.innerHTML = `
    <div class="hall-gallery-shell">
      <button class="hall-gallery-close" type="button" aria-label="Закрыть галерею">×</button>
      <div class="hall-gallery-topline">
        <p data-gallery-title></p>
        <span data-gallery-counter aria-live="polite"></span>
      </div>
      <div class="hall-gallery-stage" data-gallery-stage>
        <img data-gallery-image src="" alt="" width="1800" height="1200">
        <button class="hall-gallery-arrow is-prev" type="button" aria-label="Предыдущая фотография">‹</button>
        <button class="hall-gallery-arrow is-next" type="button" aria-label="Следующая фотография">›</button>
      </div>
      <div class="hall-gallery-thumbs" data-gallery-thumbs aria-label="Фотографии зала"></div>
    </div>`;
  document.body.append(dialog);

  const galleryImage = dialog.querySelector("[data-gallery-image]");
  const galleryTitle = dialog.querySelector("[data-gallery-title]");
  const galleryCounter = dialog.querySelector("[data-gallery-counter]");
  const galleryThumbs = dialog.querySelector("[data-gallery-thumbs]");
  const previousButton = dialog.querySelector(".is-prev");
  const nextButton = dialog.querySelector(".is-next");

  function getImages(hall) {
    const images = Array.isArray(hall.images) ? hall.images : [hall.image];
    return images.filter((image) => typeof image === "string" && image.trim());
  }

  function updateGallery() {
    if (!activeHall) return;
    const images = getImages(activeHall);
    if (!images.length) return;

    activeIndex = (activeIndex + images.length) % images.length;
    const currentImage = images[activeIndex];
    galleryImage.src = currentImage;
    galleryImage.alt = `${activeHall.title}: фотография ${activeIndex + 1}`;
    galleryTitle.textContent = activeHall.title;
    galleryCounter.textContent = `${activeIndex + 1} / ${images.length}`;
    previousButton.hidden = images.length < 2;
    nextButton.hidden = images.length < 2;

    galleryThumbs.replaceChildren(...images.map((source, index) => {
      const thumb = document.createElement("button");
      const image = document.createElement("img");
      thumb.type = "button";
      thumb.className = "hall-gallery-thumb";
      thumb.setAttribute("aria-label", `Показать фотографию ${index + 1}`);
      thumb.setAttribute("aria-current", String(index === activeIndex));
      image.src = source;
      image.alt = "";
      image.loading = "lazy";
      thumb.append(image);
      thumb.addEventListener("click", () => {
        activeIndex = index;
        updateGallery();
      });
      return thumb;
    }));
  }

  function openGallery(hall, index = 0) {
    activeHall = hall;
    activeIndex = index;
    updateGallery();
    if (!dialog.open) dialog.showModal();
  }

  function moveGallery(step) {
    if (!activeHall) return;
    activeIndex += step;
    updateGallery();
  }

  function createHallCard(hall) {
    const images = getImages(hall);
    const cover = images[0] || placeholder;
    let cardImageIndex = 0;
    let cardTouchStartX = 0;
    let cardTouchStartY = 0;
    const article = document.createElement("article");
    const imageWrap = document.createElement("div");
    const image = document.createElement("img");
    const tagline = document.createElement("span");
    const sliderControls = document.createElement("div");
    const previousImageButton = document.createElement("button");
    const nextImageButton = document.createElement("button");
    const imageCounter = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const actions = document.createElement("div");
    const galleryButton = document.createElement("button");
    const bookingLink = document.createElement("a");

    article.className = "hall-card reveal is-visible";
    imageWrap.className = "hall-image hall-image-slider";
    tagline.className = "capacity";
    sliderControls.className = "hall-slider-controls";
    previousImageButton.className = "hall-slider-arrow is-prev";
    nextImageButton.className = "hall-slider-arrow is-next";
    imageCounter.className = "hall-slider-counter";
    previousImageButton.type = "button";
    nextImageButton.type = "button";
    previousImageButton.setAttribute("aria-label", `Предыдущее фото: ${hall.title}`);
    nextImageButton.setAttribute("aria-label", `Следующее фото: ${hall.title}`);
    imageCounter.setAttribute("aria-live", "polite");
    body.className = "hall-body";
    actions.className = "hall-actions";
    galleryButton.className = "hall-gallery-open";
    galleryButton.type = "button";
    bookingLink.className = "btn btn-outline";

    image.src = cover;
    image.alt = `${hall.title} RICH HALL`;
    image.width = 900;
    image.height = 675;
    image.loading = "lazy";
    image.decoding = "async";
    tagline.textContent = hall.tagline || "банкетное пространство";
    title.textContent = hall.title;
    description.textContent = hall.description;
    galleryButton.textContent = images.length > 1 ? `Смотреть фото · ${images.length}` : "Смотреть фото";
    galleryButton.setAttribute("aria-label", `Открыть галерею: ${hall.title}`);
    galleryButton.disabled = !images.length;
    galleryButton.addEventListener("click", () => openGallery(hall));
    bookingLink.href = "#booking";
    bookingLink.textContent = "Узнать свободные даты";

    function updateCardImage() {
      cardImageIndex = (cardImageIndex + images.length) % images.length;
      image.src = images[cardImageIndex];
      image.alt = `${hall.title} RICH HALL, фото ${cardImageIndex + 1}`;
      imageCounter.textContent = `${cardImageIndex + 1} / ${images.length}`;
      image.classList.remove("is-changing");
      void image.offsetWidth;
      image.classList.add("is-changing");
    }

    function moveCardImage(step) {
      cardImageIndex += step;
      updateCardImage();
    }

    if (images.length > 1) {
      imageWrap.classList.add("has-slider");
      previousImageButton.textContent = "‹";
      nextImageButton.textContent = "›";
      imageCounter.textContent = `1 / ${images.length}`;
      previousImageButton.addEventListener("click", () => moveCardImage(-1));
      nextImageButton.addEventListener("click", () => moveCardImage(1));
      imageWrap.addEventListener("touchstart", (event) => {
        const touch = event.changedTouches[0];
        cardTouchStartX = touch?.clientX || 0;
        cardTouchStartY = touch?.clientY || 0;
      }, { passive: true });
      imageWrap.addEventListener("touchend", (event) => {
        const touch = event.changedTouches[0];
        const deltaX = (touch?.clientX || 0) - cardTouchStartX;
        const deltaY = (touch?.clientY || 0) - cardTouchStartY;
        if (Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY)) {
          moveCardImage(deltaX > 0 ? -1 : 1);
        }
      }, { passive: true });
      sliderControls.append(previousImageButton, imageCounter, nextImageButton);
    }

    imageWrap.append(image, tagline, sliderControls);
    actions.append(galleryButton, bookingLink);
    body.append(title, description, actions);
    article.append(imageWrap, body);
    return article;
  }

  function renderHalls(halls) {
    if (!halls.length) {
      const empty = document.createElement("p");
      empty.className = "halls-empty";
      empty.textContent = "Информация о залах скоро появится.";
      grid.replaceChildren(empty);
      return;
    }
    grid.replaceChildren(...halls.map(createHallCard));
  }

  dialog.querySelector(".hall-gallery-close").addEventListener("click", () => dialog.close());
  previousButton.addEventListener("click", () => moveGallery(-1));
  nextButton.addEventListener("click", () => moveGallery(1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") moveGallery(-1);
    if (event.key === "ArrowRight") moveGallery(1);
  });
  dialog.querySelector("[data-gallery-stage]").addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX || 0;
  }, { passive: true });
  dialog.querySelector("[data-gallery-stage]").addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 48) moveGallery(delta > 0 ? -1 : 1);
  }, { passive: true });

  async function loadHalls() {
    try {
      const contentUrl = new URL("content/halls.json", document.baseURI);
      contentUrl.searchParams.set("v", Date.now().toString());
      const response = await fetch(contentUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
      const content = await response.json();
      if (!Array.isArray(content.halls)) throw new Error("Invalid halls content");
      const halls = content.halls.filter((hall) => (
        hall && typeof hall.title === "string" && typeof hall.description === "string" && getImages(hall).length
      ));
      renderHalls(halls);
    } catch (error) {
      console.warn("Не удалось загрузить данные залов, используется встроенный контент.", error);
    }
  }

  loadHalls();
})();
