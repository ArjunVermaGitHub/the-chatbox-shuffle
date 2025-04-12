import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  ModelType,
  composePromptFromState,
} from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';

const teachingDeliveryTemplate = `# Task: Present Chapter Material
Chapter Title: Social Etiquette Chapter {{chapterNumber}}
Key Concepts:
{{teachingContent}}

Instructions: Present the key concepts for this chapter to the player in an engaging and easy-to-understand way. Start by stating the chapter number and topic (if identifiable from Key Concepts). End by asking if they have any initial questions.
**CRITICAL: Your response must ONLY contain the dialogue text itself. DO NOT include action tags like "(Action: ...)" or "(actions: ...)" in the final output.**

NPC Dialogue:`;

export const startTeachingAction: Action = {
  name: 'START_TEACHING',
  description: 'Initiates or resumes the teaching phase for the current chapter.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const shouldStart =
      !!teachingState &&
      teachingState.teachingModeActive &&
      (teachingState.chapterPhase === 'idle' || teachingState.chapterPhase === 'teaching');
    const logPrefix = `[Action START_TEACHING Validate]`;
    logger.debug(`${logPrefix} Player: ${message.entityId}, State:`, teachingState ?? 'null');
    logger.debug(`${logPrefix} Result: ${shouldStart}`);
    return shouldStart;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options?: any
  ): Promise<ActionHandlerResult> => {
    const playerId = message.entityId;
    const logPrefix = `[Action START_TEACHING Handler]`;
    logger.info(`${logPrefix} Started for player ${playerId}.`);

    const teachingState = await getPlayerTeachingState(runtime, playerId);

    if (!teachingState) {
      logger.error(`${logPrefix} No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    if (
      teachingState.chapterPhase === 'clarifying' ||
      teachingState.chapterPhase === 'testing' ||
      teachingState.chapterPhase === 'evaluating_test'
    ) {
      logger.warn(
        `${logPrefix} Attempted to start teaching for player ${playerId} but phase is '${teachingState.chapterPhase}'. Aborting action.`
      );
      return {
        npcDialogue: `(Internal state error: Tried to teach during ${teachingState.chapterPhase} phase. Let me re-orient...)`,
        signals: [],
      };
    }

    const chapter = teachingState.currentChapter;
    logger.info(
      `${logPrefix} Starting teaching for Chapter ${chapter}, Player ${playerId}. Current phase: ${teachingState.chapterPhase}`
    );

    const knowledgeQuery = `teaching material content for Social Etiquette Chapter ${chapter}`; // Updated query
    let rawTeachingContent = `(Placeholder: Teaching content for Social Etiquette Chapter ${chapter})`;
    let knowledgeFound = false;
    try {
      logger.debug(`${logPrefix} Fetching knowledge with query: "${knowledgeQuery}"`);
      const knowledgeResults = await runtime.getKnowledge({
        ...message,
        content: { text: knowledgeQuery },
      });
      logger.info(
        `${logPrefix} Knowledge query returned ${knowledgeResults?.length ?? 0} results.`
      );

      if (knowledgeResults && knowledgeResults.length > 0) {
        rawTeachingContent = knowledgeResults[0].content.text;
        knowledgeFound = true;
        logger.info(
          `${logPrefix} Found knowledge content for Chapter ${chapter}. Length: ${rawTeachingContent.length}`
        );
        logger.trace(`${logPrefix} Raw Knowledge Content:`, rawTeachingContent.substring(0, 500));
      } else {
        logger.warn(`${logPrefix} No specific knowledge found for query: ${knowledgeQuery}`);
        return {
          npcDialogue: `(Internal Error: I couldn't find the material for Chapter ${chapter} right now.)`,
          signals: [],
        };
      }
    } catch (err) {
      logger.error(`${logPrefix} Error fetching knowledge for Chapter ${chapter}:`, err);
      return {
        npcDialogue: `(Internal Error: Trouble accessing teaching materials for Chapter ${chapter}.)`,
        signals: [],
      };
    }

    let formattedDialogue = rawTeachingContent; // Fallback
    try {
      logger.debug(`${logPrefix} Formatting teaching content using LLM.`);
      if (!state) {
        logger.warn(
          `${logPrefix} State is undefined, cannot compose prompt for formatting. Using raw content.`
        );
        formattedDialogue = `Alright, let's cover Chapter ${chapter}.\n\n${rawTeachingContent}\n\nDo you have any initial questions?`;
      } else {
        const formattingState = state;
        formattingState.values.chapterNumber = chapter.toString();
        formattingState.values.teachingContent = rawTeachingContent.substring(0, 3000);

        const prompt = composePromptFromState({
          state: formattingState,
          template: teachingDeliveryTemplate,
        });
        logger.trace(`${logPrefix} Teaching Delivery Prompt:`, prompt);

        formattedDialogue = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
        logger.debug(`${logPrefix} Raw Formatted Dialogue: "${formattedDialogue}"`);

        formattedDialogue = formattedDialogue.trim().replace(/^["']|["']$/g, '');
        formattedDialogue = formattedDialogue.replace(/\(actions?:[^)]+\)/gi, '').trim();
        formattedDialogue = formattedDialogue.replace(/\(Action:[^)]+\)/gi, '').trim();
        formattedDialogue = formattedDialogue.replace(/^NPC Dialogue:\s*/i, '').trim();

        logger.info(`${logPrefix} Successfully formatted teaching dialogue using LLM.`);
        logger.trace(
          `${logPrefix} Cleaned Formatted Dialogue:`,
          formattedDialogue.substring(0, 500)
        );
      }
    } catch (formattingError) {
      logger.error(`${logPrefix} Error formatting teaching content with LLM:`, formattingError);
      formattedDialogue = `Alright, let's cover Chapter ${chapter}.\n\n${rawTeachingContent}\n\nDo you have any initial questions?`;
    }

    if (/\(actions?:|Action:/i.test(formattedDialogue)) {
      logger.warn(
        `${logPrefix} Dialogue *still* contains action tag after formatting cleanup, removing: "${formattedDialogue}"`
      );
      formattedDialogue = formattedDialogue.replace(/\(actions?:[^)]+\)/gi, '').trim();
      formattedDialogue = formattedDialogue.replace(/\(Action:[^)]+\)/gi, '').trim();
    }

    logger.debug(`${logPrefix} Updating player state to 'clarifying' for Chapter ${chapter}.`);
    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, {
      chapterPhase: 'clarifying',
    });

    if (!updateSuccess) {
      logger.error(`${logPrefix} Failed to update player state to 'clarifying'.`);
      formattedDialogue +=
        "\n\n(Note: There was an issue saving your progress, but let's continue.)";
    } else {
      logger.debug(`${logPrefix} Player state updated successfully to 'clarifying'.`);
    }

    logger.info(
      `${logPrefix} Returning teaching dialogue for Chapter ${chapter}. Player ${playerId} now in 'clarifying' phase.`
    );
    return {
      npcDialogue: formattedDialogue,
      signals: [],
    };
  },
  examples: [
    [
      { name: 'Player', content: { text: 'Okay, ready to learn chapter 1.' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Player is ready and state is idle for chapter 1. Start teaching.',
          text: '(Action: START_TEACHING)',
          actions: ['START_TEACHING'],
        },
      },
    ],
    [
      { name: 'NPC_Trainer', content: { text: '[Offer to review material...]' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: "State is now 'teaching'. Deliver the teaching material again.",
          text: '(Action: START_TEACHING)',
          actions: ['START_TEACHING'],
        },
      },
    ],
  ],
};
