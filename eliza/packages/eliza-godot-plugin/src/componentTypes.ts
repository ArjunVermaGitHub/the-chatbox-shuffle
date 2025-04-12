//eliza/packages/eliza-godot-plugin/src/componentTypes.ts
import { z } from 'zod';
import { type UUID } from '@elizaos/core';

export const teachingStateDataSchema = z.object({
  playerId: z.custom<UUID>(), // Stores the Player's *Entity UUID*
  currentSyllabus: z.string().default('Social Etiquette'),
  currentChapter: z.number().int().positive().default(1),
  chapterPhase: z
    .enum(['idle', 'teaching', 'clarifying', 'testing', 'evaluating_test'])
    .default('idle'),
  chapterAttempts: z.number().int().nonnegative().default(0),
  playerWeaknesses: z.array(z.string()).default([]),
  teachingModeActive: z.boolean().default(false),
  completedChapters: z.array(z.number().int().positive()).default([]),
  lastInteractionTime: z.number().int().nonnegative().default(0),
  npcStatus: z
    .enum(['idle', 'talking', 'busy'])
    .default('idle')
    .describe(
      "Tracks if NPC is available ('idle'), currently processing dialogue ('talking'), or busy with another task ('busy')."
    ),
  lastTestResult: z
    .object({
      pass: z.boolean(),
      timestamp: z.number().int(),
    })
    .nullable()
    .default(null)
    .describe('Result of the last test evaluation for this player.'),
  offerPending: z
    .boolean()
    .default(false)
    .describe(
      'Indicates if the NPC has just offered training and is awaiting player confirmation.'
    ),
});

export type TeachingStateData = z.infer<typeof teachingStateDataSchema>;

export const NpcTeachingStateComponent = {
  name: 'npcTeachingState',
  schema: teachingStateDataSchema,
};
