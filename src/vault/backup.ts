import type { Envelope } from '../crypto/envelope';
import { parseEnvelopeText } from '../crypto/envelope';

/** Backups larger than this are refused before being read into memory. */
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export function backupFileName(now: Date = new Date()): string {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `enclave-backup-${date}.json`;
}

/**
 * Offers the encrypted vault as a file download. The file is the same
 * ciphertext that sits in storage, so it is safe to keep anywhere, and it
 * opens only with the master password that was in use when it was made.
 */
export function downloadBackup(envelope: Envelope): void {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName();
  document.body.append(link);
  link.click();
  link.remove();

  // Revoked a moment later, once the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads and validates a backup file chosen by the user. */
export async function readBackupFile(file: File): Promise<Envelope> {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error('That file is too large to be an Enclave backup.');
  }
  return parseEnvelopeText(await file.text());
}
