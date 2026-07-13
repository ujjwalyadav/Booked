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
  tags: ["Tag one", "Tag two"],
  note: "Short description."
}
```

Use English month names in the data file. The interface translates them automatically.

## Edit translations

Open `assets/js/i18n.js`. The file contains English and German interface text. Book titles, author names, tags, and book descriptions remain exactly as entered in `data.js`.

## External services used

The site remains static, but it connects to these public services from the visitor's browser:

- Open Library for book covers and book links
- Google Forms for feedback submissions
- jsDelivr for D3, TopoJSON, and Natural Earth map data
- WhatsApp for the club invitation

Do not place private API keys, passwords, or secrets in these files. GitHub Pages exposes all frontend code to visitors.

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
- Mobile notice, responsive layout, keyboard support, reduced-motion support, and a custom 404 page
