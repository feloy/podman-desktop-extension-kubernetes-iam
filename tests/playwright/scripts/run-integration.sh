#!/usr/bin/env bash
#
# Copyright (C) 2026 Red Hat, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

set -uo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PACKAGE_DIR}"

SCREEN_SIZE='1280x960'
SERVER_ARGS="-screen 0 ${SCREEN_SIZE}x24"
VIDEO_DIR="${PACKAGE_DIR}/recordings"
VIDEO_FILE="${VIDEO_DIR}/kubernetes-iam-e2e.mp4"
FFMPEG_LOG="${VIDEO_DIR}/kubernetes-iam-e2e.ffmpeg.log"

if [[ "$(uname -s)" != 'Linux' ]] || ! command -v ffmpeg >/dev/null 2>&1 || ! command -v xvfb-run >/dev/null 2>&1; then
  xvfb-maybe --auto-servernum --server-args="${SERVER_ARGS}" -- npx playwright test src/ --grep @integration
  exit $?
fi

mkdir -p "${VIDEO_DIR}"

# xvfb-run provides DISPLAY; ffmpeg captures that screen while Playwright uses CDP.
xvfb-run --auto-servernum --server-args="${SERVER_ARGS}" -- \
  env VIDEO_FILE="${VIDEO_FILE}" FFMPEG_LOG="${FFMPEG_LOG}" SCREEN_SIZE="${SCREEN_SIZE}" \
  bash -c '
    set +e
    display_input="${DISPLAY}"
    if [[ "${display_input}" != *.* ]]; then
      display_input="${display_input}.0"
    fi

    ffmpeg -y -nostdin -hide_banner \
      -f x11grab -video_size "${SCREEN_SIZE}" -framerate 15 -i "${display_input}" \
      -an -codec:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 28 \
      -movflags +frag_keyframe+empty_moov+default_base_moof \
      "${VIDEO_FILE}" >"${FFMPEG_LOG}" 2>&1 &
    FFMPEG_PID=$!

    stop_ffmpeg() {
      if [[ -n "${FFMPEG_PID:-}" ]]; then
        kill -INT "${FFMPEG_PID}" 2>/dev/null || true
        wait "${FFMPEG_PID}" 2>/dev/null || true
      fi
    }
    trap stop_ffmpeg EXIT

    sleep 1
    if ! kill -0 "${FFMPEG_PID}" 2>/dev/null; then
      echo "ffmpeg failed to start; log follows:" >&2
      cat "${FFMPEG_LOG}" >&2 || true
    else
      echo "Recording xvfb ${display_input} to ${VIDEO_FILE}"
    fi

    npx playwright test src/ --grep @integration
    exit $?
  '
status=$?

echo "xvfb recordings:"
ls -lah "${VIDEO_DIR}" || true
if [[ -f "${FFMPEG_LOG}" ]]; then
  echo "ffmpeg log (tail):"
  tail -n 20 "${FFMPEG_LOG}" || true
fi
exit "${status}"
