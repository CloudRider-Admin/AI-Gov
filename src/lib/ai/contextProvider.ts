import { useEffect, useState } from 'react';

export interface PageContext {
  currentPage: string;
  section: string;
  userJourney: 'discovery' | 'learning' | 'implementation' | 'advanced';
  relevantContent: string[];
  userIntent: string;
}

export interface AIContext {
  pageContext: PageContext;
  userProfile: {
    experienceLevel: 'beginner' | 'intermediate' | 'expert';
    industry?: string;
    companySize?: 'startup' | 'small' | 'medium' | 'large';
    previousQueries: string[];
  };
  sessionData: {
    timeOnPage: number;
    interactionCount: number;
    lastActivity: string;
  };
}

export function useAIContext(): AIContext {
  const [context, setContext] = useState<AIContext>({
    pageContext: {
      currentPage: '/',
      section: 'hero',
      userJourney: 'discovery',
      relevantContent: [],
      userIntent: 'exploring AI governance'
    },
    userProfile: {
      experienceLevel: 'beginner',
      previousQueries: []
    },
    sessionData: {
      timeOnPage: 0,
      interactionCount: 0,
      lastActivity: new Date().toISOString()
    }
  });

  useEffect(() => {
    // Track page context
    const updatePageContext = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      
      let section = 'hero';
      let userJourney: PageContext['userJourney'] = 'discovery';
      let relevantContent: string[] = [];
      let userIntent = 'exploring AI governance';

      // Determine context based on current location
      if (path === '/') {
        if (hash.includes('#advisor')) {
          section = 'advisor';
          userJourney = 'implementation';
          userIntent = 'seeking specific AI governance advice';
          relevantContent = ['risk assessment', 'policy templates', 'compliance frameworks'];
        } else if (hash.includes('#playbooks')) {
          section = 'playbooks';
          userJourney = 'learning';
          userIntent = 'learning about governance frameworks';
          relevantContent = ['NIST AI RMF', 'ISO 42001', 'EU AI Act'];
        } else if (hash.includes('#templates')) {
          section = 'templates';
          userJourney = 'implementation';
          userIntent = 'looking for practical tools';
          relevantContent = ['policy templates', 'risk assessments', 'audit checklists'];
        }
      } else if (path.startsWith('/learn')) {
        userJourney = 'learning';
        userIntent = 'deepening AI governance knowledge';
        relevantContent = ['educational content', 'best practices', 'case studies'];
      } else if (path.startsWith('/playbooks')) {
        userJourney = 'implementation';
        userIntent = 'implementing governance frameworks';
        relevantContent = ['step-by-step guides', 'implementation templates'];
      }

      setContext(prev => ({
        ...prev,
        pageContext: {
          currentPage: path,
          section,
          userJourney,
          relevantContent,
          userIntent
        }
      }));
    };

    // Initial context update
    updatePageContext();

    // Listen for navigation changes
    const handleHashChange = () => updatePageContext();
    window.addEventListener('hashchange', handleHashChange);

    // Track time on page
    const startTime = Date.now();
    const interval = setInterval(() => {
      setContext(prev => ({
        ...prev,
        sessionData: {
          ...prev.sessionData,
          timeOnPage: Math.floor((Date.now() - startTime) / 1000)
        }
      }));
    }, 1000);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearInterval(interval);
    };
  }, []);

  // Method to update user interaction
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const trackInteraction = (_type: string, _data?: unknown) => {
    setContext(prev => ({
      ...prev,
      sessionData: {
        ...prev.sessionData,
        interactionCount: prev.sessionData.interactionCount + 1,
        lastActivity: new Date().toISOString()
      }
    }));
  };

  // Method to update user profile based on queries
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateUserProfile = (query: string, _response?: unknown) => {
    setContext(prev => {
      const newQueries = [...prev.userProfile.previousQueries, query].slice(-10); // Keep last 10 queries
      
      // Infer experience level from query complexity
      let experienceLevel = prev.userProfile.experienceLevel;
      if (query.includes('NIST') || query.includes('ISO') || query.includes('compliance framework')) {
        experienceLevel = query.length > 100 ? 'expert' : 'intermediate';
      }

      return {
        ...prev,
        userProfile: {
          ...prev.userProfile,
          experienceLevel,
          previousQueries: newQueries
        }
      };
    });
  };

  return {
    ...context,
    trackInteraction,
    updateUserProfile
  } as AIContext & {
    trackInteraction: (type: string, data?: unknown) => void;
    updateUserProfile: (query: string, response?: unknown) => void;
  };
}

export function generateContextualPrompt(context: AIContext, query: string): string {
  const { pageContext, userProfile, sessionData } = context;
  
  let contextPrompt = `User Context:
- Current page: ${pageContext.currentPage}
- Section: ${pageContext.section}
- User journey stage: ${pageContext.userJourney}
- User intent: ${pageContext.userIntent}
- Experience level: ${userProfile.experienceLevel}
- Time on page: ${sessionData.timeOnPage} seconds
- Interaction count: ${sessionData.interactionCount}

Relevant content for this context: ${pageContext.relevantContent.join(', ')}

`;

  // Add experience-level specific guidance
  if (userProfile.experienceLevel === 'beginner') {
    contextPrompt += `The user is a beginner, so:
- Explain technical terms and acronyms
- Provide step-by-step guidance
- Focus on practical, actionable advice
- Avoid overwhelming with too many options

`;
  } else if (userProfile.experienceLevel === 'expert') {
    contextPrompt += `The user is experienced, so:
- Use technical terminology appropriately
- Provide detailed, nuanced analysis
- Reference specific standards and frameworks
- Focus on advanced implementation strategies

`;
  }

  // Add journey-specific context
  if (pageContext.userJourney === 'discovery') {
    contextPrompt += `User is in discovery phase - focus on education and awareness building.
`;
  } else if (pageContext.userJourney === 'implementation') {
    contextPrompt += `User is ready to implement - provide specific, actionable recommendations.
`;
  }

  // Add previous query context if available
  if (userProfile.previousQueries.length > 0) {
    contextPrompt += `Previous queries in this session: ${userProfile.previousQueries.slice(-3).join('; ')}
`;
  }

  return contextPrompt + `\nUser Query: ${query}`;
}