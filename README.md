# Booked — GitHub Pages website

This folder is a complete static website. It needs no build command, server, framework, or package installation.

## Publish it on GitHub Pages

1. Back up the current repository.
2. Copy every file and folder from this package into the repository.
3. Keep `index.html` in the repository root.
4. Commit and push the files.
5. Open **Repository → Settings → Pages**.
6. Choose **Deploy from a branch**, select the publishing branch, and select `/ (root)`.

GitHub Pages will publish the site under the same repository URL. All internal paths are relative, so the site also works under a project URL such as:

```text
https://username.github.io/repository-name/
```

## Project structure

```text
booked-github-pages/
├── index.html
├── 404.html
├── manifest.webmanifest
├── .nojekyll
├── README.md
└── assets/
    ├── css/
    │   └── styles.css
    ├── icons/
    │   ├── favicon.svg
    │   └── social-card.svg
    └── js/
        ├── data.js
        ├── i18n.js
        └── app.js
```

## Edit books and club links

Open `assets/js/data.js`.

- Add, remove, or edit books inside `books`.
- Put `current: true` on the current book.
- Keep only one book marked as current.
- Add `openAccess` only when you have verified a legal public/open-access copy.
- Add `pages`, `pageSourceName`, and `pageSourceUrl` from a legitimate original-language/original-edition source when available.
- Add `meetingDate: "YYYY-MM-DD"` to the current book when a club date is scheduled.
- Change the WhatsApp invitation under `links.whatsapp`.
- Change the Google Forms endpoint and field IDs under `googleForm` when needed.

Each book follows this structure:

```js
{
  year: 2026,
  month: "August",
  title: "Book title",
  author: "Author name",
  country: "Country",
  published: 1999,
  current: true,
  meetingDate: "2026-08-30",
  pages: 240,
  pageSourceName: "Library or publisher source, original-language edition",
  pageSourceUrl: "https://example.com/catalog-record",
  openAccess: {
    url: "https://www.gutenberg.org/ebooks/example",
    label: "Read open access ↗",
    verifiedOn: "2026-08-04"
  },
  tags: ["Tag one", "Tag two"],
  note: "Short description."
}
```

Use English month names in the data file. The interface translates them automatically.
For open-access links, prefer sources such as Project Gutenberg, Standard Ebooks, Wikisource, Internet Archive public-domain texts, university/library repositories, or an official author/publisher page. Do not link pirated PDFs, preview-only pages, borrow-only pages, or sources with regional copyright warnings.

## Edit translations

Open `assets/js/i18n.js`. The file contains English and German interface text. Book titles, author names, tags, and book descriptions remain exactly as entered in `data.js`.

## External services used

The site remains static, but it connects to these public services from the visitor's browser:

- Open Library for book covers and book links
- Google Forms for feedback submissions
- jsDelivr for D3, TopoJSON, and Natural Earth map data
- WhatsApp for the club invitation

Optional analytics can be enabled in `assets/js/data.js` under `analytics`. It is disabled by default. For private ownership of visit data, point it at a self-hosted analytics service such as Umami:

```js
analytics: {
  enabled: true,
  provider: "umami",
  scriptUrl: "https://analytics.example.com/script.js",
  websiteId: "your-website-id",
  domain: ""
}
```

For a hosted service such as Plausible, use `provider: "plausible"`, set its script URL, and fill `domain` instead of `websiteId`.

Do not place private API keys, passwords, or secrets in these files. GitHub Pages exposes all frontend code to visitors.

## Optional member ratings and comments

Booked can work like a small member-only reading diary while keeping the public site unchanged for signed-out visitors.

1. Create a Supabase project.
2. In Supabase Auth, enable email/password signups.
3. Add your GitHub Pages URL to the Supabase Auth redirect URLs.
4. Run `docs/supabase-booked.sql` in the Supabase SQL editor.
5. Optional but recommended: add club member emails to `booked_allowed_members`. If the table is empty, any email/password account can use member features.
6. Fill `assets/js/data.js` under `members`:

```js
members: {
  enabled: true,
  supabaseUrl: "https://your-project.supabase.co",
  supabaseAnonKey: "your-public-anon-key",
  allowedEmailDomains: []
}
```

Use `allowedEmailDomains` only if every member signs in with the same email domain. Otherwise leave it empty and manage membership through `booked_allowed_members`. Ratings are averaged for the public library cards; public comments are visible only to logged-in members; private notes are visible only to the person who wrote them; members can like public comments.

## Local testing

Opening `index.html` directly works for most features. A small local web server gives a closer match to GitHub Pages:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Preserved features

- Complete reading archive from 2023 through July 2026
- Current-book panel for *De Profundis*
- English and German interfaces
- Light and dark themes
- Search, year filters, tag filters, and four sorting modes
- Open Library cover loading and links
- Per-book details dialog
- Browser-only club notes and ratings
- Reading statistics and publication timeline
- Interactive country map with zoom controls
- Country-to-library filtering
- Google Forms feedback form
- WhatsApp invitation
- Responsive desktop and phone layouts, mobile list-first library, keyboard support, reduced-motion support, and a custom 404 page
