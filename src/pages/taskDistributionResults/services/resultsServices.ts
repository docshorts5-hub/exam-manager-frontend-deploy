export function safeLoadResultsUnavailability() {
  return {
    teachers: [
      { id: 't1', name: 'Teacher A' },
      { id: 't2', name: 'Teacher B' }
    ],
    assignments: [
      { id: 'a1', name: 'Math Test', teacherId: 't1' },
      { id: 'a2', name: 'Science Test', teacherId: 't2' }
    ],
    columns: ['Math', 'Science'],
    status: 'ready'
  };
}

export function initializeResultsInteractionState() {
  return safeLoadResultsUnavailability();
}

export function getResultsSummaryStats() {
  const data = safeLoadResultsUnavailability();
  return {
    totalTeachers: data.teachers.length,
    totalAssignments: data.assignments.length,
    completedAssignments: 0
  };
}
