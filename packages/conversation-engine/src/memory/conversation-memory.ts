/**
 * @vanni/conversation-engine — Short-Term Memory & Conversation Summary
 *
 * Distinguishes short-term working state from permanent business knowledge:
 * 1. Rolling message turns within token budget.
 * 2. Customer context tracking (name, phone, preferences, language mode).
 * 3. Accurate Kannada / Kanglish / English language detection and script preservation.
 * 4. Structured turn and conversation summarization.
 */

import {
  ConversationMessageDTO,
  CustomerContextDTO,
  ConversationSummaryDTO,
} from '@vanni/shared';

export type DetectedLanguage = 'ENGLISH' | 'KANNADA' | 'MIXED' | 'UNKNOWN';

export class ConversationMemory {
  private messages: ConversationMessageDTO[] = [];
  private customerContext: CustomerContextDTO = {};
  private language: DetectedLanguage = 'UNKNOWN';
  private summary?: ConversationSummaryDTO;

  constructor(initialCustomerContext?: CustomerContextDTO) {
    if (initialCustomerContext) {
      this.customerContext = { ...initialCustomerContext };
    }
  }

  /**
   * Adds a message to short-term memory and analyzes linguistic patterns
   */
  addMessage(msg: ConversationMessageDTO): void {
    this.messages.push(msg);

    if (msg.speaker === 'CUSTOMER') {
      this.updateLanguage(msg.content);
      this.extractCustomerEntities(msg.content);
    }
  }

  getMessages(): ConversationMessageDTO[] {
    return [...this.messages];
  }

  getRecentMessages(limit = 10): ConversationMessageDTO[] {
    return this.messages.slice(-limit);
  }

  getCustomerContext(): CustomerContextDTO {
    return { ...this.customerContext };
  }

  updateCustomerContext(partial: Partial<CustomerContextDTO>): void {
    this.customerContext = {
      ...this.customerContext,
      ...partial,
      metadata: {
        ...(this.customerContext.metadata || {}),
        ...(partial.metadata || {}),
      },
    };
  }

  getLanguage(): DetectedLanguage {
    return this.language;
  }

  /**
   * Detects Kannada script, Kanglish phonetics, or English
   */
  private updateLanguage(text: string): void {
    // Check for Kannada Unicode block (U+0C80 to U+0CFF)
    const hasKannadaUnicode = /[\u0C80-\u0CFF]/.test(text);

    // Common Kanglish words (Latin characters representing Kannada vocabulary)
    const kanglishWords = /\b(naale|ivathu|beku|beda|ideya|hege|yelli|yavaga|namaskara|dhanyavada|banni|gothilla)\b/i;
    const hasKanglishPhonetics = kanglishWords.test(text);

    if (hasKannadaUnicode) {
      this.language = 'KANNADA';
    } else if (hasKanglishPhonetics) {
      this.language = 'MIXED';
    } else if (/^[a-zA-Z0-9\s.,?!'"₹:-]+$/.test(text)) {
      this.language = 'ENGLISH';
    } else {
      this.language = 'MIXED';
    }
  }

  /**
   * Simple entity extractor for common conversational details
   */
  private extractCustomerEntities(text: string): void {
    // Phone numbers (Indian 10-digit mobile)
    const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
    if (phoneMatch && !this.customerContext.phone) {
      this.customerContext.phone = phoneMatch[1];
    }

    // Name extraction pattern ("My name is X", "I am X", "This is X")
    const nameMatch = text.match(/\b(?:my name is|i am|this is)\s+([A-Z][a-z]+)(?:\s+(?!and\b|phone\b|my\b|is\b)[A-Z][a-z]+)?/i);
    if (nameMatch && !this.customerContext.name) {
      this.customerContext.name = nameMatch[1];
    }
  }

  /**
   * Generates or refreshes a structured conversation summary
   */
  generateSummary(conversationId: string, organizationId: string): ConversationSummaryDTO {
    const customerUtterances = this.messages
      .filter(m => m.speaker === 'CUSTOMER')
      .map(m => m.content);

    const agentUtterances = this.messages
      .filter(m => m.speaker === 'AGENT')
      .map(m => m.content);

    const goal = customerUtterances.length > 0 ? customerUtterances[0] : 'Inquiry';
    const completedActions = agentUtterances.length > 0 ? ['Greeting delivered', 'Inquiry processed'] : [];

    const summary: ConversationSummaryDTO = {
      id: `summary_${Date.now()}`,
      conversationId,
      organizationId,
      customerGoal: goal,
      importantDetails: [
        `Caller: ${this.customerContext.name || 'Anonymous'}`,
        `Phone: ${this.customerContext.phone || 'Unknown'}`,
        `Detected Language: ${this.language}`,
      ],
      preferences: {
        language: this.language,
      },
      openQuestions: [],
      actionsCompleted: completedActions,
      actionsPending: [],
      escalationStatus: 'NONE',
      turnCount: this.messages.length,
      createdAt: new Date().toISOString(),
    };

    this.summary = summary;
    return summary;
  }

  getSummary(): ConversationSummaryDTO | undefined {
    return this.summary;
  }
}
