import { scheduledDifficulty } from '../../utils/dailySchedule.js';

// Daily spice level (see LEVELS in puzzle.js): Mild and Medium have 1 pepper
// per row, column and patch, Picante 2.
export const dailyLevel = date => scheduledDifficulty('pepper-placer', date);
