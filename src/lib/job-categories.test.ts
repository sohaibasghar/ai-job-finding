import { describe, expect, it } from "vitest";

import { categoriesFromParam, categoryLabels, categorySearches, JOB_CATEGORIES, matchesCategories, MAX_CATEGORIES } from "./job-categories";

describe("job categories", () => {
  it("have unique ids", () => {
    expect(new Set(JOB_CATEGORIES.map((category) => category.id)).size).toBe(JOB_CATEGORIES.length);
  });

  it("reads them from an address, known ones once, up to the most", () => {
    expect(categoriesFromParam("ui-ux, Software,nope,ui-ux")).toEqual(["ui-ux", "software"]);
    expect(categoriesFromParam(JOB_CATEGORIES.map((category) => category.id).join(","))).toHaveLength(MAX_CATEGORIES);
    expect(categoriesFromParam("")).toEqual([]);
  });

  it("names them in the list's order", () => {
    expect(categoryLabels(["creative-direction", "software"])).toBe("Software Engineering, Creative Director");
  });

  it("searches each after the keywords", () => {
    expect(categorySearches(" react ", ["software", "ui-ux"])).toEqual(["react software engineer", "react UX designer"]);
    expect(categorySearches("", ["creative-direction"])).toEqual(["creative director"]);
  });

  it("matches roles by the titles they name, as whole words", () => {
    expect(matchesCategories("Senior Backend Engineer", ["software"])).toBe(true);
    expect(matchesCategories("UI/UX Designer", ["ui-ux"])).toBe(true);
    expect(matchesCategories("Art Director", ["creative-direction"])).toBe(true);
    expect(matchesCategories("QA Engineers wanted", ["qa"])).toBe(true);
    expect(matchesCategories("Office in Qatar", ["qa"])).toBe(false);
    expect(matchesCategories("Linux kernel hacker", ["ui-ux"])).toBe(false);
    expect(matchesCategories("Account Executive", ["software", "sales"])).toBe(true);
  });
});
