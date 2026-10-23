import { Injectable, BadRequestException } from '@nestjs/common';
import {
  buildGuardrailsSection,
  buildRoleSection,
  buildScriptureContextSection,
  buildToneAndGuidelineSection,
  buildUserMessage,
  buildVoiceProfileSection,
} from './prompt-builder.helpers';
import { ChapterPromptInput } from './prompt-builder.types';

@Injectable()
export class PromptBuilderService {
  /**
   * Build a complete system prompt for chapter generation
   * Injects author voice, scripture context, tone instructions, and faith guardrails
   */
  buildSystemPrompt(input: ChapterPromptInput): string {
    if (!input.voiceProfile || !input.toneGuardrails) {
      throw new BadRequestException(
        'Voice profile and tone/guardrails are required',
      );
    }

    const sections = [
      buildRoleSection(input.voiceProfile),
      buildVoiceProfileSection(input.voiceProfile),
      buildScriptureContextSection(input.scriptures),
      buildToneAndGuidelineSection(input.toneGuardrails),
      buildGuardrailsSection(input.toneGuardrails),
    ];

    return sections.filter((section) => section.length > 0).join('\n\n');
  }

  /**
   * Build user message for chapter generation
   */
  buildUserMessage(input: ChapterPromptInput): string {
    return buildUserMessage(input);
  }
}
