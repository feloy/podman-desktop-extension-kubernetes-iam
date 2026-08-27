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

import { createHash } from 'node:crypto';

/**
 * User names accepted by the extension.
 *
 * Kubernetes puts almost no constraint on the name of a User subject, but the same name
 * is used as the CN of a certificate request when generating a kubeconfig, so the set is
 * kept deliberately narrow.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._@-]*$/;

const MAX_SANITIZED_LENGTH = 200;
const DIGEST_LENGTH = 8;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/**
 * Builds a binding name for `username` that is a valid RFC 1123 subdomain.
 *
 * Sanitizing is lossy — `a@b` and `a-b` both reduce to `a-b` — so a short digest of the
 * original name is included to keep distinct users on distinct bindings.
 */
export function toBindingName(username: string, suffix: string): string {
  // Runs are collapsed before truncating, so at most a single dash can sit at either end
  // and stripping them needs no repetition — which keeps the expressions linear.
  const sanitized = username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SANITIZED_LENGTH)
    .replace(/^-/, '')
    .replace(/-$/, '');
  const digest = createHash('sha256').update(username).digest('hex').slice(0, DIGEST_LENGTH);
  return sanitized ? `iam-${sanitized}-${digest}-${suffix}` : `iam-${digest}-${suffix}`;
}
