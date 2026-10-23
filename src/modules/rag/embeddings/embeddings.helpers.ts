import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { FlagEmbedding } from 'fastembed';
import { EMBEDDING_DIMENSIONS } from './embeddings.constants';

export function validateEmbeddingDimensions(
  vector: ArrayLike<number>,
  context: string,
): void {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${context} produced ${vector.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }
}

export function assertNumberArray(
  vector: ArrayLike<number> | number[] | undefined,
  context: string,
): number[] {
  if (!vector || typeof vector.length !== 'number') {
    throw new Error(`${context} did not return a valid embedding vector.`);
  }

  const normalized = Array.from(vector);
  validateEmbeddingDimensions(normalized, context);

  for (const value of normalized) {
    if (!Number.isFinite(value)) {
      throw new Error(`${context} returned a non-finite vector value.`);
    }
  }

  return normalized;
}

export function getGeminiEmbeddingConfig(
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT',
) {
  return {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType,
  };
}

export function normalizeGeminiEmbedding(values: number[] | undefined): number[] {
  if (!values || !Array.isArray(values)) {
    throw new Error('Invalid embedding values returned by Gemini API');
  }

  return assertNumberArray(values, 'Gemini embedding');
}

export async function collectLocalEmbeddingBatchResults(
  generator: AsyncGenerator<ArrayLike<number>[], void, unknown>,
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for await (const batch of generator) {
    for (const vector of batch) {
      embeddings.push(assertNumberArray(vector, 'local embedding'));
    }
  }

  return embeddings;
}

export function validateEmbeddingBatch(
  embeddings: number[][],
  expectedCount: number,
  context: string,
): number[][] {
  if (embeddings.length !== expectedCount) {
    throw new Error(
      `${context} returned ${embeddings.length} embeddings for ${expectedCount} inputs.`,
    );
  }

  for (const embedding of embeddings) {
    validateEmbeddingDimensions(embedding, context);
  }

  return embeddings;
}

export function buildGeminiClient(
  credentials: any,
  projectId: string,
): GoogleGenAI {
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: 'us-central1',
    requestOptions: {
      auth: auth as any,
    },
  } as any);
}
