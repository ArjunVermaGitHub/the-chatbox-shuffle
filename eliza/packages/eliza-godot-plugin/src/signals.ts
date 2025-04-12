import { type UUID } from '@elizaos/core';

export interface GodotSignalBase {
  type: string;
  playerId: UUID;
}

export interface ChapterCompleteSignal extends GodotSignalBase {
  type: 'CHAPTER_COMPLETE';
  chapter: number;
}

export interface SyllabusCompleteSignal extends GodotSignalBase {
  type: 'SYLLABUS_COMPLETE';
  syllabusName: string;
}

export interface PlayAnimationSignal extends GodotSignalBase {
  type: 'PLAY_ANIMATION';
  animationName: string;
}

export interface SetNpcGameStateSignal extends GodotSignalBase {
  type: 'SET_NPC_GAME_STATE';
  gameState: string;
}

export type GodotSignal =
  | ChapterCompleteSignal
  | SyllabusCompleteSignal
  | PlayAnimationSignal
  | SetNpcGameStateSignal;
