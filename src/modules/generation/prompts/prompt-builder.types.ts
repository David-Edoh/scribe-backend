export interface VoiceProfileData {
  name: string;
  biography?: string;
  signaturePhrases: string[];
  anchorScriptures?: string[];
  voiceThemes?: string[];
  toneMarkers?: string[];
  keyMessages?: string[];
  recurringMotifs?: string[];
  writingStyle?: {
    tone: string;
    rhythm: string;
    emphasis: string[];
  };
  ministryDNA?: string;
  theologicalFramework?: string;
  sampleTexts?: string;
}

export interface ScriptureContext {
  ref: string;
  text: string;
  context?: string;
  themeAlignment?: string;
}

export interface ToneAndGuardrails {
  voiceStyle: string;
  doctrinalPrinciples: string[];
  faithGuardrails: string[];
  prohibitions?: string[];
}

export interface ChapterPromptInput {
  voiceProfile: VoiceProfileData;
  scriptures: ScriptureContext[];
  toneGuardrails: ToneAndGuardrails;
  chapterTitle: string;
  outlineSection: string;
  additionalContext?: string;
}
