import { type Action, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';
import { type TeachingStateData } from '../componentTypes';

function getPlayerIntent(input: string): 'affirmative' | 'negative' | 'unknown' {
  const lowerInput = input.toLowerCase().trim();
  const affirmativeKeywords = [
    'yes',
    'ok',
    'okay',
    'sure',
    'agree',
    'start',
    'resume',
    'continue',
    'teach me',
    'activate',
    'do it',
    'i accept',
    'like some',
  ];
  const negativeKeywords = [
    'no',
    'stop',
    'pause',
    'later',
    'not now',
    'cancel',
    'deactivate',
    "don't",
  ];

  if (affirmativeKeywords.some((keyword) => lowerInput.includes(keyword))) {
    return 'affirmative';
  }
  if (negativeKeywords.some((keyword) => lowerInput.includes(keyword))) {
    return 'negative';
  }
  return 'unknown';
}

export const toggleTeachingModeAction: Action = {
  name: 'TOGGLE_TEACHING_MODE',
  description:
    'Activates, deactivates, resumes, or confirms the status of the training mode based on player input, especially after an offer.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    logger.debug(
      `[Action TOGGLE_TEACHING_MODE Validate] Player: ${message.entityId}, State exists: ${!!teachingState}`
    );
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    options?: { activate?: boolean; llmThought?: string }
  ): Promise<ActionHandlerResult> => {
    const playerId = message.entityId;
    const playerInput = message.content.text || '';
    const logPrefix = `[Action TOGGLE_TEACHING_MODE Handler]`;
    logger.info(
      `${logPrefix} Started for player ${playerId}. Input: "${playerInput}", Options:`,
      options
    );

    const currentState = await getPlayerTeachingState(runtime, playerId);
    logger.debug(`${logPrefix} Current teaching state:`, currentState ?? 'null');
    const currentModeActive = currentState?.teachingModeActive ?? false;
    const offerWasPending = currentState?.offerPending ?? false;

    let newModeActive: boolean;
    let dialogue: string;
    let determinedIntent = getPlayerIntent(playerInput);
    let newStateUpdate: Partial<TeachingStateData> = {};

    logger.debug(
      `${logPrefix} Offer was pending: ${offerWasPending}, Determined Intent: ${determinedIntent}`
    );

    if (options && typeof options.activate === 'boolean') {
      newModeActive = options.activate;
      determinedIntent = newModeActive ? 'activate' : 'deactivate';
      logger.debug(
        `${logPrefix} Forced activation state: ${newModeActive}. Intent assumed: ${determinedIntent}`
      );
      newStateUpdate.offerPending = false;
    } else if (offerWasPending) {
      if (determinedIntent === 'affirmative') {
        newModeActive = true;
        dialogue = `Excellent! Training mode activated. We'll start with Chapter ${currentState?.currentChapter ?? 1}.`;
        newStateUpdate = {
          teachingModeActive: true,
          offerPending: false,
          chapterPhase: 'idle',
          npcStatus: 'idle',
        };
        logger.info(`${logPrefix} Player accepted pending offer. Activating training mode.`);
      } else if (determinedIntent === 'negative') {
        newModeActive = false;
        dialogue = 'Okay, maybe another time then. Feel free to ask if you change your mind.';
        newStateUpdate = {
          offerPending: false,
          teachingModeActive: false,
          npcStatus: 'idle',
        };
        logger.info(`${logPrefix} Player declined pending offer. Keeping training mode inactive.`);
      } else {
        newModeActive = currentModeActive;
        dialogue =
          "Sorry, I didn't quite catch that. Were you interested in starting the Social Etiquette training?";
        newStateUpdate.offerPending = true;
        logger.warn(`${logPrefix} Unclear response to pending offer. Re-prompting.`);
      }
    } else {
      if (determinedIntent === 'affirmative' && !currentModeActive) {
        newModeActive = true;
        const chapterToShow = currentState?.currentChapter ?? 1;
        const isResuming = (currentState?.completedChapters?.length ?? 0) > 0;
        dialogue = `Okay! Training mode activated. We'll ${isResuming ? 'resume at' : 'start with'} Chapter ${chapterToShow}.`;
        newStateUpdate = { teachingModeActive: true, chapterPhase: 'idle', npcStatus: 'idle' };
        logger.info(`${logPrefix} Player wants to start/resume. Activating training.`);
      } else if (determinedIntent === 'negative' && currentModeActive) {
        newModeActive = false;
        dialogue = 'Okay, training mode deactivated. You can ask to resume anytime.';
        newStateUpdate = { teachingModeActive: false, npcStatus: 'idle' };
        logger.info(`${logPrefix} Player wants to stop/pause. Deactivating training.`);
      } else {
        newModeActive = currentModeActive;
        const chapterInfo = currentState?.currentChapter
          ? ` for Chapter ${currentState.currentChapter}`
          : '';
        const completedInfo =
          (currentState?.completedChapters?.length ?? 0 > 0)
            ? ` Last completed: Chapter ${Math.max(0, ...currentState.completedChapters)}.`
            : '';
        dialogue = currentModeActive
          ? `We are currently in training mode${chapterInfo}. Ready for the next step?`
          : `We are not in training mode currently.${completedInfo} Would you like to start or resume?`;
        logger.info(
          `${logPrefix} No change requested or confirming status. Mode remains ${currentModeActive}.`
        );
        newStateUpdate.npcStatus = 'idle';
      }
    }

    if (Object.keys(newStateUpdate).length > 0 && newModeActive !== currentModeActive) {
      logger.info(`${logPrefix} Applying state update:`, newStateUpdate);
      const updateSuccess = await updatePlayerTeachingState(runtime, playerId, newStateUpdate);
      if (!updateSuccess) {
        dialogue = "Sorry, I had trouble changing the training mode state. Let's try that again.";
        logger.error(`${logPrefix} Failed to update state for player ${playerId}`);
      } else {
        logger.info(`${logPrefix} Successfully updated teaching state for player ${playerId}`);
      }
    } else if (Object.keys(newStateUpdate).length > 0) {
      logger.debug(`${logPrefix} Applying minor state update (no mode change):`, newStateUpdate);
      await updatePlayerTeachingState(runtime, playerId, newStateUpdate);
    }

    logger.info(`${logPrefix} Returning dialogue: "${dialogue}"`);
    return { npcDialogue: dialogue, signals: [] };
  },
  examples: [
    [
      {
        name: 'NPC_Trainer',
        content: { text: '[...offers training...]', actions: ['OFFER_TRAINING'] },
      },
      { name: 'Player', content: { text: 'Yes, I want to learn!' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Player accepted the pending offer. Activate teaching mode and clear offer flag.',
          text: '(Action: TOGGLE_TEACHING_MODE)',
          actions: ['TOGGLE_TEACHING_MODE'],
        },
      },
    ],
    [
      {
        name: 'NPC_Trainer',
        content: { text: '[...offers training...]', actions: ['OFFER_TRAINING'] },
      },
      { name: 'Player', content: { text: 'Not right now.' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Player declined the pending offer. Keep teaching mode inactive and clear offer flag.',
          text: '(Action: TOGGLE_TEACHING_MODE)',
          actions: ['TOGGLE_TEACHING_MODE'],
        },
      },
    ],
    [
      { name: 'Player', content: { text: 'Teach me social skills.' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Player showing interest, offerPending is false. Offer training.',
          text: '(Action: OFFER_TRAINING)',
          actions: ['OFFER_TRAINING'],
        },
      },
    ],
    [
      { name: 'Player', content: { text: "Let's stop for today." } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Player wants to pause. Deactivate teaching mode.',
          text: '(Action: TOGGLE_TEACHING_MODE)',
          actions: ['TOGGLE_TEACHING_MODE'],
        },
      },
    ],
  ],
};
