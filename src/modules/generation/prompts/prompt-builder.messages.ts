import { ChapterPromptInput } from './prompt-builder.types';

export function buildUserMessage(input: ChapterPromptInput): string {
  const sections = [
    '# Chapter Generation Request',
    `## Chapter Title: ${input.chapterTitle}`,
    `## Outline Section: ${input.outlineSection}`,
  ];

  if (input.additionalContext) {
    sections.push(`## Additional Context:\n${input.additionalContext}`);
  }

  sections.push(
    `\nPlease generate a draft of this chapter section that authentically reflects ${input.voiceProfile.name}'s voice, theological perspective, and writing style. The draft should incorporate the anchor scriptures and key themes identified above.`,
  );

  return sections.join('\n');
}
