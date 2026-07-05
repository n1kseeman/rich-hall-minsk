(() => {
  const grid = document.querySelector("[data-halls-grid]");

  if (!grid) return;

  function createHallCard(hall) {
    const article = document.createElement("article");
    const imageWrap = document.createElement("div");
    const image = document.createElement("img");
    const tagline = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const bookingLink = document.createElement("a");

    article.className = "hall-card reveal is-visible";
    imageWrap.className = "hall-image";
    tagline.className = "capacity";
    body.className = "hall-body";
    bookingLink.className = "btn btn-outline";

    image.src = hall.image;
    image.alt = `${hall.title} RICH HALL`;
    image.width = 900;
    image.height = 675;
    image.loading = "lazy";
    image.decoding = "async";

    tagline.textContent = hall.tagline || "банкетное пространство";
    title.textContent = hall.title;
    description.textContent = hall.description;
    bookingLink.href = "#booking";
    bookingLink.textContent = "Узнать свободные даты";

    imageWrap.append(image, tagline);
    body.append(title, description, bookingLink);
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

  async function loadHalls() {
    try {
      const contentUrl = new URL("content/halls.json", document.baseURI);
      contentUrl.searchParams.set("v", Date.now().toString());

      const response = await fetch(contentUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Content request failed: ${response.status}`);

      const content = await response.json();
      if (!Array.isArray(content.halls)) throw new Error("Invalid halls content");

      const halls = content.halls.filter((hall) => (
        hall
        && typeof hall.title === "string"
        && typeof hall.description === "string"
        && typeof hall.image === "string"
      ));

      renderHalls(halls);
    } catch (error) {
      console.warn("Не удалось загрузить данные залов, используется встроенный контент.", error);
    }
  }

  loadHalls();
})();
