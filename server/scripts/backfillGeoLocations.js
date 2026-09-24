import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Emergency from '../models/Emergency.js';
import SafetyFacility from '../models/SafetyFacility.js';

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(serverDir, '.env') });

function point(latitude, longitude) {
  if ([latitude, longitude].some((value) => value === null || value === undefined || value === '')) return null;
  if (![latitude, longitude].every((value) => Number.isFinite(Number(value)))) return null;
  return { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  await mongoose.connect(process.env.MONGODB_URI);
  const validCoordinate = { latitude: { $gte: -90, $lte: 90 }, longitude: { $gte: -180, $lte: 180 } };

  const facilities = await SafetyFacility.find({ ...validCoordinate, location: { $exists: false } }).select('_id latitude longitude').lean();
  if (facilities.length) {
    await SafetyFacility.bulkWrite(facilities.map((row) => ({
      updateOne: { filter: { _id: row._id }, update: { $set: { location: point(row.latitude, row.longitude) } } }
    })), { ordered: false });
  }

  const emergencyCoordinateFilter = {
    'location.latitude': { $gte: -90, $lte: 90 },
    'location.longitude': { $gte: -180, $lte: 180 }
  };
  const emergencies = await Emergency.find({ ...emergencyCoordinateFilter, 'location.point': { $exists: false } }).select('_id location').lean();
  if (emergencies.length) {
    await Emergency.bulkWrite(emergencies.map((row) => ({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { 'location.point': point(row.location.latitude, row.location.longitude) } }
      }
    })), { ordered: false });
  }

  await Promise.all([SafetyFacility.createIndexes(), Emergency.createIndexes()]);
  console.log(`GeoJSON backfill complete: ${facilities.length} facilities, ${emergencies.length} emergencies.`);
}

run()
  .catch((error) => { console.error(`GeoJSON backfill failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
