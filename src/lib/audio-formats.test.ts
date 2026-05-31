import { describe, expect, it } from 'vitest';
import { isSupportedAudioFile, SUPPORTED_AUDIO_ACCEPT } from '@/lib/audio-formats';

function file(name: string, type = '') {
  return new File(['x'], name, { type });
}

describe('audio format support', () => {
  it('accepts MP3 and common radio library formats even when MIME is missing', () => {
    expect(isSupportedAudioFile(file('song.mp3'))).toBe(true);
    expect(isSupportedAudioFile(file('sweep.FLAC'))).toBe(true);
    expect(isSupportedAudioFile(file('promo.m4a'))).toBe(true);
    expect(isSupportedAudioFile(file('archive.aiff'))).toBe(true);
    expect(isSupportedAudioFile(file('notes.txt'))).toBe(false);
  });

  it('keeps file input accept list aligned with supported extensions', () => {
    expect(SUPPORTED_AUDIO_ACCEPT).toContain('audio/*');
    expect(SUPPORTED_AUDIO_ACCEPT).toContain('.mp3');
    expect(SUPPORTED_AUDIO_ACCEPT).toContain('.flac');
    expect(SUPPORTED_AUDIO_ACCEPT).toContain('.aiff');
  });
});
