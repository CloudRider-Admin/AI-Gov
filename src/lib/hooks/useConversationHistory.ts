import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    riskLevel?: string;
    confidence?: number;
    conversationId?: string;
  };
}

export interface ConversationHistory {
  messages: Message[];
  conversationId: string | null;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  getContext: (maxMessages?: number) => string;
}

export function useConversationHistory(): ConversationHistory {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);

    // Set conversation ID from assistant messages
    if (message.role === 'assistant' && message.metadata?.conversationId) {
      setConversationId(message.metadata.conversationId);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const getContext = useCallback((maxMessages: number = 5) => {
    const recentMessages = messages.slice(-maxMessages);
    return recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
  }, [messages]);

  return {
    messages,
    conversationId,
    addMessage,
    clearHistory,
    getContext,
  };
}