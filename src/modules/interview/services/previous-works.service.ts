import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsService } from '../../rag/embeddings/embeddings.service';
import { BooksService } from '../../books/services/books.service';
import { UploadPreviousWorksDto } from '../dto/upload-previous-works.dto';

@Injectable()
export class PreviousWorksService {
  private readonly logger = new Logger(PreviousWorksService.name);

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly booksService: BooksService,
  ) {}

  async processPreviousWorks(
    dto: UploadPreviousWorksDto & { userId: string },
  ): Promise<{
    success: boolean;
    embeddingsCount: number;
    booksCreated?: number;
    error?: string;
  }> {
    this.logger.log(
      `Processing ${dto.chunks.length} text chunks for voice profile: ${dto.voiceProfileId}`,
    );

    try {
      if (dto.chunks.length === 0) {
        this.logger.warn('No chunks provided for embedding');
        return {
          success: true,
          embeddingsCount: 0,
          booksCreated: 0,
        };
      }

      let embeddingsCount = 0;
      let booksCreated = 0;

      // Group chunks by fileName
      const chunksByFile = new Map<string, string[]>();
      for (const chunk of dto.chunks) {
        if (!chunksByFile.has(chunk.fileName)) {
          chunksByFile.set(chunk.fileName, []);
        }
        chunksByFile.get(chunk.fileName)!.push(chunk.content);
      }

      this.logger.debug(
        `Grouped ${dto.chunks.length} chunks into ${chunksByFile.size} unique files`,
      );

      // Process each unique file and create ONE book record per file
      for (const [fileName, fileChunks] of chunksByFile) {
        try {
          // Create a single book record for this file
          const book = await this.booksService.createBook({
            voiceProfileId: dto.voiceProfileId,
            userId: dto.userId,
            title: fileName.replace(/\.[^/.]+$/, ''), // Remove file extension for title
            source: 'upload',
            fileName: fileName,
          });

          this.logger.debug(
            `Created book record: ${book.id} for file: ${fileName} with ${fileChunks.length} chunks`,
          );
          booksCreated++;

          // Store all embeddings for this file with the same bookId reference
          const embeddings =
            await this.embeddingsService.embedAndStoreForVoiceProfile(
              dto.voiceProfileId,
              fileChunks, // Pass all chunks for this file
              {
                type: 'previous_works',
                sourceFile: fileName,
                bookId: book.id,
                processedAt: new Date().toISOString(),
              },
            );

          embeddingsCount += embeddings.length;
          this.logger.debug(
            `Stored ${embeddings.length} embeddings for book: ${book.id}`,
          );
        } catch (fileError) {
          this.logger.error(`Failed to process file: ${fileName}`, fileError);
          // Continue processing other files even if one fails
        }
      }

      this.logger.log(
        `Successfully stored ${embeddingsCount} embeddings and created ${booksCreated} books for voice profile: ${dto.voiceProfileId}`,
      );

      return {
        success: true,
        embeddingsCount,
        booksCreated,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error processing previous works';
      this.logger.error('Failed to process previous works:', error);
      return {
        success: false,
        embeddingsCount: 0,
        booksCreated: 0,
        error: errorMessage,
      };
    }
  }
}
