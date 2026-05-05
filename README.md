# AI Governance Platform

A modular, scalable organizational website for SMBs focused on AI Governance.

## 🎯 Project Overview

**Design System:** Retro Lo-Fi meets Modern High-Performance
- Terminal aesthetics with high-contrast black/white/green schema
- Monospaced fonts (Space Mono) for headers, clean sans-serif (Inter) for body
- Smooth transitions, fast loading, responsive layouts

## 🏗️ Architecture

This project follows a **microservices-ready** architecture:

- **Frontend:** Next.js 14 with App Router
- **Styling:** Tailwind CSS with custom design tokens
- **Content:** CMS-ready data structures (easily migrated to headless CMS)
- **Future:** Prepared for Python/FastAPI backend and Multi-Agent AI system

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Global layout + fonts
│   ├── page.tsx            # Landing page
│   └── globals.css         # Tailwind + custom styles
├── components/
│   ├── sections/           # Page sections
│   │   ├── Hero.tsx
│   │   ├── Audience.tsx
│   │   ├── ValueProposition.tsx
│   │   ├── Playbooks.tsx
│   │   ├── VisualGuides.tsx
│   │   ├── Templates.tsx
│   │   └── Footer.tsx
│   └── advisor/            # Standalone AI Advisor module
│       └── Advisor.tsx     # Entry point for future GPT/Agent integration
├── data/                   # CMS-ready content structures
│   ├── content.ts          # Playbooks, templates, audience data
│   └── topics.ts           # Topic/Category map for content strategy
└── lib/                    # Utilities (future API hooks)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your OpenAI API key

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### 🔑 AI Setup Requirements

1. **OpenAI API Key**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Environment Configuration**: Add to `.env.local`:
   ```bash
   OPENAI_API_KEY=your-openai-api-key-here
   ```
3. **Dependencies**: The OpenAI package is included in package.json
4. **Model Access**: Ensure you have access to GPT-4 Turbo Preview

### 🚀 AI Features Usage

**Basic AI Advisor**:
- Navigate to the AI Advisor section on the homepage
- Ask questions about AI governance, risk assessment, or compliance
- Get structured responses with risk profiles, policy recommendations, and regulatory guidance

**Advanced Features**:
- **Conversation History**: Previous questions provide context for better responses
- **Multi-Agent Analysis**: Different AI specialists analyze your query from multiple perspectives
- **Context Awareness**: Responses adapt based on your current page and user journey stage
- **Streaming Responses**: Real-time response generation for better user experience

## 📦 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 🎨 Design Tokens

Custom colors defined in `tailwind.config.ts`:

| Token | Value | Usage |
|-------|-------|-------|
| `terminal-black` | `#0a0a0a` | Background |
| `terminal-green` | `#00ff88` | Primary accent |
| `terminal-cyan` | `#00d4ff` | Secondary accent |
| `terminal-amber` | `#ffb800` | Warning/Leadership |
| `terminal-text` | `#e0e0e0` | Body text |
| `terminal-muted` | `#888888` | Muted text |

## 🤖 AI Integration Features

The AI Advisor system includes comprehensive AI governance capabilities:

### **Core AI Features**
- **Real-time AI Analysis**: OpenAI GPT-4 powered governance recommendations
- **Conversation History**: Context-aware multi-turn conversations
- **Multi-Agent System**: Specialized agents for risk, compliance, policy, and implementation
- **Context Awareness**: Page and user journey-aware responses
- **Streaming Responses**: Real-time response streaming for better UX
- **Knowledge Base**: RAG integration with governance frameworks

### **AI Agent Specialists**
1. **Risk Assessment Specialist**: Evaluates AI risks and assigns risk levels
2. **Regulatory Compliance Expert**: Maps regulations (GDPR, EU AI Act, NIST AI RMF)
3. **AI Policy Architect**: Designs governance policies and procedures
4. **Implementation Strategy Advisor**: Creates practical rollout plans

### **API Endpoints**
- `POST /api/advisor` - Standard AI analysis with structured responses
- `POST /api/advisor/stream` - Streaming AI responses for real-time UX

## 📝 Content Management

All content is stored in `src/data/` as TypeScript interfaces, ready for headless CMS migration:

- **content.ts:** Hero copy, audience cards, playbooks, templates
- **topics.ts:** Category/topic structure for content strategy

## 🔒 Compliance Alignment

Built with governance frameworks in mind:
- NIST AI RMF
- ISO/IEC 42001
- EU AI Act

## 🔧 Development

### AI System Architecture

```
src/
├── app/api/advisor/           # AI API endpoints
│   ├── route.ts              # Standard AI analysis
│   └── stream/route.ts       # Streaming responses
├── components/advisor/        # AI Advisor UI components
├── lib/
│   ├── ai/                   # AI system modules
│   │   ├── contextProvider.ts # Context-aware AI
│   │   ├── multiAgent.ts     # Multi-agent orchestration
│   │   └── knowledgeBase.ts  # RAG knowledge base
│   └── hooks/
│       └── useConversationHistory.ts # Conversation management
```

### Extending the AI System

**Adding New Agents**:
```typescript
const newAgent: Agent = {
  id: 'custom-agent',
  name: 'Custom Specialist',
  role: 'supporting',
  expertise: ['domain expertise'],
  systemPrompt: 'Your specialized prompt...'
};
```

**Adding Knowledge Base Content**:
```typescript
knowledgeBase.addDocument({
  id: 'new-doc',
  title: 'New Governance Topic',
  content: 'Detailed content...',
  category: 'framework',
  tags: ['relevant', 'tags'],
  source: 'Source Name',
  lastUpdated: new Date().toISOString()
});
```

### Troubleshooting

**Common Issues**:
1. **OpenAI API Errors**: Check API key validity and rate limits
2. **TypeScript Errors**: Run `npm install` to ensure all dependencies are installed
3. **Streaming Issues**: Verify browser supports Server-Sent Events
4. **Context Not Working**: Check page navigation and hash changes

## 📄 License

Private - All rights reserved.
