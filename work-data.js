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
// draft:true shows a visible "Draft" badge.
//
// FPO CONTENT — every project below is "for placement only": realistic
// sample copy, numbers, and diagrams written to demonstrate the template
// at real weight, not a record of real work. No employer, product, metric,
// finding, or quote here is real — organizations are described generically
// ("Confidential — enterprise SaaS company") rather than named, on purpose.
// Every generated graphic carries a visible "FPO" stamp for the same
// reason. Swap in real case studies before this goes live; draft:true and
// the FPO markers should come off together, not separately.
//
// industrySections entries render through a single consolidated "diagram
// placeholder" component (omit `type`, optionally set `visual` to
// "network" | "flow" | "matrix" | "chart" to pick which illustrative
// sketch it draws — default is "flow"), or as a `timeline` / `callout`
// instance for variety. Add or remove entries freely; nothing else needs
// to change.

var WORK_PROJECTS = [
  // ==========================================================
  // 1 — Enterprise / Frontier AI
  // ==========================================================
  {
    slug: "enterprise-ai-case-study",
    industry: "enterprise-ai",
    title: "AI Case Triage Assistant",
    cardChallenge: "Support analysts spent 40% of their day manually routing cases across three disconnected systems.",
    cardOutcome: "Cut triage time from 12 minutes to under 3, with analysts trusting the agent's calls 9 times in 10.",
    projectType: "0→1 AI product, agent-assisted workflow",
    summary: "Designed an AI agent that triages and routes enterprise support cases in real time, cutting manual handling time by more than 70% while keeping a human in the loop for every high-stakes decision.",
    organization: "Confidential — enterprise SaaS company (10,000+ employee customers)",
    year: "2025",
    timeline: "Jan 2025 – Jul 2025",
    role: "Senior Product Designer, AI & Agents",
    team: ["1 PM", "4 engineers", "2 ML researchers", "1 content designer"],
    responsibilities: [
      "Led end-to-end design for the agent's decision and handoff UX",
      "Defined the human-in-the-loop review pattern used across the AI platform",
      "Partnered with ML research on confidence-threshold tuning and its UI implications",
    ],
    platforms: ["Web", "Internal API"],
    tags: ["Enterprise AI", "Agents", "Conversational UX"],
    featured: true,
    featuredOrder: 1,
    published: true,
    draft: true,
    confidential: true,
    confidentialityNote:
      "Company name, real screenshots, and case data are withheld under NDA. Layouts and copy shown are recreated to illustrate the approach without exposing proprietary UI.",
    thumbnail: null,
    heroMedia: null,
    heroMockup: "queue-dashboard",

    projectSummary:
      "An AI agent that reads incoming support cases, classifies their urgency and required expertise, and routes them to the right team — with a human able to review, override, or approve every recommendation before it takes effect. Built for a support organization handling 15,000+ cases a week.",
    businessContext:
      "Support volume had grown 3x in eighteen months without a matching increase in headcount. Senior analysts were spending nearly half their day on triage — reading, categorizing, and routing cases — instead of resolving them. Leadership wanted automation, but two earlier rules-based routing attempts had been abandoned after analysts stopped trusting the system's decisions.",
    whyDifficult:
      "The model's confidence in any given classification varied case by case, and there was no existing pattern on the team for showing that uncertainty without either overwhelming analysts with caveats or hiding it and eroding trust the way the earlier rules engine had. There was also no agreed-upon definition of what \"good enough to automate\" meant — that had to be negotiated with support leadership in parallel with the design work.",
    myRoleSummary:
      "I owned the end-to-end experience for how analysts interact with the agent — the review queue, the confidence and reasoning display, and the escalation path when the agent gets it wrong. I worked directly with ML research to translate model confidence scores into a UI pattern analysts could act on, and I ran the trust-calibration research that shaped the human-in-the-loop threshold.",

    successMetrics: [
      { label: "Analyst time on triage", value: "< 15%", context: "Target: reduce from ~40% of the workday" },
      { label: "Override rate", value: "< 20%", context: "Target: analysts accept the agent's routing without changes" },
    ],
    constraints: [
      { title: "Zero tolerance for silent misrouting", body: "A miscategorized case involving legal or security risk had to be impossible to miss, not just unlikely — this ruled out any design that let low-confidence cases pass through silently." },
      { title: "Analysts had been burned before", body: "Two earlier automation attempts had failed and were still fresh in analysts' memory, so the design had to earn trust incrementally rather than ask for it up front." },
      { title: "Model confidence wasn't static", body: "Confidence scores shifted as the model retrained weekly, so the UI couldn't hardcode thresholds — it had to represent a moving target without looking unstable." },
    ],
    keyDecisions: [
      {
        title: "Show reasoning, not just a confidence score",
        context: "A raw confidence percentage (e.g. \"82%\") tested poorly — analysts didn't know what to do with a number.",
        decision: "Replaced the score with a short, plain-language summary of why the agent made its call, plus a three-tier visual indicator (high / medium / low).",
        rationale: "Analysts needed something actionable, not just a number to distrust or ignore.",
      },
      {
        title: "Auto-route only above a negotiated confidence floor",
        context: "Support leadership wanted maximum automation; analysts wanted maximum control.",
        decision: "Cases above a jointly agreed confidence threshold route automatically with a visible audit trail; everything below it queues for one-click human review.",
        rationale: "Gave both groups a shared, adjustable lever instead of a fixed design decision either side could veto.",
      },
    ],
    researchHighlights: [
      "Analysts trusted the agent more after seeing it explain a wrong decision than after seeing it get five decisions right silently",
      "The word \"confidence\" tested worse than \"how sure the assistant is\" in plain-language usability sessions",
      "Most override behavior clustered around a small set of ambiguous case types, not random distrust",
    ],
    stakeholders: [
      { role: "VP of Support Operations", note: "Owned the target metrics and had to sign off on the automation threshold" },
      { role: "ML Research Lead", note: "Partnered on translating model confidence into something a human interface could represent honestly" },
    ],
    quote: {
      quote: "The first version felt like a black box telling me what to do. This version feels like a coworker showing their work.",
      attribution: "Senior Support Analyst, internal pilot participant",
    },

    designEvolution: {
      type: "sideBySide",
      left: { label: "Score-first", body: "An early version led with a numeric confidence score (\"82% confident\"). It tested well in isolation, but analysts didn't know what action to take with a percentage — accept it? Double-check it? The number alone didn't answer that." },
      right: { label: "Reasoning-first", body: "The version that shipped leads with a one-line explanation of the agent's reasoning, with the confidence tier shown as a secondary, color-coded badge. Analysts could act on \"flagged for billing dispute, high confidence\" immediately." },
    },
    finalSolution: {
      body: "The shipped experience shows every routed case with a one-line reasoning summary, a three-tier confidence badge, and a single click to approve, override, or escalate. Cases below the confidence floor never auto-route — they land directly in a priority review queue with the same reasoning summary, so reviewing them takes seconds, not minutes.",
    },
    businessImpact: [
      { label: "Average triage time", value: "2m 40s", context: "Down from 12 minutes pre-launch, measured over the first full quarter post-rollout" },
      { label: "Analyst trust survey", value: "+34 pts", context: "Net trust score change from pre-pilot baseline to three months post-launch" },
    ],
    lessonsLearned: "Trust wasn't built by the agent being right more often — it was built by the agent being legible when it was wrong. The single biggest jump in adoption came after we added visible reasoning, not after we improved model accuracy.",
    wouldChangeNextTime: "I'd bring support analysts into the confidence-threshold conversation earlier — we spent weeks negotiating a number in a room without them, then spent longer earning back trust for a threshold they'd had no say in.",
    nextOpportunities: "Extending the same reasoning-first pattern to a second, higher-stakes agent workflow (billing dispute resolution) that the support team specifically asked for after this launch.",

    industrySections: [
      { label: "AI Architecture", visual: "network" },
      { label: "Agent Workflow", visual: "flow" },
      { label: "Guardrails & Human-in-the-Loop", visual: "flow" },
      { label: "Experiment Results", visual: "chart" },
    ],
  },

  // ==========================================================
  // 2 — Cybersecurity
  // ==========================================================
  {
    slug: "cybersecurity-case-study",
    industry: "cybersecurity",
    title: "Security Operations Command Center",
    cardChallenge: "Analysts were missing real incidents in a sea of low-priority alerts across five disconnected tools.",
    cardOutcome: "Cut alert-to-triage time by 65% and reduced missed critical incidents to zero over two quarters.",
    projectType: "SOC dashboard redesign, unified alert triage",
    summary: "Redesigned a security operations dashboard that unifies alerts from five monitoring systems into one prioritized queue, cutting analyst alert fatigue and triage time.",
    organization: "Confidential — mid-market managed security services provider",
    year: "2024",
    timeline: "Mar 2024 – Nov 2024",
    role: "Lead Product Designer",
    team: ["1 PM", "3 engineers", "1 security architect"],
    responsibilities: [
      "Led the unified alert-prioritization design across five previously separate tools",
      "Designed the least-privilege permissions model for the new dashboard",
      "Ran contextual research inside a live SOC to understand analyst workflow under alert fatigue",
    ],
    platforms: ["Web (internal)"],
    tags: ["Cybersecurity", "Systems design", "Expert users"],
    featured: true,
    featuredOrder: 2,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,
    heroMockup: "alert-dashboard-ranked",

    projectSummary:
      "A unified security operations dashboard that pulls alerts from five previously separate monitoring tools into a single, risk-ranked queue — built for a 24/7 SOC team handling an average of 4,000 alerts a day, the vast majority of them noise.",
    businessContext:
      "The security team had grown through tool acquisition, not tool design — five monitoring systems, five separate alert queues, and no single view of what actually mattered right now. A near-miss incident, where a genuine intrusion sat unreviewed for six hours behind a wall of low-priority noise, made unifying the alert experience a board-level priority.",
    whyDifficult:
      "Analysts worked in a high-stress, real-time environment where a slow or confusing interface had real consequences, and any change to how alerts were prioritized risked either burying something critical or crying wolf so often that analysts tuned it out — the same failure mode as the system it was replacing. The redesign also had to fit a sub-second latency budget, since every additional render delay compounded across a shift handling thousands of alerts.",
    myRoleSummary:
      "I led the design of the unified alert queue end to end, including the risk-scoring visualization, the permissions model governing who could see and act on what, and the on-call handoff flow. I spent two full week-long shifts embedded with the SOC team to understand triage under real alert volume before designing anything.",

    successMetrics: [
      { label: "Alert-to-triage time", value: "< 90s", context: "Target: median time from alert to analyst first action" },
    ],
    constraints: [
      { title: "Sub-second latency requirement", body: "Any UI delay compounded across a shift handling thousands of alerts, so every design decision was evaluated against real render-time budgets, not just visual hierarchy." },
      { title: "Least-privilege access model", body: "Analysts, tier-2 responders, and admins needed meaningfully different views of the same data — the interface had to enforce that boundary, not just suggest it." },
      { title: "Audit logging requirements", body: "Every triage action had to be logged in a way that would hold up in a compliance review, which constrained how \"quick actions\" in the UI could be designed." },
    ],
    keyDecisions: [
      {
        title: "Risk-rank instead of tool-source alerts",
        context: "Alerts were organized by which of the five source tools generated them, so an analyst reviewing a genuine threat still had to manually cross-reference severity across tools.",
        decision: "Replaced the tool-based queue with a single risk-ranked queue that normalizes severity across all five sources.",
        rationale: "Analysts needed to answer \"what matters most right now,\" not \"what did each tool report.\"",
      },
      {
        title: "Default to collapsed detail, not expanded",
        context: "The original dashboards showed full alert payloads by default, so the highest-severity alert and the lowest-severity one took the same visual space.",
        decision: "Alerts default to a one-line risk-ranked summary; full detail is one click away.",
        rationale: "Restored the visual hierarchy that severity was supposed to provide in the first place.",
      },
    ],
    researchHighlights: [
      "Analysts had built their own informal cross-referencing habits — sticky notes, a shared spreadsheet — to work around the lack of a unified view",
      "The near-miss incident that triggered this project was cited unprompted by 4 of 6 analysts as their top concern",
    ],

    designEvolution: {
      type: "gallery",
      items: [
        { alt: "Early exploration: a single unified feed sorted purely by timestamp", mockup: "alert-dashboard-flat" },
        { alt: "Later exploration: risk-ranked queue with severity-based visual weight", mockup: "alert-dashboard-ranked" },
      ],
    },
    finalSolution: {
      body: "The shipped dashboard presents one risk-ranked queue across all five source tools, with severity encoded in position, color, and size rather than requiring analysts to read a label. Tier-appropriate permissions are enforced at the data layer, and every triage action writes to an immutable audit log visible to compliance without slowing the analyst down.",
    },
    businessImpact: [
      { label: "Alert-to-triage time", value: "65% faster", context: "Median time from alert to first analyst action, two-quarter comparison" },
    ],
    lessonsLearned: "The biggest UX problem wasn't information density — SOC analysts are comfortable with dense interfaces. It was inconsistent severity logic across five tools that had never been designed to work together.",
    wouldChangeNextTime: "I'd push for the risk-scoring model to be unified before starting visual design — we iterated on the queue's visual hierarchy twice because the underlying severity math changed mid-project.",
    nextOpportunities: "The security architect who partnered on this has asked about extending the same unified-queue pattern to the vulnerability management workflow, which has a near-identical multi-tool fragmentation problem.",

    industrySections: [
      { label: "Threat Flow", visual: "flow" },
      { label: "Permissions Matrix", visual: "matrix" },
      {
        label: "Incident Timeline",
        type: "timeline",
        steps: [
          { stage: "Detection", note: "Automated monitoring flags anomalous behavior across the five source tools." },
          { stage: "Triage", note: "Risk-ranked queue surfaces the alert; analyst reviews severity and context in under 90 seconds." },
          { stage: "Containment", note: "Tier-2 responder takes ownership; permissions model grants exactly the access needed, nothing more." },
          { stage: "Resolution", note: "Incident closed with a full, audit-ready action trail attached automatically." },
        ],
      },
      { label: "Risk Visualization", visual: "chart" },
    ],
  },

  // ==========================================================
  // 3 — FinTech / RegTech / Compliance
  // ==========================================================
  {
    slug: "fintech-compliance-case-study",
    industry: "fintech",
    title: "Regulatory Compliance Workflow Platform",
    cardChallenge: "Compliance officers tracked regulatory obligations across 40+ spreadsheets with no single source of truth.",
    cardOutcome: "Cut quarterly audit prep from six weeks to nine days; passed the next regulatory exam with zero findings.",
    projectType: "Compliance workflow platform, audit-readiness tooling",
    summary: "Designed a compliance workflow platform that replaced 40+ disconnected spreadsheets with one auditable system of record, cutting quarterly audit prep time by more than 70%.",
    organization: "Confidential — regional financial institution (bank holding company)",
    year: "2023",
    timeline: "May 2023 – Feb 2024",
    role: "Senior Product Designer",
    team: ["1 PM", "3 engineers", "1 compliance SME embedded full-time"],
    responsibilities: [
      "Designed the end-to-end compliance obligation tracking and evidence workflow",
      "Partnered with legal and audit on what \"audit-ready\" needed to mean in the interface",
      "Built the design system's approach to immutable audit trails, reused across the compliance product line",
    ],
    platforms: ["Web"],
    tags: ["FinTech", "RegTech", "Governance"],
    featured: true,
    featuredOrder: 3,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,
    heroMockup: "table-tracker",

    projectSummary:
      "A compliance workflow platform that gives a mid-size bank's compliance team one system of record for every regulatory obligation, its owner, its evidence, and its audit trail — replacing a patchwork of over 40 spreadsheets maintained across four teams.",
    businessContext:
      "Following a regulatory exam that flagged the bank's compliance tracking as a process risk, leadership committed to replacing spreadsheet-based tracking before the next examination cycle. The compliance team had grown faster than its tooling, and no one could say with confidence, on any given day, exactly which obligations were current, overdue, or unowned.",
    whyDifficult:
      "Compliance officers, auditors, and engineers all needed to trust the same record, but each group had a different definition of \"done\" — compliance wanted flexibility to document nuance, auditors wanted immutability and a clear trail, and engineering needed a data model that didn't have to be rebuilt every time a regulation changed. Reconciling those three needs into one workflow, on a hard deadline set by the next exam cycle, left very little room for a wrong early decision.",
    myRoleSummary:
      "I owned the end-to-end workflow design, from how an obligation is created and assigned through how evidence is attached and how the audit trail is presented to an external examiner. I worked directly with an embedded compliance SME daily and ran structured reviews with legal and internal audit before any workflow shipped.",

    successMetrics: [
      { label: "Quarterly audit prep time", value: "< 2 weeks", context: "Target: reduce from a historical ~6 weeks" },
      { label: "Obligation ownership coverage", value: "100%", context: "Target: every tracked obligation has a named, current owner" },
    ],
    constraints: [
      { title: "Regulatory sign-off cycle", body: "Any workflow change affecting how evidence was recorded needed compliance and legal sign-off before it could ship, which meant design changes had to be validated well ahead of build." },
      { title: "Immutable audit trail", body: "Every edit to an obligation's status or evidence had to be logged permanently and legibly enough for an external examiner to reconstruct the full history without help." },
    ],
    keyDecisions: [
      {
        title: "Evidence attached to obligations, not filed separately",
        context: "The old spreadsheet workflow treated evidence (documents, sign-offs) as a separate filing task from tracking the obligation itself, and the two routinely fell out of sync.",
        decision: "Evidence upload became a required step inside the obligation's own workflow, not a separate process.",
        rationale: "Made it structurally impossible for an obligation to show \"complete\" without its evidence attached.",
      },
    ],
    stakeholders: [
      { role: "Chief Compliance Officer", note: "Final approver on what \"audit-ready\" meant in practice" },
      { role: "Head of Internal Audit", note: "Defined the audit-trail and export requirements the design had to satisfy" },
    ],

    designEvolution: {
      type: "beforeAfter",
      before: { alt: "Compliance tracking spread across 40+ spreadsheets with no shared ownership view", caption: "Before", mockup: "spreadsheet-chaos" },
      after: { alt: "Single obligation-tracking system with owner, status, and evidence in one record", caption: "After", mockup: "table-tracker" },
    },
    finalSolution: {
      body: "The platform gives every regulatory obligation a single record: owner, status, linked evidence, and a full immutable history. A dedicated audit-export view lets internal and external auditors review a point-in-time snapshot without needing raw system access.",
    },
    businessImpact: [
      { label: "Audit prep time", value: "9 days", context: "Down from ~6 weeks, first full quarter post-launch" },
      { label: "Regulatory exam result", value: "Zero findings", context: "First post-launch examination cycle" },
    ],
    lessonsLearned: "The compliance team didn't need a more powerful tool — they needed one they could trust wouldn't drift out of sync with reality, which is a workflow problem more than a features problem.",
    wouldChangeNextTime: "I'd loop internal audit into design reviews from week one instead of week six — their audit-export requirements reshaped a piece of the data model we'd already built.",
    nextOpportunities: "Compliance leadership has asked about extending the same obligation-tracking pattern to third-party vendor risk management, which has a structurally similar tracking problem.",

    industrySections: [
      {
        label: "Compliance Timeline",
        type: "timeline",
        steps: [
          { stage: "Requirement identified", note: "New or updated regulation is logged as a tracked obligation with a named owner." },
          { stage: "Control designed", note: "Compliance team defines the control and the evidence required to demonstrate it." },
          { stage: "Internal review", note: "Legal and internal audit review the control before it goes live." },
          { stage: "Audit sign-off", note: "Obligation status and evidence are locked into the immutable record for the next exam cycle." },
        ],
      },
      { label: "Audit Trail", visual: "flow" },
      { label: "Decision Matrix", visual: "matrix" },
      { label: "Risk Scoring", visual: "chart" },
    ],
  },

  // ==========================================================
  // 4 — Government · Civic Tech · Healthcare · Insurance
  // ==========================================================
  {
    slug: "government-civic-case-study",
    industry: "government",
    title: "State Benefits Application Portal",
    cardChallenge: "60% of applicants abandoned a 45-minute paper-modeled form, disproportionately older and non-English-speaking residents.",
    cardOutcome: "Cut median completion time to 12 minutes and raised completion to 91% across every measured demographic group.",
    projectType: "Legacy system modernization, citizen-facing service",
    summary: "Redesigned a state benefits application from a 45-minute paper-modeled form into a 12-minute digital service, closing a completion-rate gap that had disproportionately affected older and limited-English-proficiency residents.",
    organization: "Confidential — U.S. state health and human services agency",
    year: "2022",
    timeline: "Aug 2022 – Jun 2023",
    role: "Lead Product Designer, Civic Services",
    team: ["1 PM", "2 engineers", "1 accessibility specialist", "2 caseworker SMEs"],
    responsibilities: [
      "Led end-to-end redesign of the public-facing application experience",
      "Owned accessibility strategy and WCAG 2.2 AA compliance for the new portal",
      "Ran in-person usability sessions in three languages with residents who had abandoned the old form",
    ],
    platforms: ["Web", "Mobile web"],
    tags: ["Government", "Civic Tech", "Accessibility"],
    featured: true,
    featuredOrder: 4,
    published: true,
    draft: true,
    confidential: false,
    confidentialityNote: "",
    thumbnail: null,
    heroMedia: null,
    heroMockup: "guided-form",

    projectSummary:
      "A redesigned public benefits application that replaced a 45-minute, paper-modeled digital form with a 12-minute guided experience — built for a resident population where nearly a third does not speak English as a first language and a meaningful share apply from a phone.",
    businessContext:
      "The state's benefits application had been digitized years earlier by converting the paper form into a long web form, section by section. Completion data showed a 60% abandonment rate, concentrated heavily among older residents and those applying in a non-English language — the population the benefit was most intended to reach.",
    whyDifficult:
      "The application had to satisfy strict policy and legal requirements — every question existed because a regulation required it — while still being redesigned for comprehension by residents under real stress, often on an older phone, sometimes in a second language. Not one required question could be removed, only reconsidered in how it was asked, sequenced, and explained, which meant every simplification had to be negotiated with policy stakeholders rather than just designed.",
    myRoleSummary:
      "I led the end-to-end redesign of the application flow, from how eligibility questions are sequenced to the plain-language rewrite of every form field, and I owned the accessibility and multi-language strategy from the start rather than as a later pass. I worked directly with caseworkers and ran usability sessions with residents in English, Spanish, and Vietnamese.",

    successMetrics: [
      { label: "Completion rate", value: "> 85%", context: "Target: reduce the historical 60% abandonment rate" },
      { label: "WCAG conformance", value: "2.2 AA", context: "Required baseline across the full application" },
    ],
    constraints: [
      { title: "WCAG 2.2 AA compliance", body: "Every screen had to meet this bar without exception, which shaped decisions down to form-field error messaging and focus order, not just color contrast." },
      { title: "Legacy mainframe integration", body: "The new front end had to submit data in a format the decades-old eligibility mainframe could still process, constraining how much the underlying data structure of the form could change." },
      { title: "Multi-agency approval process", body: "Legal, policy, and IT security each had sign-off authority over different parts of the flow, and their review cycles didn't run in parallel." },
    ],
    keyDecisions: [
      {
        title: "Split one long form into a guided, savable sequence",
        context: "The original form was a single long page; residents on an unstable connection or a shared device frequently lost progress and gave up.",
        decision: "Broke the application into short, auto-saved sections a resident could leave and resume, on any device, without losing progress.",
        rationale: "Abandonment data showed most drop-off happened mid-form, not at the start — the form needed to survive interruption, not just be shorter.",
      },
    ],
    quote: {
      quote: "I tried to apply for this three times on my phone before. This time I actually finished it on the bus.",
      attribution: "Pilot program participant, usability session",
    },

    designEvolution: {
      type: "sideBySide",
      left: { label: "Single long-form scroll", body: "The original redesign direction kept the guided flow as one long scrollable page, just with clearer language. It tested better than the legacy form but still lost residents on unstable mobile connections." },
      right: { label: "Segmented, auto-saved sections", body: "The version that shipped breaks the application into short sections with automatic save after every screen, so a lost connection or a closed tab never costs a resident their progress." },
    },
    finalSolution: {
      body: "The new application guides residents through short, auto-saved sections in plain language, with every required regulatory question paired with an approved plain-language explanation. It's fully WCAG 2.2 AA conformant and available in English, Spanish, and Vietnamese at launch, with a mobile-first layout built for the connection conditions residents actually apply under.",
    },
    businessImpact: [
      { label: "Completion rate", value: "91%", context: "Twelve months post-launch, all measured demographic groups" },
      { label: "Median completion time", value: "12 minutes", context: "Down from ~45 minutes on the legacy form" },
    ],
    lessonsLearned: "Plain language and legal accuracy were never actually in conflict — the two only looked opposed because no one had tried pairing them until this project made policy a design stakeholder from day one.",
    wouldChangeNextTime: "I'd start the multi-language usability sessions in month one instead of month four — issues found in Vietnamese-language testing late in the project required rework that earlier testing would have caught before build.",
    nextOpportunities: "The same segmented, plain-language pattern has been requested by two adjacent state agencies for their own legacy benefits applications.",

    industrySections: [
      { label: "Service Blueprint", visual: "network" },
      {
        label: "Citizen Journey",
        type: "timeline",
        steps: [
          { stage: "Awareness", note: "Resident learns about the benefit through a caseworker, clinic, or community outreach partner." },
          { stage: "Application", note: "Resident completes the guided, auto-saved application in their preferred language." },
          { stage: "Review", note: "Caseworker reviews the submission against eligibility rules; the mainframe integration keeps the case record current." },
          { stage: "Resolution", note: "Resident receives a decision and, if approved, clear next steps for enrollment." },
        ],
      },
      { label: "Accessibility Notes", type: "callout", body: "Built to WCAG 2.2 AA across every screen, with plain-language rewrites reviewed at a 6th-grade reading level and validated in English, Spanish, and Vietnamese usability sessions." },
      { label: "Stakeholder Ecosystem", visual: "network" },
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
