/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type { Page, TestInfo } from '@playwright/test';

import { test } from '@podman-desktop/tests-playwright';

import { enableSlowTyping } from './slow-typing';

const CAPTION_PACE_MS = Number(process.env.CAPTION_PACE_MS) || 0;
const CAPTION_TYPING_DURATION_MS = Number(process.env.CAPTION_TYPING_DURATION_MS) || 0;
const CAPTION_TIMEOUT_BUFFER_MS = 120_000;
const ACTION_STEP_PREFIX = '[video-caption] ';

/**
 * Records a viewer-facing caption after a UI outcome has been verified.
 * Test code should keep each recorded step at the business-outcome level,
 * rather than annotate individual UI interactions.
 */
export async function recordedStep<T>(caption: string, action: () => Promise<T>): Promise<T> {
  const result = await test.step(`${ACTION_STEP_PREFIX}${caption}`, action);
  await pauseForCaption();
  return result;
}

/** Configures transparent caption pacing and fixed-duration typing for a test. */
export function configureVideoCaptions(page: Page, testInfo: TestInfo): void {
  enableSlowTyping(page, CAPTION_TYPING_DURATION_MS);
  if (CAPTION_PACE_MS > 0) {
    testInfo.setTimeout(testInfo.timeout + CAPTION_TIMEOUT_BUFFER_MS);
  }
}

async function pauseForCaption(): Promise<void> {
  if (CAPTION_PACE_MS > 0) {
    await new Promise(resolve => setTimeout(resolve, CAPTION_PACE_MS));
  }
}
