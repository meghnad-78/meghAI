# Voice Catalog, Wake Word, and Voice Studio

## Wake Word Detection

MeghAI supports dual wake word activations:
- `"Hey Megh"`
- `"Megh"`

Wake word processing runs **locally on-device**. No microphone audio stream is continuously transmitted over the internet, preserving complete user privacy.

## Voice Catalog (100+ Profiles)

MeghAI provides over 100 high-fidelity voice profiles across:
- **Local Windows SAPI voices**: Microsoft David, Microsoft Zira, Microsoft Mark, Microsoft Kalpana, Microsoft Hemant (100% offline, zero cloud latency).
- **Google Cloud & Gemini voices**: Journey, Swara, Madhur, Tanima, Aniruddha.
- **Dialect and Accent Variations**: Indian English, Hindi, Bengali, British English, and American English across formal, conversational, narrative, and silicon valley personas.

## Emergency Kill Switch

Speaking or triggering `"STOP MEGH"` immediately triggers the hardware-level kill switch:
- Halts ongoing audio playback / TTS
- Cancels active LLM streaming buffers
- Kills child process executions
- Emits emergency halt event on the SSE EventBus
