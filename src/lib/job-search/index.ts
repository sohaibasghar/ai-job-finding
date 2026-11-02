import "server-only";

import { z } from "zod";

import { categorySearches } from "@/lib/job-categories";
import { logServerError } from "@/lib/log";

import type { JobSourceAdapter, RequestContext, SourceCredentials } from "./adapter";
import { cached, remember } from "./cache";
import { JobSearchError, jobSearchError } from "./errors";
import { adzuna } from "./adzuna";
import { arbeitsagentur } from "./arbeitsagentur";
import { jsearch } from "./jsearch";
import { postingKey, type FoundPosting, type JobSource, type SearchPage, type SearchQuery } from "./search";
import { sourceCovers } from "./sources";

// Searching the chosen job source from the server (E14-1). Results are
// cached for half an hour; failures come back as JobSearchError with a
// message for the screen, and the ones that point at a problem with the
// source are logged, without the search.

export type { JSearchHost, RequestContext, SourceCredentials } from "./adapter";
export { JobSearchError } from "./errors";

const ADAPTERS: { [S in JobSource]: JobSourceAdapter<S> } = {
  JSEARCH: jsearch,
  ADZUNA: adzuna,
  ARBEITSAGENTUR: arbeitsagentur,
};

const adapterFor = <S extends JobSource>(source: S) => ADAPTERS[source] as JobSourceAdapter<S>;

/** Logs failures that say something about the source; a wrong key or a used-up quota is the user's to fix. */
async function logged<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof JobSearchError && (error.problem === "changed" || error.problem === "unavailable")) {
      logServerError("job search", new Error(error.detail ?? error.message));
    }
    throw error;
  }
}

/**
 * One page of postings for `query` from `source`, from the cache when it was
 * asked for in the last half hour. With categories, each is its own search,
 * one after the other, and the page takes from each in turn.
 */
export async function searchPostings<S extends JobSource>(
  source: S,
  credentials: SourceCredentials[S],
  query: SearchQuery,
  next: string | null = null,
  context: RequestContext = {},
): Promise<SearchPage> {
  if (!sourceCovers(source, query.country)) throw jobSearchError("country", source, { country: query.country });
  if (query.categories.length === 0) return searchOne(source, credentials, query, next, context);

  const searches = categorySearches(query.keywords, query.categories);
  // Each search's own `next`, null once it has no more; none before the first page.
  const from = next === null ? searches.map(() => null) : nextsOf(next, searches.length);
  if (!from) return { postings: [], next: null };
  const pages: (SearchPage | null)[] = [];
  for (const [index, keywords] of searches.entries()) {
    const done = next !== null && from[index] === null;
    pages.push(done ? null : await searchOne(source, credentials, { ...query, keywords, categories: [] }, from[index], context));
  }

  const seen = new Set<string>();
  const postings: FoundPosting[] = [];
  const longest = Math.max(...pages.map((page) => page?.postings.length ?? 0));
  for (let row = 0; row < longest; row += 1) {
    for (const page of pages) {
      const posting = page?.postings[row];
      if (!posting || seen.has(postingKey(posting))) continue;
      seen.add(postingKey(posting));
      postings.push(posting);
    }
  }
  const nexts = pages.map((page) => page?.next ?? null);
  return { postings, next: nexts.some(Boolean) ? JSON.stringify(nexts) : null };
}

/** The searches' own `next`s from a category search's, or null when it isn't one for `count` searches. */
function nextsOf(next: string, count: number): (string | null)[] | null {
  try {
    const parsed = z.array(z.string().nullable()).length(count).safeParse(JSON.parse(next));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function searchOne<S extends JobSource>(
  source: S,
  credentials: SourceCredentials[S],
  query: SearchQuery,
  next: string | null,
  context: RequestContext,
): Promise<SearchPage> {
  const adapter = adapterFor(source);
  const key = `search:${source}:${JSON.stringify(query)}:${next ?? ""}`;
  const hit = cached<SearchPage>(key);
  if (hit) return hit;
  const page = await logged(() => adapter.search(query, credentials, next, context));
  remember(key, page);
  return page;
}

/** The whole text of a posting: its own description when that's complete, else fetched; null when it can't be had. */
export async function postingDetails<S extends JobSource>(
  source: S,
  credentials: SourceCredentials[S],
  posting: FoundPosting,
  context: RequestContext = {},
): Promise<string | null> {
  if (posting.complete) return posting.description;
  const key = `details:${postingKey(posting)}`;
  const hit = cached<string>(key);
  if (hit) return hit;
  const text = await logged(() => adapterFor(source).details(posting, credentials, context));
  if (text) remember(key, text);
  return text;
}

/** "Test connection" in Settings → Job search: throws a JobSearchError when the source or the key doesn't work. */
export async function testSource<S extends JobSource>(source: S, credentials: SourceCredentials[S], context: RequestContext = {}): Promise<void> {
  await logged(() => adapterFor(source).test(credentials, context));
}
