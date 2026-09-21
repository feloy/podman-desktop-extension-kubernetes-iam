# E2E video captions

This directory contains the reusable pieces that turn a Playwright e2e run
into a paced, captioned recording. They are inactive for normal test runs.

## Components

- `runtime.ts` configures a test's caption pacing and exports `recordedStep`.
- `slow-typing.ts` transparently replaces `Locator.fill()` with sequential
  typing over a fixed duration.
- `reporter.ts` produces an ASS subtitle track and FFmetadata chapters.

## Enable the framework

Configure the reporter when a recording is requested:

```ts
if (process.env.VIDEO_SUBTITLES === 'true') {
  reporter.push([
    './src/video-captions/reporter.ts',
    {
      outputFile: './recordings/e2e.ass',
      chapterFile: './recordings/e2e.ffmetadata',
    },
  ]);
}
```

Install the runtime once from the shared Playwright fixture hook:

```ts
test.beforeEach(({ page }, testInfo) => {
  configureVideoCaptions(page, testInfo);
});
```

The recording script must export these variables for the test process:

| Variable | Purpose |
| --- | --- |
| `VIDEO_SUBTITLES=true` | Enables the reporter. |
| `CAPTION_PACE_MS` | Pause after each emitted caption. Set to `0` for no pacing. |
| `CAPTION_TYPING_DURATION_MS` | Total duration for each non-empty `.fill()` call. Set to `0` for normal fills. |
| `VIDEO_RECORDING_STARTED_AT` | Epoch milliseconds captured immediately before recording begins, used to align subtitles and chapters. |

## Test authoring

Use regular Playwright locators. Inside `recordedStep`, `.click()`, `.check()`,
`.uncheck()`, and `.fill()` are automatically captioned from the control's
accessible label, title, name, placeholder, or text. Non-empty fills in that
scope also use the configured fixed typing duration.

Interactions outside `recordedStep` are silent and keep their normal timing.
This keeps setup, navigation, and cleanup out of the reviewer-facing narration.
Normal e2e runs preserve their original timing everywhere.

Use `recordedStep` only for a meaningful, verified business outcome that is
worth presenting to a reviewer:

```ts
await recordedStep('Create the administrator user', async () => {
  await page.getByRole('button', { name: 'Create user' }).click();
  await page.getByRole('textbox', { name: 'User name' }).fill('admin');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'admin', exact: true })).toBeVisible();
});
```

The caption starts after the callback succeeds, while the verified UI state is
already visible. Avoid wrapping individual interactions in `recordedStep`:
they are captioned automatically within the meaningful business outcome.

## Chapters

The reporter creates one chapter for every executed test and uppercase,
Markdown-style chapter markers for each enclosing `test.describe` group. MP4
chapters are flat, so group markers are offset by one millisecond per nesting
level before the first child; this avoids FFmpeg collapsing same-timestamp
parent markers into zero-duration chapters.
