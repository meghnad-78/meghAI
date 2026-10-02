import { describe, it, expect } from 'vitest';
import { LanguageDetector, EntityResolver, IntentEngine, InputPipeline } from '../../packages/ai-core/src/index.js';

describe('Core Input Pipeline & Language Engine', () => {
  it('detects English properly', () => {
    const res = LanguageDetector.detect('Find my resume on the desktop');
    expect(res.detectedLanguage).toBe('en');
    expect(res.isCodeSwitched).toBe(false);
  });

  it('detects Hindi / Hinglish and preserves code-switching context', () => {
    const res = LanguageDetector.detect('Megh kal mera 8 baje ka reminder laga dena');
    expect(res.detectedLanguage).toBe('hinglish');
    expect(res.isCodeSwitched).toBe(true);
  });

  it('detects Bengali and Benglish code-switching', () => {
    const res = LanguageDetector.detect('Megh ei PDF ta summarize koro');
    expect(res.detectedLanguage).toBe('benglish');
    expect(res.isCodeSwitched).toBe(true);
  });

  it('resolves file entities and aliases like "my resume"', () => {
    const entities = EntityResolver.resolve('Megh, find my resume');
    const resumeEntity = entities.find(e => e.type === 'FILE');
    expect(resumeEntity).toBeDefined();
    expect(resumeEntity?.value).toBe('resume.pdf');
  });

  it('resolves application entities like "VS Code" and "Calculator"', () => {
    const entities = EntityResolver.resolve('Hey Megh, open VS Code and Calculator');
    const apps = entities.filter(e => e.type === 'APPLICATION').map(a => a.value);
    expect(apps).toContain('code');
    expect(apps).toContain('calc');
  });

  it('classifies note creation intent accurately', () => {
    const classification = IntentEngine.classify('create a note titled Team Meeting with content discussion');
    expect(classification.primaryIntent).toBe('NOTE');
    expect(classification.requiresClarification).toBe(false);
  });

  it('detects critical ambiguity when communication recipient is missing', () => {
    const classification = IntentEngine.classify('Send it to him');
    expect(classification.primaryIntent).toBe('COMMUNICATION');
    expect(classification.requiresClarification).toBe(true);
    expect(classification.ambiguousEntities).toContain('recipient');
    expect(classification.clarificationPrompt).toContain('Who would you like me to send this to?');
  });

  it('processes standardized input pipeline end-to-end', () => {
    const res = InputPipeline.process('Hey Megh, open Chrome');
    expect(res.normalizedText).toBe('open Chrome');
    expect(res.intent.primaryIntent).toBe('APPLICATION_CONTROL');
  });
});
