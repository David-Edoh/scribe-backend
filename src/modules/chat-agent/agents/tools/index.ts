import { AgentTool } from '../agent-types';
import { tool as getManuscriptsCount } from './get_manuscripts_count';
import { tool as listManuscripts } from './list_manuscripts';
import { tool as listVoiceProfiles } from './list_voice_profiles';
import { tool as getManuscriptDetails } from './get_manuscript_details';
import { tool as searchUserKnowledge } from './search_user_knowledge';
import { tool as generateManuscript } from './generate_manuscript_or_book';
import { tool as runFrontendAction } from './run_frontend_action';

export function createAgentTools(services: any): AgentTool[] {
  return [
    getManuscriptsCount(services),
    listManuscripts(services),
    listVoiceProfiles(services),
    getManuscriptDetails(services),
    searchUserKnowledge(services),
    generateManuscript(services),
    runFrontendAction(services),
  ];
}

export function getToolDeclarations(tools: AgentTool[]) {
  return tools.map((t) => t.declaration);
}
