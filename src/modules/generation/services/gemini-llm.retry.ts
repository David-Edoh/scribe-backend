import { Logger } from '@nestjs/common';

export async function* withStreamRetry<T>(
  factory: () => Promise<AsyncIterable<T>>,
  logger: Logger,
  maxAttempts = 3,
): AsyncGenerator<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      yield* await factory();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      const delayMs = 1000 * 2 ** (attempt - 1);
      logger.warn(
        `Gemini stream attempt ${attempt}/${maxAttempts} failed — retrying in ${delayMs}ms`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
