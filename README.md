# PandaJason Goodies Zero-AI Scanner

Public, rule-based scanner for the PandaJason Goodies Dashboard seven-day trial.

## Safety boundary

- No Codex, ChatGPT, OpenAI API, LLM, image generation or video generation.
- No automatic publishing and no merchant contact.
- Only public official webpages are fetched.
- Login walls, CAPTCHA and anti-bot protection are not bypassed.
- Every discovered item remains `awaiting_deep_verification`.
- No private Dashboard tasks, unpublished assets, credentials or personal data belong in this repository.

## Trial schedule

The workflow starts at **00:30 UTC / 08:30 Asia/Kuala_Lumpur** each day. It records exactly seven scheduled scans, then attempts to disable its own workflow. A manual test does not count toward the seven scheduled runs.

Live public output: [`data/latest.json`](data/latest.json). Run history: [`data/runs`](data/runs).

The audit fields `aiCalls`, `openaiCalls`, and `autoPublished` must remain `0` in every run.
