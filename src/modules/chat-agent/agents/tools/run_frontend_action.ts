import { Type } from '@google/genai';
import { AgentTool } from '../agent-types';

export const tool = (services: any): AgentTool => ({
  declaration: {
    name: 'run_frontend_action',
    description:
      'Schedule an action to run in the user browser on the currently open page. Use only action names listed in CURRENT FRONTEND PAGE ACTIONS.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionName: { type: Type.STRING, description: 'Exact frontend action name from the current page action list.' },
        argsJson: { type: Type.STRING, description: 'JSON object string containing arguments for the frontend action.' },
        reason: { type: Type.STRING, description: 'Short user-facing reason for the action.' },
      },
      required: ['actionName'],
    },
  },
  handler: async ({ actionName, argsJson, reason }: Record<string, any>) => {
    let args: Record<string, any> = {};
    if (argsJson) {
      try {
        const parsedArgs = JSON.parse(argsJson);
        if (parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs)) args = parsedArgs;
      } catch {
        return JSON.stringify({ success: false, message: 'argsJson must be a valid JSON object string.' });
      }
    }
    return JSON.stringify({ success: true, frontendAction: { actionName, args, reason } });
  },
});
