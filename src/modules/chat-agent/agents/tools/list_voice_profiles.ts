import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'list_voice_profiles',
    description:
      'List all voice profiles for the user with their ministry identity, themes, and key messages. Returns JSON with profile IDs, names, and voice identity data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        userId: { type: Type.STRING, description: 'The user ID' },
      },
      required: ['userId'],
    },
  },
  handler: async ({ userId }: Record<string, any>) => {
    try {
      const profiles = await services.voiceProfileService.findAllByUser(userId);
      if (profiles.length === 0) {
        return JSON.stringify({
          success: true,
          profiles: [],
          message: 'No voice profiles found',
        });
      }
      return JSON.stringify({
        success: true,
        profiles: profiles.map((p: any) => ({
          id: p.id,
          name: p.name,
          ministryDNA: p.ministryDNA || p.theologicalFramework || 'custom',
          voiceThemes: p.voiceThemes || [],
          keyMessages: p.keyMessages || [],
          toneMarkers: p.toneMarkers || [],
        })),
      });
    } catch {
      return JSON.stringify({ success: false, message: 'Unable to retrieve voice profiles.' });
    }
  },
});
