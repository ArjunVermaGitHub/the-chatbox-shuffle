import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  ModelType,
  parseJSONObjectFromText,
  composePromptFromState,
} from '@elizaos/core';
import type { ActionHandlerResult } from './common';

const dialogueGenerationTemplate = `# Task: Generate NPC Dialogue based on thought and context.
{{providers}}
NPC Internal Thought: {{llmThought}}
Player Last Message: {{playerLastMessage}}

Instructions: Based on the NPC's internal thought and the conversation context, generate the next appropriate dialogue line for the NPC ({{agentName}}). Keep it concise and natural.
**CRITICAL: Your response must ONLY contain the dialogue text itself. DO NOT include action tags like "(Action: ...)" or "(actions: ...)" in the final output.**

NPC Dialogue:`;

export const setDialogueAction: Action = {
  name: 'SET_NPC_DIALOGUE',
  description:
    'Sets the current dialogue line for the NPC in the Godot game. This is the default action for sending any text response.',
  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
    logger.debug(`[Action SET_NPC_DIALOGUE Validate] Called.`);
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options?: { explicitDialogue?: string; llmThought?: string }
  ): Promise<ActionHandlerResult> => {
    const logPrefix = `[Action SET_NPC_DIALOGUE Handler]`;
    let dialogueToSet = '';
    let thought = options?.llmThought || 'Preparing to send dialogue to the game.';

    logger.debug(`${logPrefix} Started. Options received:`, options);
    logger.debug(`${logPrefix} Initial thought: "${thought}"`);

    if (options?.explicitDialogue) {
      dialogueToSet = options.explicitDialogue;
      logger.info(`${logPrefix} Using explicitly provided dialogue: "${dialogueToSet}"`);
    } else if (options?.llmThought && state) {
      logger.info(`${logPrefix} Generating dialogue based on thought: "${options.llmThought}"`);
      try {
        const dialogueState = state;
        dialogueState.values.llmThought = options.llmThought;
        dialogueState.values.playerLastMessage = message.content.text || '(No player message text)';

        const prompt = composePromptFromState({
          state: dialogueState,
          template: dialogueGenerationTemplate,
        });
        logger.trace(`${logPrefix} Dialogue Generation Prompt:`, prompt);

        dialogueToSet = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
        logger.debug(`${logPrefix} Raw generated dialogue from LLM: "${dialogueToSet}"`);

        dialogueToSet = dialogueToSet.trim().replace(/^["']|["']$/g, '');
        dialogueToSet = dialogueToSet.replace(/\(actions?:[^)]+\)/gi, '').trim();
        dialogueToSet = dialogueToSet.replace(/\(Action:[^)]+\)/gi, '').trim();
        dialogueToSet = dialogueToSet.replace(/^NPC Dialogue:\s*/i, '').trim();

        logger.debug(`${logPrefix} Cleaned generated dialogue: "${dialogueToSet}"`);
      } catch (error) {
        logger.error(`${logPrefix} Error generating dialogue from thought:`, error);
        dialogueToSet = "(Error: I couldn't figure out what to say based on my thought.)";
      }
    } else {
      logger.warn(
        `${logPrefix} No explicit dialogue or thought provided. Generating generic response.`
      );
      try {
        const fallbackPrompt = `Generate a brief, neutral acknowledgement or continuation phrase for an NPC trainer. Examples: "Okay.", "Understood.", "Alright.", "Hmm, let me think." Respond with ONLY the phrase.`;
        logger.debug(`${logPrefix} Using fallback prompt for generic dialogue.`);
        logger.trace(`${logPrefix} Fallback Prompt:`, fallbackPrompt);
        dialogueToSet = await runtime.useModel(ModelType.TEXT_SMALL, { prompt: fallbackPrompt });
        dialogueToSet = dialogueToSet.trim().replace(/^["']|["']$/g, '');
        logger.debug(`${logPrefix} Generated fallback dialogue: "${dialogueToSet}"`);
      } catch (fallbackError) {
        logger.error(`${logPrefix} Error generating fallback dialogue:`, fallbackError);
        dialogueToSet = 'Okay.';
      }
    }

    dialogueToSet =
      typeof dialogueToSet === 'string' ? dialogueToSet : '(Internal error: invalid dialogue)';

    if (/\(actions?:|Action:/i.test(dialogueToSet)) {
      logger.warn(
        `${logPrefix} Dialogue *still* contains action tag after cleanup, removing again: "${dialogueToSet}"`
      );
      dialogueToSet = dialogueToSet.replace(/\(actions?:[^)]+\)/gi, '').trim();
      dialogueToSet = dialogueToSet.replace(/\(Action:[^)]+\)/gi, '').trim();
    }

    logger.info(`${logPrefix} Final dialogue determined: "${dialogueToSet}"`);
    logger.debug(`${logPrefix} Associated thought process: "${thought}"`);

    return {
      npcDialogue: dialogueToSet,
      signals: [],
    };
  },
  examples: [
    [
      { name: 'Player', content: { text: 'Just saying hi.' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Standard greeting, will reply normally.',
          text: '(Action: SET_NPC_DIALOGUE)',
          actions: ['SET_NPC_DIALOGUE'],
        },
      },
    ],
    [
      { name: 'Player', content: { text: 'I want to improve my social skills.' } },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Player expressed interest. Respond positively and offer training.',
          text: '(Action: OFFER_TRAINING)',
          actions: ['OFFER_TRAINING'],
        },
      },
    ],
  ],
};
