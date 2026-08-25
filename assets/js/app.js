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
    mobileLibraryMode: getStored("booked_mobile_library_mode", "list"),
    mobileStatsIndex: 0,
    statsSelection: { type: "all", value: "" },
    currentBookIndex: BOOKS.findIndex(book => book.current),
    currentMemory: null,
    selectedMapCountry: null,
    lastFocusedElement: null
  };

  const coverCache = new Map();
  let worldFeatures = null;
  let worldMapDataPromise = null;
  let renderGeneration = 0;
  let meetingTimerId = null;

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
      getBookPages(book) ? String(getBookPages(book)) : "",
      getBookPages(book) ? formatPages(getBookPages(book)) : "",
      book.note,
      ...(book.tags || [])
    ].join(" "));
  }

  function fallbackOpenLibraryLink(book) {
    return `https://openlibrary.org/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`;
  }

  function getBookPages(book) {
    return Number.isFinite(book?.pages) && book.pages > 0 ? book.pages : null;
  }

  function formatPages(pages) {
    return Number.isFinite(pages) ? t().pageCount(pages) : t().pageCountUnknown;
  }

  function getPageLabel(book) {
    if (book?.pageStatus === "varies") return t().pageCountVaries;
    return formatPages(getBookPages(book));
  }

  function getPageSourceTitle(book) {
    return book?.pageSourceName
      ? t().pageSourceTitle(book.pageSourceName)
      : t().pageSourceMissing;
  }

  function formatMeetingDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    const locale = state.lang === "de" ? "de-DE" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function getTimeZoneOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    ) - date.getTime();
  }

  function zonedTimeToDate(value, hour, minute = 0, timeZone = "Europe/Berlin") {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return null;
    const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offset = getTimeZoneOffsetMs(guess, timeZone);
    return new Date(guess.getTime() - offset);
  }

  function getMeetingWindow(value) {
    const start = zonedTimeToDate(value, 18);
    const end = zonedTimeToDate(value, 20);
    return start && end ? { start, end } : null;
  }

  function formatMeetingDateTime(value) {
    const start = zonedTimeToDate(value, 18);
    if (!start) return "";
    const locale = state.lang === "de" ? "de-DE" : "en-GB";
    return `${new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin"
    }).format(start)} ${t().germanyTime}`;
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return t().countdownLeft(days, hours, minutes, seconds);
  }

  function formatCalendarDate(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function escapeCalendarText(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function getCalendarInvite(current) {
    if (!current?.meetingDate) return null;
    const meetingWindow = getMeetingWindow(current.meetingDate);
    if (!meetingWindow) return null;

    const whatsapp = source.links?.whatsapp || "";
    const title = `Booked: ${current.title}`;
    const description = t().calendarDescription(current.title, current.author, whatsapp);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Booked//Reading Club//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${getBookId(current)}-${current.meetingDate}@booked`,
      `DTSTAMP:${formatCalendarDate(new Date())}`,
      `DTSTART:${formatCalendarDate(meetingWindow.start)}`,
      `DTEND:${formatCalendarDate(meetingWindow.end)}`,
      `SUMMARY:${escapeCalendarText(title)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      `LOCATION:${escapeCalendarText(t().calendarLocation)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeCalendarText(title)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];

    return {
      content: `${lines.join("\r\n")}\r\n`,
      fileName: `${t().calendarFileName(current.title) || "booked-meeting"}.ics`
    };
  }

  function downloadCalendarInvite() {
    const invite = getCalendarInvite(BOOKS[state.currentBookIndex]);
    if (!invite) return;

    const blob = new Blob([invite.content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = invite.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setCurrentResponseButtons(current) {
    const available = Boolean(current?.meetingDate);
    const yesButton = $("#rsvpYesBtn");
    const noButton = $("#rsvpNoBtn");
    const calendarPrompt = $("#rsvpCalendarBtn");
    [yesButton, noButton].forEach(button => {
      if (button) button.hidden = !available;
    });
    if (yesButton) {
      yesButton.textContent = t().rsvpYes;
      yesButton.title = t().rsvpYesTitle;
    }
    if (noButton) {
      noButton.textContent = t().rsvpNo;
      noButton.title = t().rsvpNoTitle;
    }
    if (calendarPrompt) {
      calendarPrompt.textContent = t().rsvpCalendarPrompt;
      calendarPrompt.title = t().addToCalendarTitle;
    }
  }

  function acknowledgeJoining() {
    const note = $("#rsvpYesNote");
    if (!note) return;
    $("#rsvpYesMessage").textContent = t().rsvpYesMessage;
    $("#rsvpCalendarBtn").textContent = t().rsvpCalendarPrompt;
    note.hidden = false;
    note.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function promptMeetingFeedback() {
    const current = BOOKS[state.currentBookIndex];
    const form = $("#feedbackForm");
    const category = $("#feedbackCategory");
    const message = $("#feedbackMessage");
    const status = $("#feedbackStatus");
    if (!form || !category || !message) return;

    category.value = "meeting";
    updateFeedbackMessagePrompt();
    if (!message.value.trim()) message.value = t().rsvpNoPrompt(current?.title || "");
    if (status) status.textContent = t().rsvpNoStatus;

    window.location.hash = "feedback";
    window.requestAnimationFrame(() => {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      message.focus({ preventScroll: true });
      message.setSelectionRange(message.value.length, message.value.length);
    });
  }

  function getOpenAccessLink(book) {
    if (!book?.openAccess?.url) return null;

    try {
      const url = new URL(book.openAccess.url, window.location.href);
      if (!["http:", "https:"].includes(url.protocol)) return null;

      return {
        url: url.href,
        label: book.openAccess.label || t().readOpenAccess,
        verifiedOn: book.openAccess.verifiedOn || ""
      };
    } catch {
      return null;
    }
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

  function initializeAnalytics() {
    const config = source.analytics || {};
    if (!config.enabled || !config.scriptUrl) return;

    try {
      const scriptUrl = new URL(config.scriptUrl, window.location.href);
      if (!["http:", "https:"].includes(scriptUrl.protocol)) return;

      const provider = String(config.provider || "").toLowerCase();
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = scriptUrl.href;

      if (provider === "umami" && config.websiteId) {
        script.dataset.websiteId = config.websiteId;
      }

      if (provider === "plausible" && config.domain) {
        script.dataset.domain = config.domain;
      }

      document.head.appendChild(script);
    } catch (error) {
      console.warn("Analytics script was not loaded.", error);
    }
  }

  /* ---------------- Theme ---------------- */

  function setTheme(mode) {
    const theme = mode === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    setStored("booked_theme", theme);

    const dark = theme === "dark";
    $("#moon")?.toggleAttribute("hidden", !dark);
    $("#sun")?.toggleAttribute("hidden", dark);
    $("#mobileDockThemeMoon")?.toggleAttribute("hidden", !dark);
    $("#mobileDockThemeSun")?.toggleAttribute("hidden", dark);
    $("#themeBtn").setAttribute("aria-pressed", dark ? "true" : "false");
    $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#090a0f" : "#f7f5fc");
  }

  function setMobileLibraryMode(mode) {
    const nextMode = mode === "covers" ? "covers" : "list";
    state.mobileLibraryMode = nextMode;
    document.body.dataset.mobileLibraryMode = nextMode;
    setStored("booked_mobile_library_mode", nextMode);
    setPressed($$("[data-mobile-library-mode]"), button => button.dataset.mobileLibraryMode === nextMode);
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
      <option value="pages">${escapeHTML(t().sortPages)}</option>
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
      case "pages":
        return entries.sort((a, b) => (getBookPages(b.book) || 0) - (getBookPages(a.book) || 0) || a.book.title.localeCompare(b.book.title));
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
    const pages = getBookPages(book);
    const pageTag = pages
      ? `<span class="tag" title="${escapeHTML(getPageSourceTitle(book))}">${escapeHTML(formatPages(pages))}</span>`
      : `<span class="tag tag-muted" title="${escapeHTML(getPageSourceTitle(book))}">${escapeHTML(getPageLabel(book))}</span>`;

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
          ${pageTag}
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

    if (["title", "author", "pages"].includes(state.sort)) {
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

  function updateMeetingCountdown() {
    const current = BOOKS[state.currentBookIndex];
    const panel = $("#currentNextPanel");
    if (!current?.meetingDate || !panel) {
      if (panel) panel.hidden = true;
      return;
    }

    const meetingWindow = getMeetingWindow(current.meetingDate);
    if (!meetingWindow) {
      panel.hidden = true;
      return;
    }

    const now = new Date();
    const dateTime = formatMeetingDateTime(current.meetingDate);
    panel.hidden = false;

    if (now < meetingWindow.start) {
      $("#currentNextLabel").textContent = t().nextMeeting;
      $("#currentMeeting").textContent = dateTime;
      $("#currentNextDetail").textContent = formatCountdown(meetingWindow.start.getTime() - now.getTime());
      return;
    }

    if (now < meetingWindow.end) {
      $("#currentNextLabel").textContent = t().meetingStatusLabel;
      $("#currentMeeting").textContent = t().meetingNow;
      $("#currentNextDetail").textContent = t().meetingNowDetail;
      return;
    }

    $("#currentNextLabel").textContent = t().lastMeeting;
    $("#currentMeeting").textContent = dateTime;
    $("#currentNextDetail").textContent = t().meetingPastDetail;
  }

  function getBerlinTodayParts() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "numeric"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { year: Number(values.year), month: Number(values.month) };
  }

  function chooseRandom(items) {
    return items[Math.floor(Math.random() * items.length)] || null;
  }

  function createCurrentMemory(current) {
    const candidates = [];
    const today = getBerlinTodayParts();

    BOOKS
      .filter(book => MONTH_ORDER[book.month] === today.month && book.year < today.year)
      .sort((a, b) => b.year - a.year)
      .slice(0, 2)
      .forEach(book => {
        candidates.push({
          type: "anniversary",
          year: book.year,
          yearsAgo: today.year - book.year,
          bookIndex: getBookIndex(book)
        });
      });

    const sameAuthor = BOOKS.find(book => book !== current && book.author === current.author);
    if (sameAuthor) {
      candidates.push({
        type: "sameAuthor",
        author: current.author,
        bookIndex: getBookIndex(sameAuthor)
      });
    }

    const sameCountryCount = BOOKS.filter(book => book.country === current.country).length;
    if (current.country && sameCountryCount > 1) {
      candidates.push({
        type: "sameCountry",
        country: current.country,
        count: sameCountryCount
      });
    }

    const yearBooks = BOOKS.filter(book => book.year === current.year && !book.current);
    const longestThisYear = yearBooks
      .filter(getBookPages)
      .slice()
      .sort((a, b) => getBookPages(b) - getBookPages(a))[0];
    if (longestThisYear) {
      candidates.push({
        type: "longestYear",
        year: current.year,
        bookIndex: getBookIndex(longestThisYear),
        pages: getBookPages(longestThisYear)
      });
    }

    const tagCounts = yearBooks.reduce((counts, book) => {
      (book.tags || []).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return counts;
    }, {});
    const topTag = sortedEntriesFromCount(tagCounts)[0];
    if (topTag) {
      candidates.push({
        type: "topTagYear",
        year: current.year,
        tag: topTag[0],
        count: topTag[1]
      });
    }

    const fallback = getBooksByPages()[0];
    if (fallback) {
      candidates.push({
        type: "longestOverall",
        bookIndex: getBookIndex(fallback),
        pages: getBookPages(fallback)
      });
    }

    return chooseRandom(candidates);
  }

  function getCurrentMemoryText(memory) {
    const book = Number.isFinite(memory?.bookIndex) ? BOOKS[memory.bookIndex] : null;
    switch (memory?.type) {
      case "anniversary":
        return book ? t().memoryAnniversary(memory.yearsAgo, book.title) : "";
      case "sameAuthor":
        return book ? t().memorySameAuthor(memory.author, book.title) : "";
      case "sameCountry":
        return t().memorySameCountry(memory.country, memory.count);
      case "longestYear":
        return book ? t().memoryLongestYear(memory.year, book.title, memory.pages) : "";
      case "topTagYear":
        return t().memoryTopTagYear(memory.year, memory.tag, memory.count);
      case "longestOverall":
        return book ? t().memoryLongestOverall(book.title, memory.pages) : "";
      default:
        return "";
    }
  }

  function renderCurrentMemory(current) {
    const button = $("#currentMemory");
    if (!button || !current) return;
    state.currentMemory ||= createCurrentMemory(current);
    const text = getCurrentMemoryText(state.currentMemory);
    button.hidden = !text;
    $("#currentMemoryLabel").textContent = t().bookedMemory;
    $("#currentMemoryText").textContent = text;
  }

  function navigateToCurrentMemory() {
    const memory = state.currentMemory;
    if (!memory) return;

    if (memory.type === "sameCountry") {
      showCountryOnMap(memory.country);
      return;
    }

    const book = Number.isFinite(memory.bookIndex) ? BOOKS[memory.bookIndex] : null;
    if (memory.type === "anniversary" && book) {
      setView("stats", { focus: true });
      selectStatsDetail("year", String(book.year));
      scrollStatsInspectorIntoView();
      return;
    }

    if (memory.type === "sameAuthor" && memory.author) {
      setView("stats", { focus: true });
      selectStatsDetail("author", memory.author);
      scrollStatsInspectorIntoView();
      return;
    }

    if (memory.type === "topTagYear" && memory.tag) {
      setView("stats", { focus: true });
      selectStatsDetail("tag", memory.tag);
      scrollStatsInspectorIntoView();
      return;
    }

    setView("stats", { focus: true });
    selectStatsDetail("pages");
    scrollStatsInspectorIntoView();
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
    const currentPages = getBookPages(current);
    $("#currentMeta").textContent = [
      `${getMonthName(current.month)} ${current.year}`,
      current.author,
      currentPages ? formatPages(currentPages) : null
    ].filter(Boolean).join(" · ");

    window.clearInterval(meetingTimerId);
    updateMeetingCountdown();
    meetingTimerId = window.setInterval(updateMeetingCountdown, 1000);
    renderCurrentMemory(current);
    setCurrentResponseButtons(current);

    const calendarButton = $("#currentCalendarBtn");
    if (calendarButton) {
      calendarButton.hidden = !current.meetingDate;
      calendarButton.textContent = t().addToCalendar;
      calendarButton.title = t().addToCalendarTitle;
    }

    const openLink = $("#currentOpenLink");
    const openAccess = getOpenAccessLink(current);
    if (openAccess) {
      openLink.hidden = false;
      openLink.href = openAccess.url;
      openLink.textContent = openAccess.label;
      openLink.title = openAccess.verifiedOn
        ? t().openAccessVerified(openAccess.verifiedOn)
        : t().openAccessTitle;
    } else {
      openLink.hidden = true;
      openLink.removeAttribute("href");
      openLink.textContent = t().readOpenAccess;
      openLink.title = "";
    }

    updateCurrentCover(current);
  }

  async function updateCurrentCover(current) {
    const wrapper = $("#current .current-art");
    const image = $("#currentCoverImage");
    if (!wrapper || !image || !current) return;

    wrapper.classList.remove("has-img");
    image.removeAttribute("src");
    image.alt = t().coverAlt(current.title, current.author);

    try {
      const result = current.coverUrl
        ? { coverUrl: current.coverUrl, link: current.link }
        : await fetchCoverCached(current);
      if (result.coverUrl && BOOKS[state.currentBookIndex] === current) {
        current.coverUrl = result.coverUrl;
        current.link = result.link || current.link;
        image.src = result.coverUrl;
        wrapper.classList.add("has-img");
      }
    } catch (error) {
      console.warn(`Could not load current cover for "${current.title}".`, error);
    }
  }

  function translateStaticInterface() {
    document.documentElement.lang = state.lang;
    updateDocumentMetadata();

    $("#skipLink").textContent = t().skipLink;
    $("#brandTagline").textContent = t().brandTagline;
    $("#siteBadge").textContent = t().badge;
    $("#heroTitle").textContent = t().heroTitle;
    $("#heroSub").textContent = t().heroSub;
    $("#currentLabel").textContent = t().currentlyReading;
    $("#currentBtn").textContent = t().jumpToBook;
    setCurrentResponseButtons(BOOKS[state.currentBookIndex]);
    $("#currentCalendarBtn").textContent = t().addToCalendar;
    $("#currentCalendarBtn").title = t().addToCalendarTitle;
    $("#currentOpenLink").textContent = t().readOpenAccess;
    $("#currentNextLabel").textContent = t().nextMeeting;

    $("#viewTabs").setAttribute("aria-label", t().viewsAria);
    $("#controlsGroup").setAttribute("aria-label", t().controlsAria);
    $("#viewLibrary span:last-child").textContent = t().navLibrary;
    $("#viewStats span:last-child").textContent = t().navStats;
    $("#viewMap span:last-child").textContent = t().navMap;

    $("#search").placeholder = t().searchPlaceholder;
    $("#searchPill").title = t().searchTitle;
    $("#sortPill").title = t().sortTitle;
    $("#tagSummaryLabel").textContent = t().tagsLabel;
    $("#mobileLibraryMode")?.setAttribute("aria-label", t().mobileLibraryMode);
    $("#mobileModeList").textContent = t().mobileLibraryList;
    $("#mobileModeCovers").textContent = t().mobileLibraryCovers;
    $("#themeLabel").textContent = t().themeLabel;
    $("#themeBtn").title = t().themeTitle;
    $("#langSwitch").title = t().langSwitchTitle;
    $("#contactText").textContent = t().contact;
    $("#contactBtn").title = t().contactTitle;
    $("#joinText").textContent = t().joinWhatsapp;
    $("#joinBtn").title = t().joinWhatsappTitle;

    $("#overlayClose").setAttribute("aria-label", t().overlayClose);
    $("#overlayLocalHint").textContent = t().overlayLocalHint;
    $("#overlayNoteLabelText").textContent = t().overlayNoteLabel;
    $("#overlayNoteEditable").placeholder = t().overlayNotePlaceholder;
    $("#overlayRatingLabelText").textContent = t().overlayRatingLabel;
    $("#overlayRatingInput").placeholder = t().overlayRatingPlaceholder;
    $("#overlayOpenLibText").textContent = t().overlayOpenLib;
    $("#overlayMapText").textContent = t().overlayMap;

    $("#feedbackTitle").textContent = t().feedbackTitle;
    $("#feedbackSubtitle").textContent = t().feedbackSubtitle;
    $("#feedbackCategoryLabel").textContent = t().feedbackCategoryLabel;
    $("#feedbackMessageLabel").textContent = t().feedbackMessageLabel;
    $("#feedbackNameLabel").textContent = t().feedbackNameLabel;
    $("#feedbackName").placeholder = t().feedbackNamePlaceholder;
    $("#feedbackSubmitButton").textContent = t().feedbackSubmit;

    $("#feedbackCategory").innerHTML = `
      <option value="general">${escapeHTML(t().feedbackCategoryGeneral)}</option>
      <option value="suggestion">${escapeHTML(t().feedbackCategorySuggestion)}</option>
      <option value="website">${escapeHTML(t().feedbackCategoryWebsite)}</option>
      <option value="meeting">${escapeHTML(t().feedbackCategoryMeeting)}</option>
    `;
    updateFeedbackMessagePrompt();

    $("#toTop").textContent = t().backToTop;
    $("#toTop").title = t().backToTopTitle;
    $("#aboutBadge").textContent = t().aboutBadge;
    $("#aboutTitle").textContent = t().aboutTitle;
    $("#aboutText").textContent = t().aboutText;
    $("#aboutCadenceLabel").textContent = t().aboutCadenceLabel;
    $("#aboutCadenceText").textContent = t().aboutCadenceText;
    $("#aboutArchiveLabel").textContent = t().aboutArchiveLabel;
    $("#aboutArchiveText").textContent = t().aboutArchiveText;
    $("#footerText").innerHTML = t().footerHtml;
    $("#footerTopLink").textContent = t().footerTop;
    $("#footerContactLink").textContent = t().contact;
    $("#mobileDockLang").textContent = state.lang.toUpperCase();

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
    $("#statsView")?.removeAttribute("data-mobile-detail-open");

    $("#libraryView").hidden = nextView !== "library";
    $("#statsView").hidden = nextView !== "stats";
    $("#mapView").hidden = nextView !== "map";
    setPressed($$(".view-chip"), button => button.dataset.view === nextView);
    setPressed($$("[data-dock-view]"), button => button.dataset.dockView === nextView);

    if (nextView === "stats") renderStats();
    if (nextView === "map") renderMap();

    if (updateHash) {
      const url = new URL(window.location.href);
      url.hash = nextView === "library" ? "" : nextView;
      window.history.replaceState(null, "", url);
    }

    if (focus) {
      $("#main")?.focus({ preventScroll: true });
      $("#main")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

    $("#currentMemory")?.addEventListener("click", navigateToCurrentMemory);
    $("#rsvpYesBtn")?.addEventListener("click", acknowledgeJoining);
    $("#rsvpCalendarBtn")?.addEventListener("click", downloadCalendarInvite);
    $("#rsvpNoBtn")?.addEventListener("click", promptMeetingFeedback);
    $("#currentCalendarBtn")?.addEventListener("click", downloadCalendarInvite);
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
    const pages = getBookPages(book);
    $("#overlayPublished").textContent = [
      Number.isFinite(book.published) ? `${t().publishedLabel}: ${book.published}` : t().unknownPublicationYear,
      pages ? formatPages(pages) : t().pageCountUnknown
    ].join(" · ");
    $("#overlayPublished").title = getPageSourceTitle(book);

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
    const mapButton = $("#overlayMapButton");
    mapButton.hidden = !book.country;
    mapButton.dataset.country = book.country || "";

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
    $("#overlayMapButton").addEventListener("click", event => {
      const country = event.currentTarget.dataset.country;
      if (!country) return;
      closeOverlay();
      showCountryOnMap(country);
    });

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

  function updateFeedbackMessagePrompt() {
    const category = $("#feedbackCategory")?.value || "general";
    const prompts = t().feedbackMessagePlaceholders || {};
    $("#feedbackMessage").placeholder = prompts[category] || t().feedbackMessagePlaceholder;
  }

  function initializeFeedbackForm() {
    const form = $("#feedbackForm");
    const status = $("#feedbackStatus");
    const submit = $("#feedbackSubmitButton");
    $("#feedbackCategory").addEventListener("change", updateFeedbackMessagePrompt);

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
      payload.append(configuration.fields.message, [
        `Type: ${categoryLabel}`,
        name ? `Name/contact: ${name}` : null,
        "",
        message
      ].filter(line => line !== null).join("\n"));
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

  function getBookIndex(book) {
    return BOOKS.indexOf(book);
  }

  function renderBarList(counts, maxItems = 8, filterType = "") {
    const entries = sortedEntriesFromCount(counts).slice(0, maxItems);
    const maximum = entries[0]?.[1] || 1;
    if (!entries.length) return "";

    return `
      <div class="bar-list">
        ${entries.map(([name, count]) => {
          const percentage = Math.max(8, Math.round((count / maximum) * 100));
          const openTag = filterType
            ? `button type="button" data-stats-filter="${escapeHTML(filterType)}" data-stats-value="${escapeHTML(name)}"`
            : "div";
          const closeTag = filterType ? "button" : "div";
          return `
            <${openTag} class="bar-row stats-pick">
              <span class="bar-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
              <span class="bar-track" aria-hidden="true">
                <span class="bar-fill" style="--pct:${percentage}%"></span>
              </span>
              <span class="bar-count">${count}</span>
            </${closeTag}>
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
            <button class="timeline-item stats-pick" type="button" data-stats-book-index="${getBookIndex(book)}">
              <span class="timeline-year">${book.published}</span>
              <div>
                <div class="timeline-track"><span class="timeline-dot" style="--x:${position}%"></span></div>
                <div class="timeline-title">${escapeHTML(book.title)} · ${escapeHTML(book.author)}</div>
              </div>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderPageRankingLegacy(maxItems = Infinity) {
    const books = BOOKS
      .filter(book => getBookPages(book) && !book.current)
      .slice()
      .sort((a, b) => getBookPages(b) - getBookPages(a) || a.title.localeCompare(b.title))
      .slice(0, maxItems);

    if (!books.length) return `<p class="author">${escapeHTML(t().pageCountUnknown)}</p>`;

    const maximum = getBookPages(books[0]) || 1;
    const featured = books.slice(0, 6);
    const compact = books.slice(6);

    return `
      <button class="page-ranking stats-pick" type="button" data-stats-filter="pages">
        <div class="page-rank-featured">
          ${featured.map((book, index) => {
            const pages = getBookPages(book);
            const percentage = Math.max(10, Math.round((pages / maximum) * 100));
            return `
              <div class="page-rank-bar" title="${escapeHTML(`${book.title} · ${getPageSourceTitle(book)}`)}">
                <div class="page-rank-head">
                  <span class="page-rank-title">#${index + 1} ${escapeHTML(book.title)}</span>
                  <span class="page-rank-meta">${escapeHTML(formatPages(pages))}</span>
                </div>
                <span class="page-rank-track" aria-hidden="true">
                  <span class="page-rank-fill" style="--pct:${percentage}%"></span>
                </span>
              </div>
            `;
          }).join("")}
        </div>
        ${compact.length ? `
          <div class="page-rank-shelf" aria-label="${escapeHTML(t().remainingPageCounts)}">
            ${compact.map((book, index) => `
              <span class="page-rank-chip" title="${escapeHTML(`#${index + featured.length + 1} · ${book.title} · ${formatPages(getBookPages(book))} · ${getPageSourceTitle(book)}`)}">
                <span>#${index + featured.length + 1}</span>
                <strong>${escapeHTML(book.title)}</strong>
                <em>${escapeHTML(formatPages(getBookPages(book)))}</em>
              </span>
            `).join("")}
          </div>
        ` : ""}
      </button>
    `;
  }

  function getBooksByPages() {
    return BOOKS
      .filter(book => getBookPages(book) && !book.current)
      .slice()
      .sort((a, b) => getBookPages(b) - getBookPages(a) || a.title.localeCompare(b.title));
  }

  function renderPageRanking() {
    const books = getBooksByPages();
    if (!books.length) return `<p class="author">${escapeHTML(t().pageCountUnknown)}</p>`;

    const selected = books[0];
    const selectedIndex = getBookIndex(selected);
    const highestPages = getBookPages(books[0]);
    const lowestPages = getBookPages(books.at(-1));

    return `
      <div class="page-ranking page-slider-explorer" data-page-slider-root>
        <div class="page-slider-main">
          <div class="page-slider-detail">
            <p class="page-slider-kicker" data-page-slider-position>#1 ${escapeHTML(t().ofCount(books.length))}</p>
            <h4 data-page-slider-title>${escapeHTML(selected.title)}</h4>
            <p data-page-slider-meta>${escapeHTML([selected.author, formatPages(getBookPages(selected)), getPageSourceTitle(selected)].join(" | "))}</p>
          </div>
          <button class="button button-secondary page-slider-open stats-pick" type="button" data-stats-book-index="${selectedIndex}" data-page-slider-open>${escapeHTML(t().openBookDetails)}</button>
        </div>
        <label class="page-slider-control">
          <span>${escapeHTML(formatPages(highestPages))}</span>
          <input type="range" min="0" max="${books.length - 1}" value="0" step="1" orient="vertical" data-page-slider aria-label="${escapeHTML(t().pageSliderLabel)}">
          <span>${escapeHTML(formatPages(lowestPages))}</span>
        </label>
      </div>
    `;
  }

  function getBooksForStatsSelection(selection = state.statsSelection) {
    const value = selection?.value || "";

    switch (selection?.type) {
      case "year":
        return BOOKS.filter(book => String(book.year) === value);
      case "tag":
        return BOOKS.filter(book => (book.tags || []).includes(value));
      case "country":
        return BOOKS.filter(book => book.country === value);
      case "author":
        return BOOKS.filter(book => book.author === value);
      case "period":
        return BOOKS.filter(book => getPublicationPeriod(book.published) === value);
      case "pages":
        return BOOKS
          .filter(book => getBookPages(book) && !book.current)
          .slice()
          .sort((a, b) => getBookPages(b) - getBookPages(a) || a.title.localeCompare(b.title));
      case "current":
        return BOOKS.filter(book => book.current);
      case "years":
      case "authors":
      case "countries":
        return BOOKS;
      case "book":
        return BOOKS[Number(value)] ? [BOOKS[Number(value)]] : [];
      case "all":
      default:
        return BOOKS;
    }
  }

  function getStatsSelectionTitle(selection = state.statsSelection) {
    const value = selection?.value || "";
    switch (selection?.type) {
      case "year":
        return t().statsDetailYear(value);
      case "tag":
        return t().statsDetailTag(value);
      case "country":
        return t().statsDetailCountry(value);
      case "author":
        return t().statsDetailAuthor(value);
      case "period":
        return t().statsDetailPeriod(value);
      case "pages":
        return t().statsDetailPages;
      case "current":
        return t().statsDetailCurrent;
      case "years":
        return t().statsDetailYears;
      case "authors":
        return t().statsDetailAuthors;
      case "countries":
        return t().statsDetailCountries;
      case "book":
        return BOOKS[Number(value)]?.title || t().statsInspectorTitle;
      case "all":
      default:
        return t().statsDetailAll;
    }
  }

  function getStatsFacts(selection, books) {
    const booksWithPages = books.filter(book => getBookPages(book));
    const totalPages = booksWithPages.reduce((sum, book) => sum + getBookPages(book), 0);
    const averagePages = booksWithPages.length ? Math.round(totalPages / booksWithPages.length) : null;
    const oldest = books.filter(book => Number.isFinite(book.published)).sort((a, b) => a.published - b.published)[0];
    const newest = books.filter(book => Number.isFinite(book.published)).sort((a, b) => b.published - a.published)[0];
    const years = [...new Set(BOOKS.map(book => book.year))].sort((a, b) => a - b);
    const yearEntries = sortedEntriesFromCount(countBy(BOOKS, book => String(book.year)));
    const authorEntries = sortedEntriesFromCount(countBy(BOOKS, book => book.author));
    const countryEntries = sortedEntriesFromCount(countBy(BOOKS, book => book.country));
    const repeatingAuthors = authorEntries.filter(([, count]) => count > 1);
    const longest = BOOKS.filter(book => getBookPages(book) && !book.current)
      .slice()
      .sort((a, b) => getBookPages(b) - getBookPages(a))[0];

    switch (selection?.type) {
      case "pages":
        return [
          t().statsPagesKnown(booksWithPages.length, totalPages),
          averagePages ? t().statsAveragePages(averagePages) : "",
          longest ? t().statsLongestFact(longest.title, getBookPages(longest)) : ""
        ].filter(Boolean);
      case "years":
        return [
          t().statsYearsFact(years.length),
          years.length ? t().statsFirstYear(years[0]) : "",
          years.length ? t().statsLatestYear(years.at(-1)) : "",
          yearEntries[0] ? t().statsBusiestYear(yearEntries[0][0], yearEntries[0][1]) : ""
        ].filter(Boolean);
      case "authors":
        return [
          t().statsAuthorsFact(authorEntries.length),
          t().statsRepeatingAuthorsFact(repeatingAuthors.length),
          authorEntries[0] ? t().statsTopAuthor(authorEntries[0][0], authorEntries[0][1]) : ""
        ].filter(Boolean);
      case "countries":
        return [
          t().statsCountriesFact(countryEntries.length),
          countryEntries[0] ? t().statsTopCountry(countryEntries[0][0], countryEntries[0][1]) : "",
          t().statsBookCount(BOOKS.length)
        ].filter(Boolean);
      default:
        return [
          t().statsBookCount(books.length),
          t().statsPagesKnown(booksWithPages.length, totalPages),
          averagePages ? t().statsAveragePages(averagePages) : "",
          oldest ? t().statsOldest(oldest.title, oldest.published) : "",
          newest && newest !== oldest ? t().statsNewest(newest.title, newest.published) : ""
        ].filter(Boolean);
    }
  }

  function getPreviewBooksForStatsSelection(selection, books) {
    switch (selection?.type) {
      case "pages":
        return getBooksByPages().slice(0, 8);
      case "years": {
        const years = [...new Set(BOOKS.map(book => book.year))].sort((a, b) => b - a);
        return years
          .map(year => BOOKS.find(book => book.year === year))
          .filter(Boolean)
          .slice(0, 8);
      }
      case "authors": {
        const topAuthors = sortedEntriesFromCount(countBy(BOOKS, book => book.author)).map(([author]) => author);
        return topAuthors
          .flatMap(author => BOOKS.filter(book => book.author === author))
          .slice(0, 8);
      }
      case "countries": {
        const topCountries = sortedEntriesFromCount(countBy(BOOKS, book => book.country)).map(([country]) => country);
        return topCountries
          .flatMap(country => BOOKS.filter(book => book.country === country))
          .slice(0, 8);
      }
      case "all":
        return BOOKS.slice().sort((a, b) => bookDateValue(b) - bookDateValue(a)).slice(0, 8);
      default:
        return books.slice(0, 8);
    }
  }

  function renderStatsInspector(selection = state.statsSelection) {
    const books = getBooksForStatsSelection(selection);
    const facts = getStatsFacts(selection, books);
    const previewBooks = getPreviewBooksForStatsSelection(selection, books);

    return `
      <div class="stats-inspector-copy">
        <span class="eyebrow">${escapeHTML(t().statsInspectorTitle)}</span>
        <h3>${escapeHTML(getStatsSelectionTitle(selection))}</h3>
        <p>${escapeHTML(t().statsInspectorHint)}</p>
        <div class="stats-facts">
          ${facts.map(fact => `<span>${escapeHTML(fact)}</span>`).join("")}
        </div>
      </div>
      <div class="stats-mini-books" aria-label="${escapeHTML(t().statsRelatedBooks)}">
        ${previewBooks.map(book => {
          const index = getBookIndex(book);
          const hue = hashHue(`${book.title}${book.author}`);
          return `
            <button class="stats-mini-book stats-pick" type="button" data-stats-book-index="${index}">
              <span class="stats-mini-cover" data-stats-cover-index="${index}" style="--h:${hue}">
                ${book.coverUrl ? `<img src="${escapeHTML(book.coverUrl)}" alt="">` : ""}
              </span>
              <span>
                <strong>${escapeHTML(book.title)}</strong>
                <em>${escapeHTML([
                  book.author,
                  `${getMonthName(book.month)} ${book.year}`,
                  getBookPages(book) ? formatPages(getBookPages(book)) : null
                ].filter(Boolean).join(" | "))}</em>
              </span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  async function hydrateStatsInspectorCovers() {
    const inspector = $("#statsInspector");
    if (!inspector) return;

    await Promise.all($$("[data-stats-cover-index]", inspector).map(async cover => {
      const index = Number(cover.dataset.statsCoverIndex);
      const book = BOOKS[index];
      if (!book || cover.querySelector("img")) return;

      try {
        const result = await fetchCoverCached(book);
        if (!result.coverUrl || cover.dataset.statsCoverIndex !== String(index)) return;
        book.coverUrl = result.coverUrl;
        book.link = result.link || book.link;
        cover.innerHTML = `<img src="${escapeHTML(result.coverUrl)}" alt="">`;
      } catch {
        // The generated color cover remains in place if a thumbnail cannot load.
      }
    }));
  }

  function selectStatsDetail(type, value = "") {
    state.statsSelection = { type, value };
    const inspector = $("#statsInspector");
    if (!inspector) return;
    inspector.innerHTML = `
      <button class="stats-inspector-close" type="button" data-stats-inspector-close aria-label="${escapeHTML(t().closeStatsInspector)}">×</button>
      ${renderStatsInspector(state.statsSelection)}
    `;
    $("#statsView")?.setAttribute("data-mobile-detail-open", "true");
    hydrateStatsInspectorCovers();
  }

  function scrollStatsInspectorIntoView() {
    const inspector = $("#statsInspector");
    if (!inspector) return;
    if (window.matchMedia("(max-width: 900px)").matches) return;
    inspector.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setMobileStatsIndex(index) {
    const cards = $$("[data-mobile-stats-card]");
    if (!cards.length) return;
    state.mobileStatsIndex = (index + cards.length) % cards.length;

    cards.forEach((card, cardIndex) => {
      const distance = (cardIndex - state.mobileStatsIndex + cards.length) % cards.length;
      const reverseDistance = (state.mobileStatsIndex - cardIndex + cards.length) % cards.length;
      const stateName = cardIndex === state.mobileStatsIndex
        ? "active"
        : distance === 1
          ? "next"
          : reverseDistance === 1
            ? "prev"
            : "hidden";
      card.dataset.state = stateName;
      card.setAttribute("aria-hidden", stateName === "active" ? "false" : "true");
      card.toggleAttribute("inert", stateName !== "active");
    });

    $$(".mobile-stats-dot").forEach((dot, dotIndex) => {
      dot.dataset.active = dotIndex === state.mobileStatsIndex ? "true" : "false";
      dot.setAttribute("aria-pressed", dotIndex === state.mobileStatsIndex ? "true" : "false");
    });

    const counter = $("#mobileStatsCounter");
    if (counter) counter.textContent = `${state.mobileStatsIndex + 1} / ${cards.length}`;
  }

  function renderMobileStatsDeck({ years, authors, countries, totalPages, readBooksWithPages, yearCounts, countryCounts, tagCounts, periodCounts, topPeriod, repeatingAuthors, current }) {
    const cards = [
      {
        title: t().totalBooks,
        compact: true,
        body: `<button class="stat-card stats-pick" type="button" data-stats-filter="all">
          <p class="stat-value">${BOOKS.length}</p>
          <p class="stat-label">${escapeHTML(t().totalBooks)}</p>
        </button>`
      },
      {
        title: t().totalPages,
        compact: true,
        body: `<button class="stat-card stats-pick" type="button" data-stats-filter="pages">
          <p class="stat-value">${totalPages.toLocaleString(state.lang === "de" ? "de-DE" : "en-GB")}</p>
          <p class="stat-label">${escapeHTML(t().knownPageCounts(readBooksWithPages.length))}</p>
        </button>`
      },
      {
        title: t().yearsCovered,
        compact: true,
        body: `<button class="stat-card stats-pick" type="button" data-stats-filter="years">
          <p class="stat-value">${years[0]}-${years.at(-1)}</p>
          <p class="stat-label">${escapeHTML(t().yearsCovered)}</p>
        </button>`
      },
      {
        title: t().uniqueAuthors,
        compact: true,
        body: `<button class="stat-card stats-pick" type="button" data-stats-filter="authors">
          <p class="stat-value">${authors.size}</p>
          <p class="stat-label">${escapeHTML(t().uniqueAuthors)}</p>
        </button>`
      },
      {
        title: t().countriesRead,
        compact: true,
        body: `<button class="stat-card stats-pick" type="button" data-stats-filter="countries">
          <p class="stat-value">${countries.size}</p>
          <p class="stat-label">${escapeHTML(t().countriesRead)}</p>
        </button>`
      },
      {
        title: t().currentBook,
        body: `<article class="chart-card stats-pick" data-stats-filter="current" tabindex="0">
          <h3>${escapeHTML(t().currentBook)}</h3>
          <p class="title">${escapeHTML(current?.title || "-")}</p>
          <p class="author">${current ? escapeHTML([
            `${getMonthName(current.month)} ${current.year}`,
            current.author,
            getBookPages(current) ? formatPages(getBookPages(current)) : null,
            current.meetingDate ? t().meetingDate(formatMeetingDate(current.meetingDate)) : null
          ].filter(Boolean).join(" | ")) : ""}</p>
        </article>`
      },
      {
        title: t().booksByYear,
        body: `<article class="chart-card"><h3>${escapeHTML(t().booksByYear)}</h3>${renderBarList(yearCounts, 10, "year")}</article>`
      },
      {
        title: t().topTags,
        body: `<article class="chart-card"><h3>${escapeHTML(t().topTags)}</h3>${renderBarList(tagCounts, 10, "tag")}</article>`
      },
      {
        title: t().booksByCountry,
        body: `<article class="chart-card"><h3>${escapeHTML(t().booksByCountry)}</h3>${renderBarList(countryCounts, 10, "country")}</article>`
      },
      {
        title: t().booksByPeriod,
        body: `<article class="chart-card"><h3>${escapeHTML(t().booksByPeriod)}</h3>${renderBarList(periodCounts, 10, "period")}${topPeriod ? `<p class="period-summary">${escapeHTML(t().mostReadPeriod(topPeriod[0], topPeriod[1]))}</p>` : ""}</article>`
      },
      {
        title: t().recurringAuthors,
        body: `<article class="chart-card"><h3>${escapeHTML(t().recurringAuthors)}</h3>${Object.keys(repeatingAuthors).length ? renderBarList(repeatingAuthors, 8, "author") : `<p class="author">${escapeHTML(t().noRepeatingAuthors)}</p>`}</article>`
      },
      {
        title: t().longestBooks,
        body: `<article class="chart-card chart-card-wide"><h3>${escapeHTML(t().longestBooks)}</h3>${renderPageRanking()}</article>`
      },
      {
        title: t().publicationTimeline,
        body: `<article class="chart-card chart-card-wide"><h3>${escapeHTML(t().publicationTimeline)}</h3>${renderPublicationTimeline()}</article>`
      }
    ];

    state.mobileStatsIndex = Math.min(state.mobileStatsIndex, cards.length - 1);

    return `
      <div class="mobile-stats-app" data-mobile-stats-app>
        <div class="mobile-stats-topline">
          <span id="mobileStatsCounter">${state.mobileStatsIndex + 1} / ${cards.length}</span>
          <span>${escapeHTML(t().statsSwipeHint)} · ${escapeHTML(t().tapToExplore)}</span>
        </div>
        <div class="mobile-stats-stage" data-mobile-stats-stage>
          ${cards.map((card, index) => `
            <section class="mobile-stats-card" data-mobile-stats-card data-compact="${card.compact ? "true" : "false"}" data-state="hidden" aria-label="${escapeHTML(card.title)}">
              ${card.body}
            </section>
          `).join("")}
        </div>
        <div class="mobile-stats-controls">
          <button type="button" data-mobile-stats-dir="-1" aria-label="${escapeHTML(t().previousStat)}">‹</button>
          <div class="mobile-stats-dots" aria-hidden="true">
            ${cards.map((_, index) => `<button class="mobile-stats-dot" type="button" data-mobile-stats-dot="${index}" aria-label="${index + 1}"></button>`).join("")}
          </div>
          <button type="button" data-mobile-stats-dir="1" aria-label="${escapeHTML(t().nextStat)}">›</button>
        </div>
      </div>
    `;
  }

  function updatePageSlider(input) {
    const root = input.closest("[data-page-slider-root]");
    if (!root) return;

    const books = getBooksByPages();
    const sliderIndex = Math.min(Math.max(Number(input.value) || 0, 0), books.length - 1);
    const book = books[sliderIndex];
    if (!book) return;

    const index = getBookIndex(book);
    $("[data-page-slider-position]", root).textContent = `#${sliderIndex + 1} ${t().ofCount(books.length)}`;
    $("[data-page-slider-title]", root).textContent = book.title;
    $("[data-page-slider-meta]", root).textContent = [book.author, formatPages(getBookPages(book)), getPageSourceTitle(book)].join(" | ");
    $("[data-page-slider-open]", root).dataset.statsBookIndex = String(index);
  }

  function bindStatsInteractions(view) {
    if (view.dataset.statsBound === "true") return;
    view.dataset.statsBound = "true";

    view.addEventListener("input", event => {
      if (event.target.matches("[data-page-slider]")) updatePageSlider(event.target);
    });

    view.addEventListener("touchmove", event => {
      if (event.target.matches("[data-page-slider]")) event.preventDefault();
    }, { passive: false });

    view.addEventListener("click", event => {
      const closeInspector = event.target.closest("[data-stats-inspector-close]");
      if (closeInspector) {
        view.removeAttribute("data-mobile-detail-open");
        return;
      }

      const mobileDirection = event.target.closest("[data-mobile-stats-dir]");
      if (mobileDirection) {
        setMobileStatsIndex(state.mobileStatsIndex + Number(mobileDirection.dataset.mobileStatsDir));
        return;
      }

      const mobileDot = event.target.closest("[data-mobile-stats-dot]");
      if (mobileDot) {
        setMobileStatsIndex(Number(mobileDot.dataset.mobileStatsDot));
        return;
      }

      const item = event.target.closest("[data-stats-filter], [data-stats-book-index]");
      if (!item || !view.contains(item)) return;

      if (item.dataset.statsBookIndex) {
        openOverlay(Number(item.dataset.statsBookIndex), item);
        return;
      }

      selectStatsDetail(item.dataset.statsFilter, item.dataset.statsValue || "");
      scrollStatsInspectorIntoView();
    });

    let touchStartX = 0;
    let touchStartY = 0;
    view.addEventListener("touchstart", event => {
      if (!event.target.closest("[data-mobile-stats-stage]")) return;
      touchStartX = event.touches[0]?.clientX || 0;
      touchStartY = event.touches[0]?.clientY || 0;
    }, { passive: true });

    view.addEventListener("touchend", event => {
      if (!event.target.closest("[data-mobile-stats-stage]")) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
      setMobileStatsIndex(state.mobileStatsIndex + (deltaX < 0 ? 1 : -1));
    }, { passive: true });
  }

  function renderStats() {
    const view = $("#statsView");
    const years = [...new Set(BOOKS.map(book => book.year))].sort((a, b) => a - b);
    const authors = new Set(BOOKS.map(book => book.author));
    const countries = new Set(BOOKS.map(book => book.country));
    const current = BOOKS.find(book => book.current);
    const booksWithPages = BOOKS.filter(book => getBookPages(book));
    const readBooksWithPages = booksWithPages.filter(book => !book.current);
    const totalPages = readBooksWithPages.reduce((sum, book) => sum + getBookPages(book), 0);

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
        <button class="stat-card stats-pick" type="button" data-stats-filter="all">
          <p class="stat-value">${BOOKS.length}</p>
          <p class="stat-label">${escapeHTML(t().totalBooks)}</p>
        </button>
        <button class="stat-card stats-pick" type="button" data-stats-filter="pages">
          <p class="stat-value">${totalPages.toLocaleString(state.lang === "de" ? "de-DE" : "en-GB")}</p>
          <p class="stat-label">${escapeHTML(t().totalPages)} · ${escapeHTML(t().knownPageCounts(readBooksWithPages.length))}</p>
        </button>
        <button class="stat-card stats-pick" type="button" data-stats-filter="years">
          <p class="stat-value">${years[0]}–${years.at(-1)}</p>
          <p class="stat-label">${escapeHTML(t().yearsCovered)}</p>
        </button>
        <button class="stat-card stats-pick" type="button" data-stats-filter="authors">
          <p class="stat-value">${authors.size}</p>
          <p class="stat-label">${escapeHTML(t().uniqueAuthors)}</p>
        </button>
        <button class="stat-card stats-pick" type="button" data-stats-filter="countries">
          <p class="stat-value">${countries.size}</p>
          <p class="stat-label">${escapeHTML(t().countriesRead)}</p>
        </button>
      </div>

      ${renderMobileStatsDeck({ years, authors, countries, totalPages, readBooksWithPages, yearCounts, countryCounts, tagCounts, periodCounts, topPeriod, repeatingAuthors, current })}

      <aside class="stats-inspector" id="statsInspector" aria-live="polite">
        <button class="stats-inspector-close" type="button" data-stats-inspector-close aria-label="${escapeHTML(t().closeStatsInspector)}">×</button>
        ${renderStatsInspector(state.statsSelection)}
      </aside>

      <div class="charts">
        <article class="chart-card stats-pick" data-stats-filter="current" tabindex="0">
          <h3>${escapeHTML(t().currentBook)}</h3>
          <p class="title">${escapeHTML(current?.title || "—")}</p>
          <p class="author">${current ? escapeHTML([
            `${getMonthName(current.month)} ${current.year}`,
            current.author,
            getBookPages(current) ? formatPages(getBookPages(current)) : null,
            current.meetingDate ? t().meetingDate(formatMeetingDate(current.meetingDate)) : null
          ].filter(Boolean).join(" · ")) : ""}</p>
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().booksByYear)}</h3>
          ${renderBarList(yearCounts, 10, "year")}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().topTags)}</h3>
          ${renderBarList(tagCounts, 10, "tag")}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().booksByCountry)}</h3>
          ${renderBarList(countryCounts, 10, "country")}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().booksByPeriod)}</h3>
          ${renderBarList(periodCounts, 10, "period")}
          ${topPeriod ? `<p class="period-summary">${escapeHTML(t().mostReadPeriod(topPeriod[0], topPeriod[1]))}</p>` : ""}
        </article>
        <article class="chart-card">
          <h3>${escapeHTML(t().recurringAuthors)}</h3>
          ${Object.keys(repeatingAuthors).length ? renderBarList(repeatingAuthors, 8, "author") : `<p class="author">${escapeHTML(t().noRepeatingAuthors)}</p>`}
        </article>
        <article class="chart-card chart-card-wide">
          <h3>${escapeHTML(t().longestBooks)}</h3>
          ${renderPageRanking()}
        </article>
        <article class="chart-card chart-card-wide">
          <h3>${escapeHTML(t().publicationTimeline)}</h3>
          ${renderPublicationTimeline()}
        </article>
      </div>
    `;

    bindStatsInteractions(view);
    setMobileStatsIndex(state.mobileStatsIndex);
    hydrateStatsInspectorCovers();
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

  function showCountryOnMap(country) {
    if (!country) return;
    state.selectedMapCountry = country;
    setView("map", { focus: true });
    renderMap();
    window.requestAnimationFrame(() => {
      $("#mapView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  function initializeMobileDock() {
    const dock = $("#mobileDock");
    if (!dock) return;
    dock.hidden = false;

    const update = () => {
      document.body.dataset.mobileDock = window.scrollY > 260 ? "visible" : "hidden";
    };

    $$("[data-dock-view]", dock).forEach(button => {
      button.addEventListener("click", () => setView(button.dataset.dockView, { focus: true }));
    });

    $("[data-dock-action='language']", dock)?.addEventListener("click", () => {
      setLanguage(state.lang === "en" ? "de" : "en");
    });

    $("[data-dock-action='theme']", dock)?.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    window.addEventListener("scroll", update, { passive: true });
    update();
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

    $("#brandHome")?.addEventListener("click", event => {
      event.preventDefault();
      setView("library", { focus: true });
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

    $$("[data-mobile-library-mode]").forEach(button => {
      button.addEventListener("click", () => setMobileLibraryMode(button.dataset.mobileLibraryMode));
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
    initializeAnalytics();
    initializeTheme();
    initializeViewFromHash();
    initializeTopButton();
    initializeMobileDock();
    initializeTagMenu();
    initializeCurrentBook();
    initializeOverlay();
    initializeFeedbackForm();
    bindPrimaryControls();
    setMobileLibraryMode(state.mobileLibraryMode);

    const savedLang = getStored("booked_lang", "en");
    const savedView = state.view;
    setLanguage(savedLang);
    setView(savedView, { updateHash: false, focus: false });

    if (source.links?.whatsapp) $("#joinBtn").href = source.links.whatsapp;
    if (source.links?.whatsapp) $("#mobileDockWhatsapp").href = source.links.whatsapp;
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
