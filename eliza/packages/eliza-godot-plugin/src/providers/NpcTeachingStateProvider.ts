import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  logger,
  // type UUID, // Removed unused import
} from '@elizaos/core';
import { type TeachingStateData, NpcTeachingStateComponent } from '../componentTypes';

export const npcTeachingStateProvider: Provider = {
  name: 'NPC_TEACHING_STATE',
  description: 'Provides the current teaching progress state for the interacting player.',
  dynamic: false, // Usually needed in the context
  get: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<ProviderResult> => {
    const playerId = message.entityId; // Assuming message.entityId IS the player's unique ID
    const npcAgentId = runtime.agentId;

    if (!playerId) {
      logger.warn('NpcTeachingStateProvider: Player ID not found in message.');
      return { text: 'Context Error: Player identity unknown.' };
    }

    try {
      const stateComponent = await runtime.getComponent(
        npcAgentId, // Component is attached to the NPC agent
        NpcTeachingStateComponent.name,
        undefined, // worldId if applicable
        playerId // SourceEntityId might represent the player context here, or use metadata keying
      );

      // Alternative: Query based on data field if component stores multiple players' states
      // This depends on how you structure the component storage.
      // For simplicity here, we assume one component *instance* per player, keyed somehow.
      // A more scalable approach might use a single component with a map inside `data`.
      // This example assumes `getComponent` can effectively find the state for the specific player.

      let teachingState: TeachingStateData | null = null;
      if (stateComponent) {
        // TODO: Adapt this part based on how you actually store/query state per player.
        // If the component's data directly IS the TeachingStateData for *this* player:
        if (
          stateComponent.sourceEntityId === playerId ||
          (stateComponent.data as any)?.playerId === playerId
        ) {
          teachingState = stateComponent.data as TeachingStateData;
        } else {
          // Logic to find the correct player's state if the component holds multiple.
          // This part is highly dependent on DB adapter capabilities or fetching/filtering all states.
          logger.warn(
            `NpcTeachingStateProvider: Fetched component does not match playerId ${playerId}. Needs refinement.`
          );
        }
      }

      if (!teachingState) {
        // Player hasn't started training with this NPC yet
        return {
          text: 'Context: The player has not started Social Etiquette training yet.',
          values: {
            teachingModeActive: false,
            currentChapter: 1,
            chapterPhase: 'idle',
            completedChapters: [],
            playerWeaknesses: [],
          },
          data: { teachingState: null },
        };
      }

      // Format the state into text for the LLM
      let statusText = `Context: Social Etiquette Training Progress for Player ${playerId}:\n`;
      statusText += `- Mode Active: ${teachingState.teachingModeActive}\n`;
      if (teachingState.teachingModeActive) {
        statusText += `- Current Chapter: ${teachingState.currentChapter}\n`;
        statusText += `- Chapter Phase: ${teachingState.chapterPhase}\n`;
        statusText += `- Completed Chapters: ${teachingState.completedChapters.join(', ') || 'None'}\n`;
        if (teachingState.playerWeaknesses.length > 0) {
          statusText += `- Identified Weaknesses: ${teachingState.playerWeaknesses.join(', ')}\n`;
        }
      } else {
        statusText += `- Training Paused. Last completed chapter: ${Math.max(0, ...teachingState.completedChapters)}.\n`;
      }

      return {
        text: statusText,
        values: {
          // Make individual state elements available
          teachingModeActive: teachingState.teachingModeActive,
          currentChapter: teachingState.currentChapter,
          chapterPhase: teachingState.chapterPhase,
          completedChapters: teachingState.completedChapters,
          playerWeaknesses: teachingState.playerWeaknesses,
        },
        data: { teachingState }, // Pass the raw state object for actions
      };
    } catch (error: any) {
      logger.error(
        `NpcTeachingStateProvider: Error fetching teaching state for player ${playerId}:`,
        error
      );
      return {
        text: 'Context Error: Could not retrieve player training progress.',
        values: { teachingStateError: true },
        data: { teachingState: null },
      };
    }
  },
};
