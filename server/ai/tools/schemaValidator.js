/**
 * Minimal JSON-Schema validator for tool inputs.
 *
 * CivicSync ships no schema library, and adding one just for tool inputs is not
 * justified: the subset below is the entire contract the AI tool registry uses
 * (object shapes, primitive types, enums, ranges, arrays and `additionalProperties`).
 *
 * Rejecting unknown properties is deliberate — a model that invents an extra
 * filter must not be able to smuggle it into a database query.
 */

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === 'number') return actual === 'number' || actual === 'integer';
  if (type === 'integer') return actual === 'integer';
  return actual === type;
}

/**
 * Validates `input` against `schema`.
 * @returns {{ ok: boolean, value?: object, errors: string[] }}
 */
export function validateToolInput(input, schema = {}) {
  const errors = [];
  const value = isPlainObject(input) ? { ...input } : {};
  if (!isPlainObject(input) && input !== undefined && input !== null) errors.push('input must be a JSON object');

  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const key of required) {
    if (value[key] === undefined || value[key] === null || value[key] === '') errors.push(`${key} is required`);
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) errors.push(`${key} is not a permitted field`);
    }
  }

  for (const [key, rule] of Object.entries(properties)) {
    const current = value[key];
    if (current === undefined || current === null) continue;
    if (rule.type && !matchesType(current, rule.type)) {
      errors.push(`${key} must be of type ${rule.type}`);
      continue;
    }
    if (rule.type === 'string') {
      const text = String(current);
      if (rule.minLength !== undefined && text.length < rule.minLength) errors.push(`${key} is too short`);
      if (rule.maxLength !== undefined && text.length > rule.maxLength) errors.push(`${key} is too long`);
      if (rule.pattern && !new RegExp(rule.pattern).test(text)) errors.push(`${key} has an invalid format`);
      if (rule.enum && !rule.enum.includes(text)) errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
      value[key] = text;
    }
    if (rule.type === 'number' || rule.type === 'integer') {
      if (rule.minimum !== undefined && current < rule.minimum) errors.push(`${key} must be >= ${rule.minimum}`);
      if (rule.maximum !== undefined && current > rule.maximum) errors.push(`${key} must be <= ${rule.maximum}`);
      if (rule.enum && !rule.enum.includes(current)) errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
    }
    if (rule.type === 'array') {
      if (rule.maxItems !== undefined && current.length > rule.maxItems) errors.push(`${key} accepts at most ${rule.maxItems} items`);
      if (rule.items?.enum) {
        const invalid = current.filter((item) => !rule.items.enum.includes(item));
        if (invalid.length) errors.push(`${key} contains unsupported values`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value, errors: [] };
}

/** Renders a schema as a short signature, used in prompts and capability lists. */
export function describeSchema(schema = {}) {
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);
  return Object.entries(properties)
    .map(([key, rule]) => `${key}${required.has(key) ? '' : '?'}:${rule.type || 'any'}${rule.enum ? `(${rule.enum.join('|')})` : ''}`)
    .join(', ');
}

/** Strips properties the schema does not declare (used before audits/logging). */
export function pickDeclared(input = {}, schema = {}) {
  const properties = schema.properties || {};
  return Object.fromEntries(Object.entries(input || {}).filter(([key]) => Object.prototype.hasOwnProperty.call(properties, key)));
}
