export interface DeletableEvidenceIdentity {
  user_id: string;
  file_path: string;
}

export const evidenceBelongsToUser = (
  userId: string,
  evidence: DeletableEvidenceIdentity,
): boolean => evidence.user_id === userId && evidence.file_path.startsWith(`${userId}/`);

export const storageObjectIsAlreadyMissing = (message: string): boolean =>
  /not.?found/i.test(message);
