import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'get_manuscripts_count',
    description: 'Get the total count of manuscripts for the user',
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
      return `You have ${manuscripts.length} manuscript(s).`;
    } catch {
      return 'Unable to retrieve manuscript count.';
    }
  },
});
