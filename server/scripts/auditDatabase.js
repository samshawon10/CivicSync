// Read-only consistency inspection. No indexes, repairs, or deletes are issued.
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { referencePaths } from '../services/referenceSafety.js';

dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const findings = [];
try {
  for (const filename of await fs.readdir(new URL('../models/', import.meta.url))) {
    if (filename.endsWith('.js')) await import(new URL(`../models/${filename}`, import.meta.url));
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || undefined, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  const models = mongoose.modelNames().map((name) => mongoose.model(name));
  const counts = Object.fromEntries(await Promise.all(models.map(async (model) => [model.modelName, await model.countDocuments()])));
  for (const model of models.filter((model) => counts[model.modelName])) {
    for (const target of models) {
      for (const field of referencePaths(model.schema, target.modelName)) {
        const ids = (await model.distinct(field)).filter((id) => id != null);
        if (!ids.length) continue;
        const valid = ids.filter((id) => mongoose.isObjectIdOrHexString(id));
        const existing = new Set((await target.find({ _id: { $in: valid } }).select('_id').lean()).map((row) => String(row._id)));
        const missing = ids.filter((id) => !existing.has(String(id)));
        if (missing.length) findings.push({ model: model.modelName, field, target: target.modelName, missingReferences: missing.length });
      }
    }
  }
  const heads = await mongoose.model('User').countDocuments({ role: 'emergency_department_head', status: 'active' });
  if (heads !== 1) findings.push({ rule: 'exactly_one_active_emergency_head', actual: heads });
  const conflicting = await mongoose.model('User').countDocuments({ activeTask: { $ne: null }, activeEmergencyTeam: { $ne: null } });
  if (conflicting) findings.push({ rule: 'conflicting_civic_and_emergency_reservations', actual: conflicting });
  const staleAvailability = await mongoose.model('User').countDocuments({ availability: 'available', $or: [{ activeTask: { $ne: null } }, { activeEmergencyTeam: { $ne: null } }] });
  if (staleAvailability) findings.push({ rule: 'available_but_reserved', actual: staleAvailability });
  console.log(JSON.stringify({ readOnly: true, counts, findings }, null, 2));
  process.exitCode = findings.length ? 2 : 0;
} catch (error) {
  console.error(`Database audit failed: ${error.name}`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
