
import { AiError } from '../errors.js';

export async function invokeJsonHandler(handler, { user, query = {}, params = {}, body = {} } = {}) {
  if (typeof handler !== 'function') throw new AiError('INTERNAL', { message: 'The bridged CivicSync handler is unavailable.' });
  const state = { payload: null, status: 200, sent: false };

  const res = {
    status(code) { state.status = Number(code) || 200; return this; },
    json(value) { state.payload = value; state.sent = true; return this; },
    set() { return this; },
    send(value) { state.payload = value ?? null; state.sent = true; return this; },
    setHeader() { return this; },
    end() { state.sent = true; return this; }
  };

  const failure = await new Promise((resolve) => {
    let settled = false;
    const next = (error) => { if (!settled) { settled = true; resolve(error || new AiError('INTERNAL')); } };
    Promise.resolve()
      .then(() => handler({ user, query, params, body, headers: {}, cookies: {} }, res, next))
      .then(() => { if (!settled) { settled = true; resolve(null); } })
      .catch((error) => { if (!settled) { settled = true; resolve(error); } });
  });

  if (failure) throw failure instanceof Error ? failure : new AiError('INTERNAL', { cause: failure });
  return { ok: state.status < 400, status: state.status, payload: state.payload };
}

/** Throws when the bridged handler refused the request, so the tool reports it honestly. */
export async function requireJson(handler, request) {
  const result = await invokeJsonHandler(handler, request);
  if (!result.ok) throw new AiError('NOT_AUTHORIZED', { message: 'CivicSync refused that capability for this account.' });
  return result.payload;
}
