(() => {
  "use strict";

  const source = window.BOOKED_DATA;
  const translations = window.BOOKED_I18N;

  if (!source || !translations) {
    console.error("Booked could not start because its data files did not load.");
    return;
  }

  const BOOKS = source.books.map(book => ({ ...book, tags: [...(book.tags || [])] }));
  const MONTHS = translations.months;
  const I18N = translations.copy;

  const MONTH_ORDER = Object.freeze({
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12
  });

  const COUNTRY_ISO_NUM = Object.freeze({
    Austria: "040",
    Brazil: "076",
    Canada: "124",
    Colombia: "170",
    France: "250",
    Germany: "276",
    Ireland: "372",
    Italy: "380",
    Japan: "392",
    Portugal: "620",
    Russia: "643",
    "United Kingdom": "826",
    "United States": "840"
  });

  const ISO_NUM_TO_COUNTRY = Object.freeze(
    Object.fromEntries(Object.entries(COUNTRY_ISO_NUM).map(([country, iso]) => [iso, country]))
  );

  const state = {
    lang: "en",
    activeYear: "all",
    activeTag: "all",
    sort: "reading",
    view: "library",
    currentBookIndex: BOOKS.findIndex(book => book.current),
    selectedMapCountry: null,
    lastFocusedElement: null
  };

  const coverCache = new Map();
  let worldFeatures = null;
  let worldMapDataPromise = null;
  let renderGeneration = 0;

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const t = () => I18N[state.lang];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function hashHue(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash % 360;
  }

  function getBookId(book) {
    return `${book.title}-${book.author}-${book.year}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getMonthName(month, lang = state.lang) {
    return MONTHS[lang]?.[month] || month;
  }

  function bookDateValue(book) {
    return (book.year * 100) + (MONTH_ORDER[book.month] || 0);
  }

  function debounce(callback, delay = 150) {
    let timeoutId;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => callback(...args), delay);
    };
  }

  function getStored(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function setStored(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The site remains usable when private browsing blocks localStorage.
    }
  }

  function loadJSON(key, fallback = {}) {
    try {
      const raw = getStored(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      setStored(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  }

  function setPressed(buttons, predicate) {
    buttons.forEach(button => {
      const active = Boolean(predicate(button));
      button.dataset.active = active ? "true" : "false";
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function countBy(items, getter) {
    return items.reduce((counts, item) => {
      const key = getter(item);
      if (!key) return counts;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function sortedEntriesFromCount(counts) {
    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }

  function buildSearchBlob(book) {
    return normalizeText([
      book.title,
      book.author,
      book.year,
      book.month,
      getMonthName(book.month),
      book.country,
      book.note,
      ...(book.tags || [])
    ].join(" "));
  }

  function fallbackOpenLibraryLink(book) {
    return `https://openlibrary.org/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`;
  }

  function updateDocumentMetadata() {
    document.title = t().pageTitle;
    const description = $('meta[name="description"]');
    const ogTitle = $('meta[property="og:title"]');
    const ogDescription = $('meta[property="og:description"]');

    description?.setAttribute("content", t().pageDescription);
    ogTitle?.setAttribute("content", t().pageTitle);
    ogDescription?.setAttribute("content", t().pageDescription);
  }

  /* ---------------- Theme ---------------- */

  function setTheme(mode) {
    const theme = mode === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    setStored("booked_theme", theme);

    const dark = theme === "dark";
    $("#moon").hidden = !dark;
    $("#sun").hidden = dark;
    $("#themeBtn").setAttribute("aria-pressed", dark ? "true" : "false");
    $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#090a0f" : "#f7f5fc");
  }

  function initializeTheme() {
    const saved = getStored("booked_theme", getStored("theme"));
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(saved || (prefersDark ? "dark" : "light"));
  }

  /* ---------------- Filters and sorting ---------------- */

  function renderYearFilters() {
    const container = $("#yearFilterPill");
    const years = [...new Set(BOOKS.map(book => book.year))].sort((a, b) => a - b);

    if (state.activeYear !== "all" && !years.includes(Number(state.activeYear))) {
      state.activeYear = "all";
    }

    container.innerHTML = `<span id="yearLabel">${escapeHTML(t().yearLabel)}</span>`;

    const values = ["all", ...years.map(String)];
    values.forEach(value => {
      const button = document.createElement("button");
      button.className = "chip";
      button.type = "button";
      button.dataset.year = value;
      button.textContent = value === "all" ? t().allYears : value;
      container.appendChild(button);
    });

    const buttons = $$("button[data-year]", container);
    buttons.forEach(button => {
      button.addEventListener("click", () => {
        state.activeYear = button.dataset.year;
        setPressed(buttons, candidate => candidate.dataset.year === state.activeYear);
        applyFilters();

        if (state.activeYear !== "all" && ["reading", "newest"].includes(state.sort)) {
          $(`#year-${state.activeYear}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    setPressed(buttons, button => button.dataset.year === state.activeYear);
    container.title = t().yearFilterTitle;
  }

  function renderSortOptions() {
    const select = $("#sortSelect");
    $("#sortLabel").textContent = t().sortLabel;
    $("#sortPill").title = t().sortTitle;

    select.innerHTML = `
      <option value="reading">${escapeHTML(t().sortReading)}</option>
      <option value="newest">${escapeHTML(t().sortNewest)}</option>
      <option value="title">${escapeHTML(t().sortTitleOption)}</option>
      <option value="author">${escapeHTML(t().sortAuthor)}</option>
    `;
    select.value = state.sort;
  }

  function updateTagSummary() {
    const summary = $("#tagSummaryValue");
    if (state.activeTag === "all") {
      summary.textContent = t().allTags;
      return;
    }

    const original = BOOKS
      .flatMap(book => book.tags || [])
      .find(tag => normalizeText(tag) === state.activeTag);

    summary.textContent = original || t().allTags;
  }

  function renderTagFilters() {
    const container = $("#tagFilters");
    const tags = [...new Set(BOOKS.flatMap(book => book.tags || []))]
      .sort((left, right) => left.localeCompare(right));
    const keys = tags.map(normalizeText);

    if (state.activeTag !== "all" && !keys.includes(state.activeTag)) {
      state.activeTag = "all";
    }

    container.innerHTML = "";
    const entries = [{ label: t().allTags, key: "all" }, ...tags.map(tag => ({ label: tag, key: normalizeText(tag) }))];

    entries.forEach(({ label, key }) => {
      const button = document.createElement("button");
      button.className = "chip tag-chip";
      button.type = "button";
      button.dataset.tag = key;
      button.textContent = label;
      container.appendChild(button);
    });

    const buttons = $$(".tag-chip", container);
    buttons.forEach(button => {
      button.addEventListener("click", () => {
        state.activeTag = button.dataset.tag;
        setPressed(buttons, candidate => candidate.dataset.tag === state.activeTag);
        updateTagSummary();
        applyFilters();
        $("#tagMenu")?.removeAttribute("open");
      });
    });

    setPressed(buttons, button => button.dataset.tag === state.activeTag);
    updateTagSummary();
    container.setAttribute("aria-label", t().tagFilterAria);
  }

  function getSortedBookEntries() {
    const entries = BOOKS.map((book, index) => ({ book, index }));

    switch (state.sort) {
      case "newest":
        return entries.sort((a, b) => bookDateValue(b.book) - bookDateValue(a.book));
      case "title":
        return entries.sort((a, b) => a.book.title.localeCompare(b.book.title));
      case "author":
        return entries.sort((a, b) => a.book.author.localeCompare(b.book.author) || a.book.title.localeCompare(b.book.title));
      default:
        return entries;
    }
  }

  function createBookCard(book, index) {
    const hue = hashHue(`${book.title}${book.month}${book.year}${book.author}`);
    const card = document.createElement("button");
    card.className = "book";
    card.type = "button";
    card.dataset.year = String(book.year);
    card.dataset.idx = String(index);
    card.dataset.tags = (book.tags || []).map(normalizeText).join("|");
    card.dataset.search = buildSearchBlob(book);
    card.dataset.bookId = getBookId(book);
    card.setAttribute("aria-label", t().cardOpen(book.title, book.author));

    const currentRibbon = book.current
      ? `<span class="current-ribbon">${escapeHTML(t().currentlyReading)}</span>`
      : "";

    card.innerHTML = `
      <div class="cover skeleton" style="--h:${hue}">
        <img class="cover-img" alt="${escapeHTML(t().coverAlt(book.title, book.author))}" loading="lazy" decoding="async">
        <span class="corner">${escapeHTML(book.year)}</span>
        ${currentRibbon}
      </div>
      <div class="info">
        <h3 class="title">${escapeHTML(book.title)}</h3>
        <p class="author">${escapeHTML(book.author)}</p>
        <div class="meta">
          <span class="tag" title="${escapeHTML(t().tagMonthTitle)}">${escapeHTML(getMonthName(book.month))}</span>
          <span class="tag" title="${escapeHTML(t().tagIndexTitle)}">#${index + 1}</span>
        </div>
      </div>
    `;

    if (window.matchMedia("(pointer: fine)").matches) {
      card.addEventListener("pointermove", event => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        const rotateX = (y - .5) * -5;
        const rotateY = (x - .5) * 5;
        card.style.transform = `perspective(850px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    }

    card.addEventListener("click", () => openOverlay(index, card));
    return card;
  }

  function renderLibrary() {
    renderGeneration += 1;
    const generation = renderGeneration;
    const content = $("#content");
    content.innerHTML = "";
    const entries = getSortedBookEntries();

    if (["title", "author"].includes(state.sort)) {
      appendBookGroup(content, t().allBooksHeading, "group-all-books", entries);
    } else {
      const years = [];
      entries.forEach(({ book }) => {
        if (!years.includes(book.year)) years.push(book.year);
      });

      years.forEach(year => {
        appendBookGroup(
          content,
          String(year),
          `year-${year}`,
          entries.filter(({ book }) => book.year === year)
        );
      });
    }

    applyFilters();
    hydrateCovers(generation);
  }

  function appendBookGroup(content, headingText, headingId, entries) {
    const heading = document.createElement("h2");
    heading.className = "year";
    heading.id = headingId;
    heading.textContent = headingText;
    content.appendChild(heading);

    const grid = document.createElement("section");
    grid.className = "grid book-group";
    grid.setAttribute("aria-labelledby", headingId);
    entries.forEach(({ book, index }) => grid.appendChild(createBookCard(book, index)));
    content.appendChild(grid);
  }

  function applyFilters() {
    const query = normalizeText($("#search").value.trim());
    const cards = $$("#content .book");
    let visible = 0;

    cards.forEach(card => {
      const yearMatches = state.activeYear === "all" || card.dataset.year === state.activeYear;
      const textMatches = !query || (card.dataset.search || "").includes(query);
      const tags = card.dataset.tags ? card.dataset.tags.split("|") : [];
      const tagMatches = state.activeTag === "all" || tags.includes(state.activeTag);
      const shouldShow = yearMatches && textMatches && tagMatches;

      card.hidden = !shouldShow;
      if (shouldShow) visible += 1;
    });

    $$(".book-group").forEach(group => {
      const groupHasVisibleCard = $$(".book", group).some(card => !card.hidden);
      group.hidden = !groupHasVisibleCard;
      const headingId = group.getAttribute("aria-labelledby");
      const heading = headingId ? document.getElementById(headingId) : null;
      if (heading) heading.hidden = !groupHasVisibleCard;
    });

    const total = cards.length;
    const emptyState = $("#emptyState");
    const resultCount = $("#resultCount");
    $("#searchClear").hidden = !$("#search").value;

    if (visible === total && !query && state.activeYear === "all" && state.activeTag === "all") {
      resultCount.textContent = t().resultAll(total);
      emptyState.hidden = true;
    } else if (visible === 0) {
      resultCount.textContent = t().resultNone;
      emptyState.textContent = t().resultNone;
      emptyState.hidden = false;
    } else {
      resultCount.textContent = t().resultFiltered(visible, total);
      emptyState.hidden = true;
    }
  }

  function resetLibraryFilters() {
    state.activeYear = "all";
    state.activeTag = "all";
    $("#search").value = "";
    renderYearFilters();
    renderTagFilters();
    applyFilters();
  }

  /* ---------------- Open Library covers ---------------- */

  async function fetchCover(book) {
    const endpoint = new URL("https://openlibrary.org/search.json");
    endpoint.searchParams.set("title", book.title);
    endpoint.searchParams.set("author", book.author);
    endpoint.searchParams.set("limit", "5");

    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Open Library returned ${response.status}`);

    const data = await response.json();
    const candidate = (data.docs || [])
      .filter(document => document.cover_i)
      .sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0))[0];

    if (!candidate) {
      return { coverUrl: null, link: fallbackOpenLibraryLink(book) };
    }

    const workKey = candidate.key || candidate.work_key?.[0];
    return {
      coverUrl: `https://covers.openlibrary.org/b/id/${candidate.cover_i}-M.jpg`,
      link: workKey
        ? `https://openlibrary.org${String(workKey).startsWith("/") ? workKey : `/works/${workKey}`}`
        : fallbackOpenLibraryLink(book)
    };
  }

  async function fetchCoverCached(book) {
    const id = getBookId(book);
    if (coverCache.has(id)) return coverCache.get(id);

    const storageKey = `booked_cover_${id}`;
    const stored = loadJSON(storageKey, null);
    if (stored && (stored.coverUrl || stored.link)) {
      coverCache.set(id, stored);
      return stored;
    }

    const promise = fetchCover(book)
      .then(result => {
        coverCache.set(id, result);
        saveJSON(storageKey, result);
        return result;
      })
      .catch(error => {
        console.warn(`Could not load cover for “${book.title}”.`, error);
        const fallback = { coverUrl: null, link: fallbackOpenLibraryLink(book) };
        coverCache.set(id, fallback);
        return fallback;
      });

    coverCache.set(id, promise);
    const result = await promise;
    coverCache.set(id, result);
    return result;
  }

  async function hydrateCovers(generation) {
    const cards = $$("#content .book");
    const queue = [...cards];
    const concurrency = Math.min(5, queue.length);

    async function worker() {
      while (queue.length) {
        const card = queue.shift();
        if (!card || generation !== renderGeneration || !document.body.contains(card)) continue;

        const index = Number(card.dataset.idx);
        const book = BOOKS[index];
        const cover = $(".cover", card);
        const image = $(".cover-img", card);

        try {
          const result = await fetchCoverCached(book);
          book.link = result.link || fallbackOpenLibraryLink(book);
          book.coverUrl = result.coverUrl || null;

          if (generation !== renderGeneration || !document.body.contains(card)) continue;
          if (result.coverUrl && image && cover) {
            image.src = result.coverUrl;
            cover.classList.add("has-img");
          }
        } finally {
          cover?.classList.remove("skeleton");
        }
      }
    }

    const start = () => Promise.all(Array.from({ length: concurrency }, worker));
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 1200 });
    } else {
      window.setTimeout(start, 80);
    }
  }

  /* ---------------- Language ---------------- */

  function updateMetaSummary() {
    const years = [...new Set(BOOKS.map(book => book.year))].sort((a, b) => a - b);
    $("#metaSummary").textContent = t().metaSummary(BOOKS.length, years[0], years.at(-1));
  }

  function updateCurrentText() {
    const current = BOOKS[state.currentBookIndex];
    const section = $("#current");
    if (!current) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    section.setAttribute("aria-label", t().currentlyReading);
    $("#currentTitle").textContent = current.title;
    $("#currentMeta").textContent = `${getMonthName(current.month)} ${current.year} · ${current.author}`;
  }

  function translateStaticInterface() {
    document.documentElement.lang = state.lang;
    updateDocumentMetadata();

    $("#skipLink").textContent = t().skipLink;
    $("#mobileNoteText").textContent = t().mobileNote;
    $("#mobileNoteClose").setAttribute("aria-label", t().closeNotice);
    $("#siteBadge").textContent = t().badge;
    $("#heroTitle").textContent = t().heroTitle;
    $("#heroSub").textContent = t().heroSub;
    $("#currentLabel").textContent = t().currentlyReading;
    $("#currentBtn").textContent = t().jumpToBook;

    $("#viewTabs").setAttribute("aria-label", t().viewsAria);
    $("#controlsGroup").setAttribute("aria-label", t().controlsAria);
    $("#viewLibrary span:last-child").textContent = t().navLibrary;
    $("#viewStats span:last-child").textContent = t().navStats;
    $("#viewMap span:last-child").textContent = t().navMap;

    $("#search").placeholder = t().searchPlaceholder;
    $("#searchPill").title = t().searchTitle;
    $("#sortPill").title = t().sortTitle;
    $("#tagSummaryLabel").textContent = t().tagsLabel;
    $("#themeLabel").textContent = t().themeLabel;
    $("#themeBtn").title = t().themeTitle;
    $("#langSwitch").title = t().langSwitchTitle;
    $("#joinText").textContent = t().joinWhatsapp;
    $("#joinBtn").title = t().joinWhatsappTitle;

    $("#overlayClose").setAttribute("aria-label", t().overlayClose);
    $("#overlayLocalHint").textContent = t().overlayLocalHint;
    $("#overlayNoteLabelText").textContent = t().overlayNoteLabel;
    $("#overlayNoteEditable").placeholder = t().overlayNotePlaceholder;
    $("#overlayRatingLabelText").textContent = t().overlayRatingLabel;
    $("#overlayRatingInput").placeholder = t().overlayRatingPlaceholder;
    $("#overlayOpenLibText").textContent = t().overlayOpenLib;

    $("#feedbackTitle").textContent = t().feedbackTitle;
    $("#feedbackSubtitle").textContent = t().feedbackSubtitle;
    $("#feedbackCategoryLabel").textContent = t().feedbackCategoryLabel;
    $("#feedbackMessageLabel").textContent = t().feedbackMessageLabel;
    $("#feedbackMessage").placeholder = t().feedbackMessagePlaceholder;
    $("#feedbackNameLabel").textContent = t().feedbackNameLabel;
    $("#feedbackName").placeholder = t().feedbackNamePlaceholder;
    $("#feedbackSubmitButton").textContent = t().feedbackSubmit;

    $("#feedbackCategory").innerHTML = `
      <option value="general">${escapeHTML(t().feedbackCategoryGeneral)}</option>
      <option value="suggestion">${escapeHTML(t().feedbackCategorySuggestion)}</option>
      <option value="website">${escapeHTML(t().feedbackCategoryWebsite)}</option>
      <option value="meeting">${escapeHTML(t().feedbackCategoryMeeting)}</option>
    `;

    $("#toTop").textContent = t().backToTop;
    $("#toTop").title = t().backToTopTitle;
    $("#footerText").innerHTML = t().footerHtml;

    setPressed($$(".lang-chip"), button => button.dataset.lang === state.lang);
  }

  function setLanguage(lang) {
    state.lang = I18N[lang] ? lang : "en";
    setStored("booked_lang", state.lang);
    translateStaticInterface();
    renderYearFilters();
    renderSortOptions();
    renderTagFilters();
    renderLibrary();
    renderStats();
    renderMap();
    updateMetaSummary();
    updateCurrentText();
    setView(state.view, { updateHash: false, focus: false });
  }

  /* ---------------- Views ---------------- */

  function setView(view, options = {}) {
    const { updateHash = true, focus = false } = options;
    const nextView = ["library", "stats", "map"].includes(view) ? view : "library";
    state.view = nextView;
    document.body.dataset.view = nextView;

    $("#libraryView").hidden = nextView !== "library";
    $("#statsView").hidden = nextView !== "stats";
    $("#mapView").hidden = nextView !== "map";
    setPressed($$(".view-chip"), button => button.dataset.view === nextView);

    if (nextView === "stats") renderStats();
    if (nextView === "map") renderMap();

    if (updateHash) {
      const url = new URL(window.location.href);
      url.hash = nextView === "library" ? "" : nextView;
      window.history.replaceState(null, "", url);
    }

    if (focus) $("#main")?.focus({ preventScroll: true });
  }

  function initializeViewFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (["library", "stats", "map"].includes(hash)) state.view = hash;
  }

  /* ---------------- Current book ---------------- */

  function initializeCurrentBook() {
    if (state.currentBookIndex < 0) {
      $("#current").hidden = true;
      return;
    }

    $("#currentBtn").addEventListener("click", () => {
      setView("library");
      resetLibraryFilters();

      window.requestAnimationFrame(() => {
        const card = $(`.book[data-idx="${state.currentBookIndex}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => openOverlay(state.currentBookIndex, card), 260);
      });
    });
  }

  /* ---------------- Dialog and private notes ---------------- */

  function loadBookMeta(book) {
    return loadJSON(`booked_meta_${getBookId(book)}`, {});
  }

  function saveBookMeta(book, meta) {
    saveJSON(`booked_meta_${getBookId(book)}`, meta);
  }

  async function populateOverlayCover(book) {
    const wrapper = $("#overlayCover");
    const image = $("#overlayCoverImage");
    const hue = hashHue(`${book.title}${book.author}`);
    wrapper.style.setProperty("--cover-h", hue);
    wrapper.classList.remove("has-img");
    image.removeAttribute("src");
    image.alt = t().coverAlt(book.title, book.author);

    const result = book.coverUrl && book.link
      ? { coverUrl: book.coverUrl, link: book.link }
      : await fetchCoverCached(book);

    book.link = result.link || fallbackOpenLibraryLink(book);
    book.coverUrl = result.coverUrl || null;
    $("#overlayLink").href = book.link;

    if (result.coverUrl && $("#overlay").dataset.id === getBookId(book)) {
      image.src = result.coverUrl;
      wrapper.classList.add("has-img");
    }
  }

  function openOverlay(index, trigger = document.activeElement) {
    const book = BOOKS[index];
    const overlay = $("#overlay");
    if (!book || !overlay) return;

    state.lastFocusedElement = trigger instanceof HTMLElement ? trigger : null;
    overlay.dataset.id = getBookId(book);
    overlay.dataset.index = String(index);

    $("#overlayMonth").textContent = `${getMonthName(book.month)} ${book.year}`;
    $("#overlayTitle").textContent = book.title;
    $("#overlayAuthor").textContent = book.author;
    $("#overlayNote").textContent = book.note || "";
    $("#overlayPublished").textContent = Number.isFinite(book.published)
      ? `${t().publicationTimeline}: ${book.published}`
      : t().unknownPublicationYear;

    const tags = $("#overlayTags");
    tags.innerHTML = "";
    (book.tags || []).forEach(tagText => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = tagText;
      tags.appendChild(tag);
    });

    const meta = loadBookMeta(book);
    $("#overlayNoteEditable").value = meta.note || "";
    $("#overlayRatingInput").value = meta.rating || "";
    $("#overlayLink").href = book.link || fallbackOpenLibraryLink(book);

    document.body.style.overflow = "hidden";
    if (typeof overlay.showModal === "function" && !overlay.open) {
      overlay.showModal();
    } else {
      overlay.setAttribute("open", "");
    }

    $("#overlayClose").focus();
    populateOverlayCover(book);
  }

  function closeOverlay() {
    const overlay = $("#overlay");
    document.body.style.overflow = "";
    overlay.dataset.id = "";
    overlay.dataset.index = "";

    if (typeof overlay.close === "function" && overlay.open) {
      overlay.close();
    } else {
      overlay.removeAttribute("open");
    }

    state.lastFocusedElement?.focus?.();
  }

  function initializeOverlay() {
    const overlay = $("#overlay");
    $("#overlayClose").addEventListener("click", closeOverlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeOverlay();
    });

    overlay.addEventListener("cancel", event => {
      event.preventDefault();
      closeOverlay();
    });

    const persist = () => {
      const index = Number(overlay.dataset.index);
      const book = BOOKS[index];
      if (!book) return;
      saveBookMeta(book, {
        note: $("#overlayNoteEditable").value.trim(),
        rating: $("#overlayRatingInput").value.trim()
      });
    };

    $("#overlayNoteEditable").addEventListener("input", debounce(persist, 120));
    $("#overlayRatingInput").addEventListener("input", debounce(persist, 120));
  }

  /* ---------------- Feedback form ---------------- */

  function initializeFeedbackForm() {
    const form = $("#feedbackForm");
    const status = $("#feedbackStatus");
    const submit = $("#feedbackSubmitButton");

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const configuration = source.googleForm || {};
      if (!configuration.action || !configuration.fields?.message) {
        status.textContent = t().feedbackNotConfigured;
        return;
      }

      const message = $("#feedbackMessage").value.trim();
      const name = $("#feedbackName").value.trim();
      const category = $("#feedbackCategory");
      const categoryLabel = category.selectedOptions[0]?.textContent || category.value;

      if (!message) {
        form.reportValidity();
        return;
      }

      const payload = new FormData();
      payload.append(configuration.fields.message, `Type: ${categoryLabel}\n\n${message}`);
      if (configuration.fields.name) payload.append(configuration.fields.name, name);

      submit.disabled = true;
      submit.textContent = t().feedbackSending;
      status.textContent = "";

      try {
        await fetch(configuration.action, {
          method: "POST",
          mode: "no-cors",
          body: payload
        });

        form.reset();
        status.textContent = t().feedbackThanks;
      } catch (error) {
        console.error("Feedback form submission failed.", error);
        status.textContent = t().feedbackError;
      } finally {
        submit.disabled = false;
        submit.textContent = t().feedbackSubmit;
      }
    });
  }

  /* ---------------- Statistics ---------------- */

  function renderBarList(counts, maxItems = 8) {
    const entries = sortedEntriesFromCount(counts).slice(0, maxItems);
    const maximum = entries[0]?.[1] || 1;
    if (!entries.length) return "";

    return `
      <div class="bar-list">
        ${entries.map(([name, count]) => {
          const percentage = Math.max(8, Math.round((count / maximum) * 100));
          return `
            <div class="bar-row">
              <span class="bar-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
              <span class="bar-track" aria-hidden="true">
                <span class="bar-fill" style="--pct:${percentage}%"></span>
              </span>
              <span class="bar-count">${count}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function getPublicationPeriod(year) {
    if (!Number.isFinite(year)) return null;
    const start = Math.floor(year / 50) * 50;
    return `${start}s–${start + 49}s`;
  }

  function getPublicationPeriodCounts() {
    return BOOKS.reduce((counts, book) => {
      const period = getPublicationPeriod(book.published);
      if (!period) return counts;
      counts[period] = (counts[period] || 0) + 1;
      return counts;
    }, {});
  }

  function renderPublicationTimeline() {
    const books = BOOKS
      .filter(book => Number.isFinite(book.published))
      .slice()
      .sort((a, b) => a.published - b.published);

    if (!books.length) return `<p class="author">${escapeHTML(t().unknownPublicationYear)}</p>`;

    const minimum = Math.min(...books.map(book => book.published));
    const maximum = Math.max(...books.map(book => book.published));
    const span = Math.max(1, maximum - minimum);

    return `
      <div class="timeline">
        <div class="timeline-axis"><span>${minimum}</span><span>${maximum}</span></div>
        ${books.map(book => {
          const position = Math.round(((book.published - minimum) / span) * 100);
          return `
            <div class="timeline-item">
              <span class="timeline-year">${book.published}</span>
              <div>
                <div class="timeline-track"><span class="timeline-dot" style="--x:${position}%"></span></div>
                <div class="timeline-title">${escapeHTML(book.title)} · ${escapeHTML(book.author)}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderStats() {
    const view = $("#statsView");
    const years = [...new Set(BOOKS.map(book => book.year))].sort((a, b) => a - b);
    const authors = new Set(BOOKS.map(book => book.author));
    const countries = new Set(BOOKS.map(book => book.country));
    const current = BOOKS.find(book => book.current);

    const yearCounts = countBy(BOOKS, book => String(book.year));
    const countryCounts = countBy(BOOKS, book => book.country);
    const authorCounts = countBy(BOOKS, book => book.author);
    const repeatingAuthors = Object.fromEntries(
      sortedEntriesFromCount(authorCounts).filter(([, count]) => count > 1)
    );
    const tagCounts = BOOKS.reduce((counts, book) => {
      (book.tags || []).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return counts;
    }, {});
    const periodCounts = getPublicationPeriodCounts();
    const topPeriod = sortedEntriesFromCount(periodCounts)[0];

    view.innerHTML = `
      <div class="section-head">
        <h2>${escapeHTML(t().statsTitle)}</h2>
        <p>${escapeHTML(t().statsSubtitle)}</p>
      </div>

      <div class="stat-grid">
        <article class="stat-card">
          <p class="stat-value">${BOOKS.length}</p>
          <p class="stat-label">${escapeHTML(t().totalBooks)}</p>
        </article>
        <article class="stat-card">
          <p class="stat-value">${years[0]}–${years.at(-1)}</p>
          <p class="stat-label">${escapeHTML(t().yearsCovered)}</p>
        </article>
        <article class="stat-card">
          <p class="stat-value">${authors.size}</p>
          <p class="stat-label">${escapeHTML(t().uniqueAuthors)}</p>
        </article>
        <article class="stat-card">
          <p class="stat-value">${countries.size}</p>
          <p class="stat-label">${escapeHTML(t().countriesRead)}</p>
        </article>
      </div>

      <div class="charts">
        <article class="chart-card">
          <h3>${escapeHTML(t().currentBook)}</h3>
          <p class="title">${escapeHTML(current?.title || "—")}</p>
          <p class="author">${current ? escapeHTML(`${getMonthName(current.month)} ${current.year} · ${current.author}`) : ""}</p>
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().booksByYear)}</h3>
          ${renderBarList(yearCounts, 10)}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().topTags)}</h3>
          ${renderBarList(tagCounts, 10)}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().booksByCountry)}</h3>
          ${renderBarList(countryCounts, 10)}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().booksByPeriod)}</h3>
          ${renderBarList(periodCounts, 10)}
          ${topPeriod ? `<p class="period-summary">${escapeHTML(t().mostReadPeriod(topPeriod[0], topPeriod[1]))}</p>` : ""}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().recurringAuthors)}</h3>
          ${Object.keys(repeatingAuthors).length ? renderBarList(repeatingAuthors, 8) : `<p class="author">${escapeHTML(t().noRepeatingAuthors)}</p>`}
        </article>
        <article class="chart-card chart-card-wide">
          <h3>${escapeHTML(t().publicationTimeline)}</h3>
          ${renderPublicationTimeline()}
        </article>
      </div>
    `;
  }

  /* ---------------- Map ---------------- */

  function groupBooksByCountry() {
    return BOOKS.reduce((groups, book) => {
      const country = book.country || "Unknown";
      groups[country] ||= [];
      groups[country].push(book);
      return groups;
    }, {});
  }

  function selectMapCountry(country) {
    state.selectedMapCountry = country;
    renderMap();
  }

  function showCountryInLibrary(country) {
    setView("library");
    state.activeYear = "all";
    state.activeTag = "all";
    $("#search").value = country;
    renderYearFilters();
    renderTagFilters();
    applyFilters();
    $("#main").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderMap() {
    const view = $("#mapView");
    const groups = groupBooksByCountry();
    const countries = sortedEntriesFromCount(countBy(BOOKS, book => book.country));

    if (!state.selectedMapCountry || !groups[state.selectedMapCountry]) {
      state.selectedMapCountry = countries[0]?.[0] || null;
    }

    const selectedBooks = state.selectedMapCountry ? groups[state.selectedMapCountry] : [];
    const countryCards = countries.map(([country, count]) => `
      <button class="country-card" type="button" data-country-card="${escapeHTML(country)}" data-active="${country === state.selectedMapCountry ? "true" : "false"}">
        <strong>${escapeHTML(country)}</strong>
        <span>${escapeHTML(t().countryCount(count))}</span>
      </button>
    `).join("");

    view.innerHTML = `
      <div class="section-head">
        <h2>${escapeHTML(t().mapTitle)}</h2>
        <p>${escapeHTML(t().mapSubtitle)}</p>
        <p class="meta-row">${escapeHTML(t().mapHelp)}</p>
      </div>

      <div class="map-layout">
        <article class="map-card">
          <div class="map-canvas" aria-label="${escapeHTML(t().mapTitle)}">
            <svg id="worldMapSvg" class="world-map-svg" role="img" aria-label="${escapeHTML(t().mapTitle)}"></svg>
            <div id="mapTooltip" class="map-tooltip" hidden></div>
            <div class="map-zoom" aria-label="${escapeHTML(t().mapZoomControls)}">
              <button type="button" data-map-zoom="in" aria-label="${escapeHTML(t().zoomIn)}">+</button>
              <button type="button" data-map-zoom="out" aria-label="${escapeHTML(t().zoomOut)}">−</button>
            </div>
            <div class="map-source">${escapeHTML(t().mapSource)}</div>
            <p id="mapStatus" class="map-status"></p>
          </div>
        </article>

        <aside class="map-card">
          <h3>${escapeHTML(t().selectedCountryBooks(state.selectedMapCountry || "", selectedBooks.length))}</h3>
          <ul class="map-details-list">
            ${selectedBooks.map(book => `
              <li>
                <span class="map-book-title">${escapeHTML(book.title)}</span>
                <span class="map-book-meta">${escapeHTML(getMonthName(book.month))} ${book.year} · ${escapeHTML(book.author)}</span>
              </li>
            `).join("")}
          </ul>
          <p><button class="button button-secondary country-show" type="button" data-country="${escapeHTML(state.selectedMapCountry || "")}">${escapeHTML(t().showCountryBooks)}</button></p>
        </aside>
      </div>

      <div class="country-grid">${countryCards}</div>
    `;

    $$("[data-country-card]", view).forEach(card => {
      card.addEventListener("click", () => selectMapCountry(card.dataset.countryCard));
    });

    $(".country-show", view)?.addEventListener("click", event => {
      showCountryInLibrary(event.currentTarget.dataset.country);
    });

    drawWorldMap();
  }

  async function loadWorldFeatures() {
    if (worldFeatures) return worldFeatures;

    if (!worldMapDataPromise) {
      worldMapDataPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        .then(response => {
          if (!response.ok) throw new Error("World map data failed to load.");
          return response.json();
        })
        .then(data => window.topojson.feature(data, data.objects.countries).features);
    }

    worldFeatures = await worldMapDataPromise;
    return worldFeatures;
  }

  async function drawWorldMap() {
    const svgElement = $("#worldMapSvg");
    const canvas = $(".map-canvas");
    const tooltip = $("#mapTooltip");
    const status = $("#mapStatus");
    if (!svgElement || !canvas) return;

    if (!window.d3 || !window.topojson) {
      if (status) status.textContent = t().mapLibrariesMissing;
      return;
    }

    try {
      const features = await loadWorldFeatures();
      if (!document.body.contains(svgElement)) return;

      const counts = countBy(BOOKS, book => book.country);
      const maximum = Math.max(...Object.values(counts), 1);
      const svg = window.d3.select(svgElement);
      svg.selectAll("*").remove();

      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(720, Math.round(bounds.width || 960));
      const height = Math.max(430, Math.round(bounds.height || 540));
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      const projection = window.d3.geoNaturalEarth1();
      projection.fitExtent(
        [[14, 14], [width - 14, height - 14]],
        { type: "FeatureCollection", features }
      );

      const path = window.d3.geoPath(projection);
      const group = svg.append("g");
      group.append("path")
        .datum({ type: "Sphere" })
        .attr("class", "map-ocean")
        .attr("d", path);

      const countryPaths = group.selectAll("path.map-country")
        .data(features)
        .join("path")
        .attr("class", feature => {
          const iso = String(feature.id).padStart(3, "0");
          const country = ISO_NUM_TO_COUNTRY[iso];
          const count = country ? (counts[country] || 0) : 0;
          let level = "";
          if (count >= Math.ceil(maximum * .66)) level = "level-3";
          else if (count >= Math.ceil(maximum * .33)) level = "level-2";
          else if (count > 0) level = "level-1";

          return [
            "map-country",
            count ? "is-read" : "",
            level,
            country === state.selectedMapCountry ? "is-selected" : ""
          ].filter(Boolean).join(" ");
        })
        .attr("d", path)
        .attr("tabindex", feature => ISO_NUM_TO_COUNTRY[String(feature.id).padStart(3, "0")] ? 0 : null)
        .attr("role", feature => ISO_NUM_TO_COUNTRY[String(feature.id).padStart(3, "0")] ? "button" : null)
        .attr("aria-label", feature => {
          const country = ISO_NUM_TO_COUNTRY[String(feature.id).padStart(3, "0")];
          return country ? `${country}, ${t().countryCount(counts[country] || 0)}` : null;
        });

      countryPaths
        .on("click", (_event, feature) => {
          const country = ISO_NUM_TO_COUNTRY[String(feature.id).padStart(3, "0")];
          if (country) selectMapCountry(country);
        })
        .on("keydown", (event, feature) => {
          if (!["Enter", " "].includes(event.key)) return;
          event.preventDefault();
          const country = ISO_NUM_TO_COUNTRY[String(feature.id).padStart(3, "0")];
          if (country) selectMapCountry(country);
        })
        .on("mousemove", (event, feature) => {
          const country = ISO_NUM_TO_COUNTRY[String(feature.id).padStart(3, "0")];
          if (!country || !tooltip) {
            if (tooltip) tooltip.hidden = true;
            return;
          }

          const [x, y] = window.d3.pointer(event, canvas);
          tooltip.innerHTML = `<strong>${escapeHTML(country)}</strong><span>${escapeHTML(t().countryCount(counts[country] || 0))}</span>`;
          tooltip.style.left = `${x}px`;
          tooltip.style.top = `${y}px`;
          tooltip.hidden = false;
        })
        .on("mouseleave", () => {
          if (tooltip) tooltip.hidden = true;
        });

      const zoom = window.d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", event => group.attr("transform", event.transform));

      svg.call(zoom).on("dblclick.zoom", null);
      $$("[data-map-zoom]", canvas).forEach(button => {
        button.addEventListener("click", () => {
          const factor = button.dataset.mapZoom === "in" ? 1.35 : 1 / 1.35;
          svg.transition().duration(180).call(zoom.scaleBy, factor);
        });
      });

      if (status) status.textContent = "";
    } catch (error) {
      console.error("World map rendering failed.", error);
      if (status) status.textContent = t().mapLoadError;
    }
  }

  /* ---------------- Utility controls ---------------- */

  function initializeTopButton() {
    const button = $("#toTop");
    const update = () => {
      button.hidden = window.scrollY <= 520;
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initializeMobileNotice() {
    const notice = $("#mobileNote");
    const close = $("#mobileNoteClose");
    if (getStored("booked_mobile_note_dismissed") === "true") notice.hidden = true;
    close.addEventListener("click", () => {
      notice.hidden = true;
      setStored("booked_mobile_note_dismissed", "true");
    });
  }

  function initializeTagMenu() {
    document.addEventListener("click", event => {
      const menu = $("#tagMenu");
      if (menu?.open && !menu.contains(event.target)) menu.removeAttribute("open");
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && $("#tagMenu")?.open) {
        $("#tagMenu").removeAttribute("open");
      }
    });
  }

  function bindPrimaryControls() {
    $$(".view-chip").forEach(button => {
      button.addEventListener("click", () => setView(button.dataset.view, { focus: true }));
    });

    $("#search").addEventListener("input", debounce(applyFilters, 100));
    $("#searchClear").addEventListener("click", () => {
      $("#search").value = "";
      $("#search").focus();
      applyFilters();
    });

    $("#sortSelect").addEventListener("change", event => {
      state.sort = event.target.value;
      renderLibrary();
    });

    $("#themeBtn").addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    $$(".lang-chip").forEach(button => {
      button.addEventListener("click", () => setLanguage(button.dataset.lang));
    });

    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (["library", "stats", "map"].includes(hash)) setView(hash, { updateHash: false });
    });

    window.addEventListener("resize", debounce(() => {
      if (state.view === "map") drawWorldMap();
    }, 180));
  }

  /* ---------------- Boot ---------------- */

  function boot() {
    initializeTheme();
    initializeViewFromHash();
    initializeTopButton();
    initializeMobileNotice();
    initializeTagMenu();
    initializeCurrentBook();
    initializeOverlay();
    initializeFeedbackForm();
    bindPrimaryControls();

    const savedLang = getStored("booked_lang", "en");
    const savedView = state.view;
    setLanguage(savedLang);
    setView(savedView, { updateHash: false, focus: false });

    if (source.links?.whatsapp) $("#joinBtn").href = source.links.whatsapp;
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
