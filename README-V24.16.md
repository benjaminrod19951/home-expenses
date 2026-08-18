# V24.16

- Microphone permission is requested explicitly only after the user clicks the voice button.
- Opera/Chromium now shows a visible "requesting microphone permission" state and actionable permission errors.
- After permission is granted, Web Speech Recognition starts; a watchdog reports when Opera exposes the API but does not actually start transcription.
- No microphone API runs during application/page load.
