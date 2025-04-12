import {
  type Plugin,
  type Route,
  logger,
  createMessageMemory,
  ModelType,
  type State,
  type IAgentRuntime,
  composePromptFromState,
  type UUID,
  type Memory,
} from '@elizaos/core';
import { z } from 'zod';

import { NpcTeachingStateComponent, type TeachingStateData } from './componentTypes';
import { npcTeachingStateProvider } from './providers/NpcTeachingStateProvider';
import { setDialogueAction } from './actions/setDialogueAction';
import { offerTrainingAction } from './actions/offerTrainingAction';
import { toggleTeachingModeAction } from './actions/toggleTeachingModeAction';
import { startTeachingAction } from './actions/startTeachingAction';
import { askClarificationAction } from './actions/askClarificationAction';
import { answerQuestionAction } from './actions/answerQuestionAction';
import { startGeneratedTestAction } from './actions/startGeneratedTestAction';
import { evaluateGeneratedTestResponseAction } from './actions/evaluateGeneratedTestResponseAction';
import { advanceChapterAction } from './actions/advanceChapterAction';
import { repeatTeachingAction } from './actions/repeatTeachingAction';
import { teachingProgressEvaluator } from './evaluators/teachingProgressEvaluator';
import {
  type ActionHandlerResult,
  getPlayerTeachingState,
  updatePlayerTeachingState,
  ensurePlayerEntity,
} from './actions/common';
import { type GodotSignal } from './signals';

const handleNpcInteraction: Route['handler'] = async (req, res, runtime) => {
  const agentId = '09f35a8a-de4b-0105-9925-c6db4fc04626';
  const { playerId, dialogue } = req.body;
  let currentTeachingState: TeachingStateData | null = null;
  let playerEntityUUID: UUID | null = null;
  const interactionId = `interact-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const logPrefix = `[Interaction ${interactionId}]`;
  const STALE_STATUS_THRESHOLD = 5 * 60 * 1000;

  logger.debug(`${logPrefix} Handler started.`);
  logger.info(
    `${logPrefix} Received request - NPC: ${agentId}, Godot Player ID: ${playerId}, Dialogue: "${dialogue}"`
  );

  try {
    logger.debug(`${logPrefix} Validating request...`);
    if (!playerId || typeof dialogue === 'undefined') {
      logger.warn(`${logPrefix} Bad Request: Missing playerId or dialogue.`);
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing playerId or dialogue.' },
      });
      return;
    }
    if (runtime.agentId !== agentId) {
      logger.warn(
        `${logPrefix} Agent mismatch: Runtime agent ${runtime.agentId} != requested ${agentId}`
      );
      res.status(404).json({
        success: false,
        error: { code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} mismatch.` },
      });
      return;
    }
    logger.debug(`${logPrefix} Request validation passed.`);

    logger.debug(`${logPrefix} Step 1: Resolving Player Entity UUID for Godot ID: ${playerId}...`);
    try {
      playerEntityUUID = await ensurePlayerEntity(runtime, playerId);
      logger.info(
        `${logPrefix} Resolved Godot Player ID ${playerId} to Entity UUID ${playerEntityUUID}`
      );
    } catch (entityError: any) {
      logger.error(
        `${logPrefix} Failed to ensure player entity for Godot ID ${playerId}: ${entityError.message}`,
        { stack: entityError.stack }
      );
      throw new Error(`Could not resolve player ${playerId}.`);
    }
    logger.debug(`${logPrefix} Step 1 Complete.`);

    logger.debug(
      `${logPrefix} Step 2: Checking NPC Status for Player UUID: ${playerEntityUUID}...`
    );
    currentTeachingState = await getPlayerTeachingState(runtime, playerEntityUUID);
    logger.debug(
      `${logPrefix} Fetched current teaching state (before stale check):`,
      JSON.stringify(currentTeachingState ?? 'null', null, 2)
    );

    if (currentTeachingState && currentTeachingState.npcStatus !== 'idle') {
      const timeSinceLastInteraction = Date.now() - currentTeachingState.lastInteractionTime;
      logger.debug(
        `${logPrefix} NPC status is '${currentTeachingState.npcStatus}'. Time since last interaction: ${timeSinceLastInteraction}ms.`
      );
      if (timeSinceLastInteraction > STALE_STATUS_THRESHOLD) {
        logger.warn(
          `${logPrefix} NPC ${agentId} status is '${currentTeachingState.npcStatus}' but last interaction was ${Math.round(timeSinceLastInteraction / 1000)}s ago (> ${STALE_STATUS_THRESHOLD / 1000}s). Assuming stale, attempting reset to 'idle'.`
        );
        const resetState = await updatePlayerTeachingState(runtime, playerEntityUUID, {
          npcStatus: 'idle',
        });
        if (resetState) {
          currentTeachingState = resetState;
          logger.info(
            `${logPrefix} Stale status reset successfully. New state:`,
            JSON.stringify(currentTeachingState, null, 2)
          );
        } else {
          logger.error(
            `${logPrefix} Failed to reset stale status. Interaction may remain blocked.`
          );
          res.status(500).json({
            success: false,
            error: {
              code: 'STATE_RESET_ERROR',
              message: 'Could not reset NPC status. Please try again.',
            },
          });
          return;
        }
      } else {
        logger.warn(
          `${logPrefix} NPC ${agentId} is busy (${currentTeachingState.npcStatus}). Player ${playerEntityUUID} interaction ignored.`
        );
        res.status(200).json({
          success: true,
          data: { npcDialogue: '(The NPC seems preoccupied right now.)', signals: [] },
        });
        return;
      }
    }
    logger.debug(`${logPrefix} Step 2 Complete. NPC is idle.`);

    logger.debug(`${logPrefix} Step 3: Setting NPC status to 'talking'...`);
    const stateBeforeTalking = currentTeachingState;
    currentTeachingState = await updatePlayerTeachingState(runtime, playerEntityUUID, {
      npcStatus: 'talking',
    });
    if (!currentTeachingState) {
      logger.error(
        `${logPrefix} Failed to update NPC status to 'talking' for player ${playerEntityUUID}. Previous state:`,
        JSON.stringify(stateBeforeTalking, null, 2)
      );
      throw new Error(`Failed to update NPC status to 'talking' for player ${playerEntityUUID}.`);
    }
    logger.info(
      `${logPrefix} NPC status set to 'talking'. Current state confirmed:`,
      JSON.stringify(currentTeachingState, null, 2)
    );
    logger.debug(`${logPrefix} Step 3 Complete.`);

    logger.debug(`${logPrefix} Step 3.5: Getting last NPC action...`);
    let lastNpcAction = 'NONE';
    try {
      const lastNpcMessages = await runtime.getMemories({
        entityId: runtime.agentId,
        roomId: runtime.agentId,
        agentId: runtime.agentId,
        count: 5,
        tableName: 'messages',
      });
      logger.trace(`${logPrefix} Raw last NPC message query result:`, lastNpcMessages);

      const relevantMessage = lastNpcMessages.find(
        (msg) => msg.content?.actions && msg.content.actions.length > 0
      );

      if (relevantMessage && relevantMessage.content?.actions?.length > 0) {
        lastNpcAction = relevantMessage.content.actions[0];
      } else {
        logger.debug(`${logPrefix} No relevant previous NPC message with actions found.`);
      }
    } catch (memError: any) {
      logger.warn(`${logPrefix} Could not fetch last NPC message: ${memError.message || memError}`);
    }
    logger.info(`${logPrefix} Determined Last NPC Action: ${lastNpcAction}`);
    logger.debug(`${logPrefix} Step 3.5 Complete.`);

    logger.debug(`${logPrefix} Step 4: Constructing Memory and Composing State...`);
    const memory = createMessageMemory({
      entityId: playerEntityUUID,
      agentId: runtime.agentId,
      roomId: runtime.agentId,
      content: { text: dialogue, source: 'godot-rest', name: playerId },
    });
    logger.trace(`${logPrefix} Created memory object:`, memory);
    logger.debug(`${logPrefix} Calling composeState...`);
    const state: State = await runtime.composeState(memory);
    state.data = { ...(state.data || {}), teachingState: currentTeachingState };
    state.values.lastNpcAction = lastNpcAction;
    state.values.teachingModeActive = currentTeachingState?.teachingModeActive ?? false;
    state.values.chapterPhase = currentTeachingState?.chapterPhase ?? 'idle';
    logger.debug(`${logPrefix} Composed state. Text context length: ${state.text?.length || 0}`);
    logger.trace(
      `${logPrefix} Composed state values (incl. lastNpcAction, teaching state):`,
      state.values
    );
    logger.debug(`${logPrefix} Step 4 Complete.`);

    logger.debug(`${logPrefix} Step 5: Getting LLM Action Decision...`);
    const decisionPromptTemplate = `# Current State: teachingModeActive={{teachingModeActive}}, chapterPhase={{chapterPhase}}, Your Last Action={{lastNpcAction}}
# Task: Decide NPC action based on player interaction, teaching state, and YOUR last action.
{{providers}}
Player Dialogue: ${dialogue}
Instructions: Based on the player's dialogue, the current teaching context, AND Your Last Action, decide the single most appropriate action for the NPC trainer. Choose only ONE action. Follow the Core Action Logic Based on Phase & Player Input & YOUR LAST ACTION strictly.
Available Actions: {{actionNames}}
Response format (JSON object containing 'thought' and 'actions' array with ONE action): { "thought": "...", "actions": ["ACTION_NAME"] }
`;
    const decisionPrompt = await composePromptFromState({
      state,
      template: decisionPromptTemplate,
    });
    logger.trace(`${logPrefix} LLM Decision Prompt:\n---\n${decisionPrompt}\n---`);
    const llmDecision = await runtime.useModel(ModelType.OBJECT_SMALL, { prompt: decisionPrompt });
    logger.trace(`${logPrefix} LLM Decision Raw Response:`, llmDecision);

    const actionsToExecute =
      Array.isArray(llmDecision?.actions) && llmDecision.actions.length > 0
        ? [llmDecision.actions[0]]
        : ['SET_NPC_DIALOGUE'];
    const llmThought = llmDecision?.thought || 'No specific thought generated.';
    logger.info(
      `${logPrefix} LLM decided action: ${actionsToExecute[0]} with thought: "${llmThought}"`
    );
    logger.debug(`${logPrefix} Step 5 Complete.`);

    logger.debug(`${logPrefix} Step 6: Processing Action ${actionsToExecute[0]}...`);
    let finalDialogue = "(NPC didn't respond.)";
    let signals: GodotSignal[] = [];
    const actionName = actionsToExecute[0];
    const action = runtime.actions.find((a) => a.name === actionName);

    if (action?.handler) {
      logger.debug(`${logPrefix} Found handler for action ${actionName}. Executing...`);
      const actionOptions = { llmThought: llmThought };
      const result: unknown = await action.handler(runtime, memory, state, actionOptions);
      if (result && typeof result === 'object' && 'npcDialogue' in result) {
        const handlerResult = result as ActionHandlerResult;
        finalDialogue = handlerResult.npcDialogue;
        signals = handlerResult.signals || [];
        logger.info(
          `${logPrefix} Action ${actionName} completed. Result: Dialogue="${finalDialogue}", Signals=${JSON.stringify(signals)}`
        );
      } else {
        logger.error(
          `${logPrefix} Action ${actionName} handler returned unexpected result:`,
          result
        );
        finalDialogue = '(Error during action execution)';
      }
    } else {
      logger.error(`${logPrefix} Action ${actionName} not found or has no handler.`);
      finalDialogue = `(Action ${actionName} not found)`; // Set error dialogue
    }
    logger.debug(`${logPrefix} Step 6 Complete.`);

    logger.debug(`${logPrefix} Step 7: Running Evaluators...`);
    await runtime.evaluate(memory, state, true);
    logger.debug(`${logPrefix} Step 7 Complete.`);

    logger.info(
      `${logPrefix} Step 8: Sending final response to Godot: Dialogue="${finalDialogue}", Signals=${JSON.stringify(signals)}`
    );
    const responseData = {
      npcDialogue: finalDialogue,
      signals: signals,
      actionTaken: actionName,
      llmThought: llmThought,
    };
    res.status(200).json({ success: true, data: responseData });
    logger.debug(`${logPrefix} Step 8 Complete.`);
  } catch (error: any) {
    logger.error(`${logPrefix} Error handling NPC interaction: ${error.message || error}`, {
      stack: error.stack,
    });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'An unexpected error occurred processing interaction.',
        },
      });
    }
  } finally {
    logger.debug(`${logPrefix} Finally block: Resetting NPC status...`);
    if (playerEntityUUID && currentTeachingState?.npcStatus === 'talking') {
      try {
        logger.debug(
          `${logPrefix} Attempting to reset status from 'talking' to 'idle' for player ${playerEntityUUID}`
        );
        const resetSuccess = await updatePlayerTeachingState(runtime, playerEntityUUID, {
          npcStatus: 'idle',
        });
        if (!resetSuccess) {
          logger.error(
            `${logPrefix} CRITICAL: Failed to reset NPC ${agentId} status to 'idle' for player ${playerEntityUUID} in finally block. Current state might be inconsistent.`
          );
        } else {
          logger.debug(
            `${logPrefix} NPC ${agentId} status reset to 'idle' for player ${playerEntityUUID} in finally block.`
          );
        }
      } catch (finallyError: any) {
        logger.error(
          `${logPrefix} CRITICAL: Error during finally block status reset for player ${playerEntityUUID}: ${finallyError.message || finallyError}`,
          { stack: finallyError.stack }
        );
      }
    } else {
      logger.debug(
        `${logPrefix} No status reset needed in finally block (playerEntityUUID: ${!!playerEntityUUID}, npcStatus was not 'talking' or update failed earlier). Current Status: ${currentTeachingState?.npcStatus}`
      );
    }
    logger.info(`${logPrefix} Interaction processing finished.`);
  }
};

const handleGetNpcs: Route['handler'] = async (_req, res, runtime) => {
  const logPrefix = `[GET /npcs]`;
  try {
    logger.info(`${logPrefix} Request received.`);
    const agentInfo = { id: runtime.agentId, name: runtime.character.name };
    logger.info(`${logPrefix} Responding with agent:`, agentInfo);
    res.status(200).json({ success: true, data: [agentInfo] });
  } catch (error: any) {
    logger.error(`${logPrefix} Error fetching NPC list:`, error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve NPC list.' },
    });
  }
};

const godotPlugin: Plugin = {
  name: 'eliza-godot-plugin',
  description: 'Connects ElizaOS agents to a Godot game instance via REST API.',
  providers: [npcTeachingStateProvider],
  actions: [
    setDialogueAction,
    offerTrainingAction,
    toggleTeachingModeAction,
    startTeachingAction,
    askClarificationAction,
    answerQuestionAction,
    startGeneratedTestAction,
    evaluateGeneratedTestResponseAction,
    advanceChapterAction,
    repeatTeachingAction,
  ],
  evaluators: [teachingProgressEvaluator],
  componentTypes: [
    { ...NpcTeachingStateComponent, schema: NpcTeachingStateComponent.schema as any },
  ],
  routes: [
    {
      path: '/npcs',
      type: 'GET',
      handler: handleGetNpcs,
    },
    {
      path: '/npc/interact',
      type: 'POST',
      handler: handleNpcInteraction,
    },
  ],
  init: async (_config, runtime) => {
    logger.info('Godot REST Plugin Initialized for agent:', runtime.agentId);
  },
  config: {},
};

export default godotPlugin;

export { NpcTeachingStateComponent, updatePlayerTeachingState };
export type { TeachingStateData };
