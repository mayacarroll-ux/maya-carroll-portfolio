// Case-study content for the homepage Work section (work.html) and the
// reusable detail template (case-study.html, served at /work/:slug via
// vercel.json's rewrite). Both read from this one file so the landing
// cards and detail pages never drift out of sync.
//
// ARCHITECTURE NOTE: the detail template renders a FIXED narrative spine —
// Hero, Project Summary, Business Context, Why This Was Difficult, My Role,
// Success Metrics, Major Constraints, Key Decisions, Design Evolution,
// Final Solution, Business Impact, Lessons Learned, Next Opportunities —
// in that order, for every project. A project doesn't choose its structure;
// it just fills in (or omits) the fields below, and the template hides
// whatever a given project doesn't supply. This keeps every case study
// recognizable as "the same portfolio" while the content stays tailored
// per industry. See case-study.html's renderProject() for the pipeline.
//
// published:false hides a record from the homepage grid and from direct
// URL access (case-study.html shows a friendly "not found" for its slug).
// draft:true shows a visible "Draft" badge — set to false once a record
// holds real, reviewed content instead of bracketed placeholders.
//
// Every bracketed [placeholder] below is a prompt for real content, not a
// fact — nothing here is a real employer, metric, finding, or quote.
// Section HEADINGS translate with the site's language switcher; the
// placeholder body copy inside each field stays English until it's
// replaced with real, authored content (matching how the rest of the
// site treats draft content vs. UI chrome).
//
// industrySections entries are rendered by a single consolidated
// "diagram placeholder" component (omit `type`), or as a `timeline` /
// `callout` instance for variety — see each entry below. They're
// intentionally unpopulated: a labeled empty slot, not an invented
// diagram. Add or remove entries freely; nothing else needs to change.

var WORK_PROJECTS = [
  // ==========================================================
  // 1 — Enterprise / Frontier AI
  // ==========================================================
  {
    slug: "enterprise-ai-case-study",
    industry: "enterprise-ai",
    title: "[Enterprise AI Product Title]",
    cardChallenge: "[One line: the core problem this AI product had to solve]",
    cardOutcome: "[One line: the headline result once it shipped]",
    projectType: "[Project type — e.g. 0→1 AI product, agent platform]",
    summary: "[One-sentence summary of the problem and the outcome, written for the homepage card.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition, e.g. 1 PM, 2 engineers, 1 ML researcher]"],
    responsibilities: ["[Responsibility one]", "[Responsibility two]", "[Responsibility three]"],
    platforms: ["[Platform(s), e.g. Web, API]"],
    tags: ["Enterprise AI", "Agents", "Conversational UX"],
    featured: true,
    featuredOrder: 1,
    published: true,
    draft: true,
    confidential: true,
    confidentialityNote:
      "[Explain what's withheld and why — e.g. company name, real screenshots, or user data are withheld under NDA; layouts shown are recreated to illustrate the approach without exposing proprietary UI.]",
    thumbnail: null,
    heroMedia: null,

    projectSummary: "[Project Summary — two to three sentences on what this product was, who it was for, and why it mattered.]",
    businessContext: "[Business Context — what was true about the business before this project started, and why AI was the right lever.]",
    whyDifficult: "[Why This Was Difficult — the ambiguity, technical limits, or organizational forces that made this hard: e.g. non-deterministic model behavior, trust with expert users, undefined success criteria.]",
    myRoleSummary: "[My Role — what you specifically owned end to end, and where you partnered with engineering/ML/legal.]",

    successMetrics: [
      { label: "[Metric name]", value: "[Target]", context: "[How success was defined going in]" },
      { label: "[Metric name]", value: "[Target]", context: "[How success was defined going in]" },
    ],
    constraints: [
      { title: "[Constraint — e.g. model reliability]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. compliance review]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. legacy system integration]", body: "[How this shaped the design.]" },
    ],
    keyDecisions: [
      { title: "[Decision title]", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
      { title: "[Decision title]", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
    ],
    researchHighlights: ["[Finding one]", "[Finding two]", "[Finding three]"],
    stakeholders: [
      { role: "[Stakeholder role, e.g. Trust & Safety lead]", note: "[Why they mattered to this project]" },
      { role: "[Stakeholder role, e.g. ML research lead]", note: "[Why they mattered to this project]" },
    ],
    quote: {
      quote: "[A short stakeholder or user quote, once you have one to share.]",
      attribution: "[Name/role, or an anonymized descriptor.]",
    },

    designEvolution: {
      type: "sideBySide",
      left: { label: "[Direction A]", body: "[What you tried]" },
      right: { label: "[Direction B]", body: "[What you tried]" },
    },
    finalSolution: { body: "[Describe what shipped and why it addressed the problem.]" },
    businessImpact: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
    ],
    lessonsLearned: "[What surprised you or what you'd flag for others doing similar work.]",
    wouldChangeNextTime: "[One concrete thing you'd do differently.]",
    nextOpportunities: "[Where this work is headed, if relevant.]",

    industrySections: [
      { label: "AI Architecture" },
      { label: "Agent Workflow" },
      { label: "Guardrails & Human-in-the-Loop" },
      { label: "Experiment Results" },
    ],
  },

  // ==========================================================
  // 2 — Cybersecurity
  // ==========================================================
  {
    slug: "cybersecurity-case-study",
    industry: "cybersecurity",
    title: "[Cybersecurity Product Title]",
    cardChallenge: "[One line: the core problem security analysts faced]",
    cardOutcome: "[One line: the headline result once it shipped]",
    projectType: "[Project type — e.g. SOC dashboard redesign, identity platform]",
    summary: "[One-sentence summary describing the system's complexity and what your design work resolved.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition]"],
    responsibilities: ["[Responsibility one]", "[Responsibility two]"],
    platforms: ["[Platform(s)]"],
    tags: ["Cybersecurity", "Systems design", "Expert users"],
    featured: true,
    featuredOrder: 2,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,

    projectSummary: "[Project Summary — two to three sentences on the system, its users, and the stakes of getting it wrong.]",
    businessContext: "[Business Context — the security posture, incident history, or compliance pressure that motivated this work.]",
    whyDifficult: "[Why This Was Difficult — e.g. high information density, expert users with zero tolerance for friction, real-time data, severe consequences for missed signals.]",
    myRoleSummary: "[My Role — what you specifically owned, and how you worked with security engineers and analysts.]",

    successMetrics: [
      { label: "[Metric name]", value: "[Target]", context: "[How success was defined going in]" },
    ],
    constraints: [
      { title: "[Constraint — e.g. sub-second latency requirement]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. least-privilege access model]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. audit logging requirements]", body: "[How this shaped the design.]" },
    ],
    keyDecisions: [
      { title: "[Decision title]", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
      { title: "[Decision title]", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
    ],
    researchHighlights: ["[Finding one]", "[Finding two]"],

    designEvolution: {
      type: "gallery",
      items: [
        { alt: "[Description of an exploration artifact]" },
        { alt: "[Description of another exploration artifact]" },
      ],
    },
    finalSolution: { body: "[Describe what shipped and why it addressed the problem.]" },
    businessImpact: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
    ],
    lessonsLearned: "[What surprised you.]",
    wouldChangeNextTime: "[One concrete change.]",
    nextOpportunities: "[Where this is headed.]",

    industrySections: [
      { label: "Threat Flow" },
      { label: "Permissions Matrix" },
      {
        label: "Incident Timeline",
        type: "timeline",
        steps: [
          { stage: "[Detection]", note: "[Placeholder step]" },
          { stage: "[Triage]", note: "[Placeholder step]" },
          { stage: "[Containment]", note: "[Placeholder step]" },
          { stage: "[Resolution]", note: "[Placeholder step]" },
        ],
      },
      { label: "Risk Visualization" },
    ],
  },

  // ==========================================================
  // 3 — FinTech / RegTech / Compliance
  // ==========================================================
  {
    slug: "fintech-compliance-case-study",
    industry: "fintech",
    title: "[FinTech / Compliance Product Title]",
    cardChallenge: "[One line: the core regulatory or trust problem]",
    cardOutcome: "[One line: the headline result once it shipped]",
    projectType: "[Project type — e.g. compliance workflow platform, audit tooling]",
    summary: "[One-sentence summary emphasizing the regulatory constraint and the outcome.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition]"],
    responsibilities: ["[Responsibility one]", "[Responsibility two]"],
    platforms: ["[Platform(s)]"],
    tags: ["FinTech", "RegTech", "Governance"],
    featured: true,
    featuredOrder: 3,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,

    projectSummary: "[Project Summary — two to three sentences on the workflow, who relied on it, and what was at stake.]",
    businessContext: "[Business Context — the regulatory regime, audit history, or governance gap that motivated this work.]",
    whyDifficult: "[Why This Was Difficult — e.g. conflicting stakeholder incentives, auditability requirements, legacy financial systems, zero tolerance for error.]",
    myRoleSummary: "[My Role — what you specifically owned, and how you worked with compliance/legal/engineering.]",

    successMetrics: [
      { label: "[Metric name]", value: "[Target]", context: "[How success was defined going in]" },
      { label: "[Metric name]", value: "[Target]", context: "[How success was defined going in]" },
    ],
    constraints: [
      { title: "[Constraint — e.g. regulatory sign-off cycle]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. immutable audit trail]", body: "[How this shaped the design.]" },
    ],
    keyDecisions: [
      { title: "[Decision title]", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
    ],
    stakeholders: [
      { role: "[Stakeholder role, e.g. Compliance officer]", note: "[Why they mattered to this project]" },
      { role: "[Stakeholder role, e.g. Risk & audit lead]", note: "[Why they mattered to this project]" },
    ],

    designEvolution: {
      type: "beforeAfter",
      before: { alt: "[Before state description]", caption: "Before" },
      after: { alt: "[After state description]", caption: "After" },
    },
    finalSolution: { body: "[Describe what shipped and why it addressed the problem.]" },
    businessImpact: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
    ],
    lessonsLearned: "[What surprised you.]",
    wouldChangeNextTime: "[One concrete change.]",
    nextOpportunities: "[Where this is headed.]",

    industrySections: [
      {
        label: "Compliance Timeline",
        type: "timeline",
        steps: [
          { stage: "[Requirement identified]", note: "[Placeholder step]" },
          { stage: "[Control designed]", note: "[Placeholder step]" },
          { stage: "[Internal review]", note: "[Placeholder step]" },
          { stage: "[Audit sign-off]", note: "[Placeholder step]" },
        ],
      },
      { label: "Audit Trail" },
      { label: "Decision Matrix" },
      { label: "Risk Scoring" },
    ],
  },

  // ==========================================================
  // 4 — Government · Civic Tech · Healthcare · Insurance
  // ==========================================================
  {
    slug: "government-civic-case-study",
    industry: "government",
    title: "[Government / Civic Product Title]",
    cardChallenge: "[One line: the core public-service problem]",
    cardOutcome: "[One line: the headline result once it shipped]",
    projectType: "[Project type — e.g. legacy system modernization, citizen-facing service]",
    summary: "[One-sentence summary showing the public-service stakes and the outcome.]",
    organization: "[Organization name, or \"Confidential\" if it can't be named]",
    year: "[Year]",
    timeline: "[Start month/year – end month/year]",
    role: "[Your role/title on this project]",
    team: ["[Team composition]"],
    responsibilities: ["[Responsibility one]"],
    platforms: ["[Platform(s)]"],
    tags: ["Government", "Civic Tech", "Accessibility"],
    featured: false,
    featuredOrder: 4,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,

    projectSummary: "[Project Summary — two to three sentences on the service, who depended on it, and why it mattered.]",
    businessContext: "[Business Context — the policy mandate, legacy system, or public need that motivated this work.]",
    whyDifficult: "[Why This Was Difficult — e.g. wide accessibility requirements, large and varied stakeholder groups, legacy infrastructure, cross-agency coordination.]",
    myRoleSummary: "[My Role — what you specifically owned, and how you worked with policy/agency stakeholders.]",

    successMetrics: [
      { label: "[Metric name]", value: "[Target]", context: "[How success was defined going in]" },
    ],
    constraints: [
      { title: "[Constraint — e.g. WCAG 2.2 AA compliance]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. legacy mainframe integration]", body: "[How this shaped the design.]" },
      { title: "[Constraint — e.g. multi-agency approval process]", body: "[How this shaped the design.]" },
    ],
    keyDecisions: [
      { title: "[Decision title]", context: "[What was the fork in the road?]", decision: "[What did you choose?]", rationale: "[Why?]" },
    ],
    quote: {
      quote: "[A short stakeholder or constituent quote, once you have one to share.]",
      attribution: "[Name/role, or an anonymized descriptor.]",
    },

    designEvolution: {
      type: "sideBySide",
      left: { label: "[Direction A]", body: "[What you tried]" },
      right: { label: "[Direction B]", body: "[What you tried]" },
    },
    finalSolution: { body: "[Describe what shipped and why it addressed the problem.]" },
    businessImpact: [
      { label: "[Metric name]", value: "[Value]", context: "[Measurement window/context]" },
    ],
    lessonsLearned: "[What surprised you.]",
    wouldChangeNextTime: "[One concrete change.]",
    nextOpportunities: "[Where this is headed.]",

    industrySections: [
      { label: "Service Blueprint" },
      {
        label: "Citizen Journey",
        type: "timeline",
        steps: [
          { stage: "[Awareness]", note: "[Placeholder step]" },
          { stage: "[Application]", note: "[Placeholder step]" },
          { stage: "[Review]", note: "[Placeholder step]" },
          { stage: "[Resolution]", note: "[Placeholder step]" },
        ],
      },
      { label: "Accessibility Notes", type: "callout", body: "[Accessibility considerations and standards this work needed to meet.]" },
      { label: "Stakeholder Ecosystem" },
    ],
  },
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

// Up to `count` other published projects, preferring different industries
// first so "Related Work" reads as a tour of range rather than near-dupes.
function getRelatedWorkProjects(slug, count) {
  count = count || 3;
  var current = getWorkProjectBySlug(slug);
  var others = getPublishedWorkProjects().filter(function (p) {
    return p.slug !== slug;
  });
  if (!current) return others.slice(0, count);
  others.sort(function (a, b) {
    var aSame = a.industry === current.industry ? 1 : 0;
    var bSame = b.industry === current.industry ? 1 : 0;
    return aSame - bSame;
  });
  return others.slice(0, count);
}

var INDUSTRY_LABELS = {
  "enterprise-ai": "Enterprise / Frontier AI",
  "cybersecurity": "Cybersecurity",
  "fintech": "FinTech / RegTech / Compliance",
  "government": "Government · Civic · Health · Insurance",
};

var MayaWork = {
  WORK_PROJECTS: WORK_PROJECTS,
  INDUSTRY_LABELS: INDUSTRY_LABELS,
  getPublishedWorkProjects: getPublishedWorkProjects,
  getWorkProjectBySlug: getWorkProjectBySlug,
  getAdjacentWorkProjects: getAdjacentWorkProjects,
  getRelatedWorkProjects: getRelatedWorkProjects,
};

if (typeof window !== "undefined") window.MayaWork = MayaWork;
if (typeof module !== "undefined" && module.exports) module.exports = MayaWork;
