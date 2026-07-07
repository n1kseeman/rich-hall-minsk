(() => {
  const root = document.querySelector("[data-banquet-menu]");
  if (!root) return;

  const categoryNav = root.querySelector("[data-menu-categories]");
  const grid = root.querySelector("[data-menu-grid]");
  const countNode = root.querySelector("[data-menu-count]");
  const menuUrl = new URL("content/menu.json", document.baseURI);

  function formatPrice(value) {
    const price = String(value || "").trim();
    return price ? `${price} BYN` : "";
  }

  function createCategoryLink(category, index) {
    const link = document.createElement("a");
    link.href = `#menu-category-${index + 1}`;
    link.textContent = category.title;
    return link;
  }

  function createMeta(label, value) {
    const node = document.createElement("span");
    node.className = "menu-item-meta";
    node.textContent = `${label}: ${value}`;
    return node;
  }

  function createMenuItem(item) {
    const article = document.createElement("article");
    article.className = "menu-item";

    const content = document.createElement("div");
    content.className = "menu-item-content";

    const title = document.createElement("h4");
    title.textContent = item.title;
    content.append(title);

    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      content.append(description);
    }

    if (item.amount) {
      const meta = document.createElement("div");
      meta.className = "menu-item-metas";
      meta.append(createMeta("Выход", item.amount));
      content.append(meta);
    }

    const price = document.createElement("strong");
    price.className = "menu-item-price";
    price.textContent = formatPrice(item.price);

    article.append(content, price);
    return article;
  }

  function createCategory(category, index) {
    const section = document.createElement("section");
    section.className = "menu-category reveal is-visible";
    section.id = `menu-category-${index + 1}`;

    const head = document.createElement("div");
    head.className = "menu-category-head";

    const titleWrap = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.textContent = `Раздел ${String(index + 1).padStart(2, "0")}`;
    const title = document.createElement("h3");
    title.textContent = category.title;
    titleWrap.append(eyebrow, title);

    const count = document.createElement("p");
    count.textContent = `${category.items.length} поз.`;

    head.append(titleWrap, count);

    const items = document.createElement("div");
    items.className = "menu-items";
    items.append(...category.items.map(createMenuItem));

    section.append(head, items);
    return section;
  }

  function renderMenu(categories) {
    const cleanCategories = categories.filter((category) => (
      category
      && typeof category.title === "string"
      && Array.isArray(category.items)
      && category.items.length
    ));

    if (!cleanCategories.length) {
      grid.innerHTML = '<p class="menu-empty">Меню скоро появится.</p>';
      return;
    }

    const itemsCount = cleanCategories.reduce((total, category) => total + category.items.length, 0);
    if (countNode) {
      countNode.textContent = `${cleanCategories.length} разделов · ${itemsCount} позиций`;
    }

    categoryNav.replaceChildren(...cleanCategories.map(createCategoryLink));
    grid.replaceChildren(...cleanCategories.map(createCategory));
  }

  async function loadMenu() {
    try {
      const response = await fetch(menuUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Menu content is unavailable");
      const content = await response.json();
      renderMenu(Array.isArray(content.categories) ? content.categories : []);
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<p class="menu-empty">Не удалось загрузить меню. Свяжитесь с нами — отправим актуальный вариант.</p>';
    }
  }

  loadMenu();
})();
