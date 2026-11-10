/**
 * Curated long-form explainers for the regulations Govi cites most often.
 *
 * Body text is written in our own words — practical, AI-context-aware
 * summaries — so we can ship it without quoting copyrighted regulatory
 * text verbatim. For the authoritative text, users follow `officialUrl`.
 *
 * Lookup is via `getRegulationEntry(reg, article)` in
 * `src/lib/regulations/lookup.ts`, which normalises the regulation +
 * article strings the LLM produces into canonical slugs and falls back
 * to on-demand LLM generation when no curated entry exists.
 */

export interface RegulationEntry {
  /** Canonical `regulationSlug/articleSlug`, e.g. `gdpr/article-5`. */
  slug: string;
  /** Human-readable regulation name, e.g. `GDPR`. */
  regulation: string;
  /** Article identifier as shown on cards, e.g. `Article 5` or `Annex III §5`. */
  article: string;
  /** Short article title. */
  title: string;
  /** Official source URL — eur-lex, NIST, ISO, etc. */
  officialUrl: string;
  /**
   * Long-form markdown body. Three sections by convention:
   * - **Plain-language summary**
   * - **What it requires (for AI systems)**
   * - **Practical implications**
   */
  body: string;
  /** GovSecure document codes whose content is most relevant. */
  relatedGovSecureCodes?: string[];
  /** NIST AI RMF function/subcategory IDs this maps to. */
  nistMappings?: string[];
}

export const REGULATION_LIBRARY: RegulationEntry[] = [
  // ─── GDPR ────────────────────────────────────────────────────────────────
  {
    slug: 'gdpr/article-5',
    regulation: 'GDPR',
    article: 'Article 5',
    title: 'Principles relating to processing of personal data',
    officialUrl: 'https://gdpr-info.eu/art-5-gdpr/',
    body: `**Plain-language summary**

Article 5 sets out the seven core principles that govern every processing of personal data in the EU. These are not procedural rules — they are the substantive obligations every controller must demonstrate compliance with ("accountability"). Any AI system that ingests, infers about, or makes decisions affecting natural persons in the EU is bound by them.

**What it requires (for AI systems)**

- **Lawfulness, fairness and transparency** — You need a valid Article 6 basis (and Article 9 for special-category data) *before* feeding data into training, fine-tuning, or inference. Users must understand what the system does with their data.
- **Purpose limitation** — Data collected for one purpose (e.g. customer support transcripts) cannot be silently repurposed for model training without a fresh lawfulness analysis.
- **Data minimisation** — Only the data necessary for the specific AI use case. "We might need it later" is not a basis.
- **Accuracy** — Inferences and predictions about individuals count as personal data. Inaccurate outputs (e.g. wrong eligibility scores) must be correctable.
- **Storage limitation** — Training datasets and inference logs need retention schedules tied to the purpose.
- **Integrity and confidentiality** — Encryption, access controls, and protection against model-extraction or membership-inference attacks.
- **Accountability** — You must be able to *demonstrate* the above — typically via DPIA, ROPA, and model documentation.

**Practical implications**

For chatbots, recommender systems, and any AI that handles user data: the principles map directly to your DPIA. Accuracy and purpose limitation are the two most-litigated principles in AI contexts because LLM outputs about people are frequently wrong, and training-set repurposing is the default failure mode.`,
    relatedGovSecureCodes: ['GS-AIPS-DATAHAND-03', 'GS-CHKL-DPIASCRE-03', 'GS-AIPS-GOVERNAN-02'],
    nistMappings: ['GOVERN-1.1', 'MAP-3.4', 'MEASURE-2.10'],
  },
  {
    slug: 'gdpr/article-6',
    regulation: 'GDPR',
    article: 'Article 6',
    title: 'Lawfulness of processing',
    officialUrl: 'https://gdpr-info.eu/art-6-gdpr/',
    body: `**Plain-language summary**

Article 6 enumerates the six lawful bases for processing personal data. You must identify and document a basis *before* processing starts. For AI, the basis must cover both the *training* phase and the *inference* phase — they are separate processing operations.

**What it requires (for AI systems)**

The six bases: consent, contract, legal obligation, vital interests, public task, legitimate interests. For commercial AI products the realistic options are:

- **Consent** — explicit, granular, withdrawable. Hard to use for training data scraped at scale.
- **Contract** — processing necessary to perform a contract with the data subject. Works for AI features users actively request.
- **Legitimate interests** — requires a three-step LIA (purpose / necessity / balancing) documenting why your interest overrides the data subject's rights. The default basis for most B2B AI but the most contested.

**Practical implications**

Training-data lawfulness is the biggest open question. Italian Garante and the EDPB have signalled that scraping the web for LLM training requires a documented LIA at minimum — and that data subjects retain Article 17 (erasure) and Article 21 (objection) rights against the trained model. Document the basis per-purpose, not per-product.`,
    relatedGovSecureCodes: ['GS-AIPS-DATAHAND-03', 'GS-CHKL-DPIASCRE-03'],
    nistMappings: ['GOVERN-1.1', 'MAP-1.6'],
  },
  {
    slug: 'gdpr/article-22',
    regulation: 'GDPR',
    article: 'Article 22',
    title: 'Automated individual decision-making, including profiling',
    officialUrl: 'https://gdpr-info.eu/art-22-gdpr/',
    body: `**Plain-language summary**

Article 22 gives every data subject the right *not* to be subject to a decision based solely on automated processing — including profiling — that produces legal or similarly significant effects. It is the most AI-specific GDPR provision and the one most likely to be triggered by ML systems making eligibility, pricing, or risk decisions.

**What it requires (for AI systems)**

If your system makes a decision that:
1. Is based *solely* on automated processing (no meaningful human review), AND
2. Produces a *legal effect* (contract termination, denial of service) or *similarly significant effect* (credit denial, insurance pricing, employment screening),

then you need one of three derogations: explicit consent, necessity for contract performance, or authorisation by Union/Member State law. In all cases you must:

- Implement *meaningful* human review (not rubber-stamping).
- Inform the data subject of the logic involved and the significance/consequences.
- Provide the right to contest the decision.

**Practical implications**

"Human in the loop" is the most common compliance pattern, but regulators look hard at whether the human review is meaningful — does the reviewer have authority and information to overturn? Automated scoring with cosmetic human sign-off has been found to fall under Article 22 in multiple national-court decisions (notably the Dutch SyRI case).`,
    relatedGovSecureCodes: ['GS-AIPS-HUMANOVE-07', 'GS-CHKL-HUMANOVE-06'],
    nistMappings: ['GOVERN-1.2', 'MAP-3.5', 'MANAGE-2.3'],
  },
  {
    slug: 'gdpr/article-35',
    regulation: 'GDPR',
    article: 'Article 35',
    title: 'Data Protection Impact Assessment (DPIA)',
    officialUrl: 'https://gdpr-info.eu/art-35-gdpr/',
    body: `**Plain-language summary**

Article 35 requires a DPIA whenever processing is "likely to result in a high risk to the rights and freedoms of natural persons." For AI systems, almost every Article 35(3) trigger applies — systematic evaluation, large-scale processing of special-category data, systematic monitoring — so a DPIA is the default, not the exception.

**What it requires (for AI systems)**

A DPIA must contain at minimum:
- A systematic description of the processing and its purposes.
- An assessment of necessity and proportionality.
- An assessment of risks to data subjects.
- The measures envisaged to mitigate those risks.

For AI: include model architecture, training-data lineage, accuracy/fairness metrics, explainability mechanism, human-review process, and an honest assessment of failure modes.

**Practical implications**

If residual risk remains high after mitigation, Article 36 requires prior consultation with the supervisory authority *before* deployment. The DPIA is also your primary defence document in an enforcement action — keep it living, not a one-time artefact.`,
    relatedGovSecureCodes: ['GS-CHKL-DPIASCRE-03', 'GS-AIPS-RISKASSE-04', 'GS-CHKL-RISKASSE-17'],
    nistMappings: ['MAP-1.1', 'MAP-3.4', 'MEASURE-2.6'],
  },

  // ─── EU AI Act ───────────────────────────────────────────────────────────
  {
    slug: 'eu-ai-act/article-5',
    regulation: 'EU AI Act',
    article: 'Article 5',
    title: 'Prohibited AI practices',
    officialUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#art_5',
    body: `**Plain-language summary**

Article 5 lists AI practices that are banned outright in the EU regardless of risk-mitigation measures. Effective February 2025, these practices cannot be placed on the market, put into service, or used. Penalties reach up to €35 million or 7% of global turnover — the highest tier in the Act.

**What it requires (for AI systems)**

The eight prohibitions:
1. **Subliminal or manipulative techniques** distorting behaviour with significant harm.
2. **Exploitation of vulnerabilities** (age, disability, socio-economic).
3. **Social scoring** by public authorities leading to detrimental treatment.
4. **Predictive policing** based solely on profiling or personality traits.
5. **Untargeted scraping** of facial images for facial-recognition databases.
6. **Emotion recognition** in workplace and education (narrow medical/safety exception).
7. **Biometric categorisation** inferring sensitive attributes (race, political views, etc.).
8. **Real-time remote biometric identification** in public spaces by law enforcement (narrow derogations).

**Practical implications**

These are absolute bans — no consent, no legitimate-interest analysis can save them. The most commonly overlooked: workplace emotion recognition (sentiment scoring of customer-service agents has been flagged), and biometric categorisation hidden inside personalisation engines. Audit your existing tooling against this list before any other compliance work.`,
    relatedGovSecureCodes: ['GS-AIPS-RISKASSE-04', 'GS-CHKL-INTAKETR-09'],
    nistMappings: ['GOVERN-1.1', 'MAP-1.1'],
  },
  {
    slug: 'eu-ai-act/article-6',
    regulation: 'EU AI Act',
    article: 'Article 6',
    title: 'Classification rules for high-risk AI systems',
    officialUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#art_6',
    body: `**Plain-language summary**

Article 6 defines when an AI system counts as "high-risk" — the category that triggers the bulk of the Act's substantive obligations (risk management, data governance, technical documentation, human oversight, accuracy, conformity assessment, registration). Two paths to high-risk: (a) safety components under existing EU product law, or (b) any use case listed in Annex III.

**What it requires (for AI systems)**

If your system falls into either path you must, before deployment:
- Maintain a continuous risk-management system (Article 9).
- Use training/validation/test data meeting Article 10 quality criteria.
- Produce technical documentation (Article 11) and automatic logging (Article 12).
- Provide transparency to deployers (Article 13).
- Design for human oversight (Article 14).
- Meet accuracy, robustness, and cybersecurity standards (Article 15).
- Undergo conformity assessment and register in the EU database.

**Practical implications**

Most enforcement risk concentrates here. Note Article 6(3): a system listed in Annex III is *not* high-risk if it performs a narrow procedural task, improves a prior human activity, detects decision patterns without replacing human assessment, or is purely preparatory. This carve-out is narrow — document why if you rely on it.`,
    relatedGovSecureCodes: ['GS-AIPS-RISKASSE-04', 'GS-CHKL-RISKASSE-17', 'GS-AIPS-GOVERNAN-02'],
    nistMappings: ['MAP-1.1', 'MAP-2.3', 'MEASURE-2.1'],
  },
  {
    slug: 'eu-ai-act/annex-iii',
    regulation: 'EU AI Act',
    article: 'Annex III',
    title: 'High-risk AI systems — use case categories',
    officialUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_3',
    body: `**Plain-language summary**

Annex III is the enumerated list of use cases that automatically classify an AI system as high-risk under Article 6(2). The list covers eight broad areas where the Commission has judged the impact on fundamental rights, safety, or access to essential services to be significant enough to warrant heightened obligations.

**What it requires (for AI systems)**

The eight categories:
1. **Biometrics** — remote biometric identification, biometric categorisation, emotion recognition (where not already prohibited).
2. **Critical infrastructure** — safety components for road, water, gas, heating, electricity, digital infrastructure.
3. **Education & vocational training** — admission, evaluation, monitoring of prohibited behaviour during tests.
4. **Employment** — recruitment, selection, promotion, termination, task allocation, worker monitoring.
5. **Access to essential services** — public benefits, credit scoring, insurance pricing, emergency dispatch.
6. **Law enforcement** — victim/offender risk assessment, polygraph-like systems, evidence reliability.
7. **Migration, asylum, border control** — visa risk, document verification.
8. **Administration of justice & democratic processes** — judicial research/interpretation, election influence.

**Practical implications**

The Commission can update this list via delegated acts. Section 5 (access to essential services) is the most expansive and catches most B2C fintech, insurance, and benefits-eligibility products — including chatbots that gate access to those determinations.`,
    relatedGovSecureCodes: ['GS-AIPS-RISKASSE-04', 'GS-CHKL-INTAKETR-09'],
    nistMappings: ['MAP-1.1', 'MAP-1.6'],
  },
  {
    slug: 'eu-ai-act/annex-iii-5',
    regulation: 'EU AI Act',
    article: 'Annex III §5',
    title: 'Access to essential private and public services',
    officialUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_3',
    body: `**Plain-language summary**

Annex III §5 designates AI systems used to determine access to or eligibility for essential services as high-risk. This is the broadest practical category — it catches most consumer-facing AI in benefits, credit, insurance, and emergency services.

**What it requires (for AI systems)**

§5 covers four sub-categories:
- **(a) Public benefits** — AI used by public authorities (or on their behalf) to evaluate eligibility for essential public assistance benefits and services, or to grant, reduce, revoke, or reclaim them.
- **(b) Credit & creditworthiness** — AI evaluating creditworthiness or establishing a credit score, except for fraud detection.
- **(c) Life & health insurance** — AI for risk assessment and pricing.
- **(d) Emergency services dispatch** — AI for triage, dispatching, or establishing priority of emergency first response.

If your system performs any of these, the full Article 9–15 high-risk obligations apply: risk management, data governance, documentation, transparency, human oversight, accuracy/robustness, conformity assessment.

**Practical implications**

The "essential" qualifier is interpreted broadly. Tax-assessment chatbots, benefits eligibility checkers, mortgage pre-qualification tools, and even health-insurance quote engines all fall in scope. Note the explicit fraud-detection carve-out in (b) — fraud-only models are *not* high-risk, but the boundary between fraud detection and creditworthiness is thin and frequently audited.`,
    relatedGovSecureCodes: ['GS-AIPS-RISKASSE-04', 'GS-AIPS-HUMANOVE-07', 'GS-CHKL-RISKASSE-17'],
    nistMappings: ['MAP-1.1', 'MAP-3.5', 'MEASURE-2.11'],
  },

  // ─── NIST AI RMF ─────────────────────────────────────────────────────────
  {
    slug: 'nist-ai-rmf/govern',
    regulation: 'NIST AI RMF',
    article: 'GOVERN',
    title: 'GOVERN function — culture, policy, accountability',
    officialUrl: 'https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook/Govern',
    body: `**Plain-language summary**

GOVERN is the cross-cutting function of the NIST AI Risk Management Framework. It establishes the organisational structures — policies, processes, roles, and accountability — that make the other three functions (MAP, MEASURE, MANAGE) executable. Without GOVERN, the rest of the framework is paperwork.

**What it requires (for AI systems)**

GOVERN has six categories:
- **1. Policies & procedures** — written AI governance policy, risk tolerance, lifecycle definitions.
- **2. Accountability structures** — roles, responsibilities, lines of communication.
- **3. Workforce diversity & competence** — training, multidisciplinary teams.
- **4. Engagement** — communication with affected communities.
- **5. Process for third-party AI** — vendor due diligence, supply-chain mapping.
- **6. Risk acceptance criteria** — documented thresholds, escalation paths.

**Practical implications**

The most-cited subcategory in audits is GOVERN-1.1 (policies are in place). Have a board-approved AI policy that explicitly references your risk tiers and approval workflow. GOVERN-6.1 (third-party risk) is increasingly important as orgs adopt foundation-model APIs without due diligence.`,
    relatedGovSecureCodes: ['GS-AIPS-GOVERNAN-02', 'GS-AIPS-ENTERPRI-01', 'GS-CHKL-POLICYTO-15'],
    nistMappings: ['GOVERN-1.1', 'GOVERN-2.1', 'GOVERN-6.1'],
  },
  {
    slug: 'nist-ai-rmf/map',
    regulation: 'NIST AI RMF',
    article: 'MAP',
    title: 'MAP function — context and risk identification',
    officialUrl: 'https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook/Map',
    body: `**Plain-language summary**

MAP establishes the context within which AI risks emerge. It is the discovery function — before you can measure or manage a risk, you have to know it exists, who it affects, and what could go wrong.

**What it requires (for AI systems)**

MAP has five categories covering: context establishment, AI system categorisation, AI capabilities/limitations, impacts on individuals and groups, and risk identification including emergent risks.

For each AI system: document intended use and reasonably foreseeable misuse, identify affected populations (including non-users), inventory model capabilities and known limitations, and run an impact assessment (Article 35-style DPIA satisfies most of this).

**Practical implications**

MAP-3.4 (impact on individuals) and MAP-3.5 (human oversight feasibility) are the subcategories that map most directly to GDPR Article 22 and EU AI Act Article 14. Use a single combined assessment to satisfy all three.`,
    relatedGovSecureCodes: ['GS-AIPS-RISKASSE-04', 'GS-CHKL-INTAKETR-09', 'GS-CHKL-DPIASCRE-03'],
    nistMappings: ['MAP-1.1', 'MAP-3.4', 'MAP-3.5'],
  },
  {
    slug: 'nist-ai-rmf/measure',
    regulation: 'NIST AI RMF',
    article: 'MEASURE',
    title: 'MEASURE function — analysis, assessment, tracking',
    officialUrl: 'https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook/Measure',
    body: `**Plain-language summary**

MEASURE is the quantitative arm of the framework — turning identified risks into metrics, tests, and ongoing monitoring. It covers both technical evaluation (accuracy, robustness, bias) and socio-technical evaluation (impacts in deployment).

**What it requires (for AI systems)**

Four categories: identify appropriate methods and metrics; evaluate AI systems for trustworthy characteristics; track identified risks over time; gather feedback on measurement effectiveness.

Practically: define accuracy/fairness/robustness metrics with thresholds, run pre-deployment test suites (including adversarial), establish post-deployment monitoring with drift detection, and have a feedback channel from affected users.

**Practical implications**

MEASURE-2.11 (fairness/bias evaluation) is increasingly the focus of regulator scrutiny — be ready to produce disaggregated performance metrics across protected attributes. The framework does not prescribe which metric (demographic parity, equal opportunity, etc.) — you must justify your choice.`,
    relatedGovSecureCodes: ['GS-CHKL-MODELVAL-12', 'GS-CHKL-MONITORI-13', 'GS-AIPS-SECURITY-05'],
    nistMappings: ['MEASURE-2.1', 'MEASURE-2.7', 'MEASURE-2.11'],
  },
  {
    slug: 'nist-ai-rmf/manage',
    regulation: 'NIST AI RMF',
    article: 'MANAGE',
    title: 'MANAGE function — prioritisation, response, recovery',
    officialUrl: 'https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook/Manage',
    body: `**Plain-language summary**

MANAGE is the action function — taking the risks identified (MAP) and measured (MEASURE) and deciding what to do about them. It covers prioritisation, treatment, response to incidents, and lifecycle decisions including decommissioning.

**What it requires (for AI systems)**

Four categories: prioritise risks based on impact; manage AI risks based on plans, resources, and risk tolerance; manage risks from third-party AI; respond to and recover from AI incidents.

For AI systems: maintain a risk register with treatment decisions (accept / mitigate / transfer / avoid), define incident-response playbooks specific to AI failure modes (hallucination, drift, bias regression, jailbreaks), and plan for graceful decommissioning when the model is retired.

**Practical implications**

MANAGE-2.3 (mechanisms to override, disengage, or deactivate AI systems) is the "off switch" requirement — auditors will ask to see it demonstrated, not just documented. Tie this to your human-oversight design.`,
    relatedGovSecureCodes: ['GS-AIPS-INCIDENT-06', 'GS-CHKL-INCIDENT-07', 'GS-CHKL-CHANGEMA-02'],
    nistMappings: ['MANAGE-1.3', 'MANAGE-2.3', 'MANAGE-4.1'],
  },
];

export const REGULATION_LIBRARY_BY_SLUG: ReadonlyMap<string, RegulationEntry> = new Map(
  REGULATION_LIBRARY.map((entry) => [entry.slug, entry]),
);
