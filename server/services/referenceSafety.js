import mongoose from 'mongoose';

export function referencePaths(schema, modelName, prefix = '') {
  const paths = [];
  schema.eachPath((name, field) => {
    const path = `${prefix}${name}`;
    if (field.options?.ref === modelName || field.caster?.options?.ref === modelName) paths.push(path);
    if (field.schema) paths.push(...referencePaths(field.schema, modelName, `${path}.`));
  });
  return paths;
}

export async function assertUnreferencedRecord(modelName, recordId) {
  const references = await Promise.all(mongoose.modelNames().map(async (name) => {
    const model = mongoose.model(name);
    const paths = referencePaths(model.schema, modelName);
    if (!paths.length) return false;
    return Boolean(await model.exists({ $or: paths.map((path) => ({ [path]: recordId })), ...(name === modelName ? { _id: { $ne: recordId } } : {}) }));
  }));
  if (references.some(Boolean)) throw Object.assign(new Error('This record is referenced by existing records. Preserve it and deactivate or close it instead.'), { statusCode: 409 });
}
