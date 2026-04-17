import { getClient, shouldUseLocalData } from "./client";

import * as queries from "./queries";

import * as localContent from "@/data/content";

import * as localTopics from "@/data/topics";



/**

 * Data fetching layer with automatic fallback to local data

 * When Sanity is not configured, uses local TypeScript data files

 */



// Fetch playbooks

export async function getPlaybooks() {

  if (shouldUseLocalData()) {

    return localContent.playbooks;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.playbooksQuery);

    return data || localContent.playbooks;

  } catch (error) {

    console.error("Error fetching playbooks:", error);

    return localContent.playbooks;

  }

}



// Fetch single playbook by slug

export async function getPlaybookBySlug(slug: string) {

  if (shouldUseLocalData()) {

    const playbook = localContent.playbooks.find((p) => p.slug === slug);

    if (!playbook) return null;

    

    // Enhance with mock content for detail page

    return {

      ...playbook,

      content: getPlaybookContent(playbook.id),

      relatedPlaybooks: localContent.playbooks

        .filter((p) => p.slug !== slug)

        .slice(0, 3),

    };

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.playbookBySlugQuery, { slug });

    return data;

  } catch (error) {

    console.error("Error fetching playbook:", error);

    return null;

  }

}



// Fetch categories with topics

export async function getCategories() {

  if (shouldUseLocalData()) {

    return localTopics.categories;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.categoriesQuery);

    return data || localTopics.categories;

  } catch (error) {

    console.error("Error fetching categories:", error);

    return localTopics.categories;

  }

}



// Fetch single category by slug

export async function getCategoryBySlug(slug: string) {

  if (shouldUseLocalData()) {

    return localTopics.getCategoryBySlug(slug) || null;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.categoryBySlugQuery, { slug });

    return data;

  } catch (error) {

    console.error("Error fetching category:", error);

    return localTopics.getCategoryBySlug(slug) || null;

  }

}



// Fetch single topic by slug

export async function getTopicBySlug(slug: string) {

  if (shouldUseLocalData()) {

    const topic = localTopics.getTopicBySlug(slug);

    if (!topic) return null;

    

    // Find parent category

    const category = localTopics.categories.find((c) =>

      c.topics.some((t) => t.slug === slug)

    );

    

    return {

      ...topic,

      content: getTopicContent(topic.id),

      category: category

        ? { name: category.name, slug: category.slug }

        : null,

      relatedTopics: category?.topics

        .filter((t) => t.slug !== slug)

        .slice(0, 3) || [],

    };

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.topicBySlugQuery, { slug });

    return data;

  } catch (error) {

    console.error("Error fetching topic:", error);

    return null;

  }

}



// Fetch templates

export async function getTemplates() {

  if (shouldUseLocalData()) {

    return localContent.templates;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.templatesQuery);

    return data || localContent.templates;

  } catch (error) {

    console.error("Error fetching templates:", error);

    return localContent.templates;

  }

}



// Fetch visual guides

export async function getVisualGuides() {

  if (shouldUseLocalData()) {

    return localContent.visualGuides;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.visualGuidesQuery);

    return data || localContent.visualGuides;

  } catch (error) {

    console.error("Error fetching visual guides:", error);

    return localContent.visualGuides;

  }

}



// Fetch audience cards

export async function getAudienceCards() {

  if (shouldUseLocalData()) {

    return localContent.audienceCards;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.audienceCardsQuery);

    return data || localContent.audienceCards;

  } catch (error) {

    console.error("Error fetching audience cards:", error);

    return localContent.audienceCards;

  }

}



// Fetch value propositions

export async function getValueProps() {

  if (shouldUseLocalData()) {

    return localContent.valueProps;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.valuePropsQuery);

    return data || localContent.valueProps;

  } catch (error) {

    console.error("Error fetching value props:", error);

    return localContent.valueProps;

  }

}



// Fetch hero content

export async function getHeroContent() {

  if (shouldUseLocalData()) {

    return localContent.heroContent;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.heroQuery);

    if (!data) return localContent.heroContent;

    

    return {

      headline: data.heroHeadline || localContent.heroContent.headline,

      subheadline: data.heroSubheadline || localContent.heroContent.subheadline,

      primaryCta: data.heroPrimaryCta || localContent.heroContent.primaryCta,

      secondaryCta: data.heroSecondaryCta || localContent.heroContent.secondaryCta,

      supportText: data.heroSupportText || localContent.heroContent.supportText,

    };

  } catch (error) {

    console.error("Error fetching hero content:", error);

    return localContent.heroContent;

  }

}



// Fetch trust badges

export async function getTrustBadges() {

  if (shouldUseLocalData()) {

    return localContent.trustBadges;

  }

  

  try {

    const client = getClient();

    const data = await client.fetch(queries.trustBadgesQuery);

    return data || localContent.trustBadges;

  } catch (error) {

    console.error("Error fetching trust badges:", error);

    return localContent.trustBadges;

  }

}



// Get all playbook slugs for static generation

export async function getAllPlaybookSlugs() {

  if (shouldUseLocalData()) {

    return localContent.playbooks.map((p) => p.slug);

  }

  

  try {

    const playbooks = await getPlaybooks();

    return playbooks

      .map((p: unknown) => {

        const slugValue = (p as { slug?: { current?: string } | string }).slug;

        return typeof slugValue === "string" ? slugValue : (slugValue?.current || "");

      })

      .filter(Boolean);

  } catch {

    return localContent.playbooks.map((p) => p.slug);

  }

}



// Get all topic slugs for static generation

export async function getAllTopicSlugs() {

  if (shouldUseLocalData()) {

    return localTopics.getAllTopics().map((t) => t.slug);

  }

  

  try {

    const categories = await getCategories();

    const slugs: string[] = [];

    categories.forEach((cat: unknown) => {

      const topics = (cat as { topics?: Array<{ slug?: { current?: string } | string }> }).topics;

      topics?.forEach((topic) => {

        const slugValue = topic.slug;

        slugs.push(typeof slugValue === "string" ? slugValue : (slugValue?.current || ""));

      });

    });

    return slugs.filter(Boolean);

  } catch {

    return localTopics.getAllTopics().map((t) => t.slug);

  }

}



// Get all category slugs for static generation

export async function getAllCategorySlugs() {

  if (shouldUseLocalData()) {

    return localTopics.categories.map((c) => c.slug);

  }

  

  try {

    const categories = await getCategories();

    return categories

      .map((c: unknown) => {

        const slugValue = (c as { slug?: { current?: string } | string }).slug;

        return typeof slugValue === "string" ? slugValue : (slugValue?.current || "");

      })

      .filter(Boolean);

  } catch {

    return localTopics.categories.map((c) => c.slug);

  }

}



// Authoritative content based on NIST AI RMF, EU AI Act, and ISO 42001

function getPlaybookContent(id: string): string {

  const contentMap: Record<string, string> = {

    "starter-pack": `

## Introduction



This 90-day blueprint aligns with the **NIST AI Risk Management Framework (AI RMF)**, **ISO/IEC 42001:2023**, and prepares your organization for **EU AI Act** compliance. The phased approach moves you from NIST Tier 1 (Partial) toward Tier 2 (Risk Informed) maturity.



## Phase 1: Foundation (Days 1-30) - NIST GOVERN Function



### Week 1-2: AI Discovery and Inventory

- **Catalog all AI tools** currently in use across the organization

- **Identify shadow AI** usage through department surveys and network analysis

- **Document use cases** including business purpose, data inputs/outputs, and decision types

- Map each AI system to ISO 42001 Clause 4.3 (AIMS Scope) requirements



### Week 3-4: Initial Risk Assessment (NIST MAP Function)

- Apply **EU AI Act risk classification** framework:

  - Prohibited practices (Article 5)

  - High-risk systems (Annex III areas: employment, education, essential services, law enforcement)

  - Limited risk (transparency obligations)

  - Minimal risk (no specific requirements)

- Document intended purposes and potential impacts per NIST MAP-1

- Identify stakeholders affected by each AI system per NIST MAP-2



## Phase 2: Framework Development (Days 31-60) - ISO 42001 Alignment



### Week 5-6: Policy Development (ISO 42001 Clause 5)

- Draft **AI Policy** per ISO 42001 Clause 5.2 requirements

- Establish **AI Acceptable Use Policy** covering:

  - Approved use cases and prohibited activities

  - Data handling requirements

  - Human oversight requirements

- Define **roles and responsibilities** per ISO 42001 Clause 5.3 and NIST GOVERN-2



### Week 7-8: Risk Management Framework (ISO 42001 Clause 6)

- Develop **AI risk assessment methodology** per ISO 42001 Clause 6.1.2

- Create **AI impact assessment process** per ISO 42001 Clause 6.1.4

- Establish **risk appetite and tolerance thresholds**

- Design **approval workflows** with risk-based tiering



## Phase 3: Implementation (Days 61-90) - NIST MEASURE & MANAGE



### Week 9-10: Pilot and Monitoring (NIST MEASURE Function)

- Deploy governance framework in **pilot department**

- Implement **monitoring mechanisms** per NIST MEASURE-3:

  - Performance drift detection

  - Incident detection and reporting

  - User feedback collection

- Test **human oversight mechanisms** per EU AI Act Article 14



### Week 11-12: Rollout and Continuous Improvement (NIST MANAGE Function)

- **Roll out organization-wide** with training sessions

- Establish **incident response procedures** per NIST MANAGE-2

- Create **continuous improvement processes** per ISO 42001 Clause 10

- Schedule **quarterly governance reviews** and annual internal audits (ISO 42001 Clause 9.2)



## Key Success Factors



1. **Executive Sponsorship** - ISO 42001 Clause 5.1 requires top management commitment

2. **Cross-functional Team** - Include IT, Legal, Compliance, HR, and business units per NIST GOVERN-2

3. **Risk-Based Approach** - Prioritize based on EU AI Act risk classification

4. **Documentation** - Maintain records per ISO 42001 Clause 7.5 for potential certification

5. **Regulatory Timeline** - EU AI Act high-risk requirements effective August 2026

    `,

    "spreadsheets-policies": `

## The Challenge



Many organizations track AI usage informally—scattered spreadsheets, email threads, and tribal knowledge. This guide transforms that chaos into a structured **AI Use Case Registry** aligned with NIST AI RMF MAP function and ISO 42001 documentation requirements.



## Step 1: AI Discovery and Inventory (NIST MAP-1)



Gather existing AI documentation following NIST AI RMF MAP function guidance:

- **Department surveys** - Anonymous surveys about AI tool usage

- **Network analysis** - Traffic to known AI service domains

- **Expense review** - Credit card statements for AI subscriptions

- **Vendor contracts** - Review procurement for AI components

- **IT asset inventory** - Catalog systems with AI/ML capabilities



## Step 2: Create Unified Schema (ISO 42001 Clause 7.5)



Design a standardized format per ISO 42001 documented information requirements:



| Field | Description | Source |

|-------|-------------|--------|

| System ID | Unique identifier | Internal |

| Name/Description | Tool or model name | NIST MAP-1.1 |

| Business Purpose | Intended use case | NIST MAP-1.1 |

| Data Inputs | What data is processed | EU AI Act Art. 10 |

| Data Outputs | What decisions/content generated | NIST MAP-3.3 |

| EU AI Act Risk Class | Prohibited/High/Limited/Minimal | EU AI Act Art. 6 |

| Human Oversight Level | Full/Partial/None | EU AI Act Art. 14 |

| Owner | Business accountable party | ISO 42001 Cl. 5.3 |

| Approval Status | Pending/Approved/Restricted | Internal workflow |



## Step 3: Build Your Use Case Registry (NIST MAP-2)



Transform consolidated data into a living registry that:

- **Documents stakeholder impacts** per NIST MAP-2.1 and MAP-2.2

- **Tracks AI system lifecycle** from development to retirement

- **Links to risk assessments** per ISO 42001 Clause 6.1.2

- **Enables EU AI Act compliance reporting** for high-risk systems

- **Supports audit trails** per ISO 42001 Clause 9.2



## Step 4: Establish Governance Workflows (NIST GOVERN)



Create risk-tiered processes per NIST GOVERN function:



### New AI Request Workflow

1. **Intake** - Requester completes use case form

2. **Risk Classification** - Apply EU AI Act risk categories

3. **Review** - Risk-appropriate approval (auto-approve minimal risk, committee for high-risk)

4. **Documentation** - Add to registry with all required fields

5. **Monitoring** - Assign to monitoring schedule based on risk level



### Periodic Review Cadence

- **High-risk systems**: Quarterly review per EU AI Act post-market monitoring

- **Limited-risk systems**: Semi-annual review

- **Minimal-risk systems**: Annual review



### Incident Response (NIST MANAGE-2)

- Incident detection and escalation procedures

- Root cause analysis requirements

- Regulatory notification timelines (EU AI Act serious incident reporting)

    `,

    "aup-design": `

## What is an AI Acceptable Use Policy?



An AI Acceptable Use Policy (AUP) is a formal governance document aligned with **ISO 42001 Clause 5.2 (AI Policy)** requirements and **NIST AI RMF GOVERN function**. It establishes organizational boundaries for responsible AI use while enabling innovation.



## Why You Need One



Per ISO 42001 and EU AI Act requirements, organizations must:

- Establish **clear boundaries** for AI system use per ISO 42001 Clause 5.2

- Ensure **transparency obligations** are met per EU AI Act Article 52

- Implement **human oversight** mechanisms per EU AI Act Article 14

- Document **accountability structures** per NIST GOVERN-2

- Comply with **GDPR Article 22** for automated decision-making



## Core Policy Components (ISO 42001 Aligned)



### 1. Scope and Definitions (ISO 42001 Clause 4.3)

- **AI System Definition**: Per EU AI Act Article 3(1) - "machine-based system designed to operate with varying levels of autonomy and that may exhibit adaptiveness after deployment"

- **Covered Tools**: ChatGPT, Copilot, Gemini, internal ML models, third-party AI services

- **Applicability**: All employees, contractors, and third parties accessing organizational systems



### 2. Risk-Based Use Case Classification (EU AI Act)

| Risk Level | Examples | Requirements |

|------------|----------|--------------|

| **Prohibited** | Social scoring, emotion recognition in workplace (except safety) | Banned - no use permitted |

| **High-Risk** | CV screening, credit decisions, performance evaluation | Full compliance per EU AI Act Articles 9-15 |

| **Limited Risk** | Chatbots, content generation | Transparency disclosure required |

| **Minimal Risk** | Spam filters, recommendation engines | Standard approval process |



### 3. Prohibited Activities (EU AI Act Article 5)

- **Manipulation**: Using subliminal techniques to materially distort behavior

- **Exploitation**: Targeting vulnerabilities of specific groups

- **Biometric categorization** to infer protected characteristics

- **Real-time biometric identification** in public spaces

- Inputting **confidential/PII data** into unapproved external AI systems

- **Automated decisions** with legal effects without human oversight (GDPR Art. 22)



### 4. Data Handling Requirements (GDPR + EU AI Act)

- **Data minimization**: Only input data necessary for the task

- **Classification compliance**: Respect data classification levels

- **Personal data**: Requires DPIA and legal basis per GDPR

- **Retention**: AI-generated outputs follow standard retention schedules

- **Third-party AI**: Verify data processing agreements are in place



### 5. Human Oversight Requirements (EU AI Act Article 14)

- High-risk AI outputs must be reviewed by qualified personnel

- Override/intervention capability must be maintained

- Automated decisions affecting individuals require human review

- Documentation of human oversight actions



### 6. Transparency Obligations (EU AI Act Article 52)

- Users must be informed when interacting with AI chatbots

- AI-generated content must be identifiable

- Deep fakes must be clearly labeled

- Emotion recognition systems must disclose their operation



## Approval Workflow (NIST GOVERN-1)



| Use Case Risk | Approval Authority | Timeline |

|---------------|-------------------|----------|

| Minimal Risk | Direct manager | 1-2 days |

| Limited Risk | Department head + IT Security | 1 week |

| High Risk | AI Governance Committee | 2-4 weeks |



## Implementation Checklist



1. ☐ Draft policy with Legal, Compliance, and IT Security review

2. ☐ Obtain executive sign-off per ISO 42001 Clause 5.1

3. ☐ Develop training materials for AI literacy per EU AI Act Article 4

4. ☐ Conduct organization-wide training sessions

5. ☐ Establish feedback mechanism and policy exceptions process

6. ☐ Schedule quarterly policy reviews per ISO 42001 Clause 9.3

7. ☐ Document policy in AIMS records per ISO 42001 Clause 7.5



## Sample Policy Language



> "Employees may use approved AI tools for work-related tasks in accordance with this policy and applicable data classification requirements. High-risk AI use cases require AI Governance Committee approval. All AI-generated content intended for external distribution must be reviewed by a qualified human before release. Users interacting with AI-powered interfaces must be informed of the AI involvement per EU AI Act transparency requirements."

    `,

    "shadow-ai": `

## The Shadow AI Problem



Shadow AI refers to AI tools used without governance oversight—a critical gap that creates compliance risks under the **EU AI Act** and undermines **ISO 42001 AIMS** requirements. Per NIST AI RMF GOVERN-1, organizations must identify and document all AI systems in use.



## Why Shadow AI Happens



- **Productivity pressure**: Employees seek efficiency gains

- **Easy access**: Public AI tools require no procurement

- **Governance gaps**: No approved alternatives or unclear policies

- **Innovation desire**: Teams experiment without waiting for formal approval



## The Risks (NIST AI RMF Risk Categories)



### Data Protection Risks (GDPR + EU AI Act)

- **Personal data exposure**: Employees input PII into external AI systems

- **Data transfer violations**: Non-EU AI services may lack adequate safeguards

- **Training data concerns**: Inputs may be used to train third-party models

- **GDPR Article 22**: Automated decisions without proper legal basis



### Compliance Violations

- **EU AI Act**: Unassessed AI systems may be high-risk without required controls

- **Sector regulations**: Healthcare (HIPAA), Financial (SOX, PCI-DSS), etc.

- **Contractual obligations**: Client NDAs and data processing agreements

- **ISO 42001**: Non-conformity with AIMS scope requirements (Clause 4.3)



### Operational Risks (NIST MAP-2)

- **No audit trail**: Unable to demonstrate compliance to regulators

- **Quality issues**: Unvalidated AI outputs affecting business decisions

- **IP concerns**: Unclear ownership of AI-generated content

- **Integration risks**: Unvetted AI tools in critical workflows



## Detection Strategies (NIST MAP Function)



### Technical Detection

- **Network monitoring**: Track traffic to AI service domains (openai.com, anthropic.com, etc.)

- **DLP integration**: Flag AI-related data transfers in Data Loss Prevention tools

- **Browser analysis**: Review extension installations and web activity

- **API monitoring**: Detect unauthorized AI API calls



### Administrative Detection

- **Employee surveys**: Anonymous surveys with amnesty for disclosure

- **Department interviews**: Structured conversations about AI usage

- **Expense analysis**: Review credit card statements, procurement requests

- **Exit interviews**: Capture AI tool knowledge from departing employees



## Remediation Framework (NIST MANAGE Function)



### Phase 1: Discovery Amnesty (Weeks 1-2)

- Announce **no-penalty disclosure period** for shadow AI usage

- Communicate business rationale (compliance, not punishment)

- Provide simple disclosure mechanism (form or email)

- Executive sponsorship of amnesty program



### Phase 2: Risk Assessment (Weeks 3-4)

- Apply **EU AI Act risk classification** to disclosed tools

- Conduct **rapid risk triage** per ISO 42001 Clause 6.1.2:

  - Critical: Prohibited practices or high-risk without controls

  - High: Personal data processing or significant business impact

  - Medium: Limited risk with transparency gaps

  - Low: Minimal risk, documentation needed only

- Document findings per NIST MAP function requirements



### Phase 3: Remediation (Weeks 5-8)

| Risk Level | Action | Timeline |

|------------|--------|----------|

| Critical | Immediate cessation, incident investigation | 24-48 hours |

| High | Formal assessment, implement controls or restrict | 2 weeks |

| Medium | Add to registry, implement transparency measures | 4 weeks |

| Low | Document and approve with standard workflow | 6 weeks |



### Phase 4: Prevention (Ongoing)

- Deploy **approved AI alternatives** that meet employee needs

- Publish **approved tool list** with clear guidance

- Implement **continuous monitoring** per NIST MEASURE-3

- Establish **regular awareness training** per NIST GOVERN-3

- Update policies based on emerging tool landscape

    `,

    "executive-guide": `

## AI Governance for the C-Suite



This guide addresses **ISO 42001 Clause 5.1 (Leadership and Commitment)** requirements and helps executives fulfill their mandatory role in AI governance under the **EU AI Act** and **NIST AI RMF GOVERN function**.



## Why Executives Must Lead



Per ISO 42001 Clause 5.1, top management must demonstrate leadership and commitment by:

- Ensuring the **AI policy and objectives** are established and compatible with strategic direction

- Ensuring **integration of AIMS requirements** into business processes

- Ensuring **resources are available** for the AI Management System

- Communicating the **importance of effective AI governance**

- Ensuring the AIMS **achieves its intended outcomes**

- Directing and supporting persons to **contribute to AIMS effectiveness**



## Regulatory Context



### EU AI Act Timeline (Critical Dates)

| Date | Milestone | Executive Action Required |

|------|-----------|--------------------------|

| Feb 2025 | Prohibited practices effective | Ensure no prohibited AI uses |

| Aug 2025 | GPAI rules apply | Assess general-purpose AI model compliance |

| Aug 2026 | High-risk AI rules apply | Full compliance for high-risk systems |

| Aug 2027 | Annex I products | Regulated product integration |



### Penalties for Non-Compliance

- **Prohibited practices**: Up to €35 million or 7% global turnover

- **High-risk violations**: Up to €15 million or 3% global turnover

- **Incorrect information**: Up to €7.5 million or 1.5% global turnover



## Key Executive Responsibilities (NIST GOVERN Function)



### 1. Set Strategic Direction (NIST GOVERN-1)

- Approve **AI policy** per ISO 42001 Clause 5.2

- Define **organizational risk appetite** for AI applications

- Articulate **ethical principles** aligned with NIST trustworthy AI characteristics

- Ensure alignment with **business strategy and objectives**



### 2. Establish Governance Structure (NIST GOVERN-2)

- Appoint **AI Governance Lead** or designate accountability

- Charter **AI Governance Committee** with cross-functional representation

- Define **decision rights and escalation paths**

- Establish **reporting lines to board/audit committee**



### 3. Allocate Resources (ISO 42001 Clause 7.1)

- Budget for **governance tools and technology**

- Dedicate **staff capacity** (recommend 0.25-1 FTE minimum for SMBs)

- Invest in **training and competency development** per ISO 42001 Clause 7.2

- Plan for **external audit and certification** if pursuing ISO 42001



### 4. Monitor and Review (ISO 42001 Clause 9.3)

- Conduct **management reviews** at planned intervals

- Review **risk dashboards and KPIs** quarterly

- Assess **regulatory developments** (EU AI Act, sector-specific)

- Approve **policy updates** based on lessons learned



## Board-Level Considerations



### Essential Questions for Directors

1. What AI systems are deployed and for what purposes? (NIST MAP inventory)

2. Which systems are classified as **high-risk under EU AI Act**?

3. What is our **AI risk exposure** and how is it being managed?

4. Do we have adequate **human oversight** mechanisms in place?

5. Are we prepared for **EU AI Act August 2026 deadline**?

6. What is our **incident response capability** for AI failures?



### Board Reporting Framework

| Report | Frequency | Content |

|--------|-----------|---------|

| AI Risk Dashboard | Quarterly | Risk metrics, incidents, compliance status |

| Governance Assessment | Annual | AIMS effectiveness, audit findings, maturity |

| Incident Reports | As needed | Significant incidents, response actions, lessons |

| Regulatory Update | Semi-annual | EU AI Act, NIST, ISO developments |



## Building Your AI Governance Team



### Core Roles (ISO 42001 Clause 5.3)

- **AI Governance Lead**: Coordinates AIMS implementation and reporting

- **Technical AI Lead**: Provides expertise on AI capabilities and limitations

- **Legal/Compliance**: Ensures regulatory compliance (EU AI Act, GDPR)

- **Privacy Officer**: Addresses data protection requirements

- **Risk Management**: Integrates AI risks into enterprise risk framework



### Committee Structure

**AI Governance Committee** - Monthly meetings with:

- Executive sponsor (CEO/COO/CTO)

- IT/Engineering representative

- Legal and Compliance

- Risk Management

- HR (for employment-related AI)

- Business unit representatives

- Privacy/Security



### Maturity Progression (NIST AI RMF Tiers)

| Tier | Description | Timeline Target |

|------|-------------|-----------------|

| Tier 1: Partial | Ad hoc, reactive | Current state |

| Tier 2: Risk Informed | Practices approved, not policy | 6 months |

| Tier 3: Repeatable | Formal policy established | 12 months |

| Tier 4: Adaptive | Continuous improvement | 18-24 months |

    `,

  };

  

  return contentMap[id] || `

## Overview



This content provides guidance aligned with **NIST AI Risk Management Framework**, **EU AI Act (Regulation 2024/1689)**, and **ISO/IEC 42001:2023** AI Management System standards.



## Getting Started



1. Assess your current AI landscape using NIST MAP function

2. Classify AI systems under EU AI Act risk categories

3. Establish governance structure per ISO 42001 requirements

4. Implement risk-based controls per NIST MANAGE function



## Key Frameworks



- **NIST AI RMF**: Voluntary US framework with GOVERN, MAP, MEASURE, MANAGE functions

- **EU AI Act**: Mandatory EU regulation with risk-based classification

- **ISO 42001**: International standard for AI Management Systems

  `;

}



function getTopicContent(id: string): string {

  const contentMap: Record<string, string> = {

    "governance-charter": `

## What is an AI Governance Charter?



An AI Governance Charter is the foundational document required by **ISO 42001 Clause 5.2 (AI Policy)** and aligned with **NIST AI RMF GOVERN function**. It establishes your organization's commitment to responsible AI and defines the governance framework.



## Key Components (ISO 42001 Aligned)



### 1. Purpose and Scope (ISO 42001 Clause 4.3)

- Define the **boundaries of your AI Management System (AIMS)**

- Specify which AI systems, processes, and organizational units are covered

- Document **applicability and exclusions** with justification



### 2. AI Policy Statement (ISO 42001 Clause 5.2)

Per ISO 42001, the AI policy must:

- Be **appropriate to the purpose** of the organization

- Provide a **framework for setting AI objectives**

- Include commitment to **satisfying applicable requirements**

- Include commitment to **continual improvement** of the AIMS



### 3. Governance Principles (NIST Trustworthy AI Characteristics)

Align with NIST AI RMF trustworthy characteristics:

- **Valid and Reliable**: AI systems perform as intended

- **Safe**: Systems do not cause harm

- **Secure and Resilient**: Protection against attacks and failures

- **Accountable and Transparent**: Clear responsibility and explainability

- **Privacy-Enhanced**: Protection of personal data

- **Fair**: Managed bias and equitable treatment



### 4. Governance Structure (ISO 42001 Clause 5.3 + NIST GOVERN-2)

- **AI Governance Committee**: Charter, membership, meeting cadence

- **Roles and Responsibilities**: AI Governance Lead, Technical Lead, Legal/Compliance

- **Decision Rights**: Approval authorities by risk level

- **Escalation Procedures**: Pathways for risk escalation



### 5. Risk Framework (ISO 42001 Clause 6.1)

- **Risk appetite statement**: Organizational tolerance for AI risks

- **Risk classification**: Alignment with EU AI Act categories

- **Assessment methodology**: Per ISO 42001 Clause 6.1.2

- **Impact assessment**: Per ISO 42001 Clause 6.1.4



### 6. Regulatory Compliance Commitment

- **EU AI Act**: Commitment to comply with applicable requirements

- **GDPR**: Data protection obligations for AI systems

- **Sector-specific**: Industry regulations as applicable



## Implementation Steps



1. **Stakeholder engagement**: Cross-functional input per NIST GOVERN-2

2. **Draft charter**: Legal, Compliance, and executive review

3. **Executive approval**: Top management sign-off per ISO 42001 Clause 5.1

4. **Communication**: Organization-wide distribution per ISO 42001 Clause 7.4

5. **Training**: AI literacy program per EU AI Act Article 4

6. **Annual review**: Management review per ISO 42001 Clause 9.3

    `,

    "prompt-injection": `

## Understanding Prompt Injection



Prompt injection is a critical AI security vulnerability addressed in **NIST AI RMF MEASURE function** (security and resilience testing) and relevant to **EU AI Act Article 15** requirements for accuracy, robustness, and cybersecurity. It occurs when malicious inputs manipulate LLM behavior to bypass intended constraints.



## Types of Attacks (NIST AI RMF Security Considerations)



### Direct Prompt Injection

User directly inputs malicious prompts to override system instructions:

- **Jailbreaking**: Bypassing content filters and safety guardrails

- **Instruction override**: "Ignore previous instructions and..."

- **Role manipulation**: Convincing the model to adopt unauthorized personas



### Indirect Prompt Injection

Malicious content embedded in external data sources:

- **Data poisoning**: Malicious content in retrieved documents

- **Hidden instructions**: Invisible text in web pages or documents

- **API manipulation**: Compromised external data feeds



## EU AI Act Compliance Implications



Per **EU AI Act Article 15** (Accuracy, Robustness, Cybersecurity):

- High-risk AI systems must achieve appropriate **cybersecurity levels**

- Systems must be **resilient against unauthorized third-party attempts**

- Must address **vulnerabilities specific to AI systems**



## Prevention Strategies (NIST MEASURE Function Aligned)



### 1. Input Validation and Sanitization

- Implement **input length limits** and character filtering

- Use **content classification** to detect malicious patterns

- Apply **semantic analysis** to identify injection attempts



### 2. Output Filtering and Monitoring

- Implement **output guardrails** to block sensitive information

- Use **secondary model review** for high-risk outputs

- Log all interactions per **ISO 42001 Clause 7.5** documentation requirements



### 3. Architecture-Level Controls

- **Privilege separation**: Limit AI system access to sensitive data and functions

- **Least privilege**: AI systems should have minimal necessary permissions

- **Sandboxing**: Isolate AI execution environments



### 4. Prompt Hardening

- Use **system prompts** that are resistant to override attempts

- Implement **prompt injection detection** in preprocessing

- Apply **context boundaries** between user input and system instructions



## Monitoring and Detection (NIST MEASURE-3)



### Continuous Monitoring Requirements

- **Log all AI interactions** for audit trail per ISO 42001 Clause 9.1

- Implement **anomaly detection** for unusual prompt patterns

- **Real-time alerting** for suspected injection attempts

- Regular **security assessments** per NIST MEASURE-2.3



### Incident Response (NIST MANAGE-2)

- Document **incident classification** for prompt injection attacks

- Establish **escalation procedures** for security incidents

- Maintain **remediation playbooks** for common attack vectors

    `,

    "use-case-registry": `

## What is an AI Use Case Registry?



An AI Use Case Registry is a centralized inventory required by **NIST AI RMF MAP function** and essential for **EU AI Act compliance**. Per EU AI Act Article 49, providers of high-risk AI systems must register in the EU database. ISO 42001 Clause 4.3 requires defining the scope of your AIMS, which necessitates inventory.



## Why You Need One



### Regulatory Mandate (EU AI Act)

- **Article 49**: High-risk AI systems must be registered in EU database

- **Article 11**: Technical documentation must be maintained

- **Article 12**: Record-keeping throughout the lifecycle



### NIST AI RMF Alignment (MAP Function)

- **MAP-1**: Document intended purposes and context

- **MAP-2**: Identify stakeholders and impacts

- **MAP-3**: Understand AI system characteristics



### ISO 42001 Requirements

- **Clause 4.3**: Define AIMS scope including AI systems covered

- **Clause 7.5**: Maintain documented information

- **Clause 8.1**: Operational planning and control



## Registry Components (EU AI Act + NIST Aligned)



### Basic Information (EU AI Act Article 11)

| Field | Description | Source |

|-------|-------------|--------|

| System ID | Unique identifier | Internal |

| Name | AI system name | EU AI Act Art. 11(1)(a) |

| Provider | Vendor or internal | EU AI Act Art. 11(1)(b) |

| Version | Current version number | EU AI Act Art. 11(1)(c) |

| Deployment Date | When put into service | EU AI Act Art. 49 |

| Business Owner | Accountable executive | ISO 42001 Cl. 5.3 |

| Technical Owner | System administrator | ISO 42001 Cl. 5.3 |



### Use Case Details (NIST MAP-1)

| Field | Description | Source |

|-------|-------------|--------|

| Business Purpose | Intended use case | NIST MAP-1.1 |

| Intended Users | Who operates the system | EU AI Act Art. 13 |

| Decision Types | What decisions supported | NIST MAP-1.1 |

| Human Oversight | Level of human control | EU AI Act Art. 14 |

| Affected Stakeholders | Who is impacted | NIST MAP-2 |



### Technical Details (EU AI Act Article 11)

| Field | Description | Source |

|-------|-------------|--------|

| Model Type | Classification, generation, etc. | EU AI Act Art. 11(1)(d) |

| Training Data | Data sources and characteristics | EU AI Act Art. 10 |

| Input Specifications | What data is processed | EU AI Act Art. 11(1)(e) |

| Output Specifications | What is generated | EU AI Act Art. 11(1)(e) |

| Integration Points | Connected systems | NIST MAP-3 |

| Performance Metrics | Accuracy, reliability measures | EU AI Act Art. 15 |



### Risk Classification (EU AI Act Article 6)

| Field | Description | Source |

|-------|-------------|--------|

| EU AI Act Risk Class | Prohibited/High/Limited/Minimal | EU AI Act Art. 6 |

| Annex III Area | High-risk use case category | EU AI Act Annex III |

| Data Sensitivity | PII, confidential, public | GDPR alignment |

| Impact Level | Organizational impact rating | ISO 42001 Cl. 6.1.4 |

| Bias Assessment | Fairness testing status | NIST MEASURE-2.1 |

| Last Review Date | Most recent risk review | ISO 42001 Cl. 9.1 |



## Building Your Registry (NIST MAP Function Process)



### Step 1: Discovery (NIST MAP-1)

- Survey departments about AI tool usage

- Review IT asset inventories

- Analyze network traffic to AI services

- Review procurement and expense records

- Conduct shadow AI amnesty program



### Step 2: Classification (EU AI Act Article 6)

- Apply EU AI Act risk classification framework

- Identify prohibited practices (Article 5)

- Determine high-risk status (Annex III)

- Document transparency obligations (Article 52)



### Step 3: Documentation (ISO 42001 Clause 7.5)

- Populate registry with required fields

- Link to technical documentation

- Attach risk assessments

- Document human oversight mechanisms



### Step 4: Validation (NIST MAP-2)

- Verify with system owners

- Confirm stakeholder impact assessment

- Validate risk classifications

- Review with Legal/Compliance



### Step 5: Maintenance (ISO 42001 Clause 10.1)

- Establish update triggers (new systems, changes)

- Schedule periodic reviews (quarterly for high-risk)

- Integrate with change management processes

- Plan for EU database registration (high-risk systems)

    `,

    "nist-ai-rmf": `

## NIST AI Risk Management Framework Overview



The **NIST AI Risk Management Framework (AI RMF 1.0)**, released January 2023, is a voluntary framework providing structured guidance for managing AI risks. It complements **ISO 42001** and aligns with **EU AI Act** requirements for risk management systems.



## Framework Structure



### Core Functions



#### 1. GOVERN (Organizational Culture)

Cultivate and implement a culture of AI risk management:

- **GV-1**: Policies, processes, and practices for AI risk management

- **GV-2**: Accountability structures and oversight processes

- **GV-3**: Workforce training and competency development

- **GV-4**: Third-party and supply chain risk management



#### 2. MAP (Context Understanding)

Understand context for AI systems to identify risks:

- **MP-1**: Document intended purposes, benefits, and limitations

- **MP-2**: Identify stakeholders and potential negative impacts

- **MP-3**: Understand AI system technical characteristics



#### 3. MEASURE (Risk Assessment)

Employ methods to analyze and monitor AI risks:

- **MS-1**: Establish risk assessment methodologies and metrics

- **MS-2**: Test and evaluate AI systems (bias, performance, security)

- **MS-3**: Implement continuous monitoring for deployed systems



#### 4. MANAGE (Risk Treatment)

Allocate resources to manage risks and maximize benefits:

- **MG-1**: Prioritize and treat AI risks

- **MG-2**: Establish incident response procedures

- **MG-3**: Enable continuous improvement processes



## Trustworthy AI Characteristics



The framework defines seven characteristics:

1. **Valid and Reliable**: Performs as intended consistently

2. **Safe**: Does not cause harm to people or environment

3. **Secure and Resilient**: Resists attacks and recovers from failures

4. **Accountable and Transparent**: Clear responsibility and explainability

5. **Explainable and Interpretable**: Outputs understandable by users

6. **Privacy-Enhanced**: Protects individual privacy and data

7. **Fair with Harmful Bias Managed**: Equitable treatment



## Maturity Tiers



| Tier | Name | Description |

|------|------|-------------|

| 1 | Partial | Ad hoc, reactive approach |

| 2 | Risk Informed | Practices approved but not policy |

| 3 | Repeatable | Formally approved as policy |

| 4 | Adaptive | Continuous improvement based on lessons learned |



## Framework Alignment



| NIST AI RMF | ISO 42001 | EU AI Act |

|-------------|-----------|-----------|

| GOVERN | Clause 5 (Leadership) | Article 9 (Risk Management) |

| MAP | Clause 6.1.4 (Impact Assessment) | Article 10 (Data Governance) |

| MEASURE | Clause 9 (Performance Evaluation) | Article 15 (Accuracy/Robustness) |

| MANAGE | Clause 8 + 10 (Operation/Improvement) | Article 17 (Quality Management) |



## Implementation Roadmap



### Phase 1: Foundation (Months 1-3)

- Assess current maturity against tiers

- Conduct AI inventory (MAP function)

- Establish governance structure (GOVERN function)



### Phase 2: Development (Months 4-6)

- Develop risk assessment methodology (MEASURE)

- Create policies aligned with GOVERN requirements

- Implement documentation per MAP requirements



### Phase 3: Operations (Months 7-12)

- Deploy monitoring capabilities (MEASURE-3)

- Establish incident response (MANAGE-2)

- Target Tier 2-3 maturity

    `,

    "eu-ai-act": `

## EU AI Act (Regulation 2024/1689)



The **EU AI Act** is the world's first comprehensive AI regulation, establishing a risk-based framework that applies to AI systems placed on the EU market or put into service in the EU. It entered into force **August 1, 2024**.



## Risk Classification Framework (Article 6)



### Unacceptable Risk - PROHIBITED (Article 5)

**Effective: February 2, 2025**



| Practice | Description |

|----------|-------------|

| Manipulation | Subliminal, manipulative, or deceptive techniques causing significant harm |

| Exploitation | Targeting vulnerabilities due to age, disability, or social/economic situation |

| Social Scoring | Evaluating persons based on social behavior leading to detrimental treatment |

| Predictive Policing | Individual risk assessment based solely on profiling |

| Facial Recognition Scraping | Untargeted scraping of internet/CCTV for facial databases |

| Emotion Recognition | In workplace/education (except medical/safety) |

| Biometric Categorization | Inferring race, political opinions, religious beliefs, sexual orientation |

| Real-time Biometric ID | In public spaces for law enforcement (narrow exceptions) |



### High Risk - HEAVILY REGULATED (Annex III)

**Effective: August 2, 2026**



**Eight High-Risk Use Case Areas:**

1. **Biometrics**: Remote identification, emotion recognition, categorization

2. **Critical Infrastructure**: Road traffic, water/gas/electricity supply safety

3. **Education**: Access determination, learning evaluation, cheating detection

4. **Employment**: CV screening, job ads, performance evaluation, task allocation

5. **Essential Services**: Credit scoring, insurance risk, emergency dispatch

6. **Law Enforcement**: Evidence evaluation, reoffending risk, crime analytics

7. **Migration/Border**: Visa examination, asylum assessment, border risk

8. **Justice/Democracy**: Legal research, applying law to facts, dispute resolution



### Limited Risk - TRANSPARENCY OBLIGATIONS (Article 52)

- **Chatbots**: Users must be informed of AI interaction

- **AI-Generated Content**: Must be identifiable as artificially generated

- **Deep Fakes**: Must be clearly labeled

- **Emotion Recognition**: Must disclose operation to affected persons



### Minimal Risk - NO SPECIFIC OBLIGATIONS

- AI-enabled games, spam filters, recommendation engines, most business applications



## High-Risk AI Requirements (Articles 9-15)



| Article | Requirement | Description |

|---------|-------------|-------------|

| Art. 9 | Risk Management System | Continuous iterative process throughout lifecycle |

| Art. 10 | Data Governance | Training data must be relevant, representative, error-free |

| Art. 11 | Technical Documentation | Demonstrate compliance before market placement |

| Art. 12 | Record-Keeping | Automatic logging for traceability |

| Art. 13 | Transparency | Clear information on capabilities and limitations |

| Art. 14 | Human Oversight | Effective oversight by natural persons |

| Art. 15 | Accuracy/Robustness | Appropriate levels throughout lifecycle |

| Art. 17 | Quality Management | Systematic compliance procedures |



## General-Purpose AI Models (Articles 51-56)

**Effective: August 2, 2025**



**All GPAI Providers:**

- Maintain technical documentation

- Provide information to downstream providers

- Comply with copyright law

- Publish training content summary



**Systemic Risk GPAI (additional):**

- Perform model evaluations

- Assess and mitigate systemic risks

- Report serious incidents

- Ensure adequate cybersecurity



## Implementation Timeline



| Date | Milestone |

|------|-----------|

| Aug 1, 2024 | AI Act enters into force |

| Feb 2, 2025 | **Prohibited practices apply** |

| Aug 2, 2025 | GPAI rules and governance apply |

| Aug 2, 2026 | **High-risk AI system rules apply** |

| Aug 2, 2027 | High-risk in regulated products (Annex I) |



## Penalties (Article 99)



| Violation | Maximum Penalty |

|-----------|-----------------|

| Prohibited practices | €35M or 7% global turnover |

| High-risk violations | €15M or 3% global turnover |

| Incorrect information | €7.5M or 1.5% global turnover |

| SMEs/Startups | Proportionate caps apply |



## Governance Structure



- **European AI Office**: GPAI model oversight

- **European AI Board**: EU-wide coherence and cooperation

- **National Authorities**: AI system enforcement

- **Scientific Panel**: Expert advisory input

    `,

    "model-cards": `

## Model Cards: AI System Documentation



Model cards are standardized documentation aligned with **EU AI Act Article 11 (Technical Documentation)** and **NIST AI RMF MAP function** requirements. They provide transparency about AI system capabilities, limitations, and intended use.



## Regulatory Alignment



### EU AI Act Requirements (Article 11)

For high-risk AI systems, technical documentation must include:

- General description and intended purpose

- Design specifications and development methodology

- Data governance and training data characteristics

- Performance metrics and testing results

- Human oversight measures

- Expected lifetime and maintenance requirements



### NIST AI RMF Alignment (MAP Function)

- **MAP-1**: Document intended purposes and context

- **MAP-3**: Understand and document AI system characteristics

- Support **MEASURE** function with performance metrics



### ISO 42001 Requirements (Clause 7.5)

- Documented information for AIMS effectiveness

- Records of AI system development and operation



## Model Card Components



### 1. Model Details (EU AI Act Art. 11(1)(a-c))

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Name and Version | Unique identifier | EU AI Act Art. 11(1)(a) |

| Model Type | Classification, generation, etc. | EU AI Act Art. 11(1)(d) |

| Provider/Developer | Organization responsible | EU AI Act Art. 11(1)(b) |

| Release Date | When placed on market | EU AI Act Art. 49 |

| License | Usage terms and restrictions | Internal governance |



### 2. Intended Use (NIST MAP-1)

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Primary Use Cases | Intended applications | NIST MAP-1.1 |

| Intended Users | Who should operate system | EU AI Act Art. 13 |

| Out-of-Scope Uses | Prohibited applications | NIST MAP-1.3 |

| Deployment Context | Environment and constraints | NIST MAP-1.1 |



### 3. Training Data (EU AI Act Art. 10)

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Data Sources | Origin and collection method | EU AI Act Art. 10(2) |

| Data Characteristics | Size, features, demographics | EU AI Act Art. 10(3) |

| Data Governance | Quality and bias measures | EU AI Act Art. 10(2) |

| Data Limitations | Known gaps or issues | NIST MAP-3.2 |



### 4. Performance Evaluation (EU AI Act Art. 15)

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Metrics | Accuracy, precision, recall, F1 | EU AI Act Art. 15(1) |

| Test Datasets | Evaluation data characteristics | NIST MEASURE-2.2 |

| Performance Results | Quantitative outcomes | EU AI Act Art. 15(2) |

| Robustness Testing | Adversarial and edge cases | EU AI Act Art. 15(4) |



### 5. Fairness and Bias (NIST MEASURE-2.1)

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Bias Assessment | Testing across demographic groups | NIST MEASURE-2.1 |

| Fairness Metrics | Demographic parity, equalized odds | NIST Trustworthy AI |

| Mitigation Measures | Steps taken to address bias | EU AI Act Art. 10(2)(f) |



### 6. Limitations and Risks (NIST MAP-1.3)

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Known Limitations | Capability boundaries | NIST MAP-1.3 |

| Failure Modes | How system can fail | NIST MAP-2 |

| Risk Mitigations | Controls in place | ISO 42001 Cl. 6.1.3 |



### 7. Human Oversight (EU AI Act Art. 14)

| Field | Description | Requirement Source |

|-------|-------------|-------------------|

| Oversight Level | Human-in-loop/on-loop/over-loop | EU AI Act Art. 14(1) |

| Override Capability | How humans can intervene | EU AI Act Art. 14(4) |

| Monitoring Requirements | Ongoing supervision needs | EU AI Act Art. 14(4) |



## Implementation Best Practices



1. **Start early**: Begin documentation during development, not after

2. **Cross-functional input**: Include technical, legal, and business perspectives

3. **Plain language**: Make accessible to non-technical stakeholders

4. **Version control**: Update as models evolve per ISO 42001 Clause 6.3

5. **Accessibility**: Ensure deployers can access per EU AI Act Art. 13

    `,

    "bias-fairness": `

## AI Bias and Fairness



AI bias management is a core requirement under **NIST AI RMF** (trustworthy characteristic: "Fair with Harmful Bias Managed"), **EU AI Act Article 10** (data governance), and **ISO 42001** (AI risk assessment). Organizations must actively identify, measure, and mitigate bias throughout the AI lifecycle.



## Regulatory Requirements



### EU AI Act (Article 10 - Data Governance)

For high-risk AI systems:

- Training data must be **relevant, representative, and free of errors**

- Must examine data for **possible biases** that could lead to discrimination

- Must take **appropriate measures** to detect and address biases

- Data governance practices must be **documented**



### NIST AI RMF Trustworthy Characteristics

- **Fair with Harmful Bias Managed**: AI systems treat individuals and groups equitably

- Part of MEASURE function: Testing for bias (MEASURE-2.1)



### ISO 42001 (Clause 6.1.4 - AI System Impact Assessment)

- Assess potential **consequences on individuals and groups**

- Consider impacts related to **discrimination and unfair treatment**



## Types of AI Bias



### Data Bias (EU AI Act Art. 10 Focus)

| Type | Description | Mitigation |

|------|-------------|------------|

| Historical | Past discrimination embedded in data | Audit historical patterns, consider counterfactual data |

| Representation | Underrepresentation of groups | Stratified sampling, data augmentation |

| Measurement | Inconsistent collection across groups | Standardize collection, audit measurement processes |

| Selection | Non-random sampling | Random sampling, post-hoc weighting |

| Label | Biased human labeling | Multiple annotators, clear guidelines, bias audits |



### Algorithmic Bias (NIST MEASURE Focus)

| Type | Description | Mitigation |

|------|-------------|------------|

| Aggregation | One model assumed for all groups | Subgroup models, fairness constraints |

| Learning | Model amplifies data patterns | Regularization, adversarial debiasing |

| Evaluation | Non-representative test data | Stratified evaluation, disaggregated metrics |

| Optimization | Objective function ignores fairness | Multi-objective optimization with fairness |



### Deployment Bias (NIST MANAGE Focus)

| Type | Description | Mitigation |

|------|-------------|------------|

| Population Shift | Different population than training | Continuous monitoring, model retraining |

| Feedback Loops | Decisions influence future data | Monitor feedback effects, intervention protocols |

| Automation | Overreliance on AI decisions | Human oversight per EU AI Act Art. 14 |



## Fairness Metrics (NIST MEASURE-2.1)



### Group Fairness Metrics

| Metric | Definition | Use Case |

|--------|------------|----------|

| **Demographic Parity** | Equal positive rates across groups | When outcome should be equally distributed |

| **Equalized Odds** | Equal TPR and FPR across groups | When accuracy matters equally for all |

| **Predictive Parity** | Equal precision across groups | When prediction reliability matters |

| **Calibration** | Equal probability meaning across groups | When probabilities drive decisions |



### Individual Fairness

- **Similar Treatment**: Similar individuals receive similar predictions

- **Consistency**: Small input changes don't cause large output changes



### Counterfactual Fairness

- Predictions unchanged if protected attributes were different

- Requires causal modeling of relationships



## Mitigation Framework (NIST AI RMF Aligned)



### Pre-Processing (Data Stage)

- **Data auditing**: Analyze training data for demographic imbalances

- **Resampling**: Balance representation across protected groups

- **Feature engineering**: Remove or transform proxy variables for protected attributes

- **Synthetic data**: Generate representative samples for underrepresented groups



### In-Processing (Training Stage)

- **Fairness constraints**: Add fairness metrics to optimization objective

- **Adversarial debiasing**: Train model to be unable to predict protected attributes

- **Regularization**: Penalize model for unfair predictions

- **Fair representations**: Learn embeddings that remove protected attribute information



### Post-Processing (Output Stage)

- **Threshold adjustment**: Different decision thresholds per group for equalized odds

- **Calibration**: Ensure probability scores have same meaning across groups

- **Human review**: Mandatory review for high-stakes decisions per EU AI Act Art. 14



## Building a Fairness Program (ISO 42001 Aligned)



### Step 1: Define Fairness Context (NIST MAP)

- Identify protected attributes relevant to your use case

- Document regulatory requirements (EU AI Act, sector-specific)

- Define fairness goals appropriate to organizational context



### Step 2: Measure and Test (NIST MEASURE)

- Select appropriate fairness metrics for your use case

- Conduct disaggregated performance analysis across groups

- Document findings per ISO 42001 Clause 7.5



### Step 3: Mitigate and Monitor (NIST MANAGE)

- Implement appropriate mitigation strategies

- Establish continuous monitoring for deployed systems

- Create remediation procedures for identified issues

- Schedule periodic bias audits per ISO 42001 Clause 9.2



### Step 4: Document and Report

- Maintain bias assessment records for compliance

- Report findings to AI governance committee

- Update model cards with fairness assessments

    `,

  };

  

  return contentMap[id] || `

## Overview



This topic provides guidance aligned with **NIST AI Risk Management Framework**, **EU AI Act (Regulation 2024/1689)**, and **ISO/IEC 42001:2023** AI Management System standards.



## Key Frameworks



- **NIST AI RMF**: Voluntary framework with GOVERN, MAP, MEASURE, MANAGE functions

- **EU AI Act**: Risk-based classification (Prohibited, High-Risk, Limited, Minimal)

- **ISO 42001**: AI Management System standard with Clauses 4-10



## Getting Started



1. Assess your AI landscape using NIST MAP function

2. Classify systems under EU AI Act risk categories

3. Establish governance per ISO 42001 requirements

4. Implement controls per NIST MANAGE function

  `;

}

