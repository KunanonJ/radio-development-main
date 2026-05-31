export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".mpeg",
  ".mpga",
  ".wav",
  ".wave",
  ".flac",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".opus",
  ".webm",
  ".aiff",
  ".aif",
] as const;

export const SUPPORTED_AUDIO_ACCEPT = ["audio/*", ...SUPPORTED_AUDIO_EXTENSIONS].join(",");

export function isSupportedAudioFile(file: File) {
  if (file.type.startsWith("audio/")) return true;
  const name = file.name.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension));
}
