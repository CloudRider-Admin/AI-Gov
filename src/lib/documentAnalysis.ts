/**
 * AI-powered gap analysis for uploaded governance documents.
 *
 * Sends extracted document text to GPT with framework-specific prompts
 * to identify missing sections, compliance gaps, and improvement recommendations.
 */

import OpenAI from 'openai';
import { recordTokenUsage, countTokens } from './tokenBudget';
import { openaiCircuit } from './circuitBreaker';

interface AnalysisParams {
  userId: string;
  documentText: string;
  fileName: string;
  framework: string;
}

export interface GapAnalysisResult {
  summary: string;
  overallScore: number; // 0-100 compliance score
  frameworkAlignment: {
    framework: string;
    coverage: string; // "low" | "medium" | "high"
    gaps: string[];
  }[];
  missingSections: {
    section: string;
    importance: string; // "critical" | "high" | "medium" | "low"
    recommendation: string;
  }[];
  strengths: string[];
  recommendations: string[];
}

const FRAMEWORK_CHECKLIST: Record<string, string> = {
  'NIST AI RMF': `
Check against NIST AI RMF requirements:
- GOVERN: governance structure, AI policy, roles and responsibilities, risk culture
- MAP: AI system categorization, stakeholder analysis, risk identification
- MEASURE: metrics, testing, monitoring, bias assessment
- MANAGE: risk response, incident management, change management`,

  'EU AI Act': `
Check against EU AI Act requirements:
- Risk classification (prohibited/high-risk/limited/minimal)
- Data governance and quality
- Technical documentation
- Transparency and user information
- Human oversight measures
- Accuracy, robustness, cybersecurity
- Record-keeping obligations`,

  'ISO/IEC 42001': `
Check against ISO/IEC 42001 requirements:
- Context of the organization (Clause 4)
- Leadership and commitment (Clause 5)
- Planning for risks and opportunities (Clause 6)
- Support: resources, competence, awareness (Clause 7)
- Operations: AI lifecycle management (Clause 8)
- Performance evaluation (Clause 9)
- Improvement and corrective actions (Clause 10)`,

  'Combined': `
Check against all major frameworks:
1. NIST AI RMF: GOVERN, MAP, MEASURE, MANAGE functions
2. EU AI Act: risk classification, transparency, human oversight, data governance
3. ISO/IEC 42001: management system, lifecycle, audit
4. GDPR (for AI): data protection impact assessment, automated decision-making, consent`,
};

export async function analyzeDocumentGaps(params: AnalysisParams): Promise<GapAnalysisResult> {
  const { userId, documentText, fileName, framework } = params;

  const frameworkChecklist = FRAMEWORK_CHECKLIST[framework] ?? FRAMEWORK_CHECKLIST['Combined'];

  const systemPrompt = `You are an AI governance compliance analyst. You analyze governance documents, policies, and frameworks to identify gaps, missing sections, and compliance issues.

You must respond with a JSON object using EXACTLY this structure:
{
  "summary": "2-3 sentence overview of the document's governance coverage",
  "overallScore": 0-100 (compliance completeness score),
  "frameworkAlignment": [
    { "framework": "name", "coverage": "low|medium|high", "gaps": ["gap1", "gap2"] }
  ],
  "missingSections": [
    { "section": "name", "importance": "critical|high|medium|low", "recommendation": "what to add" }
  ],
  "strengths": ["strength1", "strength2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

  const userPrompt = `Analyze this uploaded governance document for compliance gaps.

File: ${fileName}
Target framework: ${framework}

${frameworkChecklist}

--- DOCUMENT CONTENT ---
${documentText}
--- END DOCUMENT ---

Provide a thorough gap analysis comparing this document against the target framework requirements. Identify what's covered, what's missing, and what needs improvement.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openaiCircuit.execute(() =>
    openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    }),
  );

  const content = response.choices[0]?.message?.content ?? '{}';

  // Record token usage
  recordTokenUsage({
    userId,
    endpoint: 'documents/upload',
    promptTokens: response.usage?.prompt_tokens ?? countTokens(systemPrompt + userPrompt),
    completionTokens: response.usage?.completion_tokens ?? countTokens(content),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  });

  try {
    return JSON.parse(content) as GapAnalysisResult;
  } catch {
    return {
      summary: 'Failed to parse analysis results.',
      overallScore: 0,
      frameworkAlignment: [],
      missingSections: [],
      strengths: [],
      recommendations: ['Re-upload the document and try again.'],
    };
  }
}