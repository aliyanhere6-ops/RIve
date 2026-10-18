# VTUBER Live Studio

## Current studio revision

Pointer upgrade: `vtuber.riv` now contains the user's Rectangle move listener / align-target action. Its target is exported as `Head Pointer Target` (same object ID and bindings); the five existing View Model properties remain unchanged. The renderer sends camera head X/Y through `StateMachineInstance.pointerMove` in artboard coordinates around the target's neutral position (250,154), preserving the existing head blending, body, hair and lip controls. No system mouse is moved. Camera-off canvas pointer movement previews the listener with contain-fit coordinate conversion. Rive pointer tracking can be disabled independently. Previous export is saved under ignored `exports/pointer-upgrade/previous.riv`.

Face-follow refinement: camera mode now uses calibrated face-center displacement, normalized by eye distance, as its separate pointer X/Y signal. Head rotation still drives the original head controls independently. Pointer coordinates interpolate at render frame rate; direction reversal and sensitivity controls apply to face-follow. Tracking loss recenters it. Camera-off mouse preview remains available.

Verification: `node pointer-mapping.test.mjs` tests centered/bounded mapping and mouse letterboxing. `pointer-check.html` checks the actual exported Rive target against sent coordinates in both directions and requires all five prior properties. End-to-end listener test passed.

Hair motion: the front hair group is named/exported as `Hair Motion` in the Rive source. A small damped spring supplies idle sway without needing a camera. Microphone activity above the adaptive noise gate adds gentle speech pulses, with a fast attack and gradual release; head turns add bounded follow-through. The effect changes only the hair group's transform and adds no inference model. Hair physics and Hair movement controls toggle/scale it. The previous runtime export is retained as `vtuber-before-hair.riv`. Run `node hair-motion.test.mjs` for idle, speech, bounds, variable-frame-rate and settle tests. This procedural motion belongs to the HTML renderer; the .riv exports the addressable hair group, not standalone speech detection.

Performance update: MediaPipe face/body inference runs in a dedicated classic Web Worker, not the UI/render thread. A single resized 384px camera image is in flight; additional camera frames are dropped rather than queued. GPU delegation is attempted with automatic CPU fallback. Face requests are capped near 24 Hz, body inference near 2 Hz, and mesh/debug updates are throttled. The avatar has an independent 30 Hz render budget. Canvas resolution is limited to 1.25 device pixels per CSS pixel and a one-million-pixel budget. The stage shows measured render FPS, acceleration and inference time. Reload older open tabs to load this implementation.

Slow-device handling: after three GPU face inferences exceed 150 ms, tracking switches to CPU. Expensive frames get an adaptive rest interval, and body inference falls to about one request per 1.5 seconds when tracking cost exceeds 100 ms. These are budget caps rather than guaranteed capture rates. On the observed live run, counters changed from samples of 15–19 render FPS / 378–444 ms inference to 24–28 FPS / 106–145 ms with CPU fallback. These are live samples, not a controlled benchmark. `node tracking-client.test.mjs` verifies single-frame backpressure and shutdown; `node tracking-core.test.mjs` verifies filtering behavior.

The interface now has a large sticky stage, capture/performance panels, collapsible fine tuning and diagnostics, backdrop controls, and a clean Stage view. The white circle is authored in the Rive file and is not removed by backdrop controls.

Mouths now use exclusive authored shapes, replacing the earlier crossfade described in the history below. Idle resets visibility keys before a single selected mouth is applied at full weight. No multiple-shape geometry interpolation is performed; a 65 ms minimum change interval reduces chatter.

Natural body movement is enabled by default. MediaPipe shoulder center and shoulder roll drive translation/lean on the exported `body` node with frame-rate-independent damping; subtle head follow supplies secondary motion. Gesture poses are separately opt-in. This is torso movement plus authored pose selection, not finger tracking or full skeletal retargeting.

The Rive editor's body node (`1-29780`) now has export-name enabled. The updated runtime export is `vtuber.riv`; the preceding export is retained as `vtuber-original.riv`. The export-name change is required for the browser to address the torso. Existing unresolved bindings are still present.

Validation: syntax/core tests pass. `renderer-check.html` ran changing torso lean, two-axis head blends and six exclusive mouth shapes for over 150 frames without errors; it also requires a valid exported torso node. The updated studio started camera/microphone and reported FACE TRACKED during UI checks. Final capture accuracy still depends on camera framing and calibration.

## Setup and previous implementation notes

Open this folder in VS Code. Run `node server.cjs` in the terminal and visit http://localhost:5173 in Chrome or Edge. Do not open index.html using file://. Internet is needed for the pinned Rive and MediaPipe runtimes and tracking models.

Click Start camera + mic and allow both devices. Enable Automatic tracking. Center your face and click Calibrate neutral position. Stop releases the camera and microphone. If Device in use appears, close other apps using the camera or choose a usable device in browser settings and retry.

Your exported vtuber.riv is loaded with the character artboard and State Machine 1. The main View Model name and sizing property have intentional trailing spaces preserved from the source file. All five numeric properties are bound explicitly through the Rive data-binding API.

Camera blendshapes, normalized lip opening and microphone volume estimate mouth shapes; they do not identify all consonants. Mouth signals use temporal smoothing, an adaptive microphone noise gate, a short release time and stable viseme selection. Browser speech recognition is now captions only: delayed recognized words no longer replay as mouth animations. It is not phoneme-aligned audio lip sync. Camera/audio are processed locally by default; optional captions may send audio to the browser provider. No recording or upload endpoint is included.

Mapping: visemes 0 idle, 1 L, 2 R, 3 TH, 4 FV, 5 Ch/j/Sh, 6 DGKNSTXYZ, 7 A/E/I, 8 Ee, 9 Uh/H/Ah, 10 O, 11 Oo/Uu/W, 12 rounded Oo, 13 wink, 14 shocked, 15 angry. Manual sliders expose all values. Camera-driven mouth shapes cover idle, FV, DGKNSTXYZ and the vowel/rounded shapes; L/R/TH/Ch require phoneme recognition and are manual-only. Expression gestures are off by default and do not interrupt speaking. The file's authored automatic blinking remains active.

Size is locked by default; its slider does not disable face tracking. Optional Auto size requires sustained distance changes, has separate entry/exit thresholds and freezes during head turns. Tracking loss preserves the selected size. Calibration averages 18 neutral frames. Head rotation now uses MediaPipe's 3D face transformation matrix, independent of mouth opening. The runtime retains the five data bindings and state machine, then applies weighted RESET/left/right/up/down poses continuously before drawing. Both axes can contribute. Rendering interpolates at display frame rate rather than only when camera frames arrive.

Mouth timelines are blended continuously with the idle mouth and crossfaded over 45 ms. Lip openness controls animation strength. Short syllables use a minimum hold instead of a requirement that several consecutive frames classify identically. This improves motion continuity, but is still visual mouth tracking, not accurate audio phoneme identification. The advanced Rive renderer and its WASM are pinned at 2.38.1 in vendor/ so avatar playback does not depend on a live runtime CDN download.

Optional Body pose tracking selects authored poses: right wrist raised = waving; left wrist near head = scratch; both wrists near hips = hands waist; otherwise idle. It runs less frequently to preserve face tracking responsiveness. These are discrete authored animations, not full body motion capture. Body and expression gestures start off so head and mouth behavior can be calibrated independently.

Existing source limitations: 5 pupil and 4 head yes/no trigger bindings are unresolved. Size 250/300/400 have no incoming transitions. Expressions 6 and 7 both select Warm. Layer 11 has no transitions. Source Rive file was not modified to guess missing properties.

Reverse left / right is enabled by default following the user's live camera feedback. Reverse up / down is separately available if needed; neutral remains unchanged.

Verification: Run `node tracking-core.test.mjs` for regression checks covering direction reversal, head turns without translation, pitch, neutral return, small noise rejection, locked sizing, auto-size hysteresis/turn freeze, speech onset/rounding/release, and invalid landmarks. JavaScript syntax checks passed. Browser loaded the exported character and all five bindings. Live camera tracking was verified: FACE TRACKED, changing head direction, mouth animation state changes, and locked size. LinkedIn reference shortlinks were inaccessible through the research tool.

Continuous-renderer revision: `renderer-check.html` exercised the real exported character with simultaneous horizontal/vertical blending and changing mouth intensity for over 150 frames without browser errors. Matrix regression verifies that mouth movement does not affect head rotation. The camera opened successfully during this revision but showed NO FACE, so the new tracking accuracy on a person is not yet verified. The earlier live-camera result above refers to the preceding renderer.
