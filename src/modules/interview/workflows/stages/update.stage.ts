import { extractAnchorScriptures, isProfileValid } from './helpers';

export async function executeUpdateStage(
  voiceProfileService: any,
  logger: any,
  interviewAnswers: any,
  extractedData: any,
): Promise<{
  success: boolean;
  voiceProfile?: any;
  error?: string;
}> {
  logger.debug('Executing Stage 3: Update Voice Profile');

  try {
    const updatePayload = {
      signaturePhrases: extractedData.signaturePhrases,
      voiceThemes: extractedData.voiceThemes,
      toneMarkers: extractedData.toneMarkers,
      keyMessages: extractedData.keyMessages,
      recurringMotifs: extractedData.recurringMotifs,
      writingStyle: extractedData.writingStyle,
      ministryDNA: extractedData.ministryDNA,
      anchorScriptures: extractAnchorScriptures(
        interviewAnswers.signatureScriptures,
      ),
      interviewAnswers: {
        ministryCalling: interviewAnswers.ministryCalling,
        signatureScriptures: interviewAnswers.signatureScriptures,
        signaturePhrases: interviewAnswers.signaturePhrases,
        personalStories: interviewAnswers.personalStories,
        audience: interviewAnswers.audience,
        additionalContext: interviewAnswers.additionalContext ?? null,
      },
    };

    const updatedProfile = await voiceProfileService.update(
      interviewAnswers.voiceProfileId,
      updatePayload,
    );

    if (!isProfileValid(updatedProfile, logger)) {
      logger.warn(`Stage 3: Profile validation failed after update: ${updatedProfile.id}`);
      return {
        success: false,
        error:
          'Profile was not properly populated during interview processing. Please try again.',
      };
    }

    logger.debug(`Stage 3: Profile updated successfully: ${updatedProfile.id}`);

    return {
      success: true,
      voiceProfile: updatedProfile,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Update failed';
    logger.error('Stage 3 failed: Profile update', error);
    return {
      success: false,
      error: `Profile update failed: ${errorMessage}`,
    };
  }
}
