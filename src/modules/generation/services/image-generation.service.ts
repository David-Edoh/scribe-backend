import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import { StorageService } from '../../../common/services/storage.service';
import { VertexAI } from '@google-cloud/vertexai';

export interface GenerateBookCoverRequest {
  prompt: string;
  title?: string;
  description?: string;
  manuscriptId?: string; // Optional: for generating unique filename
}

export interface GenerateBookCoverResponse {
  success: boolean;
  image: string; // Base64 encoded image with data URI prefix or public URL if uploaded
  imageUrl?: string; // Public URL if uploaded to GCS
  model: string;
  generatedAt: string;
}

/**
 * Image generation service for creating book covers using Gemini
 * Uses Vertex AI with service account authentication
 */
@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private vertexAI: VertexAI | null = null;

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly storageService: StorageService,
  ) {
    this.initializeVertexAI();
  }

  private initializeVertexAI(): void {
    try {
      const credentials = this.googleAuthService.getCredentials();
      const projectId = this.googleAuthService.getProjectId();

      this.vertexAI = new VertexAI({
        project: projectId,
        location: 'us-central1',
        googleAuthOptions: {
          credentials,
        },
      });

      this.logger.debug('Vertex AI initialized for image generation');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Vertex AI for image generation',
        error,
      );
      this.vertexAI = null;
    }
  }

  /**
   * Generate a book cover image using Gemini
   */
  async generateBookCover(
    request: GenerateBookCoverRequest,
  ): Promise<GenerateBookCoverResponse> {
    if (!this.vertexAI) {
      throw new BadRequestException(
        'Vertex AI not initialized. Check service account credentials.',
      );
    }

    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new BadRequestException('Prompt is required for image generation');
    }

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
      });

      // Build the prompt with context
      const bookTitle = request.title ? `Book Title: "${request.title}"` : '';
      const bookDescription = request.description
        ? `Description: ${request.description}`
        : '';

      const fullPrompt = `
        Create a professional, high-quality book cover image.
        ${bookTitle}
        ${bookDescription}
        
        Creative Direction: ${request.prompt}
        
        Style Requirements:
        - Professional and eye-catching design
        - Suitable for Christian ministry/apostolic/prophetic content
        - High quality artwork suitable for publishing
        - Clear, readable text areas for title and author
        - Modern yet timeless design
        - 9:16 aspect ratio (vertical orientation)
      `.trim();

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.9,
          topP: 0.95,
        },
      });

      const parts = result.response.candidates?.[0]?.content?.parts;

      if (!parts || parts.length === 0) {
        throw new Error('No image content received from Gemini');
      }

      // Look for inline image data
      const imagePart = parts.find((p: any) => p.inlineData);

      if (!imagePart?.inlineData?.data) {
        throw new Error('No image data returned from Gemini');
      }

      const base64Data = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType || 'image/png';

      // Format as data URI
      const dataUri = `data:${mimeType};base64,${base64Data}`;

      this.logger.debug('Book cover generated successfully');

      // Attempt to upload to GCS
      let imageUrl: string | undefined;
      try {
        const fileName = this.storageService.generateBookCoverFileName(
          request.manuscriptId || 'temp',
        );
        imageUrl = await this.storageService.uploadImage(
          base64Data,
          mimeType,
          fileName,
        );
        this.logger.debug(`Book cover uploaded to GCS: ${imageUrl}`);
      } catch (uploadError) {
        this.logger.warn(
          'Failed to upload image to GCS, returning base64 instead',
          uploadError,
        );
        // Continue without upload - return base64 as fallback
      }

      return {
        success: true,
        image: dataUri,
        imageUrl,
        model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error during image generation';
      this.logger.error('Image generation failed', error);
      throw new InternalServerErrorException(
        `Failed to generate book cover: ${errorMessage}`,
      );
    }
  }
}
