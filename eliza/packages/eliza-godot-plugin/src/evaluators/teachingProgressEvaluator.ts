import {
  type Evaluator,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  ModelType,
} from '@elizaos/core';
import { getPlayerTeachingState, updatePlayerTeachingState } from '../actions/common'; // Use helpers
import { z } from 'zod';

const weaknessAnalysisSchema = z.object({
  identifiedWeaknesses: z
    .array(z.string())
    .describe(
      'List of specific concepts or topics from the chapter the player seems to misunderstand based on their message.'
    ),
  isConfused: z
    .boolean()
    .describe("Overall assessment if the player's message indicates confusion."),
});

export const teachingProgressEvaluator: Evaluator = {
  name: 'TEACHING_PROGRESS_EVALUATOR',
  description: 'Analyzes player messages during teaching/clarifying phases to identify weaknesses.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    if (message.entityId === runtime.agentId) return false;

    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    return (
      !!teachingState &&
      teachingState.teachingModeActive &&
      (teachingState.chapterPhase === 'teaching' || teachingState.chapterPhase === 'clarifying')
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    _callback?: any,
    _responses?: Memory[]
  ) => {
    const playerId = message.entityId;
    const playerInput = message.content.text || '';
    const teachingState = await getPlayerTeachingState(runtime, playerId);

    if (!teachingState || !playerInput) {
      logger.debug('TeachingProgressEvaluator: Skipping, no state or empty input.');
      return;
    }

    const chapter = teachingState.currentChapter;
    logger.info(
      `TeachingProgressEvaluator: Analyzing player input for Chapter ${chapter}, Player ${playerId}`
    );

    const knowledgeQuery = `Social Etiquette Chapter ${chapter} teaching material`;
    let chapterContext = '';
    try {
      const knowledgeResults = await runtime.getKnowledge({
        ...message,
        content: { text: knowledgeQuery },
      });
      if (knowledgeResults && knowledgeResults.length > 0) {
        chapterContext = knowledgeResults.map((k) => k.content.text).join('\n\n');
      }
    } catch (err) {
      logger.error(`Evaluator: Error fetching knowledge:`, err);
    }

    const analysisPrompt = `
Context: You are analyzing a player's message during Chapter ${chapter} of Social Etiquette training.
Chapter Core Concepts Summary:
${chapterContext.substring(0, 1000)}...

Player's Message: ${playerInput}

Task: Analyze the player's message. Does it indicate confusion or misunderstanding of the chapter's concepts?
- Identify specific concepts or topics (keywords) the player seems weak on.
- Determine if the overall message suggests confusion.

Return ONLY a JSON object with the structure defined by the following schema:
${JSON.stringify(weaknessAnalysisSchema.shape)}
`;

    try {
      const analysisResult = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: analysisPrompt,
      });

      const parsedResult = weaknessAnalysisSchema.safeParse(analysisResult);

      if (!parsedResult.success) {
        logger.error('Evaluator: LLM analysis response failed validation:', parsedResult.error);
        return;
      }

      const { identifiedWeaknesses } = parsedResult.data;

      if (identifiedWeaknesses.length > 0) {
        const currentWeaknesses = teachingState.playerWeaknesses || [];
        const updatedWeaknesses = Array.from(
          new Set([...currentWeaknesses, ...identifiedWeaknesses])
        );

        if (updatedWeaknesses.length > currentWeaknesses.length) {
          logger.info(
            `TeachingProgressEvaluator: Identified new weaknesses for Player ${playerId}: ${identifiedWeaknesses.join(', ')}`
          );
          await updatePlayerTeachingState(runtime, playerId, {
            playerWeaknesses: updatedWeaknesses,
          });
        }
      } else {
        logger.debug(
          `TeachingProgressEvaluator: No new weaknesses identified for Player ${playerId}.`
        );
      }
    } catch (err) {
      logger.error(`TeachingProgressEvaluator: Error during LLM analysis:`, err);
    }
  },
  examples: [],
};
