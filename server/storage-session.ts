const historyCreatedForWorkspace = new Set<string>();

export function hasSessionHistory(workspacePath: string): boolean {
  return historyCreatedForWorkspace.has(workspacePath);
}

export function markSessionHistoryCreated(workspacePath: string) {
  historyCreatedForWorkspace.add(workspacePath);
}

export function resetSessionHistory(workspacePath: string) {
  historyCreatedForWorkspace.delete(workspacePath);
}
