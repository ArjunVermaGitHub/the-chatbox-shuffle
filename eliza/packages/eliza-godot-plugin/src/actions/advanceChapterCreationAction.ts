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
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const teachingState = await getPlayerTeachingState(runtime, message.entityId);
    const lastEvalResult = state?.data?.lastTestEvaluation;
    return (
      !!teachingState &&
      teachingState.teachingModeActive &&
      teachingState.chapterPhase === 'evaluating_test' &&
      lastEvalResult?.pass === true
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
      logger.error(`ADVANCE_CHAPTER: No teaching state found for player ${playerId}`);
      return { npcDialogue: '(Error: Cannot find your training progress.)', signals: [] };
    }

    const currentChapter = teachingState.currentChapter;

    if (teachingState.completedChapters.includes(currentChapter)) {
      logger.warn(
        `ADVANCE_CHAPTER: Chapter ${currentChapter} already completed for player ${playerId}. Skipping advancement.`
      );
      const nextChapter = currentChapter + 1;
      if (nextChapter <= TOTAL_CHAPTERS) {
        await updatePlayerTeachingState(runtime, playerId, {
          currentChapter: nextChapter,
          chapterPhase: 'idle',
          chapterAttempts: 0,
          playerWeaknesses: [],
        });
        return {
          npcDialogue: `You've already mastered Chapter ${currentChapter}. Shall we begin Chapter ${nextChapter}?`,
          signals: [],
        };
      } else {
        await updatePlayerTeachingState(runtime, playerId, { chapterPhase: 'idle' });
        return {
          npcDialogue: `You've already completed the entire Social Etiquette syllabus! Excellent work.`,
          signals: [],
        };
      }
    }

    logger.info(
      `ADVANCE_CHAPTER: Advancing Chapter for Player ${playerId} after passing Chapter ${currentChapter}`
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
    };

    const updateSuccess = await updatePlayerTeachingState(runtime, playerId, newStateUpdate);
    if (!updateSuccess) {
      return { npcDialogue: '(Error: Could not save chapter advancement.)', signals: [] };
    }

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
    } else {
      dialogue = `Excellent! You've passed Chapter ${currentChapter}. Shall we move on to Chapter ${nextChapter}?`;
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
        content: { text: '[Positive feedback after test]', actions: ['SET_NPC_DIALOGUE'] },
      },
      {
        name: 'NPC_Trainer',
        content: {
          thought: 'Player passed. Advance chapter.',
          text: '(Action: ADVANCE_CHAPTER)',
          actions: ['ADVANCE_CHAPTER'],
        },
      },
    ],
  ],
};
