import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'get_manuscript_details',
    description:
      'Get detailed information about a specific manuscript including chapter count, creation date, and outline info. Returns JSON with manuscript data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        manuscriptId: { type: Type.STRING, description: 'The manuscript ID' },
        userId: { type: Type.STRING, description: 'The user ID' },
      },
      required: ['manuscriptId', 'userId'],
    },
  },
  handler: async ({ manuscriptId, userId }: Record<string, any>) => {
    try {
      const manuscript = await services.manuscriptService.getManuscript(manuscriptId, userId);
      if (!manuscript) {
        return JSON.stringify({
          success: false,
          message: 'Manuscript not found.',
        });
      }
      return JSON.stringify({
        success: true,
        manuscript: {
          id: manuscript.id,
          title: manuscript.title,
          chapterCount: manuscript.chapters?.length || 0,
          createdAt: manuscript.createdAt,
          hasOutline: manuscript.outline ? true : false,
          outline: manuscript.outline,
        },
      });
    } catch {
      return JSON.stringify({ success: false, message: 'Unable to retrieve manuscript details.' });
    }
  },
});
