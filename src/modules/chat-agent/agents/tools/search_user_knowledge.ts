import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'search_user_knowledge',
    description:
      "Search the user's knowledge base (voice profiles + RAG embeddings) to understand their opinion and perspective on a specific topic. Synthesizes the user's actual thoughts with their writing style to create an authentic response.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        userId: { type: Type.STRING, description: 'The user ID' },
        topic: { type: Type.STRING, description: "The topic to search for user's opinion on" },
      },
      required: ['userId', 'topic'],
    },
  },
  handler: async ({ userId, topic }: Record<string, any>) => {
    try {
      const synthesizedResponse = await services.ragService.getUserOpinionOnTopic(userId, topic);
      return synthesizedResponse;
    } catch (error) {
      services.logger?.error('Error searching user knowledge:', error);
      return 'Unable to retrieve information about your perspective on this topic.';
    }
  },
});
