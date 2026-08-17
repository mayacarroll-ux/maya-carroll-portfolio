// Case-study content for the homepage Work section (index.html#work) and
// the reusable detail template (case-study.html, served at /work/:slug via
// vercel.json's rewrite). Both read from this one file so the landing
// cards and detail pages never drift out of sync.
//
// published:false hides a record from the homepage grid and from direct
// URL access (case-study.html shows a friendly "not found" for its slug).
// draft:true shows a visible "Draft" badge — set to false once a record
// holds real, reviewed content instead of bracketed placeholders.
// featuredOrder controls homepage layout only; prev/next order on the
// detail page follows WORK_PROJECTS array order instead (see
// getAdjacentWorkProjects), so the two can be tuned independently.
//
// Every bracketed [placeholder] below is a prompt for real content, not a
// fact — nothing here is a real employer, metric, finding, or quote.

var WORK_PROJECTS = [
  {
    slug: "flagship-end-to-end-project",
    title: "[Flagship project title]",
    summary: "[One-sentence summary of the problem and the outcome, written for the homepage card.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition, e.g. 1 PM, 2 engineers]"],
    responsibilities: ["[Responsibility one]", "[Responsibility two]", "[Responsibility three]"],
    platforms: ["[Platform(s), e.g. Web, iOS]"],
    tags: ["[Domain/industry]", "[Project type]"],
    featured: true,
    featuredOrder: 1,
    published: true,
    draft: true,
    confidential: true,
    confidentialityNote:
      "[Explain what's withheld and why — e.g. company name, real screenshots, or user data are withheld under NDA; layouts shown are recreated to illustrate the approach without exposing proprietary UI.]",
    thumbnail: null,
    heroMedia: null,
    impactHighlights: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" }
    ],
    executiveSummary: {
      problem: "[The problem in one to two sentences, grounded in what research surfaced.]",
      contribution: "[What you specifically led or contributed.]",
      solution: "[The solution in one to two sentences.]",
      outcome: "[What happened after launch.]"
    },
    sections: [
      { type: "richText", heading: "Challenge", body: "[Describe the challenge in one to two paragraphs — what was broken, for whom, and why it mattered.]" },
      { type: "keyFindings", heading: "Discovery", findings: ["[Finding one]", "[Finding two]", "[Finding three]"] },
      { type: "decision", heading: "Strategy", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
      { type: "sideBySide", heading: "Exploration", left: { label: "Direction A", body: "[What you tried]" }, right: { label: "Direction B", body: "[What you tried]" } },
      { type: "richText", heading: "Final solution", body: "[Describe what shipped and why it addressed the problem.]" },
      { type: "confidentialSummary", heading: "A note on confidentiality", note: "[Same or expanded version of the confidentiality note above.]" },
      { type: "quote", quote: "[A short stakeholder or user quote, once you have one to share.]", attribution: "[Name/role, or an anonymized descriptor.]" }
    ],
    reflection: {
      learned: "[What surprised you or what you'd flag for others doing similar work.]",
      changeNextTime: "[One concrete thing you'd do differently.]",
      nextSteps: "[Where this work is headed, if relevant.]"
    }
  },
  {
    slug: "complex-workflow-systems-project",
    title: "[Complex workflow / systems project title]",
    summary: "[One-sentence summary describing the system's complexity and what your design work resolved.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition]"],
    responsibilities: ["[Responsibility one]", "[Responsibility two]"],
    platforms: ["[Platform(s)]"],
    tags: ["[Domain/industry]", "Systems design"],
    featured: true,
    featuredOrder: 2,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,
    impactHighlights: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" }
    ],
    executiveSummary: {
      problem: "[The systemic problem in one to two sentences — e.g. a workflow spanning multiple roles or tools.]",
      contribution: "[What you specifically led or contributed.]",
      solution: "[The solution in one to two sentences.]",
      outcome: "[What happened after launch.]"
    },
    sections: [
      { type: "richText", heading: "Challenge", body: "[Describe the workflow's complexity — how many roles, systems, or edge cases were involved.]" },
      { type: "keyFindings", heading: "Discovery", findings: ["[Finding one]", "[Finding two]"] },
      { type: "decision", heading: "Strategy", context: "[The fork in the road.]", decision: "[What you chose.]", rationale: "[Why.]" },
      { type: "gallery", heading: "Exploration", items: [{ alt: "[Description of an exploration artifact]" }, { alt: "[Description of another exploration artifact]" }] },
      { type: "beforeAfter", heading: "Final solution", before: { alt: "[Before state description]", caption: "Before" }, after: { alt: "[After state description]", caption: "After" } }
    ],
    reflection: {
      learned: "[What surprised you.]",
      changeNextTime: "[One concrete change.]",
      nextSteps: "[Where this is headed.]"
    }
  },
  {
    slug: "research-strategy-led-project",
    title: "[Research / strategy-led project title]",
    summary: "[One-sentence summary emphasizing the research question and the strategic outcome.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition]"],
    responsibilities: ["[Responsibility one]", "[Responsibility two]"],
    platforms: ["[Platform(s), if applicable]"],
    tags: ["[Domain/industry]", "Research & strategy"],
    featured: true,
    featuredOrder: 3,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,
    impactHighlights: [
      { label: "[Metric or strategic outcome]", value: "[Value]", context: "[Measurement window/context]" }
    ],
    executiveSummary: {
      problem: "[The open question or strategic ambiguity you were brought in to resolve.]",
      contribution: "[What you specifically led — e.g. research design, synthesis, strategy formation.]",
      solution: "[The resulting recommendation or direction.]",
      outcome: "[What the organization did with it.]"
    },
    sections: [
      { type: "richText", heading: "Challenge", body: "[Describe the ambiguity or open question that prompted this work.]" },
      { type: "keyFindings", heading: "Discovery", findings: ["[Finding one]", "[Finding two]", "[Finding three]"] },
      { type: "decision", heading: "Strategy", context: "[The fork in the road.]", decision: "[What you recommended.]", rationale: "[Why.]" },
      { type: "richText", heading: "Exploration", body: "[Describe how the strategy was pressure-tested — prototypes, pilots, stakeholder review.]" },
      { type: "richText", heading: "Final solution", body: "[Describe the direction that was ultimately adopted.]" }
    ],
    reflection: {
      learned: "[What surprised you.]",
      changeNextTime: "[One concrete change.]",
      nextSteps: "[Where this is headed.]"
    }
  },
  {
    slug: "complementary-range-project",
    title: "[Complementary project title]",
    summary: "[One-sentence summary showing a different facet of your range than the three featured projects above.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition]"],
    responsibilities: ["[Responsibility one]"],
    platforms: ["[Platform(s)]"],
    tags: ["[Domain/industry]"],
    featured: false,
    featuredOrder: null,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,
    impactHighlights: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" }
    ],
    executiveSummary: {
      problem: "[The problem in one to two sentences.]",
      contribution: "[What you specifically led or contributed.]",
      solution: "[The solution in one to two sentences.]",
      outcome: "[What happened after launch.]"
    },
    sections: [
      { type: "richText", heading: "Challenge", body: "[Describe the problem.]" },
      { type: "richText", heading: "Discovery", body: "[What you learned before designing.]" },
      { type: "richText", heading: "Strategy & exploration", body: "[The direction you chose and what you tried.]" },
      { type: "richText", heading: "Final solution", body: "[What shipped.]" }
    ],
    reflection: {
      learned: "[What surprised you.]",
      changeNextTime: "[One concrete change.]",
      nextSteps: "[Where this is headed.]"
    }
  }
];

function getPublishedWorkProjects() {
  return WORK_PROJECTS.filter(function (p) {
    return p.published;
  }).sort(function (a, b) {
    var ao = a.featuredOrder == null ? 999 : a.featuredOrder;
    var bo = b.featuredOrder == null ? 999 : b.featuredOrder;
    return ao - bo;
  });
}

function getWorkProjectBySlug(slug) {
  var match = null;
  WORK_PROJECTS.forEach(function (p) {
    if (p.slug === slug && p.published) match = p;
  });
  return match;
}

// Prev/next among published records in WORK_PROJECTS array order (the
// canonical "reading order"), deliberately independent of featuredOrder so
// homepage layout and detail-page navigation can be tuned separately.
function getAdjacentWorkProjects(slug) {
  var published = WORK_PROJECTS.filter(function (p) {
    return p.published;
  });
  var idx = -1;
  published.forEach(function (p, i) {
    if (p.slug === slug) idx = i;
  });
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? published[idx - 1] : null,
    next: idx < published.length - 1 ? published[idx + 1] : null,
  };
}

var MayaWork = {
  WORK_PROJECTS: WORK_PROJECTS,
  getPublishedWorkProjects: getPublishedWorkProjects,
  getWorkProjectBySlug: getWorkProjectBySlug,
  getAdjacentWorkProjects: getAdjacentWorkProjects,
};

if (typeof window !== "undefined") window.MayaWork = MayaWork;
if (typeof module !== "undefined" && module.exports) module.exports = MayaWork;
