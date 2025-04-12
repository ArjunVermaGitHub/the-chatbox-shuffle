import { type Action, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { getPlayerTeachingState, type ActionHandlerResult } from './common';

export const askClarificationAction: Action = {
  name: 'ASK_CLARIFICATION',
  description: 'Asks the player if they have any questions after a teaching segment.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    return (
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'clarifying'
    );
  },
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined,
    _options?: any
  ): Promise<ActionHandlerResult> => {
    logger.info(`ASK_CLARIFICATION: Checking if player needs clarification.`);
    const clarificationText =
      'Do you have any questions about what we just covered, or shall we move on to the test?';
    return {
      npcDialogue: clarificationText,
      signals: [],
    };
  },
  examples: [
    [
      {
        name: 'NPC_Trainer',
        content: { text: '[...teaching content...]', actions: ['SET_NPC_DIALOGUE'] },
      },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Finished explaining the concepts for this chapter. Check if the player has questions before testing.',
          text: '(Action: ASK_CLARIFICATION)',
          actions: ['ASK_CLARIFICATION'],
        },
      },
    ],
  ],
};
