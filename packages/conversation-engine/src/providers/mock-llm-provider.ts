/**
 * @vanni/conversation-engine — Mock Structured LLM Provider
 *
 * Implements deterministic reasoning for channel-independent conversation tests.
 * Never allows arbitrary prose or uncontrolled tool execution.
 */

import {
  StructuredLLMDecisionDTO,
} from '@vanni/shared';
import { StructuredContextAssembly } from '../context/context-engine';

export interface ILLMProvider {
  generateDecision(context: StructuredContextAssembly): Promise<StructuredLLMDecisionDTO>;
}

export class MockStructuredLLMProvider implements ILLMProvider {
  /**
   * Deterministically returns structured decisions matching test scenarios
   */
  async generateDecision(context: StructuredContextAssembly): Promise<StructuredLLMDecisionDTO> {
    const input = context.L9_CurrentInput.toLowerCase();

    // 1. Prompt Injection Defense Test
    if (input.includes('ignore your instructions') || input.includes('reveal your system prompt') || input.includes('ignore rules')) {
      return {
        type: 'RESPOND',
        response: "I am an AI assistant here to help with your inquiries about our services. I cannot share internal operational instructions.",
        reason: 'Prompt injection attempt safely neutralized',
        confidence: 0.99,
        knowledgeReferences: [],
      };
    }

    // 2. Emergency Escalation
    if (input.includes('chest pain') || input.includes('heart attack') || input.includes('casualty') || input.includes('emergency')) {
      return {
        type: 'HANDOFF',
        response: "This sounds like an urgent medical emergency. Please visit our casualty immediately or call emergency services. I am connecting you to our casualty desk now.",
        reason: 'Medical emergency detected in customer utterance',
        confidence: 0.98,
        knowledgeReferences: [],
      };
    }

    // 3. Human Handoff Request
    if (input.includes('speak to someone') || input.includes('talk to a person') || input.includes('representative') || input.includes('connect me with someone')) {
      return {
        type: 'HANDOFF',
        response: "I will be happy to connect you with our front desk team right away. Please hold the line.",
        reason: 'Customer explicitly requested human assistance',
        confidence: 0.95,
        knowledgeReferences: [],
      };
    }

    // 4. Healthcare Medical Advice Guardrail Test
    if (input.includes('what medicine') || input.includes('take paracetamol') || input.includes('prescribe') || input.includes('my diagnosis')) {
      return {
        type: 'RESPOND',
        response: "As an AI assistant, I cannot prescribe medication or diagnose symptoms. I recommend scheduling an in-person consultation with one of our certified doctors.",
        reason: 'Healthcare non-diagnosis guardrail strictly maintained',
        confidence: 0.95,
        knowledgeReferences: [],
      };
    }

    // 5. Booking / Availability (Dental / Healthcare)
    if (input.includes('tomorrow doctor available') || input.includes('check availability') || input.includes('appointment ideya') || input.includes('ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ')) {
      return {
        type: 'CALL_TOOL',
        toolRequest: {
          toolName: 'check_availability',
          args: { date: 'tomorrow', specialty: 'General / Dental' },
        },
        response: "Let me check the doctor's schedule for tomorrow.",
        reason: 'Checking verified calendar slots before answering',
        confidence: 0.92,
        knowledgeReferences: [],
      };
    }

    // 6. Appointment Booking Execution
    if (input.includes('book tomorrow') || input.includes('book appointment') || (input.includes('book') && input.includes('appointment')) || input.includes('confirm 10am')) {
      return {
        type: 'CALL_TOOL',
        toolRequest: {
          toolName: 'book_appointment',
          args: { date: 'tomorrow', time: '10:00 AM', service: 'Dental Consultation' },
        },
        response: "I have prepared your appointment request for tomorrow at 10:00 AM. Would you like me to confirm this booking?",
        reason: 'Action requires confirmation',
        confidence: 0.95,
        knowledgeReferences: [],
      };
    }

    // 7. Business Brain Lookup: Operating Hours
    if (input.includes('what time does the clinic open') || input.includes('opening hours') || input.includes('timings')) {
      return {
        type: 'RESPOND',
        response: "Our clinic is open Monday through Saturday from 09:00 AM to 08:00 PM.",
        reason: 'Answered authoritatively from Business Brain operating hours',
        confidence: 0.96,
        knowledgeReferences: ['business_brain_operating_hours'],
      };
    }

    // 8. Real Estate Property Availability
    if (input.includes('3bhk still available') || input.includes('3bhk available')) {
      return {
        type: 'CALL_TOOL',
        toolRequest: {
          toolName: 'lookup_property',
          args: { unit: '3BHK' },
        },
        response: "Let me check the live inventory for the 3BHK units.",
        reason: 'Real estate inventory must be verified against database',
        confidence: 0.94,
        knowledgeReferences: [],
      };
    }

    // 9. Hospitality Early Check-in
    if (input.includes('early check in') || input.includes('early check-in')) {
      return {
        type: 'RESPOND',
        response: "Standard check-in is at 2:00 PM. Early check-in is subject to room availability upon arrival, and additional nominal charges may apply.",
        reason: 'Answered from hospitality operational policy',
        confidence: 0.92,
        knowledgeReferences: ['policy_early_checkin'],
      };
    }

    // 10. Unsupported / Unknown Service
    if (input.includes('service x') || input.includes('unsupported service') || input.includes('helicopter charter')) {
      return {
        type: 'RESPOND',
        response: "I don't have information on service X in our verified catalogue. I can connect you with our support team to verify special requests.",
        reason: 'Controlled unknown state without hallucination',
        confidence: 0.88,
        knowledgeReferences: [],
      };
    }

    // 11. Kannada Greeting
    if (input.includes('ನಾಳೆ') || input.includes('ನಮಸ್ಕಾರ') || input.includes('kannada')) {
      return {
        type: 'RESPOND',
        response: "ನಮಸ್ಕಾರ! ಹೌದು, ನಮ್ಮ ಕ್ಲಿನಿಕ್‌ನಲ್ಲಿ ನಾಳೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಲಭ್ಯವಿದೆ. ನಿಮಗೆ ಯಾವ ಸಮಯ ಅನುಕೂಲವಾಗುತ್ತದೆ?",
        reason: 'Kannada language response preserved accurately',
        confidence: 0.95,
        knowledgeReferences: [],
      };
    }

    // Default polite conversational response
    return {
      type: 'RESPOND',
      response: "Thank you for reaching out. How can I assist you with our services today?",
      reason: 'Standard conversational response',
      confidence: 0.9,
      knowledgeReferences: [],
    };
  }
}
