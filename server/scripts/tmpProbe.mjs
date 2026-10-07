import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const db = mongoose.connection.db;
const show = (name, rows) => console.log(`\n== ${name} ==\n${JSON.stringify(rows, null, 1)}`);

show('USERS', await db.collection('users').find({}).project({ name: 1, email: 1, role: 1, status: 1, departmentName: 1, department: 1, availability: 1, activeTask: 1, activeEmergencyTeam: 1, firebaseUid: 1 }).toArray());
show('TEAMS', await db.collection('departmentteams').find({}).project({ name: 1, departmentName: 1, leader: 1, members: 1, status: 1, active: 1, type: 1 }).toArray());
show('TASKS', await db.collection('departmenttasks').find({}).project({ taskNumber: 1, title: 1, departmentName: 1, status: 1, assignedOfficer: 1, assignedWorker: 1, workerIds: 1, team: 1, report: 1 }).toArray());
show('EMERGENCY TEAMS', await db.collection('emergencyresponseteams').find({}).project({ teamCode: 1, title: 1, kind: 1, officer: 1, emergency: 1, status: 1 }).toArray());
show('EMERGENCY SAMPLE', await db.collection('emergencies').find({}).sort({ createdAt: -1 }).limit(2).toArray());
show('SYSTEM SETTINGS', await db.collection('systemsettings').find({}).toArray());
show('COUNTS', { notifications: await db.collection('notifications').countDocuments(), activitylogs: await db.collection('activitylogs').countDocuments(), departmenttasks: await db.collection('departmenttasks').countDocuments() });
process.exit(0);
