import { Injectable, Logger } from '@nestjs/common';
import { VoiceProfileFormatter } from '../prompts/voice-profile-formatter.service';
import { GenerationOrchestrationService } from '../prompts/generation-orchestration.service';
import { GeminiLLMService } from './gemini-llm.service';
import { ContentConverterService } from './content-converter.service';
import { ManuscriptService } from '../../manuscripts/services/manuscript.service';
import { ChapterService } from '../../chapters/services/chapter.service';
import { EmbeddingsService } from '../../rag/embeddings/embeddings.service';
import { RetrieverService } from '../../rag/retrievers/retriever.service';

interface ManuscriptOutlineChapter {
  number: number;
  title: string;
  objectives: string[];
  keyPoints: string[];
  estimatedWordCount?: number;
}

interface ManuscriptOutline {
  title: string;
  description: string;
  chapters: ManuscriptOutlineChapter[];
  overview: string;
  themes: string[];
  estimatedWordCount?: number;
}

interface GenerateManuscriptRequest {
  userId: string;
  voiceProfileId: string;
  outline: ManuscriptOutline;
  manuscriptTitle: string;
  manuscriptDescription: string;
}

@Injectable()
export class ManuscriptGenerationService {
  private readonly logger = new Logger(ManuscriptGenerationService.name);

  constructor(
    private readonly voiceProfileFormatter: VoiceProfileFormatter,
    private readonly orchestration: GenerationOrchestrationService,
    private readonly gemini: GeminiLLMService,
    private readonly contentConverter: ContentConverterService,
    private readonly manuscriptService: ManuscriptService,
    private readonly chapterService: ChapterService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly retrieverService: RetrieverService,
  ) {}

  async generateManuscript(request: GenerateManuscriptRequest): Promise<any> {
    this.logger.debug(`Generating full manuscript: ${request.manuscriptTitle}`);

    // Create the manuscript record
    const manuscript = await this.manuscriptService.createManuscript(
      request.userId,
      {
        voiceProfileId: request.voiceProfileId,
        title: request.manuscriptTitle,
        description: request.manuscriptDescription,
        outline: request.outline,
      },
    );

    this.logger.debug(`Created manuscript: ${manuscript.id}`);

    // Fetch voice profile for personalization
    const voiceProfile = await this.voiceProfileFormatter.formatVoiceProfile(
      request.userId,
      request.voiceProfileId,
    );

    // Generate chapters
    const chapters: any[] = [];
    for (const outlineChapter of request.outline.chapters) {
      try {
        this.logger.debug(
          `Generating chapter ${outlineChapter.number}: ${outlineChapter.title}`,
        );

        // Generate chapter content
        const chapterContent = await this.generateChapterContent(
          request.userId,
          request.voiceProfileId,
          voiceProfile,
          outlineChapter,
          request.outline,
        );

        // Create chapter in database (without content)
        const chapter = await this.chapterService.createChapter(
          manuscript.id!,
          {
            title: outlineChapter.title,
            outlineSection: outlineChapter.objectives.join('\n'),
            order: outlineChapter.number,
            voiceStyle: 'APOSTOLIC',
          },
        );

        // Update chapter with generated content (convert markdown to HTML for storage)
        const htmlContent =
          this.contentConverter.markdownToHtml(chapterContent);
        const updatedChapter = await this.chapterService.updateChapter(
          chapter.id!,
          {
            content: htmlContent,
          },
        );

        chapters.push(updatedChapter);
        this.logger.debug(
          `Chapter ${outlineChapter.number} generated successfully`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate chapter ${outlineChapter.number}:`,
          error,
        );
        // Continue with next chapter even if one fails
      }
    }

    this.logger.debug(`Generated ${chapters.length} chapters`);

    // Update manuscript status
    const updatedManuscript = await this.manuscriptService.updateManuscript(
      manuscript.id!,
      request.userId,
      {
        status: 'completed',
      },
    );

    if (!updatedManuscript) {
      throw new Error('Failed to update manuscript after generation');
    }

    return {
      manuscriptId: manuscript.id,
      title: updatedManuscript.title,
      chaptersGenerated: chapters.length,
      totalChapters: request.outline.chapters.length,
    };
  }

  private async generateChapterContent(
    userId: string,
    voiceProfileId: string,
    voiceProfile: any,
    outlineChapter: ManuscriptOutlineChapter,
    fullOutline: ManuscriptOutline,
  ): Promise<string> {
    // Perform RAG vector search to retrieve relevant voice profile context
    this.logger.debug(
      `Retrieving relevant voice profile context for chapter: ${outlineChapter.title}`,
    );
    const retrievedContext = await this.retrieverService.retrieveRelevant(
      userId,
      outlineChapter.title,
      10, // Get top 10 relevant embeddings for this chapter
    );

    // Format RAG context for inclusion in prompt
    let ragContextSection = '';
    if (retrievedContext && retrievedContext.length > 0) {
      const userEmbeddings = retrievedContext
        .filter((r) => r.source === 'user')
        .slice(0, 5);
      const scriptureEmbeddings = retrievedContext
        .filter((r) => r.source === 'scripture')
        .slice(0, 3);

      if (userEmbeddings.length > 0) {
        ragContextSection += '\n## Relevant Author Voice Patterns:\n';
        userEmbeddings.forEach((item, idx) => {
          const metadata = item.item.metadata || {};
          const content =
            metadata.content || metadata.text || metadata.snippet || '';
          if (content) {
            ragContextSection += `- ${content.substring(0, 200)}\n`;
          }
        });
      }

      if (scriptureEmbeddings.length > 0) {
        ragContextSection += '\n## Relevant Scriptures:\n';
        scriptureEmbeddings.forEach((item) => {
          const ref = item.item.scriptureRef || 'Unknown';
          const text = item.item.scriptureText || '';
          ragContextSection += `- ${ref}: ${text.substring(0, 150)}\n`;
        });
      }
    }

    // Assemble prompt for chapter generation
    const outlineSection = [
      `Objectives: ${outlineChapter.objectives.join(', ')}`,
      `Key Points: ${outlineChapter.keyPoints.join(', ')}`,
    ].join('\n');

    const additionalContextParts = [
      fullOutline.overview
        ? `Manuscript Overview: ${fullOutline.overview}\nThemes: ${fullOutline.themes.join(', ')}`
        : '',
      ragContextSection,
    ]
      .filter(Boolean)
      .join('\n');

    const assembledPrompt = await this.orchestration.assembleChapterPrompt({
      userId,
      voiceProfileId,
      chapterTitle: outlineChapter.title,
      outlineSection,
      voiceStyleKey: 'APOSTOLIC',
      additionalContext: additionalContextParts || undefined,
      retrievalQuery: outlineChapter.title,
    });

    // Generate chapter content via Gemini
    const response = await this.gemini.generateChapter({
      systemPrompt: assembledPrompt.systemPrompt,
      userMessage: assembledPrompt.userMessage,
      temperature: 0.7,
      maxTokens: 3500,
    });

    return response.content;
  }
}
