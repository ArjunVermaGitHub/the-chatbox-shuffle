import { type Action, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';

export const repeatTeachingAction: Action = {
  name: 'REPEAT_TEACHING',
  description: 'Repeats the teaching segment for the current chapter after a failed test.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const isValid =
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'evaluating_test' &&
      teachingState.lastTestResult?.pass === false;
    logger.debug(
      `[Action REPEAT_TEACHING Validate] Player: ${message.entityId}, State:`,
      teachingState ?? 'null',
      `, Validation Result: ${isValid}`
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
    const logPrefix = `[Action REPEAT_TEACHING Handler]`;
    const teachingState = await getPlayerTeachingState(runtime, playerId);

    if (!teachingState) {
      logger.error(`${logPrefix} No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    if (
      teachingState.chapterPhase !== 'evaluating_test' ||
      teachingState.lastTestResult?.pass !== false
    ) {
      logger.error(
        `${logPrefix} Invalid state to repeat teaching for player ${playerId}. Phase: ${teachingState.chapterPhase}, Pass: ${teachingState.lastTestResult?.pass}. Aborting.`
      );
      return {
        npcDialogue: '(Hold on, something seems out of sync with your test results.)',
        signals: [],
      };
    }

    logger.info(
      `${logPrefix} Repeating teaching for Chapter ${teachingState.currentChapter}, Player ${playerId}`
    );

    logger.debug(
      `${logPrefix} Updating player state back to 'teaching' for Chapter ${teachingState.currentChapter}.`
    );
    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, {
      chapterPhase: 'teaching',
      lastTestResult: null,
    });
    if (!updateSuccess) {
      logger.error(
        `${logPrefix} Failed to reset state for repeating chapter for player ${playerId}.`
      );
      return { npcDialogue: '(Error: Could not reset state for repeating chapter.)', signals: [] };
    }
    logger.debug(
      `${logPrefix} Player state updated successfully to 'teaching'. Last test result cleared.`
    );

    const weaknesses = teachingState.playerWeaknesses;
    let repeatIntro = `It seems there were some tricky points in Chapter ${teachingState.currentChapter}. Let's review the material again.`;
    if (weaknesses.length > 0) {
      repeatIntro += ` We can focus specifically on: ${weaknesses.join(', ')}.`;
    }

    logger.info(`${logPrefix} Offering review for Player ${playerId}. Dialogue: "${repeatIntro}"`);
    return {
      npcDialogue: repeatIntro,
      signals: [],
    };
  },
  examples: [
    [
      {
        name: 'NPC_Trainer',
        content: {
          text: '[Constructive feedback after failed test]',
          actions: ['SET_NPC_DIALOGUE'],
        },
      },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            "Player failed the test (state phase=evaluating_test, result=fail). Revert phase to 'teaching' and offer to review.",
          text: '(Action: REPEAT_TEACHING)',
          actions: ['REPEAT_TEACHING'],
        },
      },
    ],
  ],
};
