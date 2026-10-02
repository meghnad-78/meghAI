# Indic & Multilingual Code-Switching Pipeline

## Supported Languages

MeghAI supports first-class Indic and global natural language understanding, explicitly handling informal code-switching and Romanized transliteration:

- **English** (`en`)
- **Hindi** (`hi` - Devanagari script)
- **Bengali** (`bn` - Bengali script)
- **Hinglish** (`hinglish` - Romanized Hindi-English mix)
- **Benglish** (`benglish` - Romanized Bengali-English mix)
- **Haryanvi** (`hr` - Regional dialect)
- **Bhojpuri** (`bh` - Regional dialect)

## Pipeline Workflow

```
Raw User Text
     │
     ▼
Script Detection (Unicode Devanagari / Bengali regex)
     │
     ▼
Token Analysis (Indic dialect dictionaries & frequency maps)
     │
     ▼
Code-Switching Normalization
     │
     ▼
Entity Resolution (Extract dates, times, paths, app names, persons)
     │
     ▼
Intent Classification & Ambiguity Resolution
```

## Prompt Injection Defense

All incoming user inputs and external documents are checked against high-risk injection patterns (`ignore previous instructions`, `system prompt override`, `disregard safety protocols`).
External web data and emails are strictly fenced within `[BEGIN UNTRUSTED DATA]` blocks to ensure untrusted content is never executed as instructions.
