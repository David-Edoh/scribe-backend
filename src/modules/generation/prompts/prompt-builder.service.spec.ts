import { Test, TestingModule } from '@nestjs/testing';
import {
  PromptBuilderService,
  ChapterPromptInput,
} from '../prompts/prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilderService],
    }).compile();

    service = module.get<PromptBuilderService>(PromptBuilderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildSystemPrompt', () => {
    it('should build a complete system prompt with all sections', () => {
      const input: ChapterPromptInput = {
        voiceProfile: {
          name: 'John Eldredge',
          signaturePhrases: ['awakening', 'the heart of God'],
          theologicalFramework: 'Redemption and grace-centered theology',
          sampleTexts: "The heart is central to God's work in our lives.",
          biography: 'Author and counselor',
          anchorScriptures: ['Psalm 27:4', 'John 10:10'],
        },
        scriptures: [
          {
            ref: 'Psalm 27:4',
            text: 'One thing I ask from the Lord, this only do I seek: that I may dwell in the house of the Lord all the days of my life...',
            context: 'The psalmist expresses singular devotion to God.',
            themeAlignment: 'Heart focus and singular passion',
          },
        ],
        toneGuardrails: {
          voiceStyle: 'Prophetic flow with pastoral care',
          doctrinalPrinciples: [
            'God desires our hearts above all',
            'Redemption is central to Christianity',
          ],
          faithGuardrails: [
            'Stay true to scriptural foundation',
            'Avoid prosperity gospel',
          ],
        },
        chapterTitle: 'The Awakening Heart',
        outlineSection: "Introduction to the heart's central role",
      };

      const prompt = service.buildSystemPrompt(input);

      expect(prompt).toContain('Role & Persona');
      expect(prompt).toContain('John Eldredge');
      expect(prompt).toContain('Voice Profile');
      expect(prompt).toContain('Anchor Scriptures');
      expect(prompt).toContain('Psalm 27:4');
      expect(prompt).toContain('Tone, Style & Theological Guidelines');
      expect(prompt).toContain('Sacred Guardrails');
      expect(prompt).toContain('Prophetic flow');
      expect(prompt).toContain('awakening');
    });

    it('should throw error when voiceProfile is missing', () => {
      const input: any = {
        voiceProfile: null,
        toneGuardrails: { voiceStyle: 'test' },
        chapterTitle: 'Test',
        outlineSection: 'Test',
      };

      expect(() => service.buildSystemPrompt(input)).toThrow();
    });
  });

  describe('buildUserMessage', () => {
    it('should build a user message with chapter context', () => {
      const input: ChapterPromptInput = {
        voiceProfile: {
          name: 'Author Name',
          signaturePhrases: [],
          theologicalFramework: '',
        },
        scriptures: [],
        toneGuardrails: {
          voiceStyle: 'Test style',
          doctrinalPrinciples: [],
          faithGuardrails: [],
        },
        chapterTitle: 'Chapter Title',
        outlineSection: 'Section Overview',
        additionalContext: 'Extra context here',
      };

      const message = service.buildUserMessage(input);

      expect(message).toContain('Chapter Generation Request');
      expect(message).toContain('Chapter Title: Chapter Title');
      expect(message).toContain('Section Overview');
      expect(message).toContain('Extra context here');
      expect(message).toContain('Author Name');
    });
  });
});
