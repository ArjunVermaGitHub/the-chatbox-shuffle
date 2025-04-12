import { type IAgentRuntime, type UUID, logger, stringToUuid } from '@elizaos/core';
import { NpcTeachingStateComponent, type TeachingStateData } from '../componentTypes';
import { v4 as uuidv4 } from 'uuid';
import type { GodotSignal } from '../signals';

export async function ensurePlayerEntity(
  runtime: IAgentRuntime,
  godotPlayerId: string
): Promise<UUID> {
  const playerEntityUUID = stringToUuid(godotPlayerId);
  const logPrefix = `[ensurePlayerEntity GodotID: ${godotPlayerId}, UUID: ${playerEntityUUID}]`;

  try {
    logger.debug(`${logPrefix} Checking for existing entity...`);
    let playerEntity = await runtime.getEntityById(playerEntityUUID);
    if (!playerEntity) {
      logger.info(`${logPrefix} Player entity not found. Creating...`);
      const success = await runtime.createEntity({
        id: playerEntityUUID,
        agentId: runtime.agentId,
        names: [godotPlayerId],
        metadata: { godotId: godotPlayerId, type: 'player' },
      });
      if (!success) {
        logger.warn(
          `${logPrefix} Initial createEntity call returned false. Attempting fetch again...`
        );
        playerEntity = await runtime.getEntityById(playerEntityUUID);
        if (!playerEntity) {
          throw new Error(`Failed to create or find entity.`);
        }
        logger.info(`${logPrefix} Found player entity after initial create failed.`);
      } else {
        logger.info(`${logPrefix} Successfully created player entity.`);
        playerEntity = await runtime.getEntityById(playerEntityUUID);
        if (!playerEntity) {
          logger.error(
            `${logPrefix} Entity creation reported success, but subsequent fetch failed!`
          );
          throw new Error(`Entity creation inconsistent for player ${godotPlayerId}`);
        }
      }
    } else {
      logger.debug(`${logPrefix} Existing player entity found.`);
      let needsUpdate = false;
      const updatedNames = Array.from(new Set([...(playerEntity.names || []), godotPlayerId]));
      if (JSON.stringify(updatedNames.sort()) !== JSON.stringify(playerEntity.names.sort())) {
        needsUpdate = true;
      }
      if (!playerEntity.metadata?.godotId || playerEntity.metadata.godotId !== godotPlayerId) {
        playerEntity.metadata = { ...(playerEntity.metadata || {}), godotId: godotPlayerId };
        needsUpdate = true;
      }
      if (needsUpdate) {
        logger.debug(`${logPrefix} Updating existing entity with current info.`);
        await runtime.updateEntity({
          ...playerEntity,
          names: updatedNames,
        });
      }
    }
    return playerEntityUUID;
  } catch (error) {
    logger.error(`${logPrefix} Error ensuring player entity exists:`, error);
    throw new Error(`Could not ensure entity for player ${godotPlayerId}`);
  }
}

export async function getPlayerTeachingState(
  runtime: IAgentRuntime,
  playerEntityUUID: UUID
): Promise<TeachingStateData | null> {
  const logPrefix = `[getPlayerTeachingState Player: ${playerEntityUUID}]`;
  try {
    const npcAgentId = runtime.agentId;
    logger.debug(
      `${logPrefix} Fetching component for NPC ${npcAgentId}, linked to player ${playerEntityUUID}...`
    );
    const component = await runtime.getComponent(
      npcAgentId,
      NpcTeachingStateComponent.name,
      undefined,
      playerEntityUUID
    );

    if (component) {
      logger.debug(
        `${logPrefix} Found component ${component.id}. SourceEntityId: ${component.sourceEntityId}.`
      );
      if (component.sourceEntityId === playerEntityUUID && component.data) {
        logger.debug(`${logPrefix} Component source matches. Validating data...`);
        const validation = NpcTeachingStateComponent.schema.safeParse(component.data);
        if (!validation.success) {
          logger.warn(`${logPrefix} Invalid data in component ${component.id}:`, validation.error);
          return null;
        }
        logger.debug(`${logPrefix} Data validation successful. Returning state.`);
        return validation.data;
      } else {
        logger.error(
          `${logPrefix} CRITICAL: Fetched component ${component.id} sourceEntityId ${component.sourceEntityId} does not match requested playerEntityUUID ${playerEntityUUID}!`
        );
        return null;
      }
    } else {
      logger.debug(`${logPrefix} No component found.`);
      return null;
    }
  } catch (error) {
    logger.error(`${logPrefix} Error getting teaching state:`, error);
    return null;
  }
}

export async function updatePlayerTeachingState(
  runtime: IAgentRuntime,
  playerEntityUUID: UUID,
  newStateData: Partial<Omit<TeachingStateData, 'playerId'>>
): Promise<TeachingStateData | null> {
  const logPrefix = `[updatePlayerTeachingState Player: ${playerEntityUUID}]`;
  try {
    const npcAgentId = runtime.agentId;
    logger.debug(`${logPrefix} Attempting to update state with:`, newStateData);
    const existingState = await getPlayerTeachingState(runtime, playerEntityUUID);
    logger.debug(`${logPrefix} Existing state found:`, existingState ?? 'null');

    const baseState: TeachingStateData = existingState || {
      playerId: playerEntityUUID,
      currentSyllabus: 'Social Etiquette',
      currentChapter: 1,
      chapterPhase: 'idle',
      chapterAttempts: 0,
      playerWeaknesses: [],
      teachingModeActive: false,
      completedChapters: [],
      lastInteractionTime: 0,
      npcStatus: 'idle',
      lastTestResult: null,
    };

    const finalStateData: TeachingStateData = {
      ...baseState,
      ...newStateData,
      playerId: playerEntityUUID,
      lastInteractionTime: Date.now(),
    };
    logger.debug(`${logPrefix} Merged final state data:`, finalStateData);

    const validation = NpcTeachingStateComponent.schema.safeParse(finalStateData);
    if (!validation.success) {
      logger.error(`${logPrefix} Invalid final state data before saving:`, validation.error);
      return null;
    }
    const validatedData = validation.data;
    logger.debug(`${logPrefix} Validated data passed schema check.`);

    const component = await runtime.getComponent(
      npcAgentId,
      NpcTeachingStateComponent.name,
      undefined,
      playerEntityUUID
    );

    if (component) {
      logger.debug(`${logPrefix} Updating existing component ${component.id}.`);
      await runtime.updateComponent({
        id: component.id,
        entityId: npcAgentId,
        agentId: npcAgentId,
        roomId: component.roomId,
        worldId: component.worldId,
        sourceEntityId: playerEntityUUID,
        type: NpcTeachingStateComponent.name,
        data: validatedData,
      });
      logger.info(
        `${logPrefix} Updated component ${component.id}. Mode: ${validatedData.teachingModeActive}, Phase: ${validatedData.chapterPhase}, Status: ${validatedData.npcStatus}, TestPass: ${validatedData.lastTestResult?.pass ?? 'N/A'}`
      );
    } else {
      logger.debug(`${logPrefix} Creating new component.`);
      const newComponentId = uuidv4() as UUID;
      logger.debug(`${logPrefix} Generated new component ID: ${newComponentId}`);
      await runtime.createComponent({
        id: newComponentId,
        entityId: npcAgentId,
        agentId: npcAgentId,

        roomId: npcAgentId,
        worldId: undefined,
        sourceEntityId: playerEntityUUID,
        type: NpcTeachingStateComponent.name,
        data: validatedData,
      });
      logger.info(
        `${logPrefix} Created new component ${newComponentId}. Mode: ${validatedData.teachingModeActive}, Phase: ${validatedData.chapterPhase}, Status: ${validatedData.npcStatus}, TestPass: ${validatedData.lastTestResult?.pass ?? 'N/A'}`
      );
    }
    return validatedData;
  } catch (error) {
    logger.error(`${logPrefix} Error updating teaching state:`, error);
    return null;
  }
}

export interface ActionHandlerResult {
  npcDialogue: string;
  signals?: GodotSignal[];
}
