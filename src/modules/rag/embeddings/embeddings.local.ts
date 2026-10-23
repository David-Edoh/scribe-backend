import { ExecutionProvider, EmbeddingModel, FlagEmbedding } from 'fastembed';
import { Logger } from '@nestjs/common';
import {
  assertNumberArray,
  collectLocalEmbeddingBatchResults,
  validateEmbeddingBatch,
} from './embeddings.helpers';
import { EMBEDDING_DIMENSIONS } from './embeddings.constants';

export async function initializeLocalEmbeddings(
  cacheDirectory: string,
  logger: Logger,
  model: Exclude<EmbeddingModel, EmbeddingModel.CUSTOM>,
): Promise<FlagEmbedding> {
  const instance = await FlagEmbedding.init({
    model,
    executionProviders: [ExecutionProvider.CPU],
    cacheDir: cacheDirectory,
    showDownloadProgress: true,
  });

  const testVector = await instance.queryEmbed('test');
  assertNumberArray(testVector, 'local initialization');

  logger.log(
    `Local embeddings ready with ${EMBEDDING_DIMENSIONS} dimensions`,
  );
  return instance;
}

export async function embedTextLocal(
  embeddingsClient: FlagEmbedding,
  text: string,
  logger: Logger,
): Promise<number[]> {
  const embedding = await embeddingsClient.queryEmbed(text);
  return assertNumberArray(embedding, 'local query embedding');
}

export async function embedBatchWithRetryLocal(
  embeddingsClient: FlagEmbedding,
  batch: string[],
  logger: Logger,
  maxRetries = 3,
): Promise<number[][]> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const batchResults = await collectLocalEmbeddingBatchResults(
        embeddingsClient.passageEmbed(batch, batch.length),
      );

      return validateEmbeddingBatch(
        batchResults,
        batch.length,
        'local passage embedding batch',
      );
    } catch (error) {
      const lastAttempt = attempt === maxRetries - 1;

      if (lastAttempt) {
        throw error;
      }

      const backoffMs = Math.pow(2, attempt) * 500;
      logger.warn(
        `Local embedding batch failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await delay(backoffMs);
    }
  }

  throw new Error('Failed to embed batch locally after retries');
}

export async function embedManyLocal(
  embeddingsClient: FlagEmbedding,
  texts: string[],
  logger: Logger,
): Promise<number[][]> {
  const batchSize = 32;
  const allEmbeddings: number[][] = [];
  const delayBetweenBatches = 100;

  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize);
    const batchNumber = Math.floor(start / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);

    logger.debug(
      `Embedding batch ${batchNumber}/${totalBatches} (${batch.length} texts) locally`,
    );

    const batchEmbeddings = await embedBatchWithRetryLocal(
      embeddingsClient,
      batch,
      logger,
    );

    allEmbeddings.push(...batchEmbeddings);

    if (start + batchSize < texts.length) {
      await delay(delayBetweenBatches);
    }
  }

  return allEmbeddings;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
