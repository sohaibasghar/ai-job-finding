// Job categories: kinds of work to search for or filter by, picked as chips
// in Find jobs, Settings → Job agent and Startups. Each one is its own
// search on a job source (`search`), and matches a startup's roles by the
// titles it names (`titles`). Shared by the server and the screens.

export const JOB_CATEGORIES = [
  {
    id: "software",
    label: "Software Engineering",
    search: "software engineer",
    titles: ["software", "developer", "programmer", "backend", "back-end", "frontend", "front-end", "full stack", "full-stack", "fullstack", "mobile engineer", "ios", "android", "web engineer", "platform engineer"],
  },
  { id: "data", label: "Data & AI", search: "data scientist", titles: ["data scientist", "data engineer", "data analyst", "machine learning", "ml engineer", "ai engineer", "analytics"] },
  { id: "devops", label: "DevOps & Cloud", search: "devops engineer", titles: ["devops", "sre", "site reliability", "cloud engineer", "infrastructure"] },
  { id: "security", label: "Security", search: "security engineer", titles: ["security", "infosec", "penetration tester"] },
  { id: "qa", label: "QA & Testing", search: "QA engineer", titles: ["qa", "quality assurance", "test engineer", "tester", "sdet"] },
  { id: "ui-ux", label: "UI/UX Design", search: "UX designer", titles: ["ux", "ui", "ui/ux", "ux/ui", "product designer", "interaction designer", "user researcher"] },
  { id: "graphic-design", label: "Graphic Design", search: "graphic designer", titles: ["graphic designer", "visual designer", "brand designer", "illustrator", "motion designer"] },
  { id: "creative-direction", label: "Creative Director", search: "creative director", titles: ["creative director", "art director", "creative lead", "head of design", "design director"] },
  { id: "product", label: "Product Management", search: "product manager", titles: ["product manager", "product owner", "head of product", "product lead"] },
  { id: "project", label: "Project Management", search: "project manager", titles: ["project manager", "program manager", "programme manager", "scrum master", "delivery manager"] },
  { id: "marketing", label: "Marketing", search: "marketing", titles: ["marketing", "growth", "seo", "social media", "brand manager"] },
  { id: "content", label: "Writing & Content", search: "content writer", titles: ["writer", "copywriter", "content", "editor", "technical writer"] },
  { id: "sales", label: "Sales", search: "sales", titles: ["sales", "account executive", "business development", "account manager"] },
  { id: "support", label: "Customer Success", search: "customer success", titles: ["customer success", "customer support", "support engineer", "customer service"] },
  { id: "people", label: "People & HR", search: "recruiter", titles: ["recruiter", "recruiting", "talent", "hr", "human resources", "people operations"] },
  { id: "finance", label: "Finance", search: "finance", titles: ["finance", "accountant", "accounting", "controller", "financial analyst"] },
  { id: "operations", label: "Operations", search: "operations manager", titles: ["operations", "office manager", "chief of staff"] },
] as const satisfies readonly { id: string; label: string; search: string; titles: readonly string[] }[];

export type JobCategory = (typeof JOB_CATEGORIES)[number]["id"];
export const JOB_CATEGORY_IDS = JOB_CATEGORIES.map((category) => category.id) as [JobCategory, ...JobCategory[]];

/** At most this many at once: each is a request to the job source. */
export const MAX_CATEGORIES = 5;

const byId = new Map<string, (typeof JOB_CATEGORIES)[number]>(JOB_CATEGORIES.map((category) => [category.id, category]));

export const isJobCategory = (value: string): value is JobCategory => byId.has(value);

/** "Software Engineering, UI/UX Design": the categories in a line, in the list's order. */
export function categoryLabels(categories: readonly JobCategory[]): string {
  return JOB_CATEGORIES.filter((category) => categories.includes(category.id))
    .map((category) => category.label)
    .join(", ");
}

/** Categories from an address: "software,ui-ux", unknown ones left out, at most MAX_CATEGORIES. */
export function categoriesFromParam(value: string): JobCategory[] {
  return [...new Set(value.split(",").map((part) => part.trim().toLowerCase()).filter(isJobCategory))].slice(0, MAX_CATEGORIES);
}

/** What to search for each category: its search words after the user's own, if any. */
export function categorySearches(keywords: string, categories: readonly JobCategory[]): string[] {
  return categories.map((id) => [keywords.trim(), byId.get(id)!.search].filter(Boolean).join(" "));
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const patterns = new Map(JOB_CATEGORIES.map((category) => [category.id, new RegExp(`\\b(?:${category.titles.map(escape).join("|")})s?\\b`, "i")]));

/** Whether `text` (a role, or a post) names one of the categories' titles. */
export function matchesCategories(text: string, categories: readonly JobCategory[]): boolean {
  return categories.some((id) => patterns.get(id)!.test(text));
}
