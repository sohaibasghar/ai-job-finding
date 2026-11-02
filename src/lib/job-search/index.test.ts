import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { json, stubFetch } from "@/lib/ai/test-http";
import { jsearchV2LastPage, jsearchV2Page } from "@/test/job-search-fixtures";

import { clearJobSearchCache } from "./cache";
import { postingDetails, searchPostings, testSource } from "./index";
import { EMPTY_QUERY } from "./search";
import { sourceCovers } from "./sources";

const query = { ...EMPTY_QUERY, keywords: "designer", country: "de" };
const ninja = { key: "ak_test", host: "openwebninja" as const };

beforeEach(() => {
  clearJobSearchCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("searchPostings", () => {
  it("asks the source once per half hour for the same search and page", async () => {
    const requests = stubFetch(() => json(jsearchV2Page));
    const first = await searchPostings("JSEARCH", ninja, query);
    const again = await searchPostings("JSEARCH", ninja, query);
    expect(again).toEqual(first);
    expect(requests).toHaveLength(1);

    await searchPostings("JSEARCH", ninja, query, first.next);
    await searchPostings("JSEARCH", ninja, { ...query, remoteOnly: true });
    expect(requests).toHaveLength(3);
  });

  it("doesn't keep failures", async () => {
    let status = 503;
    const requests = stubFetch(() => json(jsearchV2LastPage, { status }));
    await expect(searchPostings("JSEARCH", ninja, query)).rejects.toMatchObject({ problem: "unavailable" });
    status = 200;
    await expect(searchPostings("JSEARCH", ninja, query)).resolves.toMatchObject({ next: null });
    expect(requests).toHaveLength(2);
  });

  it("logs problems with the source without the search, but not a wrong key", async () => {
    const log = vi.mocked(console.error);
    stubFetch(() => json({}, { status: 404 }));
    await expect(searchPostings("JSEARCH", ninja, query)).rejects.toMatchObject({ problem: "changed" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("[job search] Error: JSEARCH: /jsearch/search-v2: HTTP 404");
    expect(String(log.mock.calls[0][0])).not.toContain("designer");

    stubFetch(() => json({}, { status: 401 }));
    await expect(searchPostings("JSEARCH", ninja, { ...query, keywords: "other" })).rejects.toMatchObject({ problem: "key" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("says when a source doesn't cover the country, before asking it", async () => {
    const requests = stubFetch(() => json(jsearchV2Page));
    await expect(searchPostings("ARBEITSAGENTUR", {}, { ...query, country: "fr" })).rejects.toMatchObject({
      problem: "country",
      message: "Bundesagentur für Arbeit doesn't list jobs in France. Choose another country, or another source in Settings → Job search.",
    });
    expect(requests).toHaveLength(0);
    expect(sourceCovers("ADZUNA", "de")).toBe(true);
    expect(sourceCovers("ADZUNA", "jp")).toBe(false);
    expect(sourceCovers("JSEARCH", "jp")).toBe(true);
  });
});

describe("searchPostings with categories", () => {
  const categorized = { ...query, keywords: "senior", categories: ["software" as const, "ui-ux" as const] };
  const route = ({ url }: { url: URL }) => json(url.searchParams.get("query")?.includes("software") ? jsearchV2Page : jsearchV2LastPage);

  it("searches each category after the keywords, one at a time, and takes from each in turn", async () => {
    const requests = stubFetch(route);
    const page = await searchPostings("JSEARCH", ninja, categorized);
    expect(requests.map((request) => request.url.searchParams.get("query"))).toEqual(["senior software engineer", "senior UX designer"]);
    // The same posting from both searches is kept once.
    expect(page.postings.map((posting) => posting.title)).toEqual([jsearchV2Page.data.jobs[0].job_title, jsearchV2Page.data.jobs[1].job_title]);
    expect(JSON.parse(page.next!)).toEqual([expect.stringContaining("CURSOR-PAGE-2"), null]);
  });

  it("asks only the searches with more for the next page, and stops when none has", async () => {
    const requests = stubFetch(route);
    const first = await searchPostings("JSEARCH", ninja, categorized);
    stubFetch(() => json(jsearchV2LastPage));
    const second = await searchPostings("JSEARCH", ninja, categorized, first.next);
    expect(requests).toHaveLength(2);
    expect(second.next).toBeNull();
  });

  it("gives an empty last page for a next that isn't its own", async () => {
    const requests = stubFetch(route);
    expect(await searchPostings("JSEARCH", ninja, categorized, "cursor:other")).toEqual({ postings: [], next: null });
    expect(requests).toHaveLength(0);
  });
});

describe("postingDetails", () => {
  it("returns a complete description as it is", async () => {
    const requests = stubFetch(() => json(jsearchV2Page));
    const [posting] = (await searchPostings("JSEARCH", ninja, query)).postings;
    expect(await postingDetails("JSEARCH", ninja, posting)).toBe(posting.description);
    expect(requests).toHaveLength(1);
  });

  it("asks the source for the rest of an incomplete one, and keeps it", async () => {
    stubFetch(() => json(jsearchV2Page));
    const [posting] = (await searchPostings("JSEARCH", ninja, query)).postings;
    const partial = { ...posting, complete: false };
    expect(await postingDetails("JSEARCH", ninja, partial)).toBe(posting.description);
    expect(await postingDetails("JSEARCH", ninja, { ...partial, description: "" })).toBe(posting.description);
    expect(await postingDetails("JSEARCH", ninja, { ...partial, externalId: "other", description: "" })).toBeNull();
  });
});

describe("testSource", () => {
  it("passes when the source answers", async () => {
    stubFetch(() => json(jsearchV2LastPage));
    await expect(testSource("JSEARCH", ninja)).resolves.toBeUndefined();
  });

  it("throws the problem when it doesn't", async () => {
    stubFetch(() => json({}, { status: 401 }));
    await expect(testSource("JSEARCH", ninja)).rejects.toMatchObject({ problem: "key" });
  });
});
