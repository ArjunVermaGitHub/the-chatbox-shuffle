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

export const answerQuestionAction: Action = {
  name: 'ANSWER_QUESTION',
  description: 'Answers a player question during the clarifying phase of a chapter.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    return (
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'clarifying'
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options?: any
  ): Promise<ActionHandlerResult> => {
    const playerId = message.entityId;
    const teachingState = await getPlayerTeachingState(runtime, playerId);

    if (!teachingState) {
      logger.error(`ANSWER_QUESTION: No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    const playerQuestion = message.content.text || '';
    const chapter = teachingState.currentChapter;
    logger.info(
      `ANSWER_QUESTION: Answering question "${playerQuestion.substring(0, 50)}..." for Chapter ${chapter}, Player ${playerId}`
    );

    const knowledgeQuery = `Social Etiquette Chapter ${chapter} related to: ${playerQuestion}`;
    let knowledgeContext = '';
    try {
      const knowledgeResults = await runtime.getKnowledge({
        ...message,
        content: { text: knowledgeQuery },
      });
      if (knowledgeResults && knowledgeResults.length > 0) {
        knowledgeContext = knowledgeResults.map((k) => k.content.text).join('\n\n');
      }
    } catch (err) {
      logger.error(`Error fetching knowledge for question:`, err);
    }

    const answerPrompt = `
Context: You are teaching Chapter ${chapter} of Social Etiquette.
Relevant Knowledge:
${knowledgeContext || '(None provided)'}

Player's Question: ${playerQuestion}

Task: Provide a clear and concise answer to the player's question based on the chapter context and relevant knowledge. Address potential misunderstandings if the question indicates confusion (Weaknesses: ${teachingState.playerWeaknesses.join(', ') || 'None'}).
Answer:`;

    let answerText = `(Placeholder: Answer to '${playerQuestion}' regarding Chapter ${chapter})`;
    try {
      answerText = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: answerPrompt });
    } catch (err) {
      logger.error(`Error generating answer with LLM:`, err);
      answerText =
        "That's a good question, but I'm having trouble formulating an answer right now. Could you ask differently?";
    }

    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, {
      chapterPhase: 'clarifying',
    });
    if (!updateSuccess) {
      logger.warn(
        `ANSWER_QUESTION: Failed to update state for player ${playerId} after answering.`
      );
    }

    return {
      npcDialogue: answerText,
      signals: [],
    };
  },
  examples: [
    [
      { name: 'Player', content: { text: 'But what if someone offers food I dislike?' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Player asked a specific question during clarification for Chapter 2 (Table Manners). Answer it using chapter context.',
          text: '(Action: ANSWER_QUESTION)',
          actions: ['ANSWER_QUESTION'],
        },
      },
    ],
  ],
};
