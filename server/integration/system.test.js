import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import User from '../models/User.js';
import Department from '../models/Department.js';
import DepartmentTeam from '../models/DepartmentTeam.js';
import DepartmentTask from '../models/DepartmentTask.js';
import Report from '../models/Report.js';
import ReportCategory from '../models/ReportCategory.js';
import Notification from '../models/Notification.js';
import Emergency from '../models/Emergency.js';
import { roleOrder } from '../config/permissions.js';
import { replaceEmergencyHead } from '../services/replaceEmergencyHead.js';
import { createActionConfirmation, confirmAction } from '../ai/actions/actionExecutor.js';
const { io: socketClient } = createRequire(new URL('../../client/package.json', import.meta.url))('socket.io-client');

test('isolated CivicSync Supertest HTTP and database regressions', { skip: process.env.RUN_QA_INTEGRATION !== '1', timeout: 600000 }, async (t) => {
  const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  dotenv.config({ path: path.join(serverDir, '.env'), quiet: true });
  const dbName = `csqa_${randomUUID().replaceAll('-', '')}`;
  const secret = randomUUID();
  const port = Number(process.env.QA_PORT || 5197);
  let child;
  const users = {}, tokens = {};
  const http = request(`http://127.0.0.1:${port}`);
  const httpStats = { requests: 0, statuses: {} };
  const record = (response) => {
    httpStats.requests++;
    httpStats.statuses[response.status] = (httpStats.statuses[response.status] || 0) + 1;
    return response;
  };
  const call = async (method, endpoint, role, body, raw = false, expectedStatus) => {
    let pending = http[method.toLowerCase()](`/api${endpoint}`)
      .set('Content-Type', 'application/json')
      .timeout({ response: 15000, deadline: 20000 });
    if (role) pending = pending.set('Authorization', `Bearer ${tokens[role] || role}`);
    if (body !== undefined) pending = pending.send(raw ? body : JSON.stringify(body));
    if (expectedStatus !== undefined) pending = pending.expect(expectedStatus);
    const res = record(await pending);
    return { status: res.status, data: res.body };
  };
  const expect = async (method, endpoint, role, body, status = 200) => {
    const response = await call(method, endpoint, role, body, false, status);
    assert.equal(response.status, status, `${method} ${endpoint}: ${response.data.message || JSON.stringify(response.data)}`);
    return response.data;
  };
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 15000 });
    await Promise.all([User, Department, DepartmentTeam, DepartmentTask, Report, ReportCategory, Notification, Emergency].map((model) => model.init()));
    const civic = await Department.create({ name: 'QA Civic', code: 'QA_CIVIC', scope: 'civic' });
    const other = await Department.create({ name: 'QA Other', code: 'QA_OTHER', scope: 'civic' });
    const emergency = await Department.create({ name: 'QA Emergency', code: 'QA_EMERGENCY', scope: 'emergency', emergencyTypes: ['medical', 'fire', 'police'] });
    const emergencyOther = await Department.create({ name: 'QA Emergency Other', code: 'QA_EMERGENCY_OTHER', scope: 'emergency', emergencyTypes: ['medical'] });
    for (const role of roleOrder) {
      const department = role.startsWith('emergency_') ? emergency : ['admin', 'citizen'].includes(role) ? null : civic;
      users[role] = await User.create({ name: `QA ${role}`, email: `${role}@qa.civicsync.test`, role, department: department?._id || null, departmentName: department?.name || '' });
      tokens[role] = jwt.sign({ userId: users[role]._id, role: 'admin' }, secret, { expiresIn: '1h' });
    }
    for (const [name, role, department] of [['citizen2', 'citizen', null], ['worker2', 'field_worker', civic], ['outsider', 'officer', other], ['foreignEO', 'emergency_officer', emergencyOther], ['foreignEFW', 'emergency_field_worker', emergencyOther], ['replacementHead', 'citizen', null]]) {
      users[name] = await User.create({ name: `QA ${name}`, email: `${name}@qa.civicsync.test`, role, department: department?._id || null, departmentName: department?.name || '' });
      tokens[name] = jwt.sign({ userId: users[name]._id }, secret, { expiresIn: '1h' });
    }
    emergency.emergencyHead = users.emergency_department_head._id;
    await emergency.save();
    civic.head = users.department_head._id;
    await civic.save();
    await ReportCategory.create({ key: 'qa_pothole', label: 'QA Pothole', defaultDepartment: civic.name });
    const team = await DepartmentTeam.create({ name: 'QA Road Team', department: civic._id, departmentName: civic.name, leader: users.officer._id, members: [users.field_worker._id, users.worker2._id], capacity: 2 });
    child = spawn(process.execPath, ['server.js'], { cwd: serverDir, env: { ...process.env, MONGODB_DB_NAME: dbName, JWT_SECRET: secret, PORT: String(port), NODE_ENV: 'test' }, windowsHide: true, stdio: 'ignore' });
    for (let attempt = 0; ; attempt++) {
      try { if ((await call('GET', '/reports/categories', 'citizen')).status === 200) break; } catch { /* startup */ }
      if (attempt >= 40 || child.exitCode !== null) throw new Error('Isolated API did not become ready.');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await t.test('authentication, malformed requests and all ten roles', async () => {
      await expect('GET', '/admin/users', null, undefined, 401);
      await expect('GET', '/admin/users', 'invalid', undefined, 401);
      await expect('GET', '/admin/users', jwt.sign({ userId: users.admin._id }, secret, { expiresIn: -1 }), undefined, 401);
      assert.equal((await call('POST', '/complaints', 'citizen', '{bad json', true)).status, 400);
      for (const role of roleOrder) {
        await expect('GET', '/users/me', role);
        await expect('GET', '/admin/users', role, undefined, role === 'admin' ? 200 : 403);
        await expect('GET', '/departments/dashboard', role, undefined, ['department_head', 'department_officer', 'officer'].includes(role) ? 200 : 403);
        for (const [route, permitted] of [['head', 'emergency_department_head'], ['department-officer', 'emergency_department_officer'], ['officer', 'emergency_officer'], ['field-worker', 'emergency_field_worker']]) await expect('GET', `/emergencies/dashboard/${route}`, role, undefined, [permitted, 'admin'].includes(role) ? 200 : 403);
      }
    });
    await t.test('citizen report, duplicates, task ownership and complete department workflow', async () => {
      const payload = { title: 'Large pothole near school', description: 'Deep pothole in asphalt near school entrance.', category: 'qa_pothole', priority: 'high', departmentName: civic.name, location: { address: 'QA Road', latitude: 23.78, longitude: 90.4 } };
      const report = (await expect('POST', '/reports', 'citizen', payload, 201)).report;
      await expect('GET', `/reports/${report._id}`, 'citizen');
      for (const method of ['GET', 'PUT', 'DELETE']) await expect(method, `/reports/${report._id}`, 'citizen2', method === 'PUT' ? payload : undefined, 404);
      const potential = await expect('POST', '/reports', 'citizen2', payload, 409);
      assert.equal(potential.code, 'POTENTIAL_DUPLICATES');
      const linked = (await expect('POST', '/reports', 'citizen2', { ...payload, duplicateDecision: 'duplicate', duplicateOf: report._id }, 201)).report;
      assert.equal(String(linked.masterCaseId), String(report._id));
      assert.equal(await Report.countDocuments({}), 2);
      await expect('POST', `/departments/reports/${report._id}/review`, 'department_head', { note: 'Reviewed.' });
      await expect('PATCH', `/departments/reports/${report._id}/assign`, 'department_head', { departmentOfficerId: users.department_officer._id });
      await expect('PATCH', `/departments/reports/${report._id}/assign`, 'department_officer', { officerId: users.officer._id });
      await expect('GET', `/departments/reports/${report._id}`, 'outsider', undefined, 404);
      const task = (await expect('POST', '/departments/tasks', 'officer', { reportId: report._id, title: 'Patch pothole' }, 201)).task;
      await expect('POST', '/departments/tasks', 'officer', { reportId: report._id }, 409);
      await expect('POST', `/departments/tasks/${task._id}/team`, 'officer', { teamId: team._id });
      await expect('GET', `/departments/tasks/${task._id}`, 'outsider', undefined, 404);
      await expect('PATCH', `/admin/users/${users.field_worker._id}/role`, 'admin', { role: 'citizen' }, 409);
      await expect('PATCH', `/departments/teams/${team._id}`, 'officer', { members: [users.worker2._id] }, 409);
      for (const role of ['field_worker', 'worker2']) {
        await expect('PATCH', `/departments/tasks/${task._id}/transition`, role, { status: 'accepted' });
        await expect('PATCH', `/departments/tasks/${task._id}/transition`, role, { status: 'in_progress' });
        await expect('POST', `/departments/tasks/${task._id}/complete`, role, { summary: 'Pothole patched and compacted.', result: 'Repaired' });
      }
      await expect('PATCH', `/departments/tasks/${task._id}/transition`, 'officer', { status: 'verified', note: 'Field evidence checked.' });
      await expect('PATCH', `/departments/reports/${report._id}/completion-review`, 'department_officer', { verificationStatus: 'verified', note: 'Site evidence checked.' });
      await expect('PATCH', `/departments/reports/${report._id}/completion-review`, 'department_head', { verificationStatus: 'approved', note: 'Final approval.' });
      assert.equal((await Report.findById(report._id)).workflowStage, 'RESOLVED');
      for (const role of ['field_worker', 'worker2']) {
        const worker = await User.findById(users[role]._id);
        assert.equal(worker.availability, 'available');
        assert.equal(worker.activeTask, null);
      }
      assert.ok(await Notification.exists({ recipient: users.citizen._id }));
      assert.ok(await Notification.exists({ recipient: users.citizen2._id }));
      await expect('PATCH', `/departments/tasks/${task._id}/transition`, 'officer', { status: 'pending' }, 403);
    });
    await t.test('emergency response hierarchy, department boundaries, resource release and resolution', async () => {
      const incident = (await expect('POST', '/emergencies', 'citizen', { category: 'medical', title: 'QA medical emergency', description: 'An injured person needs medical assistance.', location: { latitude: 23.78, longitude: 90.4, address: 'QA Road' }, sos: true }, 201)).emergency;
      const endpoint = `/emergencies/ops/incidents/${incident._id}`;
      await expect('POST', `/emergencies/${incident._id}/assign`, 'admin', { responseType: 'medical', officerId: users.emergency_officer._id }, 403);
      await expect('PATCH', `/emergencies/${incident._id}/status`, 'admin', { status: 'dispatched' }, 403);
      await expect('POST', `${endpoint}/assign-edo`, 'emergency_department_head', { edoId: users.emergency_department_officer._id });
      await expect('POST', `${endpoint}/edo-review`, 'emergency_department_officer', { notes: 'Urgent medical response needed.' });
      await expect('POST', `${endpoint}/assign-eo`, 'emergency_department_officer', { eoId: users.foreignEO._id }, 409);
      await expect('POST', `${endpoint}/assign-eo`, 'emergency_department_officer', { eoId: users.emergency_officer._id });
      await expect('POST', `${endpoint}/accept`, 'emergency_officer', {});
      await expect('POST', `${endpoint}/teams`, 'emergency_officer', { title: 'Wrong department team', fieldWorkerIds: [users.foreignEFW._id] }, 409);
      await expect('POST', `${endpoint}/teams`, 'emergency_officer', { title: 'QA Medical Team', fieldWorkerIds: [users.emergency_field_worker._id] }, 201);
      await expect('POST', `${endpoint}/complete-response`, 'emergency_officer', { notes: 'Premature completion' }, 409);
      await expect('POST', `${endpoint}/field-assignment`, 'emergency_field_worker', { step: 'accept' });
      await expect('POST', `${endpoint}/start-response`, 'emergency_officer', { step: 'active', notes: 'Response started.' });
      await expect('POST', `${endpoint}/field-assignment`, 'emergency_field_worker', { step: 'start' });
      await expect('POST', `${endpoint}/progress`, 'emergency_field_worker', { percentage: 50, note: 'First aid underway.' });
      await expect('POST', `${endpoint}/worker-complete`, 'emergency_field_worker', { notes: 'Patient transferred safely.' });
      await expect('POST', `${endpoint}/complete-response`, 'emergency_officer', { notes: 'Response complete.' });
      await expect('POST', `${endpoint}/review-completion`, 'emergency_department_officer', { notes: 'Response verified.' });
      await expect('POST', `${endpoint}/close`, 'emergency_department_head', { notes: 'Emergency resolved.' });
      await expect('POST', `${endpoint}/close`, 'emergency_department_head', { notes: 'Duplicate closure' }, 409);
      const worker = await User.findById(users.emergency_field_worker._id);
      assert.equal(worker.availability, 'available');
      assert.equal(worker.activeEmergencyTeam, null);
      assert.equal((await Emergency.findById(incident._id)).status, 'closed');
      await expect('GET', `/emergencies/${incident._id}`, 'citizen');
      await expect('GET', `/emergencies/${incident._id}`, 'citizen2', undefined, 404);
    });
    await t.test('AI confirmations execute once under concurrent requests', async () => {
      const before = await Report.countDocuments({ createdBy: users.citizen._id });
      const confirmation = await createActionConfirmation({ user: users.citizen, actionName: 'createReport', payload: { title: 'QA AI confirmed pothole', description: 'A damaged road requires repair from the civic department.', category: 'qa_pothole', departmentName: civic.name } });
      const results = await Promise.allSettled([confirmAction({ token: confirmation.token, user: users.citizen }), confirmAction({ token: confirmation.token, user: users.citizen })]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(await Report.countDocuments({ createdBy: users.citizen._id }), before + 1);
    });
    await t.test('admin department CRUD, live catalogue, partial updates and alternate head protection paths', async () => {
      await expect('POST', '/admin/departments', 'citizen', { name: 'Unauthorized department' }, 403);
      await expect('POST', '/admin/departments', 'admin', { name: {} }, 400);
      const body = { name: 'QA New Department', code: 'QA_NEW', scope: 'civic' };
      const department = (await expect('POST', '/admin/departments', 'admin', body, 201)).department;
      await expect('POST', '/admin/departments', 'admin', body, 409);
      assert.ok((await expect('GET', '/reports/departments', 'citizen')).departments.some((item) => item._id === department._id));
      await expect('GET', `/admin/departments/${department._id}`, 'admin');
      await expect('PATCH', `/admin/departments/${department._id}/status`, 'admin', { status: 'inactive' });
      const edited = await expect('PATCH', `/admin/departments/${department._id}`, 'admin', { name: 'QA New Renamed' });
      assert.equal(edited.department.status, 'inactive');
      await expect('PATCH', `/admin/departments/${emergency._id}`, 'admin', { status: 'inactive' }, 409);
      await expect('PATCH', `/admin/departments/${emergency._id}`, 'admin', { scope: 'civic' }, 409);
      await expect('POST', '/reports', 'citizen', { title: 'Wrong department report', description: 'This must remain in the civic workflow.', category: 'qa_pothole', departmentName: emergency.name }, 400);
      await expect('DELETE', `/admin/departments/${department._id}`, 'admin');
      await expect('GET', `/admin/departments/${department._id}`, 'admin', undefined, 404);
      const renamed = await expect('PATCH', `/admin/departments/${civic._id}`, 'admin', { name: 'QA Civic Renamed' });
      assert.equal(renamed.department.name, 'QA Civic Renamed');
      assert.equal(await Report.countDocuments({ departmentName: civic.name }), 0);
      assert.equal(await DepartmentTask.countDocuments({ departmentName: civic.name }), 0);
      assert.equal((await ReportCategory.findOne({ key: 'qa_pothole' })).defaultDepartment, 'QA Civic Renamed');
      civic.name = 'QA Civic Renamed';
    });
    await t.test('profile file ownership, upload validation and logout revocation', async () => {
      await expect('PATCH', '/users/me', 'citizen', { photoURL: '/api/users/me/photo/another-users-file.png' }, 400);
      const upload = record(await http.post('/api/reports')
        .set('Authorization', `Bearer ${tokens.citizen}`)
        .attach('media', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'attack.html', contentType: 'image/png' })
        .expect(400));
      assert.equal(upload.status, 400);
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=', 'base64');
      const saved = record(await http.post('/api/users/me/photo')
        .set('Authorization', `Bearer ${tokens.citizen}`)
        .attach('photo', png, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(200));
      assert.equal(saved.status, 200);
      const ownFile = saved.body.user.photoURL;
      const filename = decodeURIComponent(ownFile.split('/').at(-1));
      try {
        await expect('GET', ownFile.replace('/api', ''), 'citizen2', undefined, 404);
        const mine = record(await http.get(ownFile)
          .set('Authorization', `Bearer ${tokens.citizen}`).expect(200));
        assert.equal(mine.status, 200);
      } finally { await fs.unlink(path.join(serverDir, 'storage', 'profiles', filename)).catch(() => {}); }
      await expect('POST', '/auth/logout', 'citizen2', {});
      await expect('GET', '/users/me', 'citizen2', undefined, 401);
      const refreshed = await User.findById(users.citizen2._id);
      tokens.citizen2 = jwt.sign({ userId: refreshed._id, sessionVersion: refreshed.sessionVersion }, secret, { expiresIn: '1h' });
    });
    await t.test('realtime authentication and private notification recipients', async () => {
      const sockets = [];
      const connect = (role) => new Promise((resolve, reject) => {
        const client = socketClient(`http://127.0.0.1:${port}`, { auth: { token: tokens[role] || role }, reconnection: false, timeout: 5000 });
        sockets.push(client);
        client.once('connect', () => resolve(client));
        client.once('connect_error', reject);
      });
      try {
        await assert.rejects(connect('invalid'));
        const owner = await connect('citizen');
        const outsider = await connect('outsider');
        let privateEvents = 0, leakedEvents = 0;
        owner.on('COMMUNITY_NOTIFICATION_CREATED', () => { privateEvents++; });
        outsider.on('COMMUNITY_NOTIFICATION_CREATED', () => { leakedEvents++; });
        const post = (await expect('POST', '/community/posts', 'citizen', { content: 'Realtime recipient check' }, 201)).post;
        const received = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Notification did not reach its owner.')), 5000);
          owner.once('COMMUNITY_NOTIFICATION_CREATED', () => { clearTimeout(timer); resolve(); });
        });
        await expect('POST', `/community/posts/${post._id}/comments`, 'citizen2', { content: 'Realtime comment' }, 201);
        await received;
        await new Promise((resolve) => setTimeout(resolve, 250));
        assert.equal(privateEvents, 1);
        assert.equal(leakedEvents, 0);
      } finally { sockets.forEach((client) => client.disconnect()); }
    });
    await t.test('global emergency head protections and atomic replacement', async () => {
      const head = users.emergency_department_head;
      await expect('DELETE', `/admin/users/${head._id}`, 'admin', undefined, 409);
      for (const prefix of ['/admin/users', '/users']) {
        await expect('PATCH', `${prefix}/${head._id}/status`, 'admin', { status: 'suspended' }, 409);
        await expect('PATCH', `${prefix}/${head._id}/role`, 'admin', { role: 'citizen' }, 409);
      }
      await expect('POST', `/admin/departments/${emergency._id}/emergency-head`, 'admin', { userId: null }, 409);
      await expect('DELETE', `/admin/departments/${emergency._id}?force=true`, 'admin', undefined, 409);
      await assert.rejects(User.create({ name: 'Second head', email: 'second-head@qa.civicsync.test', role: 'emergency_department_head' }), (error) => error.code === 11000);
      await replaceEmergencyHead(emergency._id, users.replacementHead._id);
      assert.equal(await User.countDocuments({ role: 'emergency_department_head', status: 'active' }), 1);
    });
    await t.test('secondary civic APIs, private feedback, transparency and concurrent volunteer capacity', async () => {
      const departments = await expect('GET', '/reports/departments', 'citizen');
      assert.ok(departments.departments.every((department) => ['civic', 'hybrid'].includes(department.scope)));
      const report = await Report.findOne({ createdBy: users.citizen._id, workflowStage: 'RESOLVED' });
      await expect('PATCH', `/admin/reports/${report._id}/status`, 'admin', { status: 'pending' }, 409);
      await expect('POST', '/intelligence/feedback', 'citizen2', { targetType: 'report', targetId: report._id, rating: 5 }, 404);
      await expect('POST', '/intelligence/feedback', 'citizen', { targetType: 'report', targetId: report._id, rating: 5 }, 201);
      const transparency = await expect('GET', '/intelligence/transparency', 'citizen');
      assert.ok(transparency.data.resolvedReports >= 1);
      await expect('POST', '/intelligence/verifications', 'citizen', { targetType: 'verified_contributor', targetId: users.citizen._id, verificationType: 'verified_contributor' }, 403);
      await expect('POST', '/intelligence/verifications', 'admin', { targetType: 'verified_contributor', targetId: users.citizen._id, verificationType: 'verified_contributor' }, 201);
      const opportunity = (await expect('POST', '/intelligence/volunteers', 'citizen', { title: 'Capacity check', maxParticipants: 1 }, 201)).opportunity;
      const joined = await Promise.all(['citizen', 'citizen2'].map((role) => call('POST', `/intelligence/volunteers/${opportunity._id}/participate`, role, {})));
      assert.equal(joined.filter((response) => response.status === 200).length, 1);
      assert.ok(joined.every((response) => [200, 400, 409].includes(response.status)));
      const group = (await expect('POST', '/intelligence/groups', 'citizen', { name: 'QA group' }, 201)).group;
      await expect('POST', `/intelligence/groups/${group._id}/join`, 'citizen', {}, 409);
    });
    await t.test('existing AI acceptance checks against the isolated API and database', async () => {
      const result = await promisify(execFile)(process.execPath, ['acceptance.ai.test.js'], {
        cwd: serverDir,
        env: { ...process.env, MONGODB_DB_NAME: dbName, JWT_SECRET: secret, SMOKE_PORT: String(port), NODE_ENV: 'test' },
        windowsHide: true,
        timeout: 120000
      });
      assert.match(result.stdout, /\d+\/\d+ passed/);
      console.log(result.stdout.trim().split('\n').at(-1));
    });
    await t.test('community notifications, follower privacy and legacy status permissions', async () => {
      const post = (await expect('POST', '/community/posts', 'citizen', { content: 'QA community update', visibility: 'community' }, 201)).post;
      await expect('POST', `/community/posts/${post._id}/comments`, 'citizen2', { content: 'Thank you.' }, 201);
      assert.ok(await Notification.exists({ recipient: users.citizen._id, relatedId: post._id }));
      const privatePost = (await expect('POST', '/community/posts', 'citizen', { content: 'Followers only', visibility: 'followers' }, 201)).post;
      await expect('POST', `/community/posts/${privatePost._id}/save`, 'citizen2', {}, 404);
      const notification = await Notification.findOne({ recipient: users.citizen._id });
      await expect('PATCH', `/notifications/${notification._id}/read`, 'citizen2', {}, 404);
      const complaint = (await expect('POST', '/complaints', 'citizen', { title: 'Legacy issue', description: 'A legacy civic complaint.', category: 'road' }, 201)).complaint;
      await expect('PUT', `/complaints/${complaint._id}`, 'citizen', { status: 'Resolved' }, 403);
      await expect('PUT', `/complaints/${complaint._id}`, 'admin', { status: 'Resolved' }, 409);
      await expect('PUT', `/complaints/${complaint._id}`, 'admin', { status: 'In Progress' });
      await expect('PUT', `/complaints/${complaint._id}`, 'admin', { status: 'Resolved' });
    });
  } catch (error) {
    console.error('Isolated QA failure:', error.name, error.message);
    throw error;
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 5000); });
    }
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^csqa_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (process.env.SUPERTEST_METRICS_PATH) {
      await fs.writeFile(process.env.SUPERTEST_METRICS_PATH, JSON.stringify(httpStats, null, 2));
    }
  }
});
