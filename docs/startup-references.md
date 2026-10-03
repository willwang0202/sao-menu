# Launch animation references

Checked October 3, 2026. The user selected [Sword Art Online Link Start from japan](https://www.youtube.com/watch?v=cCfJvBgAd3E) as the visual authority and authorized using its actual high-quality footage when reconstruction did not match. The available source is 1920×1080 H.264 at 24000/1001 fps with AAC Japanese voice/effects; it has not been recolored, retimed, interpolated or video-reencoded. `public/startup/manifest.json` records its checksum and timing boundaries.

## Community comparisons

| Creator and primary source | What was inspected | Difference from the selected clip |
| --- | --- | --- |
| [Cad-noob, SAO-UI](https://github.com/Cad-noob/SAO-UI), [LinkStart component](https://github.com/Cad-noob/SAO-UI/blob/main/packages/LinkStart/src/index.vue) | Vue/CSS source: 250 elongated particles, eight repeating named colors, camera translation −1200px → 1500px over 3.5s with cubic-bezier(.8,.1,.9,.8), white fade and separate original sounds. | Implements the tunnel rather than the anime's complete sensor/language/login sequence. The published demo URL no longer resolves during this check. Useful reference for acceleration and particle geometry; no exact parity claim. |
| [Asakitan, GPU Link Start](https://github.com/Asakitan/36-key-midi-player/blob/main/link_start.py) | Creator's Python source: credits Cad-noob, instanced ModernGL particles, native refresh detection/vsync, 3.5s accelerated tunnel. | Its approximately nine-second sequence adds MIDI-player welcome branding and a separate blue tunnel. Useful reference for resolution-independent GPU rendering, rather than an exact anime asset. |
| [Akilar, SAO-UI-PLAN-LINK-START](https://cloud.tencent.com/developer/article/1968601) | Creator's article and CSS: colored-dot textures on five tunnel walls, two 12s loops offset by 6s, welcome message once per browser session. | A looping website preloader with different timing/geometry and no anime login/sensor sequence. |

The community implementations were read as references; their code was not copied or run. Their approximation does not improve exact source fidelity over the selected footage. Keep the anime video for this release, while the menu, HUD and curved browser retain compositor/RAF animation at display refresh. A 24fps recording cannot supply unique 60/120fps source frames without interpolation, which would alter the animation.

## Source timing and functional login

- 0–4s: Japanese Link Start, rainbow tunnel and flash.
- 4–10.635s: source sensor checks, language selection and animated blue login transition.
- 10.635s: pause on the empty source login form. Real username/password inputs occupy the source's field rectangles; the service footer provides login, offline continuation and service configuration.
- 12.85s onward: resume the original animated entry sequence only after actual account authentication. Source prefilled asterisks are skipped.
- HP appears after both real login and startup completion; offline continuation leaves it hidden.

`node scripts/smoke-startup-frames.mjs` captures adjacent tunnel frames and source-stage landmarks from actual native playback into `output/playwright/startup-frames/`. `node --import tsx scripts/smoke-startup.mjs` verifies source dimensions/cadence, edge-to-edge native bounds, authenticated entry, reduced motion, sound off and HP lifecycle. The SHA test verifies the checked source bytes; sample screenshots are visual evidence, not a claim that an independently reconstructed scene matches every original frame.
