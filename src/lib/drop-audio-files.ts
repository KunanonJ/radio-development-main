const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'aac',
  'm4a',
  'ogg',
  'opus',
  'webm',
]);

function isAudioFile(file: File) {
  if (file.type.startsWith('audio/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext != null && AUDIO_EXTENSIONS.has(ext);
}

type EntryWithChildren = FileSystemEntry & {
  createReader?: () => FileSystemDirectoryReader;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
};

async function readEntry(entry: EntryWithChildren): Promise<File[]> {
  if (entry.isFile && typeof entry.file === 'function') {
    return new Promise<File[]>((resolve, reject) => {
      entry.file!(
        (file) => resolve(isAudioFile(file) ? [file] : []),
        (error) => reject(error),
      );
    });
  }

  if (!entry.isDirectory || typeof entry.createReader !== 'function') {
    return [];
  }

  const reader = entry.createReader();
  const files: File[] = [];

  async function readBatch(): Promise<void> {
    const entries = await new Promise<EntryWithChildren[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (entries.length === 0) return;
    for (const child of entries) {
      files.push(...(await readEntry(child)));
    }
    await readBatch();
  }

  await readBatch();
  return files;
}

export async function extractAudioFilesFromDrop(event: DragEvent | ReactDragEvent) {
  const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
  const { dataTransfer } = nativeEvent;
  if (!dataTransfer) return [];

  const directFiles = Array.from(dataTransfer.files).filter(isAudioFile);
  if (directFiles.length > 0) return directFiles;

  const items = Array.from(dataTransfer.items ?? []);
  const collected: File[] = [];
  for (const item of items) {
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (!entry) continue;
    collected.push(...(await readEntry(entry as EntryWithChildren)));
  }
  return collected.filter(isAudioFile);
}
import type { DragEvent as ReactDragEvent } from 'react';
