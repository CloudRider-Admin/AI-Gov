import OpenAI from 'openai';
import { getBySubcategory, searchPlaybook, type NISTPlaybookEntry } from '@/data/nistPlaybookService';
import { NIST_AI_RMF, EU_AI_ACT, ISO_42001 } from '@/data/governanceKnowledge';
import {
  intakeAssessmentSchema,
  governanceDocumentSchema,
  playbookSchema,
  type IntakeRequest,
  type IntakeAssessmentOutput,
  type DocumentRequest,
  type GovernanceDocumentOutput,
  type PlaybookRequest,
  type PlaybookOutput,
} from './schemas';
import {
  RISK_DRIVERS,
  AUTO_HIGH_TRIGGERS,
  TIER_ARTIFACTS,
  DOCUMENT_SECTION_TEMPLATES,
  DOCUMENT_TITLES,
  NIST_PLAYBOOK_PHASES,
  getArtifactsForTier,
} from './documentTemplates';
import { getExemplarsForGeneration, renderExemplarBlock } from './exemplarRetrieval';
import { getOrgContext, renderOrgContextBlock } from './orgContext';
import { getIntakeProfile, renderIntakeProfileBlock } from './intakeProfile';

export interface Agent {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  systemPrompt: string;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentResponse {
  agentId: string;
  content: string;
  confidence: number;
  riskLevel: RiskLevel;
  reasoning: string[];
  recommendations: string[];
}

/** Weights for consensus voting — must sum to 1.0 */
export const AGENT_WEIGHTS: Record<string, number> = {
  'risk-assessor': 0.40,
  'compliance-expert': 0.30,
  'policy-architect': 0.15,
  'implementation-advisor': 0.15,
};

const RISK_LEVEL_NUMERIC: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const NUMERIC_TO_RISK: Record<number, RiskLevel> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'critical',
};

export interface SynthesisResult {
  riskLevel: RiskLevel;
  confidence: number;
  summary: string;
  agreements: string[];
  contradictions: string[];
  gaps: string[];
  keyRecommendations: string[];
}

export interface OrchestrationResult {
  primaryResponse: AgentResponse;
  supportingResponses: AgentResponse[];
  consensus: {
    riskLevel: RiskLevel;
    confidence: number;
    keyRecommendations: string[];
    contested: boolean;
  };
  synthesis?: SynthesisResult;
  timestamp: string;
}

export const AI_AGENTS: Agent[] = [
  {
    id: 'risk-assessor',
    name: 'Risk Assessment Specialist',
    role: 'primary',
    expertise: ['risk analysis', 'threat modeling', 'impact assessment'],
    systemPrompt: `You are a Risk Assessment Specialist focused on AI governance. Your role is to:
- Evaluate AI use case risks across technical, operational, and regulatory dimensions
- Assign risk levels (low/medium/high/critical) with confidence scores
- Identify potential failure modes and mitigation strategies
- Consider both immediate and long-term risks
- Provide quantitative risk metrics where possible

Focus on practical risk assessment for SMBs with limited resources.

Respond ONLY with a JSON object containing these fields:
{
  "content": "detailed risk analysis paragraph",
  "riskLevel": "low|medium|high|critical",
  "confidence": <number between 0 and 1 reflecting your actual certainty>,
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "recommendations": ["action 1", "action 2", "action 3"]
}`
  },
  {
    id: 'compliance-expert',
    name: 'Regulatory Compliance Expert',
    role: 'supporting',
    expertise: ['GDPR', 'EU AI Act', 'NIST AI RMF', 'ISO 42001', 'regulatory compliance'],
    systemPrompt: `You are a Regulatory Compliance Expert specializing in AI governance frameworks. Your role is to:
- Map AI use cases to relevant regulations and standards
- Identify compliance requirements and obligations
- Recommend specific compliance actions and documentation
- Assess regulatory risk and exposure
- Provide jurisdiction-specific guidance

Focus on GDPR, EU AI Act, NIST AI RMF, and ISO/IEC 42001 compliance for SMBs.

Respond ONLY with a JSON object containing these fields:
{
  "content": "detailed compliance analysis paragraph",
  "riskLevel": "low|medium|high|critical",
  "confidence": <number between 0 and 1 reflecting your actual certainty>,
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "recommendations": ["action 1", "action 2", "action 3"]
}`
  },
  {
    id: 'policy-architect',
    name: 'AI Policy Architect',
    role: 'supporting',
    expertise: ['policy development', 'governance frameworks', 'organizational design'],
    systemPrompt: `You are an AI Policy Architect focused on organizational governance. Your role is to:
- Design comprehensive AI governance policies and procedures
- Recommend organizational structures and roles
- Create implementation roadmaps and timelines
- Suggest monitoring and audit mechanisms
- Align policies with business objectives and risk tolerance

Focus on practical, implementable policies for SMB environments.

Respond ONLY with a JSON object containing these fields:
{
  "content": "detailed policy architecture paragraph",
  "riskLevel": "low|medium|high|critical",
  "confidence": <number between 0 and 1 reflecting your actual certainty>,
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "recommendations": ["action 1", "action 2", "action 3"]
}`
  },
  {
    id: 'implementation-advisor',
    name: 'Implementation Strategy Advisor',
    role: 'supporting',
    expertise: ['change management', 'implementation planning', 'resource optimization'],
    systemPrompt: `You are an Implementation Strategy Advisor for AI governance initiatives. Your role is to:
- Create practical implementation plans and timelines
- Identify resource requirements and constraints
- Recommend phased rollout strategies
- Suggest change management approaches
- Provide cost-benefit analysis and ROI considerations

Focus on realistic implementation strategies for SMBs with limited resources.

Respond ONLY with a JSON object containing these fields:
{
  "content": "detailed implementation strategy paragraph",
  "riskLevel": "low|medium|high|critical",
  "confidence": <number between 0 and 1 reflecting your actual certainty>,
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "recommendations": ["action 1", "action 2", "action 3"]
}`
  }
];

export class MultiAgentOrchestrator {
  private agents: Agent[];

  constructor(agents: Agent[] = AI_AGENTS) {
    this.agents = agents;
  }

  async orchestrateResponse(
    query: string,
    context?: string,
    apiKey?: string,
    ragContext?: string,
  ): Promise<OrchestrationResult> {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for multi-agent orchestration');
    }

    const openai = new OpenAI({ apiKey });

    // Dynamic NIST lookup based on the user's actual query
    const queryRelevantNist = searchPlaybook(query, 6);

    const primaryAgent = this.agents.find(agent => agent.role === 'primary') || this.agents[0];
    const primaryResponse = await this.getAgentResponse(
      openai, primaryAgent, query, context, undefined, ragContext, queryRelevantNist,
    );

    const supportingAgents = this.agents.filter(agent => agent.role === 'supporting');
    const supportingResponses = await Promise.all(
      supportingAgents.map(agent =>
        this.getAgentResponse(
          openai, agent, query, context, primaryResponse.content, ragContext, queryRelevantNist,
        )
      )
    );

    const allResponses = [primaryResponse, ...supportingResponses];
    const consensus = this.generateConsensus(allResponses);

    // Pass 2: Synthesis agent resolves contradictions and produces unified analysis
    let synthesis: SynthesisResult | undefined;
    try {
      synthesis = await this.synthesize(openai, query, allResponses, consensus);
    } catch (err) {
      console.error('[multiAgent] Synthesis failed, using consensus only:', err);
    }

    return {
      primaryResponse,
      supportingResponses,
      consensus,
      synthesis,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Pass 2: A synthesis agent reviews all agent outputs, resolves contradictions,
   * identifies gaps, and produces a unified risk assessment.
   */
  private async synthesize(
    openai: OpenAI,
    query: string,
    responses: AgentResponse[],
    consensus: OrchestrationResult['consensus'],
  ): Promise<SynthesisResult> {
    const agentSummaries = responses.map(r =>
      `Agent: ${r.agentId}\nRisk Level: ${r.riskLevel}\nConfidence: ${r.confidence}\nAnalysis: ${r.content}\nRecommendations: ${r.recommendations.join('; ')}`
    ).join('\n\n');

    const systemPrompt = `You are an AI Governance Synthesis Specialist. You receive analyses from multiple specialist agents and must produce a unified, coherent assessment.

Your tasks:
1. Identify where agents AGREE (list key points of consensus)
2. Identify where agents CONTRADICT each other (flag specific disagreements and resolve them with reasoning)
3. Identify GAPS — important governance areas no agent mentioned
4. Produce a final risk level with justification
5. Produce a unified set of key recommendations (max 6), prioritised by importance

The preliminary consensus from weighted voting is: ${consensus.riskLevel} (${consensus.contested ? 'CONTESTED — agents disagree significantly' : 'uncontested'})

Respond with a JSON object:
{
  "riskLevel": "low|medium|high|critical",
  "confidence": <0-1>,
  "summary": "2-3 sentence unified assessment",
  "agreements": ["point 1", "point 2"],
  "contradictions": ["contradiction 1 + resolution"],
  "gaps": ["gap 1", "gap 2"],
  "keyRecommendations": ["rec 1", "rec 2", ...]
}`;

    const userPrompt = `User query: ${query}\n\n## Agent Analyses\n\n${agentSummaries}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);

    const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    return {
      riskLevel: validRiskLevels.includes(parsed.riskLevel) ? parsed.riskLevel : consensus.riskLevel,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : consensus.confidence,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      agreements: Array.isArray(parsed.agreements) ? parsed.agreements : [],
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      keyRecommendations: Array.isArray(parsed.keyRecommendations)
        ? deduplicateRecommendations(parsed.keyRecommendations, 6)
        : consensus.keyRecommendations,
    };
  }

  private async getAgentResponse(
    openai: OpenAI,
    agent: Agent,
    query: string,
    context?: string,
    primaryAnalysis?: string,
    ragContext?: string,
    queryNist?: NISTPlaybookEntry[],
  ): Promise<AgentResponse> {
    try {
      const userPrompt = this.buildAgentPrompt(agent, query, context, primaryAnalysis, ragContext, queryNist);

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);

      const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
      const riskLevel = validRiskLevels.includes(parsed.riskLevel)
        ? parsed.riskLevel
        : 'medium';

      return {
        agentId: agent.id,
        content: typeof parsed.content === 'string' ? parsed.content : raw.slice(0, 500),
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        riskLevel,
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      console.error(`[multiAgent] Error from agent ${agent.id}:`, error);
      return {
        agentId: agent.id,
        content: `Unable to get response from ${agent.name}`,
        confidence: 0,
        riskLevel: 'medium',
        reasoning: ['Agent communication failed'],
        recommendations: [],
      };
    }
  }

  private buildAgentPrompt(
    agent: Agent,
    query: string,
    context?: string,
    primaryAnalysis?: string,
    ragContext?: string,
    queryNist?: NISTPlaybookEntry[],
  ): string {
    const parts: string[] = [];

    if (context) parts.push(`Previous context:\n${context}`);
    if (primaryAnalysis && agent.role === 'supporting') {
      parts.push(`Primary risk assessment already completed:\n${primaryAnalysis}`);
    }

    // ── Inject RAG results (query-relevant documents from all sources) ──
    if (ragContext) {
      parts.push(ragContext);
    }

    // ── Inject query-relevant NIST subcategories (dynamic, not hardcoded) ──
    if (queryNist?.length) {
      const nistText = queryNist
        .map(e => `${e.title} [${e.category}]: ${e.description}`)
        .join('\n');
      parts.push(`Relevant NIST AI RMF subcategories for this query:\n${nistText}`);
    }

    // ── Also keep agent-specific baseline NIST subcategories ──
    const baselineSubcats: Record<string, string[]> = {
      'risk-assessor': ['MAP 1.1', 'MEASURE 2.1'],
      'compliance-expert': ['GOVERN 1.1', 'GOVERN 1.2'],
      'policy-architect': ['GOVERN 2.1', 'GOVERN 2.3'],
      'implementation-advisor': ['MANAGE 1.1', 'MANAGE 2.1'],
    };
    const baseline = (baselineSubcats[agent.id] ?? [])
      .map(sc => getBySubcategory(sc))
      .filter(Boolean)
      .map(e => `${e!.title}: ${e!.description}`)
      .join('\n');
    if (baseline) parts.push(`Baseline NIST guidance for your specialty:\n${baseline}`);

    // ── Inject agent-specific governance framework context ──
    const frameworkContext = getAgentFrameworkContext(agent.id);
    if (frameworkContext) parts.push(frameworkContext);

    parts.push(`User query:\n${query}`);

    return parts.join('\n\n');
  }

  /**
   * Weighted consensus voting across all agent responses.
   *
   * Each agent's riskLevel is converted to a numeric score (1-4), multiplied by
   * the agent's weight, and summed. The result is rounded to the nearest integer
   * and mapped back to a risk level.
   *
   * If agents disagree by 2+ levels, the result is flagged as "contested" and
   * defaults to the higher of the two most-weighted agents.
   */
  generateConsensus(responses: AgentResponse[]): {
    riskLevel: RiskLevel;
    confidence: number;
    keyRecommendations: string[];
    contested: boolean;
  } {
    // Weighted confidence
    let weightedConfidence = 0;
    let weightedRiskScore = 0;
    let totalWeight = 0;

    for (const r of responses) {
      const weight = AGENT_WEIGHTS[r.agentId] ?? (1 / responses.length);
      weightedConfidence += r.confidence * weight;
      weightedRiskScore += RISK_LEVEL_NUMERIC[r.riskLevel] * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      weightedConfidence /= totalWeight;
      weightedRiskScore /= totalWeight;
    }

    // Detect contested: max and min risk levels differ by 2+ levels
    const riskValues = responses.map(r => RISK_LEVEL_NUMERIC[r.riskLevel]);
    const maxRisk = Math.max(...riskValues);
    const minRisk = Math.min(...riskValues);
    const contested = (maxRisk - minRisk) >= 2;

    // If contested, default to the higher risk (conservative)
    let finalScore: number;
    if (contested) {
      finalScore = Math.ceil(weightedRiskScore);
    } else {
      finalScore = Math.round(weightedRiskScore);
    }
    finalScore = Math.max(1, Math.min(4, finalScore));

    const riskLevel = NUMERIC_TO_RISK[finalScore];

    // Deduplicate recommendations using simple word-overlap similarity
    const allRecommendations = responses.flatMap(r => r.recommendations);
    const keyRecommendations = deduplicateRecommendations(allRecommendations, 5);

    return { riskLevel, confidence: weightedConfidence, keyRecommendations, contested };
  }
}

/**
 * Returns agent-specific governance framework context from governanceKnowledge.ts.
 * Each agent gets data relevant to its domain expertise.
 *
 * Phase 4 extension: every agent additionally receives a tailored slice of
 * the GovSecure body of knowledge (4-tier risk model, AI Chef stations,
 * Policy Suite Map, 90-Day Blueprint) so consensus responses cite GovSecure
 * methodology consistently rather than only when RAG happens to retrieve it.
 */
export function getAgentFrameworkContext(agentId: string): string | null {
  const govsecure = getGovSecureAgentContext(agentId);
  switch (agentId) {
    case 'risk-assessor': {
      const chars = NIST_AI_RMF.trustworthyCharacteristics
        .map(c => `- ${c.name}: ${c.description}`)
        .join('\n');
      const tiers = NIST_AI_RMF.implementationTiers
        .map(t => `- Tier ${t.tier} (${t.name}): ${t.description}`)
        .join('\n');
      return appendGovSecure(
        `NIST AI RMF Trustworthiness Characteristics:\n${chars}\n\nNIST Implementation Tiers:\n${tiers}`,
        govsecure,
      );
    }
    case 'compliance-expert': {
      const highRiskAreas = EU_AI_ACT.riskCategories.HIGH_RISK.useCaseAreas
        .map(a => `- ${a.area}: ${a.examples.join(', ')}`)
        .join('\n');
      const prohibited = EU_AI_ACT.riskCategories.UNACCEPTABLE.prohibitedPractices
        .map(p => `- ${p.name}: ${p.description}`)
        .join('\n');
      const penalties = `Prohibited violations: ${EU_AI_ACT.penalties.prohibitedPractices}\nHigh-risk violations: ${EU_AI_ACT.penalties.highRiskViolations}`;
      const timeline = EU_AI_ACT.timeline
        .map(t => `- ${t.date}: ${t.milestone}`)
        .join('\n');
      return appendGovSecure(
        `EU AI Act — High-Risk Use Case Areas:\n${highRiskAreas}\n\nProhibited AI Practices:\n${prohibited}\n\nPenalties:\n${penalties}\n\nTimeline:\n${timeline}`,
        govsecure,
      );
    }
    case 'policy-architect': {
      const clauses = Object.values(ISO_42001.clauses)
        .filter((c): c is typeof c & { requirements: Array<{ id: string; name: string; description: string }> } =>
          'requirements' in c && Array.isArray((c as Record<string, unknown>).requirements))
        .flatMap(c => (c.requirements as Array<{ id: string; name: string; description: string }>)
          .map(r => `- ${r.id} ${r.name}: ${r.description}`))
        .join('\n');
      return appendGovSecure(
        `ISO/IEC 42001:2023 — Key Requirements:\n${clauses}`,
        govsecure,
      );
    }
    case 'implementation-advisor': {
      const nistActions = Object.values(NIST_AI_RMF.coreFunctions)
        .map(f => `${f.name}:\n${f.keyActions.map(a => `  - ${a}`).join('\n')}`)
        .join('\n');
      const highRiskReqs = EU_AI_ACT.riskCategories.HIGH_RISK.requirements
        .map(r => `- ${r.name}: ${r.description}`)
        .join('\n');
      return appendGovSecure(
        `NIST AI RMF — Key Actions by Function:\n${nistActions}\n\nEU AI Act — High-Risk Requirements:\n${highRiskReqs}`,
        govsecure,
      );
    }
    default:
      return null;
  }
}

function appendGovSecure(base: string, govsecure: string | null): string {
  if (!govsecure) return base;
  return `${base}\n\n${govsecure}`;
}

/**
 * Deduplicates recommendations using Jaccard word-overlap similarity.
 * Two recommendations with > 0.5 overlap are considered duplicates;
 * the longer (more detailed) version is kept.
 */
export function deduplicateRecommendations(recs: string[], limit: number): string[] {
  const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));

  const unique: string[] = [];
  for (const rec of recs) {
    const recTokens = tokenize(rec);
    const isDuplicate = unique.some(existing => {
      const existingTokens = tokenize(existing);
      const intersection = new Set([...recTokens].filter(t => existingTokens.has(t)));
      const union = new Set([...recTokens, ...existingTokens]);
      return union.size > 0 && intersection.size / union.size > 0.5;
    });

    if (!isDuplicate) {
      unique.push(rec);
    }
  }
  return unique.slice(0, limit);
}

export const multiAgentOrchestrator = new MultiAgentOrchestrator();

// ─── Shared helper ────────────────────────────────────────────────────────────

async function callOpenAIJson(
  openai: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4000,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });
  return completion.choices[0]?.message?.content ?? '{}';
}

// ─── Intake Risk Assessment Orchestrator ─────────────────────────────────────

export class IntakeOrchestrator {
  async run(req: IntakeRequest, apiKey: string): Promise<IntakeAssessmentOutput> {
    const openai = new OpenAI({ apiKey });
    const today = new Date().toISOString().split('T')[0];
    const nextReview = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const driversContext = RISK_DRIVERS.map(d =>
      `Driver: ${d.label} (id: ${d.id})\n` +
      `Description: ${d.description}\n` +
      `Scoring: 0=${d.scoringGuidance[0]} | 1=${d.scoringGuidance[1]} | 2=${d.scoringGuidance[2]} | 3=${d.scoringGuidance[3]}\n` +
      `NIST: ${d.nistMappings.join(', ')} | EU AI Act: ${d.euAiActMappings.join(', ')}`
    ).join('\n\n');

    const triggersContext = AUTO_HIGH_TRIGGERS.map(t =>
      `Trigger: ${t.id}\nCondition: ${t.description}\nRationale: ${t.rationale}`
    ).join('\n\n');

    const artifactsContext = TIER_ARTIFACTS.map(a =>
      `${a.name} (minimum tier: ${a.minimumTier}): ${a.description}`
    ).join('\n');

    // Phase 4.5: pull conversation-scoped OrgContext.
    const orgContext = req.conversationId ? await getOrgContext(req.conversationId) : {};
    const orgBlock = renderOrgContextBlock(orgContext);

    // Captured GovSecure intake profile — verbatim user input. Quoting this
    // back into the prompt blocks the LLM from inventing controls /
    // oversight / vendor terms that the user never supplied.
    const intakeProfile = req.conversationId ? await getIntakeProfile(req.conversationId) : {};
    const intakeBlock = renderIntakeProfileBlock(intakeProfile);

    const systemPrompt = `You are an AI Governance Risk Assessment specialist. Your task is to complete a formal AI Intake Risk Assessment.

${orgBlock ? orgBlock + '\n' : ''}
${intakeBlock ? intakeBlock + '\n' : ''}

You will score 10 risk drivers (0–3 each, max 30), check 6 auto-high triggers, determine the risk tier, list required artifacts, make a launch decision, and classify the use case under the EU AI Act.

## Anti-hallucination rules (HARD CONSTRAINTS — violation invalidates the assessment)
1. The driver \`notes\` field MUST cite only information present in the INTAKE PROFILE block, the ORGANIZATION CONTEXT block, or the user's Use Case Description below. Do NOT invent vendor terms, DPA status, subprocessor reviews, human-in-the-loop oversight, output review processes, kill switches, training, monitoring, or any other control unless it appears verbatim in the input.
2. If a driver cannot be scored from the supplied input, the \`notes\` field MUST begin with the literal string "Insufficient information —" and the \`score\` MUST be 3 (worst case). This applies especially to: Vendor / Supply Chain (no vendor stated → score 3), Reputational Risk (no review process stated → score 3 if customer/public-facing), Reliability Risk (no fallback stated → score 3), Bias / Discrimination (no testing stated → score 3 if people-impacting).
3. Auto-high trigger \`fired\` MUST be consistent with the input: a use case described as customer- or public-facing MUST fire trigger #3 (Public-facing or customer-facing generative output). A use case handling regulated/financial/PHI data MUST fire trigger #2.
4. \`deployment\` MUST match what the user stated. If the INTAKE PROFILE specifies "Public-facing", do NOT output "Internal".
5. \`jurisdictions\` MUST mirror the user's stated jurisdictions. If none were given, output an empty array — do NOT assume EU/GDPR applicability.
6. Driver scores and the \`autoHighTriggers\` section MUST agree with each other. If trigger #1 (decisions about people) fires, Decision Impact MUST be ≥ 2. If trigger #3 fires, Reputational Risk MUST be ≥ 2.

## Risk Drivers (score each 0–3)
${driversContext}

## Auto-High Triggers (fire if condition applies)
${triggersContext}

## Tier Scoring Rules
- Low: 0–8 AND no auto-high triggers fired
- Medium: 9–17 AND no auto-high triggers fired
- High: 18–30 OR any auto-high trigger fired
- Critical: Reserved for Prohibited EU AI Act use cases

## Required Artifacts by Tier (cumulative)
${artifactsContext}

## Launch Decision Rules
- Go: Low or Medium tier, no open blockers
- Conditional Go: High tier with mitigations, or Medium with open items
- No-Go: Critical tier, or Prohibited EU AI Act classification, or unmitigable High risks

Respond ONLY with a valid JSON object matching the schema exactly. All arrays must be present (use [] if empty). Strings must not be null.`;

    const userPrompt = `Assess this AI use case:

Use Case Name: ${req.useCaseName ?? 'Unnamed Use Case'}
Owner: ${req.owner ?? 'Not specified'}
Business Unit: ${req.businessUnit ?? 'Not specified'}
Model Type: ${req.modelType ?? 'GenAI'}
Deployment: ${req.deployment ?? 'Internal'}
Jurisdictions: ${req.jurisdictions?.join(', ') || 'Not specified'}
Go-Live Target: ${req.goLiveTarget ?? 'Not specified'}
Assessment Date: ${today}

Use Case Description:
${req.useCaseDescription}

Return a JSON object with this exact structure:
{
  "useCaseName": string,
  "owner": string,
  "businessUnit": string,
  "modelType": "GenAI" | "Predictive ML" | "Rules + ML" | "Vendor Feature",
  "deployment": "Internal" | "Customer-facing" | "Public-facing",
  "jurisdictions": string[],
  "goLiveTarget": string | null,
  "assessmentDate": "${today}",
  "riskDrivers": [
    {
      "id": string,          // matches driver id exactly
      "label": string,
      "description": string,
      "score": 0 | 1 | 2 | 3,
      "notes": string,       // 1-2 sentence rationale grounded in the use case
      "nistMappings": string[],
      "euAiActMappings": string[]
    }
    // ... all 10 drivers
  ],
  "totalScore": number,      // sum of all driver scores
  "autoHighTriggers": [
    {
      "id": string,
      "description": string,
      "fired": boolean,
      "reason": string
    }
    // ... all 6 triggers
  ],
  "autoHighFired": boolean,
  "riskTier": "Low" | "Medium" | "High" | "Critical",
  "tierRationale": string,
  "requiredApprovers": ("Compliance" | "Security" | "Legal/Privacy" | "Risk/ERM")[],
  "requiredArtifacts": [
    { "name": string, "description": string, "tier": "Low" | "Medium" | "High" | "Critical", "status": "pending" }
  ],
  "launchDecision": "Go" | "Conditional Go" | "No-Go",
  "conditions": string,      // empty string if no conditions
  "nextReviewDate": "${nextReview}",
  "reassessmentTriggers": string[],
  "euAIActClassification": "Prohibited" | "High-Risk" | "Limited-Risk" | "Minimal-Risk" | "General-Purpose",
  "euAIActRationale": string,
  "nistKeySubcategories": string[],
  "markdownExport": ""
}`;

    const raw = await callOpenAIJson(openai, systemPrompt, userPrompt, 4000);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('[IntakeOrchestrator] Failed to parse OpenAI JSON response');
    }

    // Populate requiredArtifacts from template if AI left them empty
    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.requiredArtifacts) || (data.requiredArtifacts as unknown[]).length === 0) {
      const tier = (data.riskTier as string ?? 'Low') as 'Low' | 'Medium' | 'High' | 'Critical';
      data.requiredArtifacts = getArtifactsForTier(tier).map(a => ({
        name: a.name,
        description: a.description,
        tier: a.minimumTier,
        status: 'pending',
      }));
    }

    // Compute suggested next-action handoffs (chain into Document /
    // Playbook / Workflow orchestrators). Populated server-side rather
    // than asked from the LLM so the action ids stay stable for the UI.
    data.suggestedNextActions = buildSuggestedNextActions(
      data as IntakeAssessmentOutput,
      intakeProfile,
    );

    // Generate markdown export
    const assessment = data as IntakeAssessmentOutput;
    data.markdownExport = buildIntakeMarkdown(assessment);

    const result = intakeAssessmentSchema.safeParse(data);
    if (!result.success) {
      console.error('[IntakeOrchestrator] Zod validation failed:', result.error.flatten());
      throw new Error('[IntakeOrchestrator] Assessment output failed validation');
    }
    return result.data;
  }
}

/**
 * Decide which follow-on artifacts to offer when the intake completes.
 * Triggered by tier, data sensitivity, customer-facing flag, and whether
 * a vendor was named (third-party data path).
 */
function buildSuggestedNextActions(
  a: IntakeAssessmentOutput,
  profile: import('./intakeProfile').IntakeProfile,
): import('./schemas').SuggestedNextAction[] {
  const actions: import('./schemas').SuggestedNextAction[] = [];
  const isHigh = a.riskTier === 'High' || a.riskTier === 'Critical';
  const conditional = a.launchDecision === 'Conditional Go' || a.launchDecision === 'No-Go';
  const handlesSensitive = Boolean(
    profile.dataCategories?.personalOrSensitive ||
      profile.dataCategories?.financialOrRegulated,
  );
  const customerFacing =
    profile.deploymentScope === 'Customer-facing' ||
    profile.deploymentScope === 'Public-facing' ||
    a.deployment === 'Customer-facing' ||
    a.deployment === 'Public-facing';
  const hasVendor = Boolean(profile.vendor && profile.vendor.toLowerCase() !== 'in-house');

  // DPIA — always for sensitive data; required for High tier
  if (handlesSensitive || isHigh) {
    actions.push({
      id: 'dpia-draft',
      label: 'Generate DPIA draft',
      rationale: 'High-risk handling of personal or regulated data triggers a Data Protection Impact Assessment.',
      intent: 'document',
      payload: { documentType: 'dpia' },
      priority: 10,
    });
  }

  // TPRM workflow — when a third-party vendor is in scope
  if (hasVendor) {
    actions.push({
      id: 'tprm-workflow',
      label: 'Launch TPRM vendor review',
      rationale: `Third-party AI Privacy Risk Assessment for ${profile.vendor}, using the GovSecure questionnaire and scoring workbook.`,
      intent: 'workflow',
      payload: { workflowKey: 'tprm' },
      priority: 20,
    });
  }

  // Threat Model — High tier or customer-facing
  if (isHigh || customerFacing) {
    actions.push({
      id: 'threat-model',
      label: 'Generate AI Threat Model',
      rationale: 'High-tier or public-facing systems require a documented threat model covering prompt injection, data leakage, and abuse paths.',
      intent: 'document',
      payload: { documentType: 'threat-model' },
      priority: 30,
    });
  }

  // 90-Day Blueprint — when no framework is in place (Conditional Go or High tier)
  if (conditional || isHigh) {
    actions.push({
      id: 'blueprint-90day',
      label: 'Generate 90-Day Governance Blueprint',
      rationale: 'GovSecure AI Chef™ phased rollout to stand up the controls this assessment requires.',
      intent: 'playbook',
      payload: { framework: 'Combined' },
      priority: 40,
    });
  }

  // Use Case Registry entry — always
  actions.push({
    id: 'registry-entry',
    label: 'Add to AI Use Case Registry',
    rationale: 'Log this use case in the registry so leadership has a single source of truth for active AI activity.',
    intent: 'document',
    payload: { documentType: 'govsecure-checklist-inventory' },
    priority: 50,
  });

  return actions.sort((x, y) => x.priority - y.priority);
}

function buildIntakeMarkdown(a: IntakeAssessmentOutput): string {
  const lines: string[] = [
    `# AI Intake Risk Assessment`,
    `**Use Case:** ${a.useCaseName}`,
    `**Owner:** ${a.owner || '—'} | **Business Unit:** ${a.businessUnit || '—'}`,
    `**Model Type:** ${a.modelType} | **Deployment:** ${a.deployment}`,
    `**Assessment Date:** ${a.assessmentDate} | **Next Review:** ${a.nextReviewDate}`,
    ``,
    `## Risk Tier: ${a.riskTier} (Score: ${a.totalScore}/30)`,
    `${a.tierRationale}`,
    ``,
    `**Launch Decision:** ${a.launchDecision}`,
    a.conditions ? `**Conditions:** ${a.conditions}` : '',
    ``,
    `## Section A — Risk Driver Scores`,
    `| Driver | Score | Notes |`,
    `|--------|-------|-------|`,
    ...a.riskDrivers.map(d => `| ${d.label} | ${d.score}/3 | ${d.notes} |`),
    ``,
    `**Total Score:** ${a.totalScore}/30`,
    ``,
    `## Section B — Auto-High Triggers`,
    ...a.autoHighTriggers.map(t => `- [${t.fired ? 'X' : ' '}] ${t.description}${t.fired ? `\n  *${t.reason}*` : ''}`),
    ``,
    `## Section C — Framework Classification`,
    `**EU AI Act:** ${a.euAIActClassification}`,
    a.euAIActRationale,
    ``,
    `**Key NIST Subcategories:** ${a.nistKeySubcategories.join(', ')}`,
    ``,
    `## Section D — Required Artifacts`,
    ...a.requiredArtifacts.map(r => `- [ ] **${r.name}** — ${r.description}`),
    ``,
    `## Section E — Required Approvers`,
    a.requiredApprovers.length ? a.requiredApprovers.map(ap => `- ${ap}`).join('\n') : '- None required at this tier',
    ``,
    `## Reassessment Triggers`,
    ...a.reassessmentTriggers.map(t => `- ${t}`),
  ].filter(l => l !== undefined);
  return lines.join('\n');
}

export const intakeOrchestrator = new IntakeOrchestrator();

// ─── Governance Document Orchestrator ─────────────────────────────────────────

export class DocumentOrchestrator {
  async run(req: DocumentRequest, apiKey: string): Promise<GovernanceDocumentOutput> {
    const openai = new OpenAI({ apiKey });
    const now = new Date().toISOString();

    const sectionTemplates = DOCUMENT_SECTION_TEMPLATES[req.documentType];
    // Phase 2.5: per-section guidance now stays compact; the brand-voice
    // anchor lives in a single REFERENCE EXEMPLARS block built below.
    const sectionsContext = sectionTemplates.map((s, i) => {
      const provenance = s.sourceDocCode
        ? ` [source: ${s.sourceDocCode}${s.sourceSection ? ` §${s.sourceSection}` : ''}]`
        : '';
      return `Section ${i + 1}: ${s.heading}${provenance}\nGuidance: ${s.guidance}\nRequired: ${s.required}${s.isChecklist ? ' (checklist format)' : ''}`;
    }).join('\n\n');

    const docTitle = `${DOCUMENT_TITLES[req.documentType] ?? req.documentType} — ${req.useCaseName ?? 'AI Use Case'}`;

    // Phase 2.5: pick 1-2 representative GovSecure exemplars for this doc
    // type. Empty for generic governance docs — `renderExemplarBlock` returns
    // an empty string so it can be concatenated unconditionally.
    const exemplars = getExemplarsForGeneration(
      req.documentType,
      sectionTemplates.map((s) => s.heading),
    );
    const exemplarBlock = renderExemplarBlock(exemplars, DOCUMENT_TITLES[req.documentType] ?? req.documentType);

    // Phase 4.5: pull conversation-scoped OrgContext so all generated
    // documents in the session share the same org name, lead title,
    // jurisdictions, and known AI tools. Empty when no metadata captured.
    const orgContext = req.conversationId ? await getOrgContext(req.conversationId) : {};
    const orgBlock = renderOrgContextBlock(orgContext);

    const reviewCycles: Record<string, string> = {
      Low: 'Annual', Medium: 'Semi-annual', High: 'Quarterly', Critical: 'Quarterly',
    };

    const systemPrompt = `You are an AI Governance specialist who produces formal governance documents for AI use cases.

Generate a complete "${DOCUMENT_TITLES[req.documentType]}" document grounded in NIST AI RMF 1.0, EU AI Act (2024/1689), ISO/IEC 42001:2023, and GDPR where applicable.

The document is for a risk tier: ${req.riskTier}

${orgBlock ? orgBlock + '\n\n' : ''}${exemplarBlock}## Required Sections
${sectionsContext}

Write substantive, specific content for each section grounded in the use case description provided. Do not use placeholder text. Each section content should be 100–300 words of professional, actionable prose (or structured checklist items for checklist sections).

Include 3–6 framework citations across NIST AI RMF, EU AI Act, ISO/IEC 42001, and GDPR where relevant.

Respond ONLY with a valid JSON object.`;

    const userPrompt = `Generate a complete ${DOCUMENT_TITLES[req.documentType]} for this AI use case.

Use Case Name: ${req.useCaseName ?? 'AI Use Case'}
Risk Tier: ${req.riskTier}
Use Case Description: ${req.useCaseDescription}
${req.context ? `\nAdditional Context:\n${req.context}` : ''}

Return a JSON object with this exact structure:
{
  "documentType": "${req.documentType}",
  "title": "${docTitle}",
  "riskTier": "${req.riskTier}",
  "useCaseName": "${req.useCaseName ?? 'AI Use Case'}",
  "sections": [
    {
      "heading": string,
      "content": string,
      "checklistItems": [{ "text": string, "complete": false }] | undefined,
      "required": boolean
    }
  ],
  "frameworkCitations": [
    {
      "framework": "NIST AI RMF" | "EU AI Act" | "ISO/IEC 42001" | "GDPR" | "Other",
      "reference": string,
      "description": string
    }
  ],
  "reviewCycle": "${reviewCycles[req.riskTier] ?? 'Annual'}",
  "generatedAt": "${now}",
  "markdownExport": ""
}

Generate all ${sectionTemplates.length} sections in order. For checklist sections, populate checklistItems instead of (or in addition to) content.`;

    const raw = await callOpenAIJson(openai, systemPrompt, userPrompt, 4000);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('[DocumentOrchestrator] Failed to parse OpenAI JSON response');
    }

    const data = parsed as GovernanceDocumentOutput;
    data.markdownExport = buildDocumentMarkdown(data);

    const result = governanceDocumentSchema.safeParse(data);
    if (!result.success) {
      console.error('[DocumentOrchestrator] Zod validation failed:', result.error.flatten());
      throw new Error('[DocumentOrchestrator] Document output failed validation');
    }
    return result.data;
  }
}

function buildDocumentMarkdown(doc: GovernanceDocumentOutput): string {
  const lines: string[] = [
    `# ${doc.title}`,
    `**Document Type:** ${doc.documentType} | **Risk Tier:** ${doc.riskTier}`,
    `**Generated:** ${new Date(doc.generatedAt).toLocaleDateString('en-GB')} | **Review Cycle:** ${doc.reviewCycle}`,
    ``,
  ];

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    if (section.content) lines.push(section.content);
    if (section.checklistItems?.length) {
      for (const item of section.checklistItems) {
        lines.push(`- [${item.complete ? 'x' : ' '}] ${item.text}`);
      }
    }
    lines.push('');
  }

  if (doc.frameworkCitations.length) {
    lines.push('## Framework References');
    for (const c of doc.frameworkCitations) {
      lines.push(`- **${c.framework} — ${c.reference}:** ${c.description}`);
    }
  }

  return lines.join('\n');
}

export const documentOrchestrator = new DocumentOrchestrator();

// ─── Playbook Orchestrator ─────────────────────────────────────────────────────

export class PlaybookOrchestrator {
  async run(req: PlaybookRequest, apiKey: string): Promise<PlaybookOutput> {
    const openai = new OpenAI({ apiKey });
    const now = new Date().toISOString();

    // Phase 3: GovSecure flagship products use bespoke phase contexts so the
    // generated playbook mirrors the AI Chef stations or the 90-Day Blueprint
    // phases exactly. The output schema (PlaybookOutput) is unchanged.
    const phasesContext = buildPhasesContext(req);
    const phaseCount = countPhases(req);

    // Phase 4.5: pull conversation-scoped OrgContext.
    const orgContext = req.conversationId ? await getOrgContext(req.conversationId) : {};
    const orgBlock = renderOrgContextBlock(orgContext);

    const frameworkVersions: Record<string, string[]> = {
      'NIST AI RMF': ['NIST AI RMF 1.0'],
      'EU AI Act': ['EU AI Act 2024/1689'],
      'ISO/IEC 42001': ['ISO/IEC 42001:2023'],
      'Combined': ['NIST AI RMF 1.0', 'EU AI Act 2024/1689', 'ISO/IEC 42001:2023'],
      'GovSecure AI Chef': ['GovSecure AI Chef Operating Model v1.0'],
      'GovSecure 90-Day Blueprint': ['GovSecure 90-Day Implementation Blueprint v1.0'],
    };

    const systemPrompt = `You are an AI Governance Implementation specialist. Generate a detailed, actionable governance playbook grounded in ${req.framework}.

${orgBlock ? orgBlock + '\n\n' : ''}## Framework Phases (use these as the basis for your phases)
${phasesContext}

## Instructions
- Generate ${phaseCount} phases matching the structure above
- Each phase must have 3–6 concrete tasks with realistic effort estimates
- Tasks must have specific owners from: AI Governance Lead, Business Owner, Security Team, Privacy/Legal, IT/Engineering, HR/Training, Risk/Compliance, Executive Sponsor
- Ground each phase's tasks in the NIST subcategories listed for that phase
- KPIs must be measurable with defined targets and measurement methods
- All output must be specific to the use case described — do not use generic placeholder text

Respond ONLY with a valid JSON object.`;

    const userPrompt = `Generate a complete AI governance playbook.

Framework: ${req.framework}
Risk Tier: ${req.riskTier}
Use Case Name: ${req.useCaseName ?? 'AI Use Case'}
${req.focusAreas?.length ? `Focus Areas: ${req.focusAreas.join(', ')}` : ''}

Use Case Description:
${req.useCaseDescription}

Return a JSON object with this exact structure:
{
  "title": "${req.framework} Governance Playbook — ${req.useCaseName ?? 'AI Use Case'}",
  "framework": "${req.framework}",
  "riskTier": "${req.riskTier}",
  "useCaseName": "${req.useCaseName ?? 'AI Use Case'}",
  "summary": string,  // 2–3 paragraph executive summary
  "phases": [
    {
      "phaseNumber": number,
      "phaseName": string,
      "duration": string,
      "objectives": string[],
      "tasks": [
        {
          "taskId": string,      // e.g. "P1-T1"
          "name": string,
          "description": string,
          "owner": string,       // one of the valid owner roles
          "priority": "critical" | "high" | "medium" | "low",
          "effort": string,      // e.g. "2–3 days"
          "dependsOn": string[], // task IDs this depends on, or []
          "nistActions": string[], // NIST subcategory refs e.g. ["GOVERN 1.1"]
          "output": string       // tangible deliverable produced
        }
      ],
      "nistActionsSource": string[],
      "deliverables": string[],
      "documentationRequirements": string[]
    }
  ],
  "kpis": [
    {
      "metric": string,
      "target": string,
      "measurementMethod": string,
      "frequency": string
    }
  ],
  "totalDuration": string,
  "frameworkVersions": ${JSON.stringify(frameworkVersions[req.framework] ?? frameworkVersions['NIST AI RMF'])},
  "generatedAt": "${now}",
  "markdownExport": ""
}`;

    const raw = await callOpenAIJson(openai, systemPrompt, userPrompt, 4000);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('[PlaybookOrchestrator] Failed to parse OpenAI JSON response');
    }

    const data = parsed as PlaybookOutput;
    data.markdownExport = buildPlaybookMarkdown(data);

    const result = playbookSchema.safeParse(data);
    if (!result.success) {
      console.error('[PlaybookOrchestrator] Zod validation failed:', result.error.flatten());
      throw new Error('[PlaybookOrchestrator] Playbook output failed validation');
    }
    return result.data;
  }
}

function buildPlaybookMarkdown(pb: PlaybookOutput): string {
  const lines: string[] = [
    `# ${pb.title}`,
    `**Framework:** ${pb.framework} | **Risk Tier:** ${pb.riskTier} | **Duration:** ${pb.totalDuration}`,
    `**Generated:** ${new Date(pb.generatedAt).toLocaleDateString('en-GB')}`,
    `**Versions:** ${pb.frameworkVersions.join(', ')}`,
    ``,
    `## Executive Summary`,
    pb.summary,
    ``,
  ];

  for (const phase of pb.phases) {
    lines.push(`## Phase ${phase.phaseNumber}: ${phase.phaseName}`);
    lines.push(`**Duration:** ${phase.duration}`);
    lines.push(`**Objectives:** ${phase.objectives.join('; ')}`);
    lines.push('');
    lines.push('### Tasks');
    for (const task of phase.tasks) {
      lines.push(`#### ${task.taskId} — ${task.name}`);
      lines.push(`**Owner:** ${task.owner} | **Priority:** ${task.priority} | **Effort:** ${task.effort}`);
      lines.push(task.description);
      lines.push(`**Output:** ${task.output}`);
      if (task.nistActions.length) lines.push(`**NIST:** ${task.nistActions.join(', ')}`);
      lines.push('');
    }
    if (phase.deliverables.length) {
      lines.push('### Deliverables');
      phase.deliverables.forEach(d => lines.push(`- ${d}`));
      lines.push('');
    }
  }

  if (pb.kpis.length) {
    lines.push('## KPIs');
    lines.push('| Metric | Target | Method | Frequency |');
    lines.push('|--------|--------|--------|-----------|');
    pb.kpis.forEach(k => lines.push(`| ${k.metric} | ${k.target} | ${k.measurementMethod} | ${k.frequency} |`));
  }

  return lines.join('\n');
}

export const playbookOrchestrator = new PlaybookOrchestrator();

// ─── Phase 3: framework-specific phase context builders ─────────────────────

import {
  AI_CHEF_STATIONS,
  GOVSECURE_90_DAY_PHASES,
} from '@/data/govsecurePlaybooks';
import {
  GOVSECURE_POLICY_SUITE,
  GOVSECURE_RISK_MODEL,
} from '@/data/govsecureKnowledge';
import { AUTO_HIGH_TRIGGERS as AUTO_HIGH_TRIGGER_DEFS } from './documentTemplates';

/**
 * Returns a GovSecure-flavored slice of context tailored to each agent role.
 * Phase 4 — every agent now sees the GovSecure methodology in addition to
 * the regulatory framework data. Returns `null` when no GovSecure context
 * is meaningful for the role (defensive — current matrix covers all agents).
 */
function getGovSecureAgentContext(agentId: string): string | null {
  switch (agentId) {
    case 'risk-assessor': {
      const tiers = GOVSECURE_RISK_MODEL.tiers
        .map(t => `- ${t.tier} (Level ${t.numericLevel}): ${t.shortDescription}`)
        .join('\n');
      const triggers = AUTO_HIGH_TRIGGER_DEFS
        .map(t => `- ${t.id}: ${t.description}`)
        .join('\n');
      const kitchen = AI_CHEF_STATIONS
        .find(s => s.id === 'S2');
      return [
        'GOVSECURE 4-TIER RISK MODEL — apply this when assigning risk levels:',
        tiers,
        '',
        'GOVSECURE AUTO-HIGH TRIGGERS — fire any of these to force tier ≥ High:',
        triggers,
        kitchen
          ? `\nGovSecure Risk Assessment Kitchen (Station ${kitchen.id}): ${kitchen.purpose}`
          : '',
      ].filter(Boolean).join('\n');
    }
    case 'compliance-expert': {
      const tierLines = GOVSECURE_POLICY_SUITE.tiers
        .map(t => {
          const policies = t.policies
            .slice(0, 6)
            .map(p => `  - ${p.name}`)
            .join('\n');
          return `- ${t.tier} tier (${t.policies.length} policies): ${t.description}\n${policies}`;
        })
        .join('\n\n');
      return [
        'GOVSECURE POLICY SUITE MAP — recommend policies from this 15-policy structure',
        '(Starter → Operational → Maturity tiers map to client lifecycle stage):',
        tierLines,
        '',
        'When discussing compliance, name the GovSecure policy that satisfies each',
        'NIST/EU/ISO/GDPR obligation rather than listing the obligation alone.',
      ].join('\n');
    }
    case 'policy-architect': {
      const stations = AI_CHEF_STATIONS
        .map(s => `- Station ${s.id} (${s.name}): ${s.purpose}`)
        .join('\n');
      const policies = GOVSECURE_POLICY_SUITE.tiers
        .flatMap(t => t.policies.map(p => `- ${p.name} [${t.tier}]`))
        .join('\n');
      return [
        'GOVSECURE AI CHEF™ OPERATING MODEL — 6 governance stations:',
        stations,
        '',
        'GOVSECURE 15-POLICY SUITE (Starter / Operational / Maturity tiers):',
        policies,
        '',
        'When recommending organizational structure, anchor it in the AI Chef stations',
        '(governance lead, station owners, recipe-level RACI) rather than inventing a new model.',
      ].join('\n');
    }
    case 'implementation-advisor': {
      const phases = GOVSECURE_90_DAY_PHASES
        .map(p =>
          `- ${p.name} (${p.weekRange}, ${p.durationDays} days, NIST: ${p.nistFunctionAlignment.join('/')})\n  Objectives: ${p.objectives.slice(0, 3).join('; ')}`,
        )
        .join('\n\n');
      return [
        'GOVSECURE 90-DAY IMPLEMENTATION BLUEPRINT — use this as the default rollout plan',
        'when no contrary timing constraint exists:',
        phases,
        '',
        'Default to GovSecure phase weeks rather than reinventing a Quarter 1/2/3 plan.',
        'For SMB resource constraints, name the AI Chef station that owns each task.',
      ].join('\n');
    }
    default:
      return null;
  }
}

function buildPhasesContext(req: PlaybookRequest): string {
  if (req.framework === 'GovSecure AI Chef') {
    return AI_CHEF_STATIONS.map((s, i) =>
      `Phase ${i + 1} — ${s.name} (Station ${s.id})\n` +
      `Purpose: ${s.purpose}\n` +
      `Map this AI Chef station to a playbook phase. Tasks should reflect the recipes ` +
      `(intake, risk-tiering, policy authoring, vendor diligence, monitoring, incident response) ` +
      `that the station owns in the GovSecure operating model.`,
    ).join('\n\n');
  }

  if (req.framework === 'GovSecure 90-Day Blueprint') {
    return GOVSECURE_90_DAY_PHASES.map((p, i) =>
      `Phase ${i + 1}: ${p.name}\n` +
      `Duration: ${p.durationDays} days (${p.weekRange})\n` +
      `NIST function alignment: ${p.nistFunctionAlignment.join(', ')}\n` +
      `Objectives: ${p.objectives.join('; ')}`,
    ).join('\n\n');
  }

  return NIST_PLAYBOOK_PHASES.map(p =>
    `Phase ${p.phaseNumber}: ${p.phaseName}\n` +
    `Duration (${req.riskTier}): ${p.durationGuide[req.riskTier as 'Low' | 'Medium' | 'High'] ?? p.durationGuide.High}\n` +
    `Objectives: ${p.objectives.join('; ')}\n` +
    `NIST Subcategories: ${p.nistSubcategories.join(', ')}` +
    (p.euAiActArticles ? `\nEU AI Act: ${p.euAiActArticles.join(', ')}` : '') +
    (p.iso42001Clauses ? `\nISO 42001: ${p.iso42001Clauses.join(', ')}` : ''),
  ).join('\n\n');
}

function countPhases(req: PlaybookRequest): number {
  if (req.framework === 'GovSecure AI Chef') return AI_CHEF_STATIONS.length;
  if (req.framework === 'GovSecure 90-Day Blueprint') return GOVSECURE_90_DAY_PHASES.length;
  return NIST_PLAYBOOK_PHASES.length;
}