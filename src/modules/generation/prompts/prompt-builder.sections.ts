import {
  ChapterPromptInput,
  ScriptureContext,
  ToneAndGuardrails,
  VoiceProfileData,
} from './prompt-builder.types';
import { DEFAULT_GUARDRAILS } from './prompt-builder.guardrails';

export function buildRoleSection(voiceProfile: VoiceProfileData): string {
  return `# Role & Persona

You are an intimate ghostwriter for ${voiceProfile.name}, a ${
    voiceProfile.biography
      ? voiceProfile.biography + '.'
      : 'Christian author and ministry voice.'
  }

Your task is to write chapter content that feels as if it came directly from ${voiceProfile.name}'s own hand—maintaining their exact voice, theological perspective, signature expressions, and spiritual unction. Every sentence should reflect their unique blend of scriptural insight, pastoral care, and prophetic or apostolic authority.

You have studied ${voiceProfile.name}'s writing extensively. You know their rhythms, their favorite metaphors, their key theological themes, and the way they weave scripture into narrative. When you write, readers will say, "This is unmistakably ${voiceProfile.name}'s voice."`;
}

export function buildVoiceProfileSection(voiceProfile: VoiceProfileData): string {
  const sections: string[] = [];
  sections.push(`# ${voiceProfile.name}'s Voice Profile`);

  if (voiceProfile.ministryDNA) {
    sections.push(`## Ministry DNA\n${voiceProfile.ministryDNA}`);
  }

  if (voiceProfile.voiceThemes && voiceProfile.voiceThemes.length > 0) {
    sections.push(
      `## Core Voice Themes\n${voiceProfile.voiceThemes.map((theme) => `- ${theme}`).join('\n')}`,
    );
  }

  if (voiceProfile.keyMessages && voiceProfile.keyMessages.length > 0) {
    sections.push(
      `## Key Messages\n${voiceProfile.keyMessages.map((message) => `- ${message}`).join('\n')}`,
    );
  }

  if (voiceProfile.signaturePhrases && voiceProfile.signaturePhrases.length > 0) {
    sections.push(
      `## Signature Phrases & Expressions\nUse these naturally throughout the text when contextually appropriate:\n${voiceProfile.signaturePhrases.map((phrase) => `- "${phrase}"`).join('\n')}`,
    );
  }

  if (voiceProfile.toneMarkers && voiceProfile.toneMarkers.length > 0) {
    sections.push(`## Tone Markers\n${voiceProfile.toneMarkers.join(', ')}`);
  }

  if (voiceProfile.recurringMotifs && voiceProfile.recurringMotifs.length > 0) {
    sections.push(
      `## Recurring Motifs\n${voiceProfile.recurringMotifs.map((motif) => `- ${motif}`).join('\n')}`,
    );
  }

  if (voiceProfile.writingStyle) {
    const styleLines = [`Tone: ${voiceProfile.writingStyle.tone}`, `Rhythm: ${voiceProfile.writingStyle.rhythm}`];
    if (voiceProfile.writingStyle.emphasis && voiceProfile.writingStyle.emphasis.length > 0) {
      styleLines.push(`Emphatic elements: ${voiceProfile.writingStyle.emphasis.join(', ')}`);
    }
    sections.push(`## Writing Style\n${styleLines.join('\n')}`);
  }

  if (!voiceProfile.ministryDNA && voiceProfile.theologicalFramework) {
    sections.push(`## Theological Framework\n${voiceProfile.theologicalFramework}`);
  }

  if (voiceProfile.sampleTexts) {
    sections.push(
      `## Sample Writing Style & Rhythm\nStudy this sample to internalize ${voiceProfile.name}'s voice:\n\n${voiceProfile.sampleTexts}`,
    );
  }

  return sections.filter((section) => section.length > 0).join('\n\n');
}

export function buildScriptureContextSection(scriptures: ScriptureContext[]): string {
  if (!scriptures || scriptures.length === 0) {
    return '';
  }

  const sections = ['# Anchor Scriptures & Theological Context'];

  scriptures.forEach((scripture) => {
    let entry = `## ${scripture.ref}`;

    if (scripture.text) {
      entry += `\n"${scripture.text}"`;
    }

    if (scripture.context) {
      entry += `\n\nContext: ${scripture.context}`;
    }

    if (scripture.themeAlignment) {
      entry += `\n\nTheme Alignment: ${scripture.themeAlignment}`;
    }

    sections.push(entry);
  });

  return sections.join('\n\n');
}

export function buildToneAndGuidelineSection(
  toneGuardrails: ToneAndGuardrails,
): string {
  const sections = ['# Tone, Style & Theological Guidelines'];

  if (toneGuardrails.voiceStyle) {
    sections.push(`## Voice & Tone\n${toneGuardrails.voiceStyle}`);
  }

  if (toneGuardrails.doctrinalPrinciples && toneGuardrails.doctrinalPrinciples.length > 0) {
    sections.push(
      `## Doctrinal Principles to Emphasize\n${toneGuardrails.doctrinalPrinciples.map((principle) => `- ${principle}`).join('\n')}`,
    );
  }

  return sections.filter((section) => section.length > 0).join('\n\n');
}

export function buildGuardrailsSection(
  toneGuardrails: ToneAndGuardrails,
): string {
  const guardrails = [...DEFAULT_GUARDRAILS, ...(toneGuardrails.faithGuardrails || [])];

  const sections = [
    '# Sacred Guardrails (Non-Negotiable)',
    `## Doctrinal & Ethical Constraints\n${guardrails.map((guardrail) => `- ${guardrail}`).join('\n')}`,
  ];

  if (toneGuardrails.prohibitions && toneGuardrails.prohibitions.length > 0) {
    sections.push(
      `## Specific Prohibitions\n${toneGuardrails.prohibitions.map((prohibition) => `- Do NOT: ${prohibition}`).join('\n')}`,
    );
  }

  return sections.join('\n\n');
}
