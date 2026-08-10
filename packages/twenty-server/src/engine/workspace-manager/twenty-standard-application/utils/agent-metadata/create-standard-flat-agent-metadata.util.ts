import { type FlatAgent } from 'src/engine/metadata-modules/flat-agent/types/flat-agent.type';
import { type AllStandardAgentName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-agent-name.type';
import { type CreateStandardAgentArgs } from 'src/engine/workspace-manager/twenty-standard-application/utils/agent-metadata/create-standard-agent-flat-metadata.util';

// Intentionally empty — see STANDARD_AGENT in standard-agent.constant.ts for why
// the stock "helper" agent was removed.
export const STANDARD_FLAT_AGENT_METADATA_BUILDERS_BY_AGENT_NAME: Partial<
  Record<
    AllStandardAgentName,
    (args: Omit<CreateStandardAgentArgs, 'context'>) => FlatAgent
  >
> = {};
