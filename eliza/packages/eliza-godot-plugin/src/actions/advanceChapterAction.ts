import { type Action, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import {
  getPlayerTeachingState,
  updatePlayerTeachingState,
  type ActionHandlerResult,
} from './common';
import { type TeachingStateData } from '../componentTypes';
import {
  type GodotSignal,
  type ChapterCompleteSignal,
  type SyllabusCompleteSignal,
} from '../signals';

const TOTAL_CHAPTERS = 3;

export const advanceChapterAction: Action = {
  name: 'ADVANCE_CHAPTER',
  description:
    'Advances the player to the next chapter after passing a test or marks syllabus complete.',
  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const isValid =
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'evaluating_test' &&
      teachingState.lastTestResult?.pass === true; // <-- CHECK COMPONENT STATE
    logger.debug(
      `[Action ADVANCE_CHAPTER Validate] Player: ${message.entityId}, State:`,
      teachingState ?? 'null',
      `, Validation Result: ${isValid}`
    );
    return isValid;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options?: any
  ): Promise<ActionHandlerResult> => {
    const playerId = message.entityId;
    const logPrefix = `[Action ADVANCE_CHAPTER Handler]`;
    const teachingState = await getPlayerTeachingState(runtime, playerId);

    if (!teachingState) {
      logger.error(`${logPrefix} No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    if (
      teachingState.chapterPhase !== 'evaluating_test' ||
      teachingState.lastTestResult?.pass !== true
    ) {
      logger.error(
        `${logPrefix} Invalid state to advance chapter for player ${playerId}. Phase: ${teachingState.chapterPhase}, Pass: ${teachingState.lastTestResult?.pass}. Aborting.`
      );
      return {
        npcDialogue: '(Hold on, something seems out of sync with your test results.)',
        signals: [],
      };
    }

    const currentChapter = teachingState.currentChapter;

    if (teachingState.completedChapters.includes(currentChapter)) {
      logger.warn(
        `${logPrefix} Chapter ${currentChapter} already marked completed for player ${playerId}. Logic error likely occurred. Attempting recovery.`
      );
      const nextChapter = currentChapter + 1;
      if (nextChapter <= TOTAL_CHAPTERS) {
        await updatePlayerTeachingState(runtime, playerId, {
          currentChapter: nextChapter,
          chapterPhase: 'idle',
          chapterAttempts: 0,
          playerWeaknesses: [],
          lastTestResult: null,
        });
        return {
          npcDialogue: `It seems you've already mastered Chapter ${currentChapter}. Shall we begin Chapter ${nextChapter}?`,
          signals: [],
        };
      } else {
        await updatePlayerTeachingState(runtime, playerId, {
          chapterPhase: 'idle',
          lastTestResult: null,
        });
        return {
          npcDialogue: `You've already completed the entire Social Etiquette syllabus! Excellent work.`,
          signals: [],
        };
      }
    }

    logger.info(
      `${logPrefix} Advancing Chapter for Player ${playerId} after passing Chapter ${currentChapter}`
    );

    const newCompletedChapters = [...teachingState.completedChapters, currentChapter];
    const nextChapter = currentChapter + 1;
    const isSyllabusComplete = nextChapter > TOTAL_CHAPTERS;

    const newStateUpdate: Partial<TeachingStateData> = {
      completedChapters: newCompletedChapters,
      currentChapter: isSyllabusComplete ? currentChapter : nextChapter,
      chapterPhase: 'idle',
      chapterAttempts: 0,
      playerWeaknesses: [],
      lastTestResult: null,
    };

    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, newStateUpdate);
    if (!updateSuccess) {
      logger.error(`${logPrefix} Failed to save chapter advancement for player ${playerId}.`);
      return { npcDialogue: '(Error: Could not save chapter advancement.)', signals: [] };
    }
    logger.info(
      `${logPrefix} State updated for Player ${playerId}. Completed: ${newCompletedChapters.join(',')}, Next Chapter: ${newStateUpdate.currentChapter}, Phase: idle.`
    );

    const signals: GodotSignal[] = [
      {
        type: 'CHAPTER_COMPLETE',
        playerId: playerId,
        chapter: currentChapter,
      } satisfies ChapterCompleteSignal,
    ];
    let dialogue: string;

    if (isSyllabusComplete) {
      dialogue = `Fantastic work! You've successfully completed Chapter ${currentChapter} and the entire Social Etiquette syllabus! You've shown great improvement.`;
      signals.push({
        type: 'SYLLABUS_COMPLETE',
        playerId: playerId,
        syllabusName: teachingState.currentSyllabus,
      } satisfies SyllabusCompleteSignal);
      logger.info(`${logPrefix} Syllabus complete for Player ${playerId}.`);
    } else {
      dialogue = `Excellent! You've passed Chapter ${currentChapter}. Shall we move on to Chapter ${nextChapter}?`;
      logger.info(
        `${logPrefix} Player ${playerId} advanced to Chapter ${nextChapter}. Ready for idle phase.`
      );
    }

    return {
      npcDialogue: dialogue,
      signals: signals,
    };
  },
  examples: [
    [
      {
        name: 'NPC_Trainer',
        content: {
          text: '[Positive feedback after passed test]',
          actions: ['SET_NPC_DIALOGUE'],
        },
      },
      {
        name: 'NPC_Trainer',
        content: {
          thought:
            'Player passed the test (state phase=evaluating_test, result=pass). Advance to the next chapter or mark syllabus complete.',
          text: '(Action: ADVANCE_CHAPTER)',
          actions: ['ADVANCE_CHAPTER'],
        },
      },
    ],
  ],
};
