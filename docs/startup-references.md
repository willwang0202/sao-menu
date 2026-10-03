# Launch animation references

Checked October 3, 2026. The user selected [Sword Art Online Link Start from japan](https://www.youtube.com/watch?v=cCfJvBgAd3E) as the visual authority. They later asked for the animation to be reproduced exactly and run at the display's refresh rate instead of playing the video. The 1920×1080, 24000/1001fps reference is kept at `tests/fixtures/startup/link-start-reference.mp4` for comparison only. Its AAC voice/effects track is stream-copied to `public/startup/link-start.m4a`. `public/startup/manifest.json` records both checksums and the timing boundaries.

## Community comparisons

| Creator and primary source | What was inspected | Difference from the selected clip |
| --- | --- | --- |
| [Cad-noob, SAO-UI](https://github.com/Cad-noob/SAO-UI), [LinkStart component](https://github.com/Cad-noob/SAO-UI/blob/main/packages/LinkStart/src/index.vue) | Vue/CSS source: 250 elongated particles, eight repeating named colors, camera translation −1200px → 1500px over 3.5s with cubic-bezier(.8,.1,.9,.8), white fade and separate original sounds. | Implements the tunnel rather than the anime's complete sensor/language/login sequence. The published demo URL no longer resolves during this check. Useful reference for acceleration and particle geometry; no exact parity claim. |
| [Asakitan, GPU Link Start](https://github.com/Asakitan/36-key-midi-player/blob/main/link_start.py) | Creator's Python source: credits Cad-noob, instanced ModernGL particles, native refresh detection/vsync, 3.5s accelerated tunnel. | Its approximately nine-second sequence adds MIDI-player welcome branding and a separate blue tunnel. Useful reference for resolution-independent GPU rendering, rather than an exact anime asset. |
| [Akilar, SAO-UI-PLAN-LINK-START](https://cloud.tencent.com/developer/article/1968601) | Creator's article and CSS: colored-dot textures on five tunnel walls, two 12s loops offset by 6s, welcome message once per browser session. | A looping website preloader with different timing/geometry and no anime login/sensor sequence. |

The community implementations were read as references; their code was not copied or run. The rod-tunnel idea (coloured particles along the view axis, passed by a moving camera) is common to them and to the reconstruction, but its parameters here were fitted to the selected clip.

## Reconstruction and measurement

Every scene is drawn on a canvas in the reference's 1920×1080 space and scaled to cover the display, so non-16:9 screens crop like the film did. One clock drives the picture; it eases onto the audio position and re-seeks the audio only if the two drift more than 120ms apart.

- **Tunnel (1.4–5.0s):** coloured rods along the view axis, passed at constant speed, with motion-blurred heads. Rod count, length, width and pass window were fitted by comparing per-ring screen coverage with the reference at 24fps.
- **Sensor checks (5.25–8.95s):** dial positions and radii were read at 12–24fps for Touch, sight, Hearing, Taste and Smell. Each approaches, fills the view, changes its label to OK and docks in the right-hand column. The column turns green and scatters. Ring geometry was measured radially from a close-up.
- **Language, login and registration (9.05–13.64s):** box positions, colours, opening and fade times were measured from frames. The playback holds on the empty login card at 10.62s, before the source's placeholder typing. Real inputs sit over the card's fields. After authentication it resumes at 11.64s, showing asterisks for the real credential lengths.
- **Welcome and dive (13.68–19.11s):** the background darkens, then "Welcome to Sword Art Online !" appears in the original SAO UI face, with letter spacing fitted to the reference widths. The text zooms through log-scale keys into a blue rod field with rays, lightning, hexagon bokeh and a growing core, ending in white.

`node scripts/compare-startup.mjs <seconds…>` renders chosen times next to reference frames. The reconstruction matches composition, timing and palette. Fine detail is approximate: dial segment layout, the soft blur and grey tunnel rings of the blue dive, and panel font weight (only the bundled Source Han Sans Medium is available). `npm run test:startup` checks that a new frame is drawn every refresh and records per-scene frame intervals in `output/playwright/startup-timing.json`.
