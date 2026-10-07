import mongoose from 'mongoose';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { invalidateUserSockets } from '../realtime/emergencyRealtime.js';

// The unique index enforces at most one head; the transaction preserves the
// occupied seat if validation, the replacement save, or department update fails.
export async function replaceEmergencyHead(departmentId, candidateId) {
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const department = await Department.findById(departmentId).session(session);
      const candidate = await User.findById(candidateId).session(session);
      if (!department || !candidate || department.status !== 'active' || !['emergency', 'hybrid'].includes(department.scope)
        || candidate.status !== 'active' || candidate.role === 'admin' || candidate.activeTask || candidate.activeEmergencyTeam) {
        throw Object.assign(new Error('The selected department or replacement head is no longer eligible.'), { statusCode: 409 });
      }
      const current = await User.findOne({ role: 'emergency_department_head', status: 'active' }).session(session);
      if (current && !current._id.equals(candidate._id) && String(department.emergencyHead) !== String(current._id)) {
        throw Object.assign(new Error('Replace the global Emergency Department Head from their current department.'), { statusCode: 409 });
      }
      if (current && !current._id.equals(candidate._id)) {
        current.role = 'citizen';
        current.department = null;
        current.departmentName = '';
        await current.save({ session });
      }
      // Clear only the slots this candidate actually holds.
      await Department.updateMany({ head: candidate._id }, { $set: { head: null } }, { session });
      await Department.updateMany({ emergencyHead: candidate._id, _id: { $ne: department._id } }, { $set: { emergencyHead: null } }, { session });
      candidate.role = 'emergency_department_head';
      candidate.department = department._id;
      candidate.departmentName = department.name;
      await candidate.save({ session });
      if (String(department.head) === String(candidate._id)) department.head = null;
      department.emergencyHead = candidate._id;
      await department.save({ session });
      return { department, previousHead: current?._id || null, newHead: candidate._id };
    });
    invalidateUserSockets(result.previousHead);
    invalidateUserSockets(result.newHead);
    return result;
  } finally {
    await session.endSession();
  }
}
