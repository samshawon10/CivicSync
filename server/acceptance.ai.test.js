/**
 * CivicSync Intelligence — end-to-end acceptance test (§38).
 *
 * Drives the real HTTP contract the React client uses (aiService.js) for a
 * citizen, one operational role and one emergency role, against a live server.
 * Verifies the full chain: frontend payload -> /api/ai/chat -> RBAC -> context
 * engine -> tool engine -> model router -> validated response.
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const BASE = `http://localhost:${process.env.SMOKE_PORT || 5099}`;
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
};

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
};

const tok = (user) =>
  jwt.sign(
    { userId: user._id, firebaseUid: `acc-${user._id}`, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

const users = [];
let citizen, officer, emergencyOfficer, AiConversation;
try {
  const { connectDatabase } = await import('./config/database.js');
  await connectDatabase();
  const User = (await import('./models/User.js')).default;
  AiConversation = (await import('./models/AiConversation.js')).default;

  const mk = async (role, extra = {}) => {
    const user = await User.create({
      name: `Acc ${role}`,
      email: `acc.${role}.${Date.now()}@civicsync.test`,
      password: 'x', role, status: 'active', ...extra
    });
    users.push(user);
    return user;
  };

  citizen = await mk('citizen');
  officer = await mk('department_officer', { departmentName: 'Roads & Public Works' });
  emergencyOfficer = await mk('emergency_officer', { departmentName: 'Emergency Response' });

  // ---- Capability surface is what enables the AI entry point, per role ----
  const caps = {};
  for (const [label, user] of [
    ['citizen', citizen],
    ['department_officer', officer],
    ['emergency_officer', emergencyOfficer]
  ]) {
    const res = await call('GET', '/api/ai/capabilities', { token: tok(user) });
    caps[label] = res.json?.capabilities || {};
    check(`[${label}] capabilities load (AI button can enable)`, res.status === 200 && Object.keys(caps[label].tools || {}).length > 0,
      `groups=${Object.keys(caps[label].tools || {}).join('/')}`);
  }

  check('[citizen] gets citizen-scoped actions',
    caps.citizen.actions.some((a) => a.name === 'createReport'));
  check('[officer] denied citizen-only createReport',
    !caps.department_officer.actions.some((a) => a.name === 'createReport'),
    caps.department_officer.actions.map((a) => a.name).join(',') || 'none');
  check('[officer] and [emergency_officer] see different tool surfaces',
    JSON.stringify(Object.keys(caps.department_officer.tools)) !== JSON.stringify(Object.keys(caps.emergency_officer.tools)),
    `dept=${Object.keys(caps.department_officer.tools).join('/')} | emrg=${Object.keys(caps.emergency_officer.tools).join('/')}`);

  // ---- Suggested prompt -> backend -> gateway -> validated response ----
  const first = await call('POST', '/api/ai/chat', {
    token: tok(citizen),
    body: { message: 'Show my active cases', pageContext: { route: 'citizen_dashboard' } }
  });
  check('5-9. suggested prompt -> gateway -> response', first.status === 200 && Boolean(first.json?.response?.message),
    `type=${first.json?.response?.type} provider=${first.json?.provider}`);
  check('grounded contract present (citations array)',
    Array.isArray(first.json?.response?.citations), `n=${first.json?.response?.citations?.length}`);

  const conversationId = first.json?.conversationId;
  const second = await call('POST', '/api/ai/chat', {
    token: tok(citizen),
    body: { conversationId, message: 'What are my recent notifications?' }
  });
  check('10. conversational follow-up answered', second.status === 200 && Boolean(second.json?.response?.message),
    (second.json?.response?.message || '').slice(0, 70));
  check('multi-turn keeps the same conversation', second.json?.conversationId === conversationId);

  // ---- Error-state contracts the UI renders ----
  const bad = await call('POST', '/api/ai/chat', { token: tok(citizen), body: { message: '' } });
  check('12. error contract (empty message -> 400 + code)',
    bad.status === 400 && Boolean(bad.json?.code), `status=${bad.status} code=${bad.json?.code}`);

  const unauth = await call('POST', '/api/ai/chat', { body: { message: 'hi' } });
  check('12. unauthenticated -> 401 (sign-in-again state)', unauth.status === 401, `status=${unauth.status}`);

  const list = await call('GET', '/api/ai/conversations', { token: tok(citizen) });
  check('13. conversation history persists', list.status === 200 && list.json?.conversations?.length >= 1,
    `count=${list.json?.conversations?.length}`);

  // ---- Operational + emergency roles genuinely work ----
  const oChat = await call('POST', '/api/ai/chat', {
    token: tok(officer), body: { message: 'Which cases are approaching SLA?', pageContext: { route: 'department' } }
  });
  check('operational role (department_officer) answered', oChat.status === 200 && Boolean(oChat.json?.response?.message),
    `provider=${oChat.json?.provider}`);

  const eChat = await call('POST', '/api/ai/chat', {
    token: tok(emergencyOfficer), body: { message: 'Summarize incident timeline', pageContext: { route: 'emergency' } }
  });
  check('emergency role (emergency_officer) answered', eChat.status === 200 && Boolean(eChat.json?.response?.message),
    `provider=${eChat.json?.provider}`);

  // ---- RBAC: page context must never escalate privilege ----
  const spoof = await call('POST', '/api/ai/chat', {
    token: tok(citizen), body: { message: 'Show admin platform overview', pageContext: { route: 'admin', role: 'admin' } }
  });
  check('RBAC: pageContext cannot escalate role', spoof.status === 200 &&
    !/super admin|credential|database connection/i.test(spoof.json?.response?.message || ''),
    (spoof.json?.response?.message || '').slice(0, 80));

  // ---- No provider secrets reachable from the browser ----
  const health = await call('GET', '/api/ai/health', { token: tok(citizen) });
  const raw = JSON.stringify(health.json || {});
  check('30. health exposes readiness but zero secrets',
    !/api[_-]?key|AIza|sk-|serviceaccount|Bearer\s/i.test(raw), 'scanned for keys/tokens');
  check('31. provider configuration is reported honestly',
    Array.isArray(health.json?.readiness) && health.json.readiness.length > 0,
    health.json?.readiness?.map((p) => `${p.id}:${p.configured ? 'yes' : 'no'}`).join(' '));

  // ---- Community drafting must propose, never auto-publish ----
  const draft = await call('POST', '/api/ai/chat', {
    token: tok(citizen), body: { message: 'Help me draft a post', pageContext: { route: 'community' } }
  });
  const proposed = draft.json?.response?.action;
  check('17. community drafting proposes, never auto-publishes',
    !proposed || ['saveCommunityDraft', 'createReport'].includes(proposed.name),
    proposed ? `proposed=${proposed.name} (needs confirmation)` : 'no action proposed');
} catch (error) {
  check('acceptance run crashed', false, error.message);
  console.error(error);
} finally {
  for (const user of users) {
    await AiConversation.deleteMany({ user: user._id });
    await mongoose.connection.collection('users').deleteOne({ _id: user._id });
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
