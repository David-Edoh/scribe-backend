import { Injectable, Logger } from '@nestjs/common';
import { VoiceProfileFormatter } from '../../generation/prompts/voice-profile-formatter.service';
import { EmbeddingsService } from '../../rag/embeddings/embeddings.service';
import { RetrieverService } from '../../rag/retrievers/retriever.service';
import { GeminiLLMService } from '../../generation/services/gemini-llm.service';
import { ToneAndGuardrailsBuilder } from '../../generation/prompts/tone-and-guardrails-builder.service';
import {
  GenerateOutlineRequest,
  ManuscriptOutline,
  OutlineChapter,
} from './outline-generation.types';
import {
  buildOutlineSystemPrompt,
  buildOutlineUserMessage,
  parseOutlineResponse,
} from './outline-generation.helpers';

@Injectable()
export class OutlineGenerationService {
  private readonly logger = new Logger(OutlineGenerationService.name);

  constructor(
    private readonly voiceProfileFormatter: VoiceProfileFormatter,
    private readonly embeddingsService: EmbeddingsService,
    private readonly retrieverService: RetrieverService,
    private readonly gemini: GeminiLLMService,
    private readonly toneBuilder: ToneAndGuardrailsBuilder,
  ) {}

  async generateOutline(
    request: GenerateOutlineRequest,
  ): Promise<ManuscriptOutline> {
    this.logger.debug(`Generating outline for manuscript: ${request.title}`);

    // Fetch voice profile
    const voiceProfile = await this.voiceProfileFormatter.formatVoiceProfile(
      request.userId,
      request.voiceProfileId,
    );

    this.logger.debug(
      `Generate embeddings for the title and description to capture semantic meaning`,
    );
    // Generate embeddings for the title and description to capture semantic meaning
    const titleEmbedding = await this.embeddingsService.embedText(
      request.title,
    );
    const descriptionEmbedding = await this.embeddingsService.embedText(
      request.moreInfo,
    );

    // Do RAG vector search to find relevant voice profile embeddings
    this.logger.debug(
      `Performing RAG vector search to retrieve relevant voice profile context`,
    );
    const searchQuery = `${request.title} ${request.moreInfo}`;
    const retrievedContext = await this.retrieverService.retrieveRelevant(
      request.userId,
      searchQuery,
      10, // Get top 10 most relevant embeddings
    );

    // Build tone and guardrails
    this.logger.debug(
      `Building tone and guardrails for voice style: ${request.voiceStyleKey || 'APOSTOLIC'}`,
    );
    const voiceStyle = request.voiceStyleKey || 'APOSTOLIC';
    const toneGuardrails = this.toneBuilder.buildForVoiceStyle(voiceStyle);

    // Build system prompt with RAG context
    const systemPrompt = this.buildOutlineSystemPrompt(
      voiceProfile,
      toneGuardrails,
      retrievedContext,
    );

    this.logger.debug(`Building user message with manuscript details`);
    // Build user message with manuscript details
    const userMessage = this.buildOutlineUserMessage(
      request.title,
      request.moreInfo,
      titleEmbedding,
      descriptionEmbedding,
    );

    this.logger.debug(
      `System prompt and user message constructed, calling Gemini LLM for outline generation`,
    );
    // Call Gemini to generate outline
    const outlineResponse = await this.gemini.generateChapter({
      systemPrompt,
      userMessage,
      temperature: 0.7,
      maxTokens: 2000,
    });

    this.logger.debug(
      `Received outline response from Gemini LLM, parsing the response`,
    );
    // Parse the generated outline
    const outline = parseOutlineResponse(
      outlineResponse.content,
      request.title,
      request.moreInfo,
    );

    this.logger.debug(
      `Successfully generated outline with ${outline.chapters.length} chapters`,
    );

    return outline;
  }

  private buildOutlineSystemPrompt(
    voiceProfile: any,
    toneGuardrails: any,
    retrievedContext?: any[],
  ): string {
    return buildOutlineSystemPrompt(
      voiceProfile,
      toneGuardrails,
      retrievedContext,
    );
  }

  private buildOutlineUserMessage(
    title: string,
    moreInfo: string,
    titleEmbedding: number[],
    descriptionEmbedding: number[],
  ): string {
    return buildOutlineUserMessage(
      title,
      moreInfo,
      titleEmbedding,
      descriptionEmbedding,
    );
  }

  private parseOutlineResponse(
    response: string,
    title: string,
    moreInfo: string,
  ): ManuscriptOutline {
    return parseOutlineResponse(response, title, moreInfo);
  }

  private extractBulletPoints(content: string, section: string): string[] {
    const sectionRegex = new RegExp(
      `${section}:\\s*\\n+([\s\S]*?)(?=\n\n|Est\\.|Key|Objectives|$)`,
      'i',
    );
    const match = content.match(sectionRegex);

    if (!match) {
      return [];
    }

    return match[1]
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter((line) => line.length > 0 && !line.startsWith('**'));
  }

  private generateDefaultOutline(
    title: string,
    description: string,
  ): OutlineChapter[] {
    // Generate a sensible default 6-chapter outline if parsing fails
    return [
      {
        number: 1,
        title: 'Foundation & Call',
        objectives: [
          'Establish the core premise',
          'Connect with reader spiritually',
          'Introduce key theological framework',
        ],
        keyPoints: [
          'The calling and vision',
          'Scriptural foundation',
          'Why this message now',
        ],
        estimatedWordCount: 1500,
      },
      {
        number: 2,
        title: 'Understanding the Landscape',
        objectives: [
          'Provide cultural and spiritual context',
          'Identify key challenges or opportunities',
          'Set up the central thesis',
        ],
        keyPoints: [
          'Current state analysis',
          'Spiritual dynamics',
          'Key pain points or opportunities',
        ],
        estimatedWordCount: 2000,
      },
      {
        number: 3,
        title: 'The Core Message',
        objectives: [
          'Present the central teaching',
          'Root it in scripture',
          'Show practical application',
        ],
        keyPoints: [
          'Main theological truth',
          'Scriptural support',
          'Real-world examples',
        ],
        estimatedWordCount: 2500,
      },
      {
        number: 4,
        title: 'Deep Application & Authority',
        objectives: [
          'Demonstrate prophetic or apostolic authority',
          'Provide actionable wisdom',
          'Address resistance or questions',
        ],
        keyPoints: [
          'Authority and authenticity',
          'Practical implementation',
          'Common objections addressed',
        ],
        estimatedWordCount: 2000,
      },
      {
        number: 5,
        title: 'Stories, Testimonies & Breakthrough',
        objectives: [
          'Illustrate transformation',
          'Demonstrate power of the message',
          'Build faith and expectancy',
        ],
        keyPoints: [
          'Personal stories',
          'Client/congregant testimonies',
          'Spiritual breakthroughs',
        ],
        estimatedWordCount: 2000,
      },
      {
        number: 6,
        title: 'The Call Forward',
        objectives: [
          'Inspire action and commitment',
          'Prophetic vision for the future',
          'Empower the reader to carry forward',
        ],
        keyPoints: [
          'Vision casting',
          'Clear next steps',
          'Spiritual empowerment',
        ],
        estimatedWordCount: 1500,
      },
    ];
  }
}
