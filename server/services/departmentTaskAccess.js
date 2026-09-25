export const departmentTaskAccess = {
  sameId(value, id) {
    const resolved = value?._id || value;
    return Boolean(resolved && String(resolved) === String(id));
  },

  canAccess(user, task) {
    if (!user || !task || task.departmentName !== user.departmentName) return false;
    if (user.role === 'field_worker') return this.sameId(task.assignedWorker, user._id);
    return ['department_head', 'department_officer', 'officer', 'field_worker'].includes(user.role);
  },

  canManage(user, task) {
    if (!user || !task || task.departmentName !== user.departmentName) return false;
    return ['department_head', 'department_officer'].includes(user.role) || this.sameId(task.assignedWorker, user._id);
  }
};
