# Attendi 3 Second Logo Intro Storyboard

Status: editable timeline pending review. Rendering is disabled.

| Time | Track | Visual | Motion | Notes |
| --- | --- | --- | --- | --- |
| 0.00s - 0.54s | Primary Visual | Standalone Attendi mark | Fade, blur clear, and scale reveal | First primary asset gets its own timeline interval. |
| 0.54s - 1.15s | Primary Visual + Graphics | Mark holds with blue energy | Small scale settle and diagonal light sweep | Handoff effect only; no second primary visual is stacked over it. |
| 1.15s - 1.67s | Primary Visual | Full Attendi logo appears | Fade/blur reveal from the same center point | Full logo starts after the mark interval ends. |
| 1.67s - 2.62s | Primary Visual | Full logo hold | Subtle scale settle and glow | Stable review beat. |
| 2.62s - 3.00s | Primary Visual | Full logo fades for handoff | Fade to black | Preview ends cleanly without rendering. |

Primary assets:

- `assets/attendi-mark.png`
- `assets/attendi-logo.png`

Review notes:

- Edit timing in `timelines/hyperframe-timeline.v1.0.0.json`.
- Edit animation choreography in `index.html`.
- Do not run a final render until the timeline is approved.
