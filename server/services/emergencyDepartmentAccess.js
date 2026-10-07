export function sameDepartment(left, right) {
  const id = (value) => String(value?._id || value || '');
  return Boolean(id(left) && id(right) && id(left) === id(right));
}

export function emergencyDepartmentConflict(incident, candidate, supervisor = null) {
  if (!candidate?.department) return 'Emergency staff must belong to an emergency department.';
  if (incident?.assignedDepartment && !sameDepartment(incident.assignedDepartment, candidate.department)) return 'Choose staff from the emergency assigned department.';
  if (supervisor && !sameDepartment(supervisor.department, candidate.department)) return 'Emergency teams must contain staff from their supervising officer department.';
  return null;
}
