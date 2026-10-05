// One-shot CoreLocation reader for the Field Map. Prints a single JSON line and exits.
// Electron's navigator.geolocation does not reach Core Location on macOS.
import CoreLocation
import Foundation

let timeoutSeconds = 20.0

func emit(_ object: [String: Any]) -> Never {
  if let data = try? JSONSerialization.data(withJSONObject: object), let line = String(data: data, encoding: .utf8) { print(line) }
  exit(0)
}

final class Reader: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var requested = false
  func start() {
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    handle(manager.authorizationStatus)
  }
  private func handle(_ status: CLAuthorizationStatus) {
    switch status {
    case .notDetermined: manager.requestWhenInUseAuthorization()
    case .denied, .restricted: emit(["error": "denied"])
    default:
      if !requested { requested = true; manager.requestLocation() }
    }
  }
  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { handle(manager.authorizationStatus) }
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    emit(["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude, "accuracy": location.horizontalAccuracy])
  }
  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    emit(["error": (error as? CLError)?.code == .denied ? "denied" : "unavailable"])
  }
}

if CommandLine.arguments.contains("--self-test") { emit(["ok": true]) }
if !CLLocationManager.locationServicesEnabled() { emit(["error": "disabled"]) }
let reader = Reader()
reader.start()
DispatchQueue.main.asyncAfter(deadline: .now() + timeoutSeconds) { emit(["error": "timeout"]) }
RunLoop.main.run()
