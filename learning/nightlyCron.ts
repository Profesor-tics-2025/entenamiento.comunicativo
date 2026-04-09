import 'dotenv/config';
import cron from 'node-cron';
import { updateThresholds } from './updateThresholds.js';
import { detectNewFillers } from './detectNewFillers.js';
import { generateExercises } from './generateExercises.js';
import { updateUserMemory } from './updateUserMemory.js';
import pool from '../server/db.js';

async function runNightlyJob() {
  console.log('[nightly] Starting learning job at', new Date().toISOString());

  const stats = {
    thresholdsUpdated: 0,
    fillersDetected: 0,
    exercisesCreated: 0,
    memoriesUpdated: 0,
    notes: '',
  };

  try {
    stats.thresholdsUpdated = await updateThresholds();
    stats.fillersDetected = await detectNewFillers();
    stats.exercisesCreated = await generateExercises();
    stats.memoriesUpdated = await updateUserMemory();
  } catch (err) {
    stats.notes = String(err);
    console.error('[nightly] Error during learning job:', err);
  }

  await pool.query(
    'INSERT INTO learning_log (thresholds_updated, fillers_detected, exercises_created, memories_updated, notes) VALUES (?, ?, ?, ?, ?)',
    [stats.thresholdsUpdated, stats.fillersDetected, stats.exercisesCreated, stats.memoriesUpdated, stats.notes]
  );

  console.log('[nightly] Done.', stats);
}

// Schedule: every night at 03:00
cron.schedule('0 3 * * *', runNightlyJob, { timezone: 'Europe/Madrid' });

console.log('[nightly] Learning cron scheduled for 03:00 daily');
