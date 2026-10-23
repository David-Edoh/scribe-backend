import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'generate_manuscript_or_book',
    description:
      'Generate a manuscript outline and create a manuscript entry with only the outline saved. Returns JSON with manuscriptId, manuscriptTitle, and outlineId.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        userId: { type: Type.STRING, description: 'The user ID (auto-filled)' },
        voiceProfileId: { type: Type.STRING, description: 'The voice profile ID' },
        title: { type: Type.STRING, description: 'The manuscript/book title' },
        moreInfo: { type: Type.STRING, description: 'Description, intent, or notes for the book' },
        voiceStyleKey: { type: Type.STRING, description: 'Optional voice style key' },
      },
      required: ['userId', 'voiceProfileId', 'title', 'moreInfo'],
    },
  },
  handler: async ({ userId, voiceProfileId, title, moreInfo, voiceStyleKey }: Record<string, any>) => {
    try {
      console.log('[GENERATE-OUTLINE] Starting outline generation:', {
        userId,
        voiceProfileId,
        title,
        moreInfo,
        voiceStyleKey,
      });
      services.logger?.debug?.('Generating manuscript outline with parameters:', { userId, voiceProfileId, title, moreInfo, voiceStyleKey });

      console.log('[GENERATE-OUTLINE] Fetching voice profile to verify ownership...');
      const voiceProfile = await services.voiceProfileService.findById(voiceProfileId);
      console.log('[GENERATE-OUTLINE] Voice profile found:', {
        id: voiceProfile?.id,
        name: voiceProfile?.name,
        profileOwnerId: voiceProfile?.userId,
        sessionUserId: userId,
        ownershipMatch: voiceProfile?.userId === userId,
      });

      if (!voiceProfile) {
        console.error('[GENERATE-OUTLINE] Voice profile not found:', voiceProfileId);
        throw new Error(`Voice profile ${voiceProfileId} not found`);
      }

      if (voiceProfile.userId !== userId) {
        console.error('[GENERATE-OUTLINE] Ownership mismatch!', {
          profileOwnerId: voiceProfile.userId,
          sessionUserId: userId,
        });
        throw new Error('Unauthorized: Voice profile does not belong to user');
      }

      const outline = await services.outlineGenerationService.generateOutline({
        userId,
        voiceProfileId,
        title,
        moreInfo,
        voiceStyleKey,
      });
      console.log('[GENERATE-OUTLINE] Successfully generated outline with', outline?.chapters?.length || 0, 'chapters');
      services.logger?.debug?.('Generated outline:', outline);

      const manuscript = await services.manuscriptService.createManuscript(userId, {
        voiceProfileId,
        title,
        description: moreInfo,
        outline,
      });
      console.log('[GENERATE-OUTLINE] Successfully created manuscript:', manuscript.id);
      services.logger?.debug?.('Created manuscript with outline:', manuscript);

      return JSON.stringify({
        success: true,
        manuscriptId: manuscript.id,
        manuscriptTitle: manuscript.title,
        outlineId: manuscript.id,
      });
    } catch (error) {
      console.error('[GENERATE-OUTLINE] ERROR:', error);
      console.error('[GENERATE-OUTLINE] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[GENERATE-OUTLINE] Error stack:', error instanceof Error ? error.stack : 'no stack');
      services.logger?.error?.('Error generating manuscript outline:', error);
      return JSON.stringify({
        success: false,
        message: 'Unable to generate manuscript outline.',
      });
    }
  },
});
