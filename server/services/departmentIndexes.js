import Department from '../models/Department.js';

export async function ensureDepartmentHeadIndexes() {
  for (const [field, name] of [['head', 'uniq_department_head'], ['emergencyHead', 'uniq_department_emergency_head']]) {
    // Create the replacement first; never remove the existing constraint until
    // uniqueness of all real ObjectId holders is enforced by the new index.
    await Department.collection.createIndex({ [field]: 1 }, { unique: true, name, partialFilterExpression: { [field]: { $type: 'objectId' } } });
    const legacy = (await Department.collection.indexes()).find((index) => index.name === `${field}_1`);
    if (legacy?.unique && legacy.sparse && Object.keys(legacy.key).length === 1 && legacy.key[field] === 1) {
      await Department.collection.dropIndex(legacy.name);
    }
  }
}
