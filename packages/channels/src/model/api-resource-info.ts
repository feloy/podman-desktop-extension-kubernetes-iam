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

export interface ApiResourceInfo {
  /** Empty string for the core group. */
  group: string;
  /** Resource name, including subresources such as `pods/log`. */
  resource: string;
  kind: string;
  namespaced: boolean;
  verbs: string[];
}

/** How far the discovery of the resources of the current context went. */
export type ApiResourcesStatus = 'unknown' | 'loading' | 'loaded' | 'error';

export interface ApiResourcesData {
  status: ApiResourcesStatus;
  /** Sorted by API group then by name, and empty until the first discovery succeeds. */
  resources: ApiResourceInfo[];
  /** Set when `status` is `error`: discovery as a whole could not be read. */
  error?: string;
  /**
   * The group/versions discovery could not read, the operator most likely not being allowed
   * to list them. Their resources are missing from `resources`, which stays usable.
   */
  failedGroupVersions?: string[];
}
