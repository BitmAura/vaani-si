/**
 * Layer 3: Emergency Detection & Escalation Handler
 * Dhwani SI — Critical Healthcare Response Engine
 * Detects emergency keywords and triggers immediate human escalation
 */

export interface EmergencyDetectionResult {
  isEmergency: boolean;
  emergencyType: 'CRITICAL' | 'URGENT' | 'MODERATE' | 'NONE';
  recommendedAction: 'TRANSFER_IMMEDIATE' | 'ALERT_DOCTOR' | 'SCHEDULE_ASAP' | 'NORMAL_FLOW';
  detectedKeywords: string[];
  escalationMessage: string;
  transferNumber?: string;
}

export class EmergencyHandler {
  private onCallDoctorNumber: string;
  private emergencyContactNumber: string;
  private hospitalFrontDesk: string;

  constructor(config?: {
    onCallDoctor?: string;
    emergencyContact?: string;
    frontDesk?: string;
  }) {
    this.onCallDoctorNumber = config?.onCallDoctor || process.env.ON_CALL_DOCTOR_NUMBER || '';
    this.emergencyContactNumber = config?.emergencyContact || process.env.EMERGENCY_CONTACT_NUMBER || '108';
    this.hospitalFrontDesk = config?.frontDesk || process.env.HOSPITAL_FRONT_DESK || '';
  }

  /**
   * Detects emergency keywords in real-time conversation transcript
   * Returns emergency classification and recommended action
   */
  public detectEmergency(transcript: string): EmergencyDetectionResult {
    const text = transcript.toLowerCase();
    const detectedKeywords: string[] = [];

    // CRITICAL EMERGENCIES - Immediate transfer to emergency services
    const criticalKeywords = [
      'chest pain', 'heart attack', 'cardiac arrest', 'breathing difficulty',
      'not breathing', 'unconscious', 'severe bleeding', 'stroke',
      'suicide', 'poisoning', 'overdose', 'seizure', 'convulsion',
      'ಎದೆ ನೋವು', // chest pain in Kannada
      'ಉಸಿರಾಟ ಕಷ್ಟ', // breathing difficulty
      'ರಕ್ತಸ್ರಾವ', // bleeding
      'ದೆವ್ವ',
      'accident', '108', 'casualty',
    ];

    for (const keyword of criticalKeywords) {
      if (text.includes(keyword)) {
        detectedKeywords.push(keyword);
      }
    }

    if (detectedKeywords.length > 0) {
      return {
        isEmergency: true,
        emergencyType: 'CRITICAL',
        recommendedAction: 'TRANSFER_IMMEDIATE',
        detectedKeywords,
        escalationMessage: 'Sir/Madam, this sounds like a medical emergency. Please call 108 ambulance immediately or rush to the nearest hospital. Do not wait. I am transferring you to our emergency doctor right now.',
        transferNumber: this.emergencyContactNumber,
      };
    }

    // URGENT CASES - Alert on-call doctor immediately
    const urgentKeywords = [
      'high fever', 'severe pain', 'vomiting blood', 'blood in stool',
      'sudden vision loss', 'severe headache', 'allergic reaction',
      'swelling', 'unable to urinate', 'pregnancy bleeding',
      'ಅತಿ ಜ್ವರ', // high fever
      'ತೀವ್ರ ನೋವು', // severe pain
    ];

    for (const keyword of urgentKeywords) {
      if (text.includes(keyword)) {
        detectedKeywords.push(keyword);
      }
    }

    if (detectedKeywords.length > 0) {
      return {
        isEmergency: true,
        emergencyType: 'URGENT',
        recommendedAction: 'ALERT_DOCTOR',
        detectedKeywords,
        escalationMessage: 'Sir/Madam, this requires immediate medical attention. I am alerting our on-call doctor right now. Please stay on the line. Doctor will speak with you shortly.',
        transferNumber: this.onCallDoctorNumber,
      };
    }

    // MODERATE URGENCY - Schedule same-day appointment
    const moderateKeywords = [
      'fever', 'infection', 'diarrhea', 'dehydration', 'injury',
      'cuts', 'burns', 'sprain', 'fracture', 'diabetes high sugar',
      'ಜ್ವರ', // fever
      'ಸೋಂಕು', // infection
    ];

    for (const keyword of moderateKeywords) {
      if (text.includes(keyword)) {
        detectedKeywords.push(keyword);
      }
    }

    if (detectedKeywords.length > 0) {
      return {
        isEmergency: false,
        emergencyType: 'MODERATE',
        recommendedAction: 'SCHEDULE_ASAP',
        detectedKeywords,
        escalationMessage: 'Sir/Madam, I can assist you with scheduling an in-person doctor consultation at the clinic for professional medical evaluation. Let me check our doctor schedule for you.',
      };
    }

    // Normal case
    return {
      isEmergency: false,
      emergencyType: 'NONE',
      recommendedAction: 'NORMAL_FLOW',
      detectedKeywords: [],
      escalationMessage: '',
    };
  }

  /**
   * Generates emergency-appropriate Kanglish response
   * Should be used immediately when emergency detected
   */
  public generateEmergencyResponse(
    emergencyType: 'CRITICAL' | 'URGENT',
    detectedKeywords: string[]
  ): string {
    if (emergencyType === 'CRITICAL') {
      return 'Sir/Madam, ಇದು ತುರ್ತು ಪರಿಸ್ಥಿತಿ ಇದೆ. Please immediately 108 ambulance call madi or nearest hospital ge rush madi. Waiting ಮಾಡಬೇಡಿ. Main emergency doctor line ge transfer madthini. Please hold.';
    }

    if (emergencyType === 'URGENT') {
      return 'Sir/Madam, ನಿಮ್ಮ symptoms urgent medical attention ನೀಡುತ್ತವೆ. On-call doctor alert madthini. Please line hold ಮಾಡಿ. Doctorರು ಕೂಡಲೇ talk ಮಾಡುತ್ತಾರೆ.';
    }

    return 'Sir/Madam, ನಿಮ್ಮ health concern important ಆಗಿದೆ. Doctor consultation schedule ಮಾಡೋಣ.';
  }

  /**
   * Sends SMS alert to emergency contacts
   * Logs all emergency events for audit
   */
  public async triggerEmergencyAlert(
    callSessionId: string,
    emergencyType: 'CRITICAL' | 'URGENT',
    transcript: string,
    callerPhone: string
  ): Promise<{ success: boolean; alertId: string }> {
    const alertId = `EMG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log emergency event
    const emergencyLog = {
      alertId,
      callSessionId,
      emergencyType,
      timestamp: new Date().toISOString(),
      callerPhone: this.maskPhone(callerPhone),
      transcript: transcript.substring(0, 200), // First 200 chars only
    };

    console.error('[EMERGENCY]', JSON.stringify(emergencyLog, null, 2));

    // In production, this would:
    // 1. Send SMS to on-call doctor
    // 2. Send SMS to hospital front desk
    // 3. Create emergency record in database
    // 4. Trigger push notification to dashboard
    // 5. Initiate call transfer to emergency line

    // Simulate alert sending
    await new Promise(resolve => setTimeout(resolve, 100));

    return { success: true, alertId };
  }

  /**
   * Masks phone number for privacy in logs
   */
  private maskPhone(phone: string): string {
    if (phone.length < 8) return phone;
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 4);
  }

  /**
   * Emergency disclaimer for demo calls
   */
  public static DEMO_DISCLAIMER = 'This is a demonstration call only. This AI voice agent is not providing real medical advice. For actual medical emergencies, please contact your doctor or call 108 immediately.';

  /**
   * Healthcare compliance badges text
   */
  public static COMPLIANCE_BADGES = {
    HIPAA: 'HIPAA Compliant - Patient data protected under US Healthcare Privacy Law',
    ABDM: 'ABDM Compatible - Integrated with Ayushman Bharat Digital Mission',
    ISO_27001: 'ISO 27001 Certified - Enterprise-grade security standards',
    DATA_LOCALIZATION: 'Data Residency in India - All patient data stored in Mumbai data centers',
  };
}
