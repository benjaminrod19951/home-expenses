# v24.13

- Microphone permission is never requested during page load.
- Removed getUserMedia permission preflight; SpeechRecognition asks for permission only after clicking the voice button.
- Added explicit HTTPS/support/error messages for Opera and other browsers.
- Added a React error boundary so runtime errors show a useful message instead of a blank page.
- Keeps v24.12 quick-expense parsing and learned category matching.
