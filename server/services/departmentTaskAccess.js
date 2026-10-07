export const departmentTaskAccess = {
  sameId(value, id) {
    const resolved = value?._id || value;
    return Boolean(resolved && String(resolved) === String(id));
  },

  canAccess(user, task) {
    const userDepartment = user?.departmentName || user?.department?.name || '';
    if (!user || !task || !userDepartment || task.departmentName !== userDepartment) return false;
    if (user.role === 'field_worker') {
      const team = task.team;
      if (team && (team.departmentName !== task.departmentName
        || !(team.members || []).some((member) => this.sameId(member, user._id)))) return false;
      const directAssignment = this.sameId(task.assignedWorker, user._id)
        || (task.workerIds || []).some((worker) => this.sameId(worker, user._id))
        || (task.workerAssignments || []).some((assignment) => this.sameId(assignment.worker, user._id));
      return directAssignment;
    }
    if (['department_head', 'department_officer'].includes(user.role)) return true;
    return user.role === 'officer'
      && (this.sameId(task.assignedOfficer, user._id) || this.sameId(task.teamLeader, user._id));
  },

  canManage(user, task) {
    const userDepartment = user?.departmentName || user?.department?.name || '';
    if (!user || !task || !userDepartment || task.departmentName !== userDepartment) return false;
    if (['department_head', 'department_officer'].includes(user.role)) return true;
    return user.role === 'officer'
      && (this.sameId(task.assignedOfficer, user._id) || this.sameId(task.teamLeader, user._id));
  }
};
