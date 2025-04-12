import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  ModelType,
} from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';

export const startGeneratedTestAction: Action = {
  name: 'START_GENERATED_TEST',
  description: 'Generates and presents a test to the player for the current chapter.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const isValidPhase =
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'clarifying';
    logger.debug(
      `[Action START_GENERATED_TEST Validate] Player: ${message.entityId}, Valid Phase: ${isValidPhase}`
    );
    return isValidPhase;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options?: any
  ): Promise<ActionHandlerResult> => {
    const playerId = message.entityId;
    const logPrefix = `[Action START_GENERATED_TEST Handler]`;
    const teachingState = await getPlayerTeachingState(runtime, playerId);

    if (!teachingState) {
      logger.error(`${logPrefix} No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    if (teachingState.chapterPhase !== 'clarifying') {
      logger.warn(
        `${logPrefix} Attempted to start test for player ${playerId} but phase is '${teachingState.chapterPhase}' not 'clarifying'. Aborting.`
      );
      return {
        npcDialogue: `(Hold on, we were in the middle of the '${teachingState.chapterPhase}' phase. Let's finish that first.)`,
        signals: [],
      };
    }

    const chapter = teachingState.currentChapter;
    logger.info(`${logPrefix} Starting test for Chapter ${chapter}, Player ${playerId}`);

    const knowledgeQuery = `teaching material content for Social Etiquette Chapter ${chapter}`;
    let chapterContent = '';
    try {
      logger.debug(`${logPrefix} Fetching knowledge with query: "${knowledgeQuery}"`);
      const knowledgeResults = await runtime.getKnowledge({
        ...message,
        content: { text: knowledgeQuery },
      });
      if (knowledgeResults && knowledgeResults.length > 0) {
        chapterContent = knowledgeResults.map((k) => k.content.text).join('\n\n');
        logger.info(
          `${logPrefix} Found knowledge for Chapter ${chapter}. Length: ${chapterContent.length}`
        );
        logger.trace(`${logPrefix} Chapter Content:`, chapterContent.substring(0, 500));
      } else {
        logger.warn(`${logPrefix} No knowledge found for Chapter ${chapter} test generation.`);
      }
    } catch (err) {
      logger.error(`${logPrefix} Error fetching knowledge for test generation:`, err);
    }

    const testGenPrompt = `
Context: You are creating a test for Chapter ${chapter} of Social Etiquette.
Chapter Content Summary:
${chapterContent.substring(0, 1000)}...

Player Weaknesses Identified So Far: ${teachingState.playerWeaknesses.join(', ') || 'None'}

Task: Generate 1-3 test questions or a short scenario related to the chapter content. The difficulty should be moderate, but slightly increased if the player has shown weaknesses in specific areas. The test should assess understanding of the core concepts. Present the test clearly to the player.

Generated Test:`;
    logger.trace(`${logPrefix} Test Generation Prompt:`, testGenPrompt);

    let testText = `(Placeholder: Test for Chapter ${chapter})`;
    try {
      logger.debug(`${logPrefix} Generating test using LLM.`);
      testText = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: testGenPrompt });
      logger.info(`${logPrefix} Successfully generated test text.`);
      logger.trace(`${logPrefix} Generated Test Text:`, testText);
    } catch (err) {
      logger.error(`${logPrefix} Error generating test with LLM:`, err);
      testText =
        "I seem to be having trouble creating the test right now. Let's try again in a moment.";
      return { npcDialogue: testText, signals: [] };
    }

    logger.debug(`${logPrefix} Updating player state to 'testing' for Chapter ${chapter}.`);
    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, {
      chapterPhase: 'testing',
    });

    if (!updateSuccess) {
      logger.error(`${logPrefix} Failed to update player state to 'testing'.`);
      return { npcDialogue: '(Error: Could not update training state for test.)', signals: [] };
    }
    logger.debug(`${logPrefix} Player state updated successfully to 'testing'.`);

    const finalDialogue = `Okay, time for a quick check on Chapter ${chapter}!\n\n${testText}\n\nPlease provide your answer.`;
    logger.info(`${logPrefix} Presenting test to Player ${playerId}.`);
    return {
      npcDialogue: finalDialogue,
      signals: [],
    };
  },
  examples: [
    [
      { name: 'Player', content: { text: "I think I'm ready for the test." } },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Player indicates readiness during clarification. Start the test for the current chapter.',
          text: '(Action: START_GENERATED_TEST)',
          actions: ['START_GENERATED_TEST'],
        },
      },
    ],
  ],
};
