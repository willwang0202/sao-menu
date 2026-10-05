import Foundation
import CoreGraphics

// The helper observes only mouse buttons and motion. It never receives keyboard
// events, changes an event, suppresses a click, or records pointer history.
private func emit(_ payload: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
}

private enum MouseAction { case leftDown, leftUp, rightDown, rightUp, move }

private struct SlideGesture {
    var leftPressed = false
    var rightPressed = false
    var origin: CGPoint? = nil
    var summoned = false
    var direction = 1

    mutating func handle(_ action: MouseAction, point: CGPoint) -> Bool {
        let previouslyChorded = leftPressed && rightPressed
        switch action {
        case .leftDown: leftPressed = true
        case .leftUp: leftPressed = false
        case .rightDown: rightPressed = true
        case .rightUp: rightPressed = false
        case .move: break
        }
        guard leftPressed && rightPressed else {
            origin = nil; summoned = false
            return false
        }
        if !previouslyChorded { origin = point; summoned = false }
        guard !summoned, let start = origin else { return false }
        let vertical = point.y - start.y
        let horizontal = abs(point.x - start.x)
        // Original defaults are implemented in its closed Windows core. The
        // documented button chord is preserved with a 64-point down threshold.
        if abs(vertical) >= 64 && horizontal <= max(32, abs(vertical) * 0.75) {
            summoned = true
            direction = vertical >= 0 ? 1 : -1
            return true
        }
        return false
    }
}

private func status(running: Bool = false, message: String? = nil) {
    var result: [String: Any] = [
        "kind": "status", "version": 1,
        "granted": CGPreflightListenEventAccess(), "running": running,
    ]
    if let message { result["message"] = message }
    emit(result)
}

private final class MouseObserver {
    var gesture = SlideGesture()
    var tap: CFMachPort? = nil

    func handle(type: CGEventType, event: CGEvent) {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            gesture = SlideGesture()
            if CGPreflightListenEventAccess(), let tap {
                CGEvent.tapEnable(tap: tap, enable: true)
            } else {
                status(message: "Input Monitoring permission was revoked.")
                CFRunLoopStop(CFRunLoopGetCurrent())
            }
            return
        }
        let action: MouseAction
        switch type {
        case .leftMouseDown: action = .leftDown
        case .leftMouseUp: action = .leftUp
        case .rightMouseDown: action = .rightDown
        case .rightMouseUp: action = .rightUp
        case .mouseMoved, .leftMouseDragged, .rightMouseDragged: action = .move
        default: return
        }
        if type == .leftMouseDown || type == .rightMouseDown {
            emit(["kind": "pointer-down", "x": event.location.x, "y": event.location.y])
        }
        if gesture.handle(action, point: event.location) {
            emit(["kind": gesture.direction > 0 ? "summon" : "dismiss", "x": event.location.x, "y": event.location.y])
        }
    }

    func run() {
        guard CGPreflightListenEventAccess() else {
            status(message: "Enable Input Monitoring for SAO Menu to use the global mouse gesture.")
            return
        }
        let types: [CGEventType] = [.leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp, .mouseMoved, .leftMouseDragged, .rightMouseDragged]
        let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
        tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap, place: .tailAppendEventTap, options: .listenOnly,
            eventsOfInterest: mask,
            callback: { _, type, event, userInfo in
                if let userInfo {
                    Unmanaged<MouseObserver>.fromOpaque(userInfo).takeUnretainedValue().handle(type: type, event: event)
                }
                return Unmanaged.passUnretained(event)
            },
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        )
        guard let tap, let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else {
            status(message: "macOS could not start the global mouse listener. Check Input Monitoring and restart SAO Menu.")
            return
        }
        CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        status(running: true)
        CFRunLoopRun()
        CGEvent.tapEnable(tap: tap, enable: false)
        CFMachPortInvalidate(tap)
    }
}

private func selfTest() {
    var gesture = SlideGesture()
    var checks = 0
    func check(_ condition: Bool) { precondition(condition, "Gesture state-machine check failed"); checks += 1 }
    let start = CGPoint(x: 120, y: 120)
    check(!gesture.handle(.leftDown, point: start))
    check(!gesture.handle(.move, point: CGPoint(x: 120, y: 220)))
    check(!gesture.handle(.rightDown, point: start))
    check(!gesture.handle(.move, point: CGPoint(x: 120, y: 183)))
    check(gesture.handle(.move, point: CGPoint(x: 120, y: 184)))
    check(!gesture.handle(.move, point: CGPoint(x: 120, y: 300)))
    check(!gesture.handle(.leftUp, point: start))
    check(!gesture.handle(.leftDown, point: start))
    check(!gesture.handle(.move, point: CGPoint(x: 120, y: 80)))
    check(!gesture.handle(.move, point: CGPoint(x: 320, y: 184)))
    check(gesture.handle(.move, point: CGPoint(x: 140, y: 200)))
    check(!gesture.handle(.rightUp, point: start))
    check(!gesture.handle(.leftUp, point: start))
    check(!gesture.handle(.rightDown, point: start))
    check(!gesture.handle(.leftDown, point: start))
    check(gesture.handle(.move, point: CGPoint(x: 120, y: 200)))
    check(gesture.direction == 1)
    check(!gesture.handle(.leftUp, point: start))
    check(!gesture.handle(.leftDown, point: start))
    check(!gesture.handle(.move, point: CGPoint(x: 120, y: 57)))
    check(gesture.handle(.move, point: CGPoint(x: 120, y: 56)))
    check(gesture.direction == -1)
    check(!gesture.handle(.move, point: CGPoint(x: 120, y: 0)))
    emit(["kind": "self-test", "checks": checks, "passed": true])
}

switch CommandLine.arguments.dropFirst().first {
case "--status": status()
case "--request":
    // Only called after an explicit user action in the desktop preferences.
    _ = CGRequestListenEventAccess()
    status()
case "--listen": MouseObserver().run()
case "--self-test": selfTest()
default:
    FileHandle.standardError.write(Data("Expected --status, --request, --listen, or --self-test.\n".utf8))
    exit(64)
}
