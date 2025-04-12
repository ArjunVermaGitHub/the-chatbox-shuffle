import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  ModelType,
  parseJSONObjectFromText,
} from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';
import { type TeachingStateData } from '../componentTypes'; // Import type

import { z } from 'zod';

const evaluationResultSchema = z.object({
  pass: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const lowerVal = val.trim().toLowerCase();
        if (lowerVal === 'true') return true;
        if (lowerVal === 'false') return false;
      }
      return val;
    },
    z.boolean({
      required_error: 'Pass field is required.',
      invalid_type_error: 'Pass field must be a boolean (true/false) or string "true"/"false".',
    })
  ),
  feedback: z.string({
    required_error: 'Feedback field is required.',
    invalid_type_error: 'Feedback must be a string.',
  }),
  newWeaknesses: z.array(z.string({ invalid_type_error: 'Weaknesses must be strings.' })),
});

export const evaluateGeneratedTestResponseAction: Action = {
  name: 'EVALUATE_GENERATED_TEST_RESPONSE',
  description: 'Evaluates the player response to a generated test.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const logPrefix = `[Action EVALUATE_TEST Validate]`;
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const isValidPhase =
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'testing';
    logger.debug(
      `${logPrefix} Player: ${message.entityId}, State: ${JSON.stringify(teachingState ?? 'null')}, Valid Phase: ${isValidPhase}`
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
    const playerAnswer = message.content.text || '';
    const logPrefix = `[Action EVALUATE_TEST Handler]`;
    const teachingState = await getPlayerTeachingState(runtime, playerId);

    logger.info(`${logPrefix} Triggered for Player ${playerId}.`);

    if (!teachingState) {
      logger.error(`${logPrefix} No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    if (teachingState.chapterPhase === 'evaluating_test') {
      logger.warn(
        `${logPrefix} Player ${playerId} state is already 'evaluating_test'. Skipping duplicate evaluation.`
      );
      const feedback = teachingState.lastTestResult?.pass
        ? `We already went over this, and you passed Chapter ${teachingState.currentChapter}! Ready for the next challenge?`
        : `We already reviewed this answer for Chapter ${teachingState.currentChapter}. It looks like a review might be helpful. Shall we go over it again?`;
      return { npcDialogue: feedback, signals: [] };
    }

    if (teachingState.chapterPhase !== 'testing') {
      logger.warn(
        `${logPrefix} Attempted to evaluate test for player ${playerId} but phase is '${teachingState.chapterPhase}' not 'testing'. Aborting.`
      );
      return {
        npcDialogue: `(Hmm, I wasn't expecting an answer right now. We are in the '${teachingState.chapterPhase}' phase.)`,
        signals: [],
      };
    }

    const chapter = teachingState.currentChapter;
    logger.info(
      `${logPrefix} Evaluating answer "${playerAnswer.substring(0, 50)}..." for Chapter ${chapter}, Player ${playerId}`
    );

    const knowledgeQuery = `teaching material content for Social Etiquette Chapter ${chapter}`;
    let chapterContext = '';
    try {
      logger.debug(`${logPrefix} Fetching knowledge with query: "${knowledgeQuery}"`);
      const knowledgeResults = await runtime.getKnowledge({
        ...message,
        content: { text: knowledgeQuery },
      });
      if (knowledgeResults && knowledgeResults.length > 0) {
        chapterContext = knowledgeResults.map((k) => k.content.text).join('\n\n');
        logger.info(
          `${logPrefix} Found knowledge for Chapter ${chapter} evaluation. Length: ${chapterContext.length}`
        );
        logger.trace(`${logPrefix} Chapter Context (Snippet):`, chapterContext.substring(0, 500));
      } else {
        logger.warn(`${logPrefix} No knowledge found for Chapter ${chapter} evaluation.`);
      }
    } catch (err: any) {
      logger.error(`${logPrefix} Error fetching knowledge for evaluation: ${err.message || err}`);
    }

    const evaluationPrompt = `
Context: Evaluating player's answer for Chapter ${chapter} of Social Etiquette.
Chapter Core Concepts Summary:
${chapterContext.substring(0, 1000)}...

Player Weaknesses Identified So Far: ${teachingState.playerWeaknesses.join(', ') || 'None'}

Player's Answer: ${playerAnswer}

Task: Evaluate if the player's answer demonstrates understanding of the chapter's concepts.
- Determine if the answer is essentially correct (Pass=true) or incorrect (Pass=false).
- Provide brief feedback explaining the evaluation.
- If Pass=false, identify specific concepts the player misunderstood (these are new weaknesses).

Return ONLY a JSON object within a markdown code block (\`\`\`json ... \`\`\`) with the structure:
{
  "pass": boolean,  <-- MUST BE true or false, NOT "true" or "false"
  "feedback": "string (brief explanation)",
  "newWeaknesses": ["string", ...]
}
`;
    logger.trace(`${logPrefix} Evaluation Prompt:\n---\n${evaluationPrompt}\n---`);

    let evaluationResult: z.infer<typeof evaluationResultSchema> = {
      pass: false,
      feedback: '(Error during evaluation)',
      newWeaknesses: [],
    };
    try {
      logger.debug(`${logPrefix} Evaluating answer using LLM (OBJECT_SMALL).`);
      const llmResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: evaluationPrompt,
        // *** FIX: Pass the full Zod schema object ***
        schema: evaluationResultSchema,
      });
      logger.trace(`${logPrefix} Raw LLM Response Object:`, llmResponse);

      const parsedResult = evaluationResultSchema.safeParse(llmResponse);

      if (!parsedResult.success) {
        logger.error(
          `${logPrefix} LLM evaluation response failed validation:`,
          parsedResult.error.flatten()
        );
        evaluationResult.feedback =
          "I couldn't properly evaluate your answer due to an internal format error.";
        logger.warn(`${logPrefix} Input that failed validation:`, llmResponse);
      } else {
        evaluationResult = parsedResult.data;
        logger.info(
          `${logPrefix} LLM Evaluation Result: Pass=${evaluationResult.pass} (Type: ${typeof evaluationResult.pass}), Feedback Snippet="${evaluationResult.feedback.substring(0, 50)}...", Weaknesses=${JSON.stringify(evaluationResult.newWeaknesses)}`
        );
      }
    } catch (err: any) {
      logger.error(`${logPrefix} Error evaluating test answer with LLM: ${err.message || err}`, {
        stack: err.stack,
      });
      evaluationResult.feedback = 'I encountered an error while evaluating your answer.';
    }

    const newWeaknesses = Array.from(
      new Set([...teachingState.playerWeaknesses, ...evaluationResult.newWeaknesses])
    );
    const finalPassState =
      typeof evaluationResult.pass === 'boolean' ? evaluationResult.pass : false;

    const newStateUpdate: Partial<TeachingStateData> = {
      chapterPhase: 'evaluating_test', // Mark as evaluated
      chapterAttempts: (teachingState.chapterAttempts || 0) + 1,
      playerWeaknesses: newWeaknesses,
      lastTestResult: {
        pass: finalPassState,
        timestamp: Date.now(),
      },
    };
    logger.debug(
      `${logPrefix} Updating player state to 'evaluating_test' with result: Pass=${finalPassState}`
    );

    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, newStateUpdate);
    if (!updateSuccess) {
      logger.error(`${logPrefix} Failed to save evaluation results for player ${playerId}`);
      evaluationResult.feedback += ' (Note: There was an issue saving this result.)';
    } else {
      logger.debug(
        `${logPrefix} Player state updated successfully to 'evaluating_test'. Test result saved: Pass=${finalPassState}`
      );
    }

    logger.info(
      `${logPrefix} Returning evaluation feedback to Player ${playerId}: "${evaluationResult.feedback}"`
    );
    return {
      npcDialogue: evaluationResult.feedback,
      signals: [],
    };
  },
  examples: [
    [
      { name: 'Player', content: { text: "[Player's answer to the test]" } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Player answered the test. Evaluate the response.',
          text: '(Action: EVALUATE_GENERATED_TEST_RESPONSE)',
          actions: ['EVALUATE_GENERATED_TEST_RESPONSE'],
        },
      },
    ],
  ],
};
