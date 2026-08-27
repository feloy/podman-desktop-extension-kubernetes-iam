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

/**
 * Names of the Kubernetes objects the extension creates.
 *
 * Roles and bindings are named after an RFC 1123 subdomain, namespaces after the stricter
 * RFC 1123 label, which is what the API server itself enforces on those objects.
 */
const RFC_1123_SUBDOMAIN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const RFC_1123_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const MAX_SUBDOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

export function isValidResourceName(name: string): boolean {
  return name.length <= MAX_SUBDOMAIN_LENGTH && RFC_1123_SUBDOMAIN.test(name);
}

export function isValidNamespaceName(namespace: string): boolean {
  return namespace.length <= MAX_LABEL_LENGTH && RFC_1123_LABEL.test(namespace);
}
