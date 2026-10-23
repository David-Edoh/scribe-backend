export async function executeEmbeddingStage(
  embeddingsService: any,
  booksService: any,
  logger: any,
  voiceProfileId: string,
  extractedData: any,
  userId: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  logger.debug('Executing Stage 4: Store Embeddings for RAG');

  try {
    const interviewBook = await booksService.createBook({
      voiceProfileId,
      userId,
      title: `Voice Profile Interview - ${new Date().toLocaleDateString()}`,
      source: 'interview',
      fileName: 'voice-profile-interview',
    });

    logger.debug(`Created book record for interview: ${interviewBook.id}`);

    const textsToEmbed = [
      ...extractedData.signaturePhrases,
      ...extractedData.voiceThemes,
      ...extractedData.keyMessages,
    ];

    if (textsToEmbed.length === 0) {
      logger.warn('No texts to embed - voice profile extraction may have failed');
      return {
        success: false,
        error: 'No texts to embed',
      };
    }

    await embeddingsService.embedAndStoreForVoiceProfile(
      voiceProfileId,
      textsToEmbed,
      {
        type: 'voice_profile_extraction',
        bookId: interviewBook.id,
        extractedAt: new Date().toISOString(),
        includesPhrases: true,
        includesThemes: true,
        includesMessages: true,
      },
    );

    logger.debug(
      `Stage 4: Successfully stored ${textsToEmbed.length} embeddings for profile ${voiceProfileId} in book ${interviewBook.id}`,
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Embedding storage failed';
    logger.error('Stage 4 failed: Embedding storage', error);
    return {
      success: false,
      error: `Embedding storage failed: ${errorMessage}`,
    };
  }
}
