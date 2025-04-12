import { type Action, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';
import { type TeachingStateData } from '../componentTypes'; // Import type

export const offerTrainingAction: Action = {
  name: 'OFFER_TRAINING',
  description: 'Offers the Social Etiquette training syllabus to the player.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const isCompleted = teachingState?.completedChapters?.length === 3; // Assuming 3 chapters total
    const isValid =
      !teachingState ||
      (!teachingState.teachingModeActive && !isCompleted && !teachingState.offerPending);
    logger.debug(
      `[Action OFFER_TRAINING Validate] Player: ${message.entityId}, State:`,
      teachingState ?? 'null',
      `IsCompleted: ${isCompleted}, Result: ${isValid}`
    );
    return isValid;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options?: any
  ): Promise<ActionHandlerResult> => {
    const playerId = message.entityId;
    const logPrefix = `[Action OFFER_TRAINING Handler]`;
    logger.info(`${logPrefix} Offering training to player ${playerId}.`);

    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, {
      offerPending: true,
    });

    if (!updateSuccess) {
      logger.error(`${logPrefix} Failed to set offerPending flag for player ${playerId}.`);
    } else {
      logger.debug(`${logPrefix} Set offerPending=true for player ${playerId}.`);
    }

    const offerText =
      "I've noticed your interest in self-improvement. I specialize in teaching Social Etiquette. Would you be interested in starting a short training syllabus?";
    return {
      npcDialogue: offerText,
      signals: [],
    };
  },
  examples: [
    [
      { name: 'Player', content: { text: 'I wish I knew how to act at fancy dinners.' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Player expressed a need related to social etiquette. Offer the training syllabus.',
          text: '(Action: OFFER_TRAINING)',
          actions: ['OFFER_TRAINING'],
        },
      },
    ],
  ],
};
