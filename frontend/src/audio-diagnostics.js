export function microphoneErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone permission was blocked. Allow microphone access for this site, then try again.";
    case "NotFoundError":
      return "No microphone was found. Connect one or choose an available input, then try again.";
    case "NotReadableError":
      return "The microphone could not be opened. Close other apps using it and check your device.";
    case "OverconstrainedError":
      return "That microphone is no longer available. Select Default microphone and try again.";
    case "AbortError":
      return "Microphone startup was interrupted. Check the device and try again.";
    case "TypeError":
      return "Microphone access needs HTTPS or localhost in a supported browser.";
    default:
      return "Microphone could not be started. Check browser permission and the selected device.";
  }
}

export function audioCloseMessage(code) {
  if (code === 1008) return "Audio server stopped the session because its frame-rate limit was exceeded.";
  if (code === 1009) return "Audio server rejected an oversized audio frame. Try again with a supported browser.";
  if (code === 1006) return "Audio connection was interrupted. Check your internet and try again.";
  return "Audio server closed the session unexpectedly. Check the connection and try again.";
}
