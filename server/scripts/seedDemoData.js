/**
 * CivicSync demo seed (development / demonstration data only).
 *
 * Creates:
 *   - two demo departments (Road & Transport, Water & Sanitation)
 *   - the Head / Department Officer / Team Leader / Worker accounts for both
 *   - the emergency command chain accounts (Head, dispatch officer, officer, field workers)
 *   - one response team per civic department, with the team leader and both workers
 *   - three citizen reports linked to one master civic case and one team task
 *   - one pre-seeded emergency     : DEMO-EMERGENCY-001 (Medical, CRITICAL)
 *
 * Every account signs in through the existing Firebase authentication with the
 * password `123456` (override with --password=… or DEMO_PASSWORD).
 *
 * The script is idempotent: each record is looked up by its natural key first;
 * existing demo road accounts and their team are kept aligned with the live
 * Roads & Infrastructure category department.
 *
 *   npm run seed:demo
 *   npm run seed:demo -- --keep-existing-emergency-head
 *   npm run seed:demo -- --skip-firebase
 *
 * Environment: MONGODB_URI plus the Firebase Admin credentials already used by
 * the API (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { getFirebaseAdminAuth } from '../config/firebaseAdmin.js';
import { HEAD_ROLE, WORKFLOW } from '../config/emergencyOps.js';
import Department from '../models/Department.js';
import DepartmentTeam from '../models/DepartmentTeam.js';
import Emergency from '../models/Emergency.js';
import Report from '../models/Report.js';
import DepartmentTask from '../models/DepartmentTask.js';
import ReportCategory from '../models/ReportCategory.js';
import User from '../models/User.js';
import { OPEN_TASK_STATES } from '../services/taskWorkflow.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDir, '..', '.env') });

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const valueOf = (name, fallback) => {
  const match = argv.find((entry) => entry.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const PASSWORD = valueOf('password', process.env.DEMO_PASSWORD || '123456');
const SKIP_FIREBASE = hasFlag('skip-firebase');
const KEEP_EXISTING_EMERGENCY_HEAD = hasFlag('keep-existing-emergency-head');

const ROAD = {
  name: 'Roads & Infrastructure',
  code: 'ROADS_INFRASTRUCTURE',
  type: 'Roads & Transport',
  icon: 'wrench',
  color: '#2563eb',
  email: 'road.department@civicsync.demo',
  description: 'Demo department responsible for road repair, footpaths, street furniture and transport casework.'
};
const WATER = {
  name: 'Water & Sanitation Department',
  code: 'DEMO_WATER_SANITATION',
  type: 'Water & Sanitation',
  icon: 'droplets',
  color: '#0891b2',
  email: 'water.department@civicsync.demo',
  description: 'Demo department responsible for water supply, drainage and sanitation casework.'
};

/** Demo accounts. `role` values are the existing CivicSync role keys. */
const ACCOUNTS = [
  { key: 'citizen', name: 'Demo Citizen', email: 'citizen@civicsync.demo', role: 'citizen', department: null },
  { key: 'citizenTwo', name: 'Demo Citizen Two', email: 'citizen.two@civicsync.demo', role: 'citizen', department: null },
  { key: 'citizenThree', name: 'Demo Citizen Three', email: 'citizen.three@civicsync.demo', role: 'citizen', department: null },
  { key: 'roadHead', name: 'Road Department Head', email: 'road.head@civicsync.demo', role: 'department_head', department: 'road' },
  { key: 'roadOfficer', name: 'Road Department Officer', email: 'road.officer@civicsync.demo', role: 'department_officer', department: 'road' },
  { key: 'roadLeader', name: 'Road Team Leader', email: 'road.leader@civicsync.demo', role: 'officer', department: 'road' },
  { key: 'roadWorker1', name: 'Road Worker One', email: 'road.worker1@civicsync.demo', role: 'field_worker', department: 'road' },
  { key: 'roadWorker2', name: 'Road Worker Two', email: 'road.worker2@civicsync.demo', role: 'field_worker', department: 'road' },
  { key: 'waterHead', name: 'Water Department Head', email: 'water.head@civicsync.demo', role: 'department_head', department: 'water' },
  { key: 'waterOfficer', name: 'Water Department Officer', email: 'water.officer@civicsync.demo', role: 'department_officer', department: 'water' },
  { key: 'waterLeader', name: 'Water Team Leader', email: 'water.leader@civicsync.demo', role: 'officer', department: 'water' },
  { key: 'waterWorker1', name: 'Water Worker One', email: 'water.worker1@civicsync.demo', role: 'field_worker', department: 'water' },
  { key: 'waterWorker2', name: 'Water Worker Two', email: 'water.worker2@civicsync.demo', role: 'field_worker', department: 'water' },
  { key: 'emergencyHead', name: 'Emergency Head', email: 'emergency.head@civicsync.demo', role: HEAD_ROLE, department: null },
  { key: 'emergencyDispatch', name: 'Emergency Dispatch Officer', email: 'emergency.dispatch@civicsync.demo', role: 'emergency_department_officer', department: null },
  { key: 'emergencyOfficer', name: 'Emergency Officer', email: 'emergency.officer@civicsync.demo', role: 'emergency_officer', department: null },
  { key: 'emergencyWorker1', name: 'Emergency Field Worker One', email: 'emergency.worker1@civicsync.demo', role: 'emergency_field_worker', department: null },
  { key: 'emergencyWorker2', name: 'Emergency Field Worker Two', email: 'emergency.worker2@civicsync.demo', role: 'emergency_field_worker', department: null }
];

const TEAMS = [
  { key: 'roadTeam', name: 'Road Response Team', department: 'road', leader: 'roadLeader', members: ['roadWorker1', 'roadWorker2'], skills: ['road repair', 'pavement', 'signage'] },
  { key: 'waterTeam', name: 'Water Response Team', department: 'water', leader: 'waterLeader', members: ['waterWorker1', 'waterWorker2'], skills: ['pipeline repair', 'drainage', 'sanitation'] }
];

const created = [];
const reused = [];
const warnings = [];
const say = (message) => console.log(message);
const createdLine = (label, value) => { created.push(label); say(`  + ${label}${value ? ` — ${value}` : ''}`); };
const reusedLine = (label) => { reused.push(label); say(`  = ${label} (already present)`); };
const warn = (message) => { warnings.push(message); say(`  ! ${message}`); };

/** Firebase account used for password login; created once, password kept at the demo value. */
async function ensureFirebaseUser(account) {
  if (SKIP_FIREBASE) return { uid: undefined, skipped: true };
  const auth = getFirebaseAdminAuth();
  const existing = await auth.getUserByEmail(account.email).catch((error) => {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  });
  if (existing) {
    await auth.updateUser(existing.uid, { password: PASSWORD, displayName: account.name, emailVerified: true });
    return { uid: existing.uid, created: false };
  }
  const user = await auth.createUser({ email: account.email, password: PASSWORD, displayName: account.name, emailVerified: true });
  return { uid: user.uid, created: true };
}

async function ensureDepartment(definition) {
  const existing = await Department.findOne({ name: definition.name });
  if (existing) {
    reusedLine(`Department "${definition.name}"`);
    return existing;
  }
  const department = await Department.create({
    name: definition.name,
    code: definition.code,
    type: definition.type,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    email: definition.email,
    status: 'active',
    scope: 'civic',
    assignedRoles: ['department_head', 'department_officer', 'officer', 'field_worker']
  });
  createdLine(`Department "${department.name}"`, department.code);
  return department;
}

async function ensureCategory({ key, label, departmentName, description, order }) {
  const existing = await ReportCategory.findOne({ key });
  if (existing) {
    reusedLine(`Report category "${key}"`);
    return existing;
  }
  await ReportCategory.create({ key, label, description, defaultDepartment: departmentName, order, active: true });
  createdLine(`Report category "${key}"`, `→ ${departmentName}`);
  return ReportCategory.findOne({ key });
}

/** Demo account: Mongo record + Firebase identity. */
async function ensureAccount(account, departments, firebaseState) {
  const department = account.department ? departments[account.department] : null;
  const existing = await User.findOne({ email: account.email });
  if (existing) {
    reusedLine(`User ${account.email}`);
    let changed = false;
    if (department && (String(existing.department) !== String(department._id) || existing.departmentName !== department.name)) {
      existing.department = department._id;
      existing.departmentName = department.name;
      changed = true;
    }
    if (!existing.firebaseUid && firebaseState[account.key]?.uid) {
      existing.firebaseUid = firebaseState[account.key].uid;
      changed = true;
    }
    if (changed) {
      await existing.save();
    }
    return existing;
  }
  const user = await User.create({
    name: account.name,
    email: account.email,
    role: account.role,
    department: department?._id || null,
    departmentName: department?.name || '',
    firebaseUid: firebaseState[account.key]?.uid,
    status: 'active',
    emailVerified: true
  });
  createdLine(`User ${account.email}`, `${account.role}${department ? ` · ${department.name}` : ''}`);
  return user;
}

async function ensureTeam(definition, departments, users) {
  const department = departments[definition.department];
  const existing = await DepartmentTeam.findOne({ departmentName: department.name, name: definition.name });
  if (existing) {
    reusedLine(`Team "${definition.name}"`);
    existing.department = department._id;
    existing.departmentName = department.name;
    existing.leader = users[definition.leader]._id;
    existing.members = definition.members.map((key) => users[key]._id);
    await existing.save();
    return existing;
  }
  const team = await DepartmentTeam.create({
    name: definition.name,
    type: 'normal',
    department: department._id,
    departmentName: department.name,
    category: 'general',
    leader: users[definition.leader]._id,
    members: definition.members.map((key) => users[key]._id),
    skills: definition.skills,
    serviceArea: 'Demo Residential Area',
    capacity: 6,
    status: 'available',
    phone: '',
    notes: `Demo response team for ${department.name}.`,
    active: true
  });
  createdLine(`Team "${team.name}"`, `${definition.members.length + 1} member(s)`);
  return team;
}

// === STEPS ===

const DEMO_REPORT_REFERENCE = 'DEMO-ROAD-001';
const DEMO_DUPLICATE_REFERENCES = ['DEMO-ROAD-002', 'DEMO-ROAD-003'];
const DEMO_TASK_NUMBER = 'TASK-DEMO-ROAD-001';
const DEMO_EMERGENCY_ID = 'DEMO-EMERGENCY-001';
const DEMO_COORDINATES = { latitude: 23.8103, longitude: 90.4125 };

/** Pre-seeded normal civic report: submitted, waiting for the Road Department. */
async function ensureDemoReport({ citizen, citizenTwo, citizenThree, department }) {
  const existing = await Report.findOne({ reference: DEMO_REPORT_REFERENCE });
  if (existing) {
    if (!existing.masterCaseId || String(existing.masterCaseId) !== String(existing._id)) {
      existing.masterCaseId = existing._id;
      existing.isMasterReport = true;
      existing.duplicateOf = null;
      existing.relationType = 'MASTER';
      await existing.save();
    }
    reusedLine(`Report ${DEMO_REPORT_REFERENCE}`);
  } else {
    const masterId = new mongoose.Types.ObjectId();
    const master = await Report.create({
      _id: masterId,
      reference: DEMO_REPORT_REFERENCE,
      title: 'Damaged Road Near Residential Area',
      description: 'A major section of the road is damaged and needs repair. The damaged area is causing difficulty for pedestrians and vehicles.',
      category: 'road_damage',
      departmentName: department.name,
      priority: 'high',
      masterCaseId: masterId,
      isMasterReport: true,
      duplicateOf: null,
      relationType: 'MASTER',
      status: 'pending',
      workflowStage: 'SUBMITTED',
      workflowHistory: [{
        stage: 'SUBMITTED',
        previousStage: '',
        actor: citizen._id,
        actorRole: 'citizen',
        note: 'Citizen submitted this report for department review.'
      }],
      activity: [{
        action: 'Submitted',
        actorRole: 'citizen',
        note: 'Demo report created by the CivicSync demo seed.'
      }],
      location: {
        area: 'Demo Residential Area',
        address: 'Demo Residential Area, CivicSync Demo Zone',
        landmark: 'Demo Community Centre',
        latitude: DEMO_COORDINATES.latitude,
        longitude: DEMO_COORDINATES.longitude
      },
      additionalInfo: 'Demo case used to walk the full CivicSync workflow from submission to resolution.',
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdBy: citizen._id
    });
    createdLine(`Report ${DEMO_REPORT_REFERENCE}`, master.title);
  }
  const master = await Report.findOne({ reference: DEMO_REPORT_REFERENCE });
  const duplicateDefinitions = [
    {
      reference: DEMO_DUPLICATE_REFERENCES[0],
      citizen: citizenTwo,
      title: 'Road surface damaged near the community centre',
      description: 'The damaged road surface near the community centre is difficult for pedestrians and vehicles.'
    },
    {
      reference: DEMO_DUPLICATE_REFERENCES[1],
      citizen: citizenThree,
      title: 'Large road pothole in the residential area',
      description: 'A large pothole is causing difficulty for vehicles and people walking nearby.'
    }
  ];
  for (const [index, definition] of duplicateDefinitions.entries()) {
    const duplicate = await Report.findOne({ reference: definition.reference });
    if (duplicate) {
      reusedLine(`Report ${definition.reference}`);
      continue;
    }
    await Report.create({
      reference: definition.reference,
      title: definition.title,
      description: definition.description,
      category: master.category,
      departmentName: department.name,
      priority: 'medium',
      status: 'pending',
      workflowStage: 'SUBMITTED',
      masterCaseId: master._id,
      isMasterReport: false,
      duplicateOf: master._id,
      relationType: 'DUPLICATE',
      location: {
        area: 'Demo Residential Area',
        address: 'Demo Residential Area, CivicSync Demo Zone',
        landmark: 'Demo Community Centre',
        latitude: DEMO_COORDINATES.latitude + (index + 1) * 0.0001,
        longitude: DEMO_COORDINATES.longitude
      },
      activity: [{ action: 'Citizen report linked to the demo master civic issue', actorRole: 'citizen' }],
      createdBy: definition.citizen._id
    });
    createdLine(`Report ${definition.reference}`, `linked to ${DEMO_REPORT_REFERENCE}`);
  }
  return master;
}

async function ensureDemoFieldTask({ report, department, departmentHead, departmentOfficer, teamLeader, team }) {
  const existingTask = await DepartmentTask.findOne({ report: report._id }).sort({ createdAt: 1 });
  if (existingTask) {
    if (OPEN_TASK_STATES.includes(existingTask.status) && !report.activeTask) {
      report.activeTask = existingTask._id;
      await report.save();
    }
    reusedLine(`Field task ${existingTask.taskNumber}`);
    return existingTask;
  }
  if (report.workflowStage !== 'SUBMITTED') {
    warn(`The demo master report is already at ${report.workflowStage}; no starter task was added.`);
    return null;
  }
  const workers = await User.find({
    _id: { $in: team.members },
    role: 'field_worker',
    departmentName: department.name,
    status: 'active',
    availability: 'available',
    activeTask: null
  }).select('_id');
  if (workers.length < 2) {
    warn('The demo response team does not have two available workers; its starter field task was not created.');
    return null;
  }

  const taskId = new mongoose.Types.ObjectId();
  const task = await DepartmentTask.create({
    _id: taskId,
    report: report._id,
    taskNumber: DEMO_TASK_NUMBER,
    title: 'Repair damaged road near the demo residential area',
    description: 'Inspect and repair the reported road damage near the Demo Community Centre.',
    departmentName: department.name,
    assignedOfficer: teamLeader._id,
    team: team._id,
    teamLeader: teamLeader._id,
    assignedWorker: workers[0]._id,
    workerIds: workers.map((worker) => worker._id),
    workerAssignments: workers.map((worker) => ({ worker: worker._id, status: 'assigned' })),
    assignedBy: teamLeader._id,
    status: 'team_formed',
    priority: 'high',
    progressPercent: 0,
    targetDueAt: report.dueAt,
    instructions: 'Inspect the damaged section and record field observations before beginning repairs.',
    location: {
      address: report.location.address,
      latitude: report.location.latitude,
      longitude: report.location.longitude
    },
    timeline: [
      { status: 'pending', actor: teamLeader._id, actorRole: 'officer', note: 'Created from the demo master civic case.' },
      { status: 'team_formed', actor: teamLeader._id, actorRole: 'officer', note: `Demo response team "${team.name}" assigned.` }
    ]
  });

  const booking = await User.updateMany(
    { _id: { $in: workers.map((worker) => worker._id) }, availability: 'available', activeTask: null },
    { $set: { availability: 'busy', activeTask: task._id, availabilityChangedAt: new Date() } }
  );
  if (booking.modifiedCount !== workers.length) {
    await User.updateMany({ activeTask: task._id }, { $set: { availability: 'available', activeTask: null } });
    await task.deleteOne();
    warn('A demo worker became unavailable while assigning the starter field task; task creation was rolled back.');
    return null;
  }

  const now = new Date();
  report.status = 'assigned';
  report.workflowStage = 'TEAM_FORMED';
  report.assignedDepartmentOfficer = departmentOfficer._id;
  report.assignedOfficer = teamLeader._id;
  report.assignedTeam = team._id;
  report.teamLeader = teamLeader._id;
  report.activeTask = task._id;
  report.workflowHistory.push(
    { stage: 'DEPARTMENT_HEAD_REVIEW', previousStage: 'SUBMITTED', actor: departmentHead._id, actorRole: 'department_head', at: now, note: 'Demo department review.' },
    { stage: 'ASSIGNED_TO_DEPARTMENT_OFFICER', previousStage: 'DEPARTMENT_HEAD_REVIEW', actor: departmentHead._id, actorRole: 'department_head', at: now, note: 'Demo Department Officer assigned.' },
    { stage: 'DEPARTMENT_OFFICER_REVIEW', previousStage: 'ASSIGNED_TO_DEPARTMENT_OFFICER', actor: departmentOfficer._id, actorRole: 'department_officer', at: now, note: 'Demo case accepted for operational planning.' },
    { stage: 'ASSIGNED_TO_OFFICER', previousStage: 'DEPARTMENT_OFFICER_REVIEW', actor: teamLeader._id, actorRole: 'department_officer', at: now, note: 'Demo Team Leader assigned.' },
    { stage: 'TEAM_FORMED', previousStage: 'ASSIGNED_TO_OFFICER', actor: teamLeader._id, actorRole: 'officer', at: now, note: `Demo team "${team.name}" assigned.` }
  );
  report.activity.push({ action: 'Demo response team assigned', actorRole: 'officer', note: `${team.name} · ${workers.length} Field Workers.` });
  await report.save();
  team.status = 'busy';
  await team.save();
  createdLine(`Field task ${task.taskNumber}`, `${workers.length} workers · ${team.name}`);
  return task;
}

/** Pre-seeded emergency: reported by the demo citizen, waiting for Emergency command. */
async function ensureDemoEmergency({ citizen }) {
  const existing = await Emergency.findOne({ emergencyId: DEMO_EMERGENCY_ID });
  if (existing) {
    reusedLine(`Emergency ${DEMO_EMERGENCY_ID}`);
    return existing;
  }
  const emergency = await Emergency.create({
    citizen: citizen._id,
    citizenName: citizen.name,
    citizenEmail: citizen.email,
    citizenPhone: citizen.phone || '',
    emergencyId: DEMO_EMERGENCY_ID,
    type: 'medical',
    category: 'medical',
    subcategory: 'medical_emergency',
    title: 'Medical Emergency — Immediate Assistance Required',
    description: 'A citizen has requested urgent medical assistance and an emergency response team is required.',
    location: {
      address: 'Demo Residential Area',
      landmark: 'Demo Community Centre',
      latitude: DEMO_COORDINATES.latitude,
      longitude: DEMO_COORDINATES.longitude,
      capturedAt: new Date(),
      point: { type: 'Point', coordinates: [DEMO_COORDINATES.longitude, DEMO_COORDINATES.latitude] }
    },
    status: 'received',
    priority: 'critical',
    severity: 'critical',
    source: 'report',
    visibility: 'standard',
    activity: [{ action: 'Emergency reported', actorRole: 'citizen', note: 'Demo emergency created by the CivicSync demo seed.' }],
    ops: {
      workflowStatus: WORKFLOW.SUBMITTED,
      priority: 'CRITICAL',
      emergencyType: 'MEDICAL',
      priorityHistory: [],
      progress: [],
      blockers: [],
      instructions: [],
      completionPercent: 0,
      reviewed: false,
      responseTypes: []
    }
  });
  createdLine(`Emergency ${DEMO_EMERGENCY_ID}`, emergency.title);
  return emergency;
}

/**
 * The API enforces a single active Emergency Head, and only the Emergency
 * Department Officer may dispatch an Emergency Officer. Seeding the demo seat
 * therefore follows the same rule the admin dashboard uses when a new head is
 * appointed: the outgoing head is released back to a citizen account.
 */
async function ensureEmergencyHeadSeat() {
  const demoHead = ACCOUNTS.find((account) => account.role === HEAD_ROLE);
  const currentHead = await User.findOne({ role: HEAD_ROLE, status: 'active' });
  if (!currentHead || currentHead.email === demoHead.email) return true;
  if (KEEP_EXISTING_EMERGENCY_HEAD) {
    warn(`An active Emergency Head already exists (${currentHead.email}), so ${demoHead.email} was NOT created. Sign in as the existing head, or re-run without --keep-existing-emergency-head to transfer the seat.`);
    return false;
  }
  currentHead.role = 'citizen';
  currentHead.department = null;
  currentHead.departmentName = '';
  await currentHead.save();
  warn(`Emergency Head seat transferred from ${currentHead.email} (released to a citizen account, the same transfer the admin "assign head" flow performs).`);
  return true;
}

async function linkDepartmentHead(department, head) {
  if (!department || !head) return;
  if (department.head && String(department.head) === String(head._id)) return;
  if (department.head) {
    warn(`"${department.name}" already has a department head assigned; the demo head ${head.email} keeps the role but not the department slot.`);
    return;
  }
  department.head = head._id;
  await department.save();
  createdLine(`Department head slot for "${department.name}"`, head.email);
}

async function seed() {
  say('\nCivicSync demo seed');
  say('===================');
  say(`MongoDB: ${mongoose.connection.name}`);
  say(`Demo password: ${PASSWORD}${SKIP_FIREBASE ? ' (Firebase accounts skipped)' : ''}`);

  say('\n[1/7] Departments');
  const departments = { road: await ensureDepartment(ROAD), water: await ensureDepartment(WATER) };

  say('\n[2/7] Report categories');
  await ensureCategory({ key: 'road_damage', label: 'Road Damage', departmentName: departments.road.name, description: 'Damaged carriageways, potholes and road surface defects.', order: 11 });
  await ensureCategory({ key: 'water_sanitation', label: 'Water & Sanitation', departmentName: departments.water.name, description: 'Water supply, drainage and sanitation issues.', order: 41 });

  say('\n[3/7] Accounts');
  const headSeat = await ensureEmergencyHeadSeat();
  const accounts = ACCOUNTS.filter((account) => account.role !== HEAD_ROLE || headSeat);
  const firebaseState = {};
  for (const account of accounts) {
    if (SKIP_FIREBASE) { firebaseState[account.key] = { uid: undefined, skipped: true }; continue; }
    try {
      firebaseState[account.key] = await ensureFirebaseUser(account);
    } catch (error) {
      firebaseState[account.key] = { uid: undefined, failed: true };
      warn(`Firebase account for ${account.email} could not be prepared (${error?.code || error?.message}); the Mongo record is still created.`);
    }
  }
  const users = {};
  for (const account of accounts) users[account.key] = await ensureAccount(account, departments, firebaseState);

  say('\n[4/7] Department head slots');
  await linkDepartmentHead(departments.road, users.roadHead);
  await linkDepartmentHead(departments.water, users.waterHead);

  say('\n[5/7] Response teams');
  const teams = {};
  for (const definition of TEAMS) teams[definition.key] = await ensureTeam(definition, departments, users);

  say('\n[6/7] Demo report');
  const report = await ensureDemoReport({
    citizen: users.citizen,
    citizenTwo: users.citizenTwo,
    citizenThree: users.citizenThree,
    department: departments.road
  });
  const task = await ensureDemoFieldTask({
    report,
    department: departments.road,
    departmentHead: users.roadHead,
    departmentOfficer: users.roadOfficer,
    teamLeader: users.roadLeader,
    team: teams.roadTeam
  });

  say('\n[7/7] Demo emergency');
  const emergency = await ensureDemoEmergency({ citizen: users.citizen });

  say('\n---------------------------------------------------------------');
  say(`Accounts (password: ${PASSWORD})`);
  say('---------------------------------------------------------------');
  for (const account of accounts) say(`  ${account.email.padEnd(38, ' ')} ${account.role}`);
  say('\nDemo data');
  say(`  Departments : ${departments.road.name}, ${departments.water.name}`);
  say(`  Teams       : ${teams.roadTeam.name} (${users.roadLeader.name} + ${users.roadWorker1.name}, ${users.roadWorker2.name}), ${teams.waterTeam.name}`);
  say(`  Master case : ${report.reference} — ${report.title} [${report.workflowStage}/${report.status}]`);
  say(`  Linked reports: ${await Report.countDocuments({ masterCaseId: report._id })}`);
  say(`  Field task  : ${task?.taskNumber || 'not created (see warning above)'}`);
  say(`  Emergency   : ${emergency.emergencyId} — ${emergency.title} [${emergency.ops?.workflowStatus}/${emergency.priority}]`);
  if (warnings.length) {
    say('\nWarnings');
    warnings.forEach((message) => say(`  ! ${message}`));
  }
  say(`\nCreated: ${created.length} · Already present: ${reused.length}`);
  if (!SKIP_FIREBASE && warnings.some((message) => message.includes('Firebase account'))) {
    say('Some Firebase identities are missing: check the Firebase Admin credentials in server/.env, then re-run this script.');
  }
  say('\nNext: npm run dev in server/, npm run dev in client/, then sign in with any account above.\n');
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in server/.env.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await seed();
  } finally {
    await mongoose.disconnect();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('\nDemo seed failed:', error.message);
  if (error?.code === 11000) console.error('A record with the same unique key already exists. Re-run the seed; it only creates missing records.');
  process.exit(1);
});
