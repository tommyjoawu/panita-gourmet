---
workflow: general-video
flow: automation
storyboard: no
message: "Panita hace empanadas, tequeños, pan de jamón y café cada mañana, con 4.9★, en San Francisco"
destination: website-hero
aspect: 1920x1080
language: es-PA
length: 15s
---

## Intent

Silent, seamless-looping hero video for the Panita Gourmet & Bakery website (autoplays muted).
Kinetic Spanish typography over the business's own food photos and warm b-roll. Premium, warm,
editorial — not cheesy. Panama Spanish with tuteo, never voseo, no prices.

## Assets

- assets/img/ig-*.webp — Panita's own IG photos (empanadas, tequeños, pan de jamón, latte art, team at the mural); the stars.
- assets/video/pexels-*.mp4 — b-roll: frying, espresso pour, bread oven, sweet rolls.
- fonts/ — Fraunces (display, same family as the website) + Bricolage Grotesque (labels).

## Notes

- Palette: cream #F4EBDD, cocoa #2A1A12, amber #C47A2C, tomato #D8452B.
- Must loop: t=15.0 state equals t=0 (plain cream field between the wordmark exit and the first panel wipe).
- Key text kept inside the central ~70% width / 76% height so object-fit: cover crops don't cut it.
- Outputs: ../assets/video/panita-motion.{mp4,webm} + panita-motion-poster.jpg.
