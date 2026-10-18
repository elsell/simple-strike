import AVFoundation

/// Native speech adapter. Guidance decides what to say and when to stop.
final class NavigationSpeech: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func speak(_ text: String, language: String) throws {
    guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
    // A new maneuver replaces an obsolete utterance instead of building a queue.
    synthesizer.stopSpeaking(at: .immediate)
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
    try session.setActive(true)
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: language)
    synthesizer.speak(utterance)
  }

  func stop() {
    synthesizer.stopSpeaking(at: .immediate)
    releaseAudio()
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    if !synthesizer.isSpeaking { releaseAudio() }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    if !synthesizer.isSpeaking { releaseAudio() }
  }

  private func releaseAudio() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
