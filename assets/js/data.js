/* Booked content and external-service configuration.
   Edit this file when you add books or change club links. */
window.BOOKED_DATA = Object.freeze({
  books: [
    {
      year: 2023,
      month: "November",
      title: "Die Wand",
      author: "Marlen Haushofer",
      country: "Austria",
      published: 1963,
      pages: 264,
      pageSourceName: "Open Library, Mohn Verlag 1963 German edition",
      pageSourceUrl: "https://openlibrary.org/books/OL26978848M/Die_Wand",
      tags: ["Literary fiction", "Psychological", "German", "Survival"],
      note: "A woman finds herself sealed off by an invisible wall in the Austrian mountains, forced to survive and confront radical solitude."
    },
    {
      year: 2023,
      month: "December",
      title: "Giovanni's Room",
      author: "James Baldwin",
      country: "United States",
      published: 1956,
      pages: 248,
      pageSourceName: "Open Library, Dial Press 1956 edition",
      pageSourceUrl: "https://openlibrary.org/works/OL228702W/Giovanni%27s_Room?edition=ia%3Agiovannisroom0000bald_g2u6",
      tags: ["Classic", "Queer", "Tragic", "Paris"],
      note: "A tense, intimate portrait of love, shame, and self-denial in 1950s Paris."
    },
    {
      year: 2024,
      month: "January",
      title: "After Dark",
      author: "Haruki Murakami",
      country: "Japan",
      published: 2004,
      pages: 294,
      pageSourceName: "Kodansha, 2004 Japanese edition",
      pageSourceUrl: "https://www.kodansha.co.jp/book/products/0000182341",
      tags: ["Japanese", "Surreal", "Nocturnal", "Short"],
      note: "A one-night drift through Tokyo where reality blurs and the city becomes a dreamlike stage."
    },
    {
      year: 2024,
      month: "February",
      title: "Orlando",
      author: "Virginia Woolf",
      country: "United Kingdom",
      published: 1928,
      pages: 299,
      pageSourceName: "Open Library, Hogarth Press 1928 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL2811937M/Orlando",
      tags: ["Classic", "Queer", "Modernist", "Fantasy"],
      note: "A playful, time-traveling life story of a character who changes gender and crosses centuries.",
      openAccess: {
        url: "https://standardebooks.org/ebooks/virginia-woolf/orlando",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2024,
      month: "March",
      title: "The Lathe of Heaven",
      author: "Ursula K. Le Guin",
      country: "United States",
      published: 1971,
      pages: 184,
      pageSourceName: "Open Library, Scribner 1971 edition",
      pageSourceUrl: "https://openlibrary.org/works/OL59858W/The_Lathe_of_Heaven?edition=key%3A%2Fbooks%2FOL4583658M",
      tags: ["Sci-fi", "Philosophical", "Dystopia"],
      note: "A man’s dreams alter reality itself, raising questions about power, ethics, and utopian schemes."
    },
    {
      year: 2024,
      month: "April",
      title: "Death with Interruptions",
      author: "José Saramago",
      country: "Portugal",
      published: 2005,
      pages: 214,
      pageSourceName: "Open Library, Caminho 2005 Portuguese edition",
      pageSourceUrl: "https://openlibrary.org/books/OL22749431M/As_intermit%C3%AAncias_da_morte",
      tags: ["Speculative", "Satire", "Portuguese"],
      note: "In one country, people stop dying—and the consequences are funny, bureaucratic, and deeply human."
    },
    {
      year: 2024,
      month: "May",
      title: "An Apprenticeship or The Book of Pleasures",
      author: "Clarice Lispector",
      country: "Brazil",
      published: 1969,
      pages: 177,
      pageSourceName: "Open Library, Sabiá 1969 Portuguese edition",
      pageSourceUrl: "https://openlibrary.org/works/OL44898987W/Uma_aprendizagem_ou",
      tags: ["Brazilian", "Philosophical", "Romance"],
      note: "A lyrical inner journey of a woman learning how to love, think, and feel with new clarity."
    },
    {
      year: 2024,
      month: "June",
      title: "Lolita",
      author: "Vladimir Nabokov",
      country: "Russia",
      published: 1955,
      pages: 416,
      pageSourceName: "Paris Olympia Press bibliography, 1955 two-volume edition",
      pageSourceUrl: "https://parisolympiapress.com/tag/lolita/",
      tags: ["Classic", "Controversial", "Psychological"],
      note: "A disturbing narrative of obsession and abuse told in dazzling, unreliable prose."
    },
    {
      year: 2024,
      month: "July",
      title: "Del amor y otros demonios",
      author: "Gabriel García Márquez",
      country: "Colombia",
      published: 1994,
      pages: 198,
      pageSourceName: "Google Books, Norma 1994 Spanish edition",
      pageSourceUrl: "https://books.google.com/books/about/Del_amor_y_otros_demonios.html?hl=es&id=LfQQAQAAMAAJ",
      tags: ["Latin American", "Magical realism", "Romance"],
      note: "A condemned girl and a priest meet in a world of superstition, illness, and forbidden desire."
    },
    {
      year: 2024,
      month: "August",
      title: "Notes from Underground",
      author: "Fyodor Dostoevsky",
      country: "Russia",
      published: 1864,
      pages: 146,
      pageSourceName: "National Electronic Library, 1866 Russian book edition",
      pageSourceUrl: "https://rusneb.ru/catalog/000199_000009_003568290/",
      tags: ["Classic", "Russian", "Existential"],
      note: "A bitter, self-sabotaging narrator dismantles himself in a confession full of spite and clarity.",
      openAccess: {
        url: "https://www.gutenberg.org/ebooks/600",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2024,
      month: "September",
      title: "Lapvona",
      author: "Ottessa Moshfegh",
      country: "United States",
      published: 2022,
      pages: 304,
      pageSourceName: "Open Library, Penguin Press 2022 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL36011848M/Lapvona",
      tags: ["Contemporary", "Dark", "Satire", "Medieval"],
      note: "A grotesque, darkly comic tale of faith, power, and cruelty in a strange medieval village."
    },
    {
      year: 2024,
      month: "October",
      title: "The Picture of Dorian Gray",
      author: "Oscar Wilde",
      country: "Ireland",
      published: 1890,
      pages: 334,
      pageSourceName: "Open Library, Ward Lock 1891 book edition",
      pageSourceUrl: "https://openlibrary.org/books/OL14034381M/The_Picture_of_Dorian_Gray",
      tags: ["Classic", "Gothic", "Aestheticism"],
      note: "A young man never ages while his hidden portrait bears the marks of his corruption.",
      openAccess: {
        url: "https://www.gutenberg.org/ebooks/174",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2024,
      month: "November",
      title: "Dracula",
      author: "Bram Stoker",
      country: "Ireland",
      published: 1897,
      pages: 390,
      pageSourceName: "BramStoker.org, 1897 Archibald Constable edition",
      pageSourceUrl: "https://bramstoker.org/novels/05dracula.html",
      tags: ["Classic", "Gothic", "Horror"],
      note: "The original vampire novel: diaries, letters, and sea logs trace an ancient evil crossing into England.",
      openAccess: {
        url: "https://www.gutenberg.org/ebooks/345",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2024,
      month: "December",
      title: "White Nights",
      author: "Fyodor Dostoevsky",
      country: "Russia",
      published: 1848,
      pages: 72,
      pageSourceName: "Russian State Library, 1865 Russian book edition",
      pageSourceUrl: "https://search.rsl.ru/ru/record/01003567550",
      tags: ["Russian", "Romantic", "Short"],
      note: "A dreamy, lonely narrator wanders St. Petersburg and falls into a brief, intense connection.",
      openAccess: {
        url: "https://www.gutenberg.org/ebooks/36034",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2025,
      month: "January",
      title: "Moby-Dick",
      author: "Herman Melville",
      country: "United States",
      published: 1851,
      pages: 634,
      pageSourceName: "Open Library, Harper & Brothers 1851 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL6984724M/Moby-Dick_or_the_Whale?v=7",
      tags: ["Classic", "American", "Adventure", "Sea"],
      note: "A sprawling, obsessive hunt for a white whale that becomes an encyclopedia of the sea and the soul.",
      openAccess: {
        url: "https://www.gutenberg.org/ebooks/2701",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2025,
      month: "February",
      title: "One Hundred Years of Solitude",
      author: "Gabriel García Márquez",
      country: "Colombia",
      published: 1967,
      pages: 351,
      pageSourceName: "Open Library, Editorial Sudamericana 1967 Spanish edition",
      pageSourceUrl: "https://openlibrary.org/books/OL22797610M/Cien_anos_de_soledad",
      tags: ["Classic", "Magical realism", "Latin American"],
      note: "The rise and fall of the Buendía family in the mythical town of Macondo, where magic and history coexist."
    },
    {
      year: 2025,
      month: "March",
      title: "Fahrenheit 451",
      author: "Ray Bradbury",
      country: "United States",
      published: 1953,
      pages: 199,
      pageSourceName: "Open Library, Ballantine Books 1953 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL6137190M",
      tags: ["Classic", "Dystopia", "Sci-fi"],
      note: "In a future where books are burned, a fireman begins to question what he’s destroying."
    },
    {
      year: 2025,
      month: "May",
      title: "Invisible Cities",
      author: "Italo Calvino",
      country: "Italy",
      published: 1972,
      pages: 170,
      pageSourceName: "Google Books, Einaudi 1972 Italian edition",
      pageSourceUrl: "https://books.google.com/books/about/Le_Citta_invisibili.html?id=W1Ru0AEACAAJ",
      tags: ["Italian", "Experimental", "Short"],
      note: "Marco Polo describes impossible, poetic cities to Kublai Khan—maybe real, maybe imagined."
    },
    {
      year: 2025,
      month: "June",
      title: "A Room of One's Own",
      author: "Virginia Woolf",
      country: "United Kingdom",
      published: 1929,
      pages: 172,
      pageSourceName: "Morgan Library, Hogarth Press 1929 first edition",
      pageSourceUrl: "https://www.themorgan.org/printed-books/417538",
      tags: ["Essay", "Feminist", "Nonfiction"],
      note: "A foundational essay on women, money, space, and the conditions needed to write.",
      openAccess: {
        url: "https://en.wikisource.org/wiki/A_Room_of_One%27s_Own_(Hogarth_1929)",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2025,
      month: "July",
      title: "Animal Farm",
      author: "George Orwell",
      country: "United Kingdom",
      published: 1945,
      pages: 92,
      pageSourceName: "WorldCat, Secker & Warburg 1945 edition",
      pageSourceUrl: "https://search.worldcat.org/title/animal-farm/oclc/670282456",
      tags: ["Satire", "Dystopia", "Political", "Short"],
      note: "A farmyard revolution goes wrong, turning into a compact allegory of power and betrayal."
    },
    {
      year: 2025,
      month: "August",
      title: "Strange Case of Dr Jekyll and Mr Hyde",
      author: "Robert Louis Stevenson",
      country: "United Kingdom",
      published: 1886,
      pages: 141,
      pageSourceName: "Open Library, Longmans Green 1886 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL7243520M/Strange_case_of_Dr._Jekyll_and_Mr._Hyde.",
      tags: ["Classic", "Gothic", "Horror", "Short"],
      note: "A respectable doctor hides a violent alter ego, embodying a split between public virtue and private vice.",
      openAccess: {
        url: "https://www.gutenberg.org/ebooks/43",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2025,
      month: "September",
      title: "Narcissus and Goldmund",
      author: "Hermann Hesse",
      country: "Germany",
      published: 1930,
      pages: 417,
      pageSourceName: "Open Library, S. Fischer 1930 German edition",
      pageSourceUrl: "https://openlibrary.org/books/OL6745961M/Narziss_und_Goldmund",
      tags: ["German", "Philosophical", "Bildungsroman"],
      note: "Two friends follow opposite paths—contemplative monk and wandering artist—in search of meaning."
    },
    {
      year: 2025,
      month: "October",
      title: "Who's Afraid of Virginia Woolf?",
      author: "Edward Albee",
      country: "United States",
      published: 1962,
      pages: 242,
      pageSourceName: "Open Library, Atheneum 1962 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL5856064M/Who%27s_afraid_of_Virginia_Woolf",
      tags: ["Play", "American", "Psychological"],
      note: "A long, alcohol-fueled night where a couple weaponizes truth and illusion against each other and their guests."
    },
    {
      year: 2025,
      month: "November",
      title: "Never Let Me Go",
      author: "Kazuo Ishiguro",
      country: "United Kingdom",
      published: 2005,
      pages: 263,
      pageSourceName: "Bibliographies Online, Faber & Faber 2005 UK edition",
      pageSourceUrl: "https://bibliographies.online/never-let-me-go/",
      tags: ["Dystopia", "Sci-fi", "Contemporary"],
      note: "Former students slowly uncover the dark purpose behind their idyllic boarding school upbringing."
    },
    {
      year: 2026,
      month: "January",
      title: "The Handmaid's Tale",
      author: "Margaret Atwood",
      country: "Canada",
      published: 1985,
      pages: 324,
      pageSourceName: "Google Books, McClelland & Stewart 1985 Canadian edition",
      pageSourceUrl: "https://books.google.com/books/about/The_Handmaid_s_Tale.html?id=k6v00AEACAAJ",
      tags: ["Dystopia", "Feminist", "Classic"],
      note: "In a theocratic regime, a handmaid narrates her tightly controlled life and quiet acts of resistance."
    },
    {
      year: 2026,
      month: "February",
      title: "Any Ursula K. Le Guin work",
      author: "Ursula K. Le Guin",
      country: "United States",
      published: null,
      pages: null,
      pageStatus: "varies",
      tags: ["Sci-fi", "Fantasy", "Speculative", "Author focus"],
      note: "Author month: any novel by Ursula K. Le Guin is allowed. Each reader may choose their own book."
    },
    {
      year: 2026,
      month: "March",
      title: "The Myth of Sisyphus",
      author: "Albert Camus",
      country: "France",
      published: 1942,
      pages: 168,
      pageSourceName: "Open Library, Gallimard 1942 French edition",
      pageSourceUrl: "https://openlibrary.org/books/OL6063922M/Le_mythe_de_Sisyphe.",
      tags: ["Essay", "Philosophical", "Nonfiction"],
      note: "A philosophical essay about absurdity, meaning, and the defiant act of continuing to live with consciousness."
    },
    {
      year: 2026,
      month: "April",
      title: "Interview with the Vampire",
      author: "Anne Rice",
      country: "United States",
      published: 1976,
      pages: 372,
      pageSourceName: "The First Edition Rare Books, Knopf 1976 first edition",
      pageSourceUrl: "https://thefirstedition.com/product/interview-with-the-vampire/",
      tags: ["Gothic", "Horror", "Philosophical", "Fantasy"],
      note: "A confessional vampire story about immortality, desire, loneliness, guilt, and the cost of refusing ordinary human life."
    },
    {
      year: 2026,
      month: "May",
      title: "Letters to a Young Poet",
      author: "Rainer Maria Rilke",
      country: "Austria",
      published: 1929,
      pages: 54,
      pageSourceName: "Open Library, Insel-Verlag 1929 German edition",
      pageSourceUrl: "https://openlibrary.org/books/OL13567278M/Briefe_an_einen_jungen_dichter.",
      tags: ["Letters", "Nonfiction", "Philosophical", "Poetry"],
      note: "A series of intimate letters reflecting on solitude, love, creativity, and the inner life of the artist, urging patience and deep self-trust in the making of art."
    },
    {
      year: 2026,
      month: "June",
      title: "Mrs Dalloway",
      author: "Virginia Woolf",
      country: "United Kingdom",
      published: 1925,
      current: false,
      pages: 293,
      pageSourceName: "Kent School catalog, Hogarth Press 1925 first edition",
      pageSourceUrl: "https://catalog.kent-school.edu/bib/8390",
      tags: ["Modernist", "Stream of Consciousness", "Psychological"],
      note: "A modernist novel following Clarissa Dalloway over the course of a single day in London, exploring memory, social life, trauma, time, and the hidden depths of inner consciousness.",
      openAccess: {
        url: "https://standardebooks.org/ebooks/virginia-woolf/mrs-dalloway",
        verifiedOn: "2026-08-25"
      }
    },
    {
      year: 2026,
      month: "July",
      title: "De Profundis",
      author: "Oscar Wilde",
      country: "United Kingdom",
      published: 1905,
      current: false,
      pages: 123,
      pageSourceName: "Open Library, G. P. Putnam's Sons 1905 edition",
      pageSourceUrl: "https://openlibrary.org/books/OL7127808M",
      tags: ["Epistolary", "Autobiographical", "Philosophical"],
      note: "A deeply personal letter written during Wilde’s imprisonment, reflecting on suffering, love, betrayal, spiritual growth, and his relationship with Lord Alfred Douglas.",
      openAccess: {
        url: "https://en.wikisource.org/wiki/De_Profundis_(Wilde,_1915)",
        verifiedOn: "2026-08-25"
      }
    },
     {
  year: 2026,
  month: "August",
  title: "East of Eden",
  author: "John Steinbeck",
  country: "United States",
  published: 1952,
  current: true,
  meetingDate: "2026-08-30",
  pages: 602,
  pageSourceName: "Open Library, Viking Press 1952 edition",
  pageSourceUrl: "https://openlibrary.org/works/OL23166W/East_of_Eden?edition=ia%3Aeastofeden0000john",
  tags: ["Family Saga", "Historical Fiction", "Biblical Retelling"],
  note: "A sweeping multigenerational novel set in California’s Salinas Valley, exploring family conflict, love, guilt, free will, and the struggle between good and evil through a modern retelling of Cain and Abel."
}
  ],

  links: {
    whatsapp: "https://chat.whatsapp.com/EStsFPtmF2PJy6HX54eLat",
    instagram: "https://www.instagram.com/bookclub.hd/"
  },

  googleForm: {
    action: "https://docs.google.com/forms/u/0/d/e/1FAIpQLSdKp4Xl2Al2hFHI3EDnfhkC7705L2PJaasKCyXKrRlYOX-1cw/formResponse",
    fields: {
      message: "entry.2103806539",
      name: "entry.2116861404"
    }
  },

  members: {
    enabled: true,
    supabaseUrl: "https://vlsotmfdcbilcrwvlzqy.supabase.co",
    supabaseAnonKey: "sb_publishable_tXQScIoYgGIJsM10AQA2_A_Rcxh3bK2",
    allowedEmailDomains: []
  },

  analytics: {
    enabled: true,
    provider: "umami",
    scriptUrl: "https://cloud.umami.is/script.js",
    websiteId: "a593ec6c-3468-4d35-a447-9b1bfc73abd8",
    domain: ""
  }
});
