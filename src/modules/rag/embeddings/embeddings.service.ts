import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuthService } from '../../../common/services/google-auth.service';
import { VoiceProfileRepository } from '../../voice-profile/voice-profile.repository';
import { GoogleGenAI } from '@google/genai';
import { FlagEmbedding } from 'fastembed';
import * as path from 'path';
import {
  buildGeminiClient,
} from './embeddings.helpers';
import {
  embedManyLocal,
  embedTextLocal,
  initializeLocalEmbeddings,
} from './embeddings.local';
import { embedManyGemini, embedTextGemini } from './embeddings.gemini';
import {
  EMBEDDING_DIMENSIONS,
  GEMINI_EMBEDDING_MODEL,
  LOCAL_EMBEDDING_MODEL,
} from './embeddings.constants';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private genAI: GoogleGenAI | null = null;
  private localEmbeddings: FlagEmbedding | null = null;
  private useLocalEmbedding: boolean;
  private embeddingsReady: Promise<void>;
  private initializationError: Error | null = null;
  private readonly localCacheDir = path.resolve(
    process.cwd(),
    '.fastembed-cache',
  );

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly repo: VoiceProfileRepository,
  ) {
    this.useLocalEmbedding = process.env.USE_LOCAL_EMBEDDING === 'true';

    if (this.useLocalEmbedding) {
      this.logger.log(
        'Initializing local embeddings (fastembed all-MiniLM-L6-v2)...',
      );
      this.embeddingsReady = this.initializeLocalEmbeddingsWithFallback();
    } else {
      this.logger.log(
        `Initializing Gemini API embeddings (${GEMINI_EMBEDDING_MODEL})...`,
      );
      this.initializeGenAI();
      this.embeddingsReady = Promise.resolve();
    }
  }

  private initializeGenAI(): void {
    try {
      const credentials = this.googleAuthService.getCredentials();
      const projectId = this.googleAuthService.getProjectId();

      this.genAI = buildGeminiClient(credentials, projectId);
      this.logger.debug(
        'Google Gen AI initialized with GoogleAuth for Vertex AI',
      );
    } catch (error) {
      this.logger.error('Failed to initialize Google Gen AI', error);
      this.genAI = null;
    }
  }

  private async initializeLocalEmbeddings(): Promise<boolean> {
    try {
      this.localEmbeddings = await initializeLocalEmbeddings(
        this.localCacheDir,
        this.logger,
        LOCAL_EMBEDDING_MODEL,
      );
      return true;
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
      this.localEmbeddings = null;
      this.logger.error(
        'Local embeddings initialization failed:',
        this.initializationError,
      );
      return false;
    }
  }

  private async initializeLocalEmbeddingsWithFallback(): Promise<void> {
    const success = await this.initializeLocalEmbeddings();

    if (success) {
      return;
    }

    this.logLocalFallback();
    this.useLocalEmbedding = false;
    this.initializeGenAI();

    if (this.genAI) {
      this.logger.log(
        `Successfully initialized Gemini API (${GEMINI_EMBEDDING_MODEL})`,
      );
    } else {
      this.logger.error(
        'CRITICAL: Neither local nor Gemini embeddings are available.',
      );
    }
  }

  private logLocalFallback(): void {
    this.logger.warn('');
    this.logger.warn('Local embeddings initialization failed.');
    this.logger.warn(
      `Falling back to Gemini API (${GEMINI_EMBEDDING_MODEL}).`,
    );
    this.logger.warn(`Local cache directory: ${this.localCacheDir}`);
    if (this.initializationError) {
      this.logger.warn(`Reason: ${this.initializationError.message}`);
    }
    this.logger.warn('');
  }

  async embedText(text: string): Promise<number[]> {
    await this.embeddingsReady;

    if (this.useLocalEmbedding) {
      if (!this.localEmbeddings) {
        throw new Error('Local embeddings are not initialized.');
      }
      return embedTextLocal(this.localEmbeddings, text, this.logger);
    }

    if (!this.genAI) {
      throw new Error(
        'Google Gen AI not initialized. Check service account credentials.',
      );
    }

    return embedTextGemini(this.genAI, text, this.logger);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    await this.embeddingsReady;

    if (texts.length === 0) {
      return [];
    }

    if (this.useLocalEmbedding) {
      if (!this.localEmbeddings) {
        throw new Error('Local embeddings are not initialized.');
      }
      return embedManyLocal(this.localEmbeddings, texts, this.logger);
    }

    if (!this.genAI) {
      throw new Error(
        'Google Gen AI not initialized. Check service account credentials.',
      );
    }

    return embedManyGemini(this.genAI, texts, this.logger);
  }

  async embedAndStoreForVoiceProfile(
    voiceProfileId: string,
    texts: string[],
    metadata: any = {},
  ) {
    const vectors = await this.embedMany(texts);
    const results: any[] = [];

    for (let i = 0; i < vectors.length; i++) {
      results.push(
        await this.repo.addEmbedding(voiceProfileId, vectors[i], texts[i], {
          ...metadata,
          index: i,
        }),
      );
    }

    return results;
  }

  getEmbeddingConfig(): { method: 'local' | 'gemini'; dimensions: number } {
    return {
      method: this.useLocalEmbedding ? 'local' : 'gemini',
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}
