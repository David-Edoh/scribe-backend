import { GoogleGenAI } from '@google/genai';
import { Logger } from '@nestjs/common';
import {
  getGeminiEmbeddingConfig,
  normalizeGeminiEmbedding,
  validateEmbeddingBatch,
} from './embeddings.helpers';
import { GEMINI_EMBEDDING_MODEL } from './embeddings.constants';

export async function embedTextGemini(
  genAI: GoogleGenAI,
  text: string,
  logger: Logger,
): Promise<number[]> {
  const response = await genAI.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: { parts: [{ text }] },
    config: getGeminiEmbeddingConfig('RETRIEVAL_QUERY'),
  });

  return normalizeGeminiEmbedding(response.embeddings?.[0]?.values);
}

export async function embedManyGemini(
  genAI: GoogleGenAI,
  texts: string[],
  logger: Logger,
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  return embedBatchWithRetryGemini(genAI, texts, logger);
}

export async function embedBatchWithRetryGemini(
  genAI: GoogleGenAI,
  batch: string[],
  logger: Logger,
  maxRetries = 3,
): Promise<number[][]> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await genAI.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: batch.map((text) => ({ parts: [{ text }] })),
        config: getGeminiEmbeddingConfig('RETRIEVAL_DOCUMENT'),
      });

      const embeddings = response.embeddings;
      if (!embeddings || !Array.isArray(embeddings)) {
        throw new Error('Invalid embedding response: ' + JSON.stringify(response));
      }

      return validateEmbeddingBatch(
        embeddings.map((item) => normalizeGeminiEmbedding(item.values)),
        batch.length,
        'Gemini embedding batch',
      );
    } catch (error: any) {
      const quotaExceeded =
        error?.error?.code === 429 || error?.status === 'RESOURCE_EXHAUSTED';
      const lastAttempt = attempt === maxRetries - 1;

      if (quotaExceeded && !lastAttempt) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        logger.warn(
          `Quota exceeded, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await delay(backoffMs);
        continue;
      }

      if (lastAttempt) {
        throw error;
      }
    }
  }

  throw new Error('Failed to embed batch after retries');
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
