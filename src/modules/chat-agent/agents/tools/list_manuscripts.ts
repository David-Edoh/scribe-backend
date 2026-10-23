import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'list_manuscripts',
    description:
      'List all manuscripts for the user with their titles and chapter count. Returns JSON with manuscript IDs, titles, and chapter counts.',
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
      const manuscripts = await services.manuscriptService.listManuscripts(userId);
      if (manuscripts.length === 0) {
        return JSON.stringify({
          success: true,
          manuscripts: [],
          message: 'No manuscripts found',
        });
      }
      return JSON.stringify({
        success: true,
        manuscripts: manuscripts.map((m: any) => ({
          id: m.id,
          title: m.title,
          chapterCount: m.chapters?.length || 0,
        })),
      });
    } catch {
      return JSON.stringify({ success: false, message: 'Unable to retrieve manuscripts.' });
    }
  },
});
