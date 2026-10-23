import { Injectable } from '@nestjs/common';
import { ToneAndGuardrails } from './prompt-builder.types';

/**
 * Configuration for different ministry voice types
 */
type VoiceStyleKey = 'PROPHETIC' | 'APOSTOLIC' | 'PASTORAL' | 'TEACHING';

const VOICE_STYLE_TEMPLATES: Record<VoiceStyleKey, { voiceStyle: string; doctrinalPrinciples: string[] }> = {
  PROPHETIC: {
    voiceStyle: `Prophetic flow with Spirit-led authority. Write with urgency and revelation. Use vivid imagery, divine perspective, and calls to spiritual awakening. Balance divine truth with pastoral care. Avoid harshness; prophetic voice is firm but loving. Use rhythmic, poetic language when appropriate.`,
    doctrinalPrinciples: [
      'God speaks directly to His people through His Spirit',
      "Scripture reveals God's heart and character",
      'The Holy Spirit empowers and guides believers',
      'Repentance and faith are central to discipleship',
      'The Kingdom of God is both present and future',
    ],
  },
  APOSTOLIC: {
    voiceStyle: `Apostolic authority grounded in Scripture and spiritual leadership. Write with clarity, conviction, and pastoral oversight. Use strategic thinking and organizational wisdom. Balance authority with humility. Reference foundational truths, church history, and biblical precedent.`,
    doctrinalPrinciples: [
      'Christ is the Head of the Church',
      'Authority flows from obedience to Christ',
      'Believers are equipped for the work of ministry',
      'Spiritual health requires biblical foundation and community',
      'Leadership accountability matters',
    ],
  },
  PASTORAL: {
    voiceStyle: `Pastoral care with gentleness and wisdom. Write with deep compassion, practical insight, and spiritual maturity. Use personal anecdotes, illustrative stories, and encouragement. Balance truth with grace. Shepherd the reader\'s heart toward Jesus.`,
    doctrinalPrinciples: [
      'Christ is the Chief Shepherd',
      'Believers need guidance, encouragement, and accountability',
      "God's love is foundational to all Christian life",
      'Spiritual growth requires vulnerability and community',
      'The gospel transforms individual lives and relationships',
    ],
  },
  TEACHING: {
    voiceStyle: `Didactic voice with clarity and depth. Write with precision, progression of thought, and scriptural grounding. Use logical structure, explain concepts thoroughly, and build understanding progressively. Balance intellectual rigor with spiritual wisdom.`,
    doctrinalPrinciples: [
      'Scripture is the authoritative source of doctrine',
      "Believers need to understand God's word deeply",
      'Theological truth impacts practical living',
      'Sound doctrine produces spiritual maturity',
      'Teaching requires clarity, accuracy, and humility',
    ],
  },
};

@Injectable()
export class ToneAndGuardrailsBuilder {
  /**
   * Build tone and guardrails configuration for a specific voice style
   */
  buildForVoiceStyle(
    voiceStyleKey: string,
    additionalPrinciples?: string[],
    customProhibitions?: string[],
  ): ToneAndGuardrails {
    const template =
      VOICE_STYLE_TEMPLATES[voiceStyleKey.toUpperCase()] ||
      VOICE_STYLE_TEMPLATES.PASTORAL;

    return {
      voiceStyle: template.voiceStyle,
      doctrinalPrinciples: [
        ...template.doctrinalPrinciples,
        ...(additionalPrinciples || []),
      ],
      faithGuardrails: [
        'Prioritize biblical fidelity above all else',
        'Avoid sensationalism, hype, or emotional manipulation',
        'Distinguish between scriptural teaching and personal opinion',
        'Acknowledge theological complexity and humility in difficult topics',
        'Promote Jesus as central, not methods or techniques',
      ],
      prohibitions: [
        'prosperity gospel or materialism dressed as spirituality',
        'spiritual manipulation or fear-based teaching',
        'doctrinal novelty or trendy theology disconnected from church history',
        'harsh judgment of other believers or movements without context',
        'sexual, financial, or power abuse',
        ...(customProhibitions || []),
      ],
    };
  }

  /**
   * Custom builder for unique ministry contexts
   */
  buildCustom(config: {
    voiceStyle: string;
    doctrinalPrinciples: string[];
    faithGuardrails: string[];
    prohibitions?: string[];
  }): ToneAndGuardrails {
    return {
      voiceStyle: config.voiceStyle,
      doctrinalPrinciples: config.doctrinalPrinciples,
      faithGuardrails: config.faithGuardrails,
      prohibitions: config.prohibitions || [],
    };
  }

  /**
   * Get available voice style templates
   */
  getAvailableVoiceStyles(): string[] {
    return Object.keys(VOICE_STYLE_TEMPLATES);
  }

  /**
   * Get template for a specific voice style
   */
  getVoiceStyleTemplate(key: string): any {
    return VOICE_STYLE_TEMPLATES[key.toUpperCase()] || null;
  }
}
