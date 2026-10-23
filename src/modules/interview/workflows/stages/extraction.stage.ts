export async function executeExtractionStage(
  extractionAgent: any,
  logger: any,
  interviewAnswers: any,
): Promise<{
  success: boolean;
  extractedData?: any;
  error?: string;
}> {
  logger.debug('Executing Stage 1: Extract Voice Profile');

  try {
    const extractedData = await extractionAgent.extractVoiceProfile(
      interviewAnswers,
    );

    logger.debug(
      `Extraction complete. Phrases: ${extractedData.signaturePhrases.length}, Themes: ${extractedData.voiceThemes.length}, Messages: ${extractedData.keyMessages.length}, Motifs: ${extractedData.recurringMotifs.length}`,
    );

    return {
      success: true,
      extractedData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
    logger.error('Stage 1 failed: Extraction', error);
    return {
      success: false,
      error: `Extraction failed: ${errorMessage}`,
    };
  }
}
