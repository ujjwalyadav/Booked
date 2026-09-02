import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@5.2.5";

type Source = {
  name: string;
  region: string;
  kind: string;
  feed: string;
};

type DeskItem = {
  url: string;
  title: string;
  source: string;
  region: string;
  kind: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string;
};

type RankedDeskItem = DeskItem & { relevance: number };

const SOURCES: Source[] = [
  { name: "The Guardian Books", region: "United Kingdom", kind: "Reviews & news", feed: "https://www.theguardian.com/books/rss" },
  { name: "London Review of Books", region: "United Kingdom", kind: "Essays", feed: "https://www.lrb.co.uk/feeds/rss" },
  { name: "African Book Addict", region: "Africa & diaspora", kind: "Recommendations", feed: "https://africanbookaddict.com/feed/" },
  { name: "Scroll Books & Ideas", region: "South Asia", kind: "Essays & news", feed: "https://scroll.in/category/80/books-and-ideas/rss" },
  { name: "Words Without Borders", region: "International", kind: "Literature in translation", feed: "https://wordswithoutborders.org/feed/" }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true
});

const toArray = <T>(value: T | T[] | undefined | null): T[] => value ? (Array.isArray(value) ? value : [value]) : [];

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return String((value as Record<string, unknown>)["#text"] || "");
  return "";
}

function cleanText(value: unknown, limit = 360): string | null {
  const cleaned = text(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1).trim()}…` : cleaned;
}

function getLink(entry: Record<string, unknown>): string | null {
  const direct = text(entry.link);
  if (direct.startsWith("https://")) return direct;
  const atomLink = toArray(entry.link as Record<string, unknown> | Record<string, unknown>[])
    .map(link => String(link?.["@_href"] || ""))
    .find(link => link.startsWith("https://"));
  return atomLink || null;
}

function getImage(entry: Record<string, unknown>): string | null {
  const media = entry.content as Record<string, unknown> | undefined;
  const thumbnail = entry.thumbnail as Record<string, unknown> | undefined;
  const fromMedia = String(media?.["@_url"] || thumbnail?.["@_url"] || "");
  if (fromMedia.startsWith("https://")) return fromMedia;
  const description = text(entry.description || entry.encoded || entry.summary);
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1]?.startsWith("https://") ? match[1] : null;
}

async function getArticleImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Booked literary desk/1.0" }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const openGraphMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    const image = openGraphMatch?.[1]?.replace(/&amp;/g, "&") || "";
    return image.startsWith("https://") ? image : null;
  } catch {
    return null;
  }
}

function parseDate(value: unknown): string {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function relevanceScore(title: string, excerpt: string | null, source: Source): number {
  const content = `${title} ${excerpt || ""}`.toLowerCase();
  const directBookTerms = /\b(book|books|bookish|novel|novels|fiction|poetry|poem|poems|literature|literary|author|authors|writer|writers|reading|reader|translation|translated|publisher|publishing|bookshop|bookshops|library|libraries)\b/g;
  const discoveryTerms = /\b(best|anticipated|recommend|recommendation|reading list|summer reads|new releases|prize|prizes|award|awards|review|reviews|interview|excerpt)\b/g;
  const directMatches = content.match(directBookTerms)?.length || 0;
  const discoveryMatches = content.match(discoveryTerms)?.length || 0;
  const sourceBoost = source.kind.includes("Recommendations") || source.kind.includes("translation") ? 2 : 0;
  return directMatches * 2 + discoveryMatches * 3 + sourceBoost;
}

async function readSource(source: Source): Promise<RankedDeskItem[]> {
  const response = await fetch(source.feed, { headers: { "User-Agent": "Booked literary desk/1.0" } });
  if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
  const feed = parser.parse(await response.text()) as Record<string, unknown>;
  const channel = (feed.rss as Record<string, unknown> | undefined)?.channel;
  const rawEntries = channel
    ? toArray((channel as Record<string, unknown>).item as Record<string, unknown> | Record<string, unknown>[])
    : toArray(((feed.feed as Record<string, unknown> | undefined)?.entry) as Record<string, unknown> | Record<string, unknown>[]);

  return rawEntries.slice(0, 4).flatMap(entry => {
    const url = getLink(entry);
    const title = cleanText(entry.title, 180);
    if (!url || !title) return [];
    const excerpt = cleanText(entry.description || entry.encoded || entry.summary);
    const relevance = relevanceScore(title, excerpt, source);
    if (relevance < 2) return [];
    return [{
      url,
      title,
      source: source.name,
      region: source.region,
      kind: source.kind,
      excerpt,
      image_url: getImage(entry),
      published_at: parseDate(entry.pubDate || entry.published || entry.updated),
      relevance
    }];
  });
}

function selectDeskItems(items: RankedDeskItem[]): DeskItem[] {
  const sorted = items
    .sort((a, b) => b.relevance - a.relevance || Date.parse(b.published_at) - Date.parse(a.published_at));
  const selected: RankedDeskItem[] = [];
  const perSource = new Map<string, number>();

  for (const item of sorted) {
    if ((perSource.get(item.source) || 0) >= 2) continue;
    if (selected.some(selectedItem => selectedItem.url === item.url)) continue;
    selected.push(item);
    perSource.set(item.source, (perSource.get(item.source) || 0) + 1);
    if (selected.length === 9) break;
  }

  return selected.map(({ relevance: _relevance, ...item }) => item);
}

Deno.serve(async request => {
  const secret = Deno.env.get("BOOKED_DESK_CRON_SECRET");
  if (secret && request.headers.get("x-booked-cron-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return Response.json({ error: "Missing Supabase configuration" }, { status: 500 });

  const results = await Promise.allSettled(SOURCES.map(readSource));
  const articles = await Promise.all(selectDeskItems(
    results.flatMap(result => result.status === "fulfilled" ? result.value : [])
  ).map(async article => ({
    ...article,
    image_url: article.image_url || await getArticleImage(article.url)
  })));
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase.from("booked_literary_desk").delete().in("source", SOURCES.map(source => source.name));
  const { error } = await supabase.from("booked_literary_desk").upsert(articles, { onConflict: "url" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await supabase.from("booked_literary_desk").delete().lt(
    "published_at",
    new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  );

  return Response.json({ refreshed: articles.length, sources: SOURCES.length });
});
