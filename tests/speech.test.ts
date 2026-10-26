import { describe, expect, it } from 'vitest';
import { rankVoices } from '@/ui/speech';

const v = (name: string, lang = 'en-US', localService = true) => ({ name, lang, localService, voiceURI: name, default: false }) as SpeechSynthesisVoice;

describe('read-aloud voice', () => {
  it('picks a natural, friendly voice over robotic and joke voices', () => {
    const mac = [v('Albert'), v('Fred'), v('Samantha'), v('Daniel', 'en-GB'), v('Ava (Premium)'), v('Zarvox'), v('Thomas', 'fr-FR')];
    const ranked = rankVoices(mac).map((x) => x.name);
    expect(ranked[0]).toBe('Ava (Premium)');
    expect(ranked[1]).toBe('Samantha');
    expect(ranked.slice(-3)).toEqual(expect.arrayContaining(['Albert', 'Fred', 'Zarvox']));
    expect(ranked).not.toContain('Thomas');
  });
  it('never picks an online voice when the device has its own', () => {
    const chrome = [v('Google US English', 'en-US', false), v('Microsoft David', 'en-US'), v('Microsoft Zira', 'en-US')];
    expect(rankVoices(chrome).map((x) => x.name)).toEqual(['Microsoft Zira', 'Microsoft David']);
  });
  it('uses the Android voice on phones', () => {
    expect(rankVoices([v('English United States', 'en-US'), v('Google US English', 'en_US')])[0].name).toBe('Google US English');
  });
});
