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

import { inject, injectable } from 'inversify';
import { Disposable } from '@podman-desktop/api';
import type {
  ApiGroup,
  ApiResource,
  ApiResourceError,
  ApiResourceList,
  ContextsHealthsInfo,
  KubernetesDashboardExtensionApi,
} from '@podman-desktop/kubernetes-dashboard-extension-api';
import type { ApiResourceInfo, ApiResourcesData } from '@kubernetes-iam/channels';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';
import { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import { Emitter, Event } from '/@/types/emitter';

const CORE_GROUP_VERSION = 'v1';
const CONCURRENCY = 8;
const MAX_RETRIES = 2;
const HEALTH_DEBOUNCE_MS = 500;
const DASHBOARD_MISSING = 'Dashboard extension API not available';
const DASHBOARD_TOO_OLD = 'The Kubernetes Dashboard extension needs updating to list API resources';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasDiscovery(api: KubernetesDashboardExtensionApi): boolean {
  return typeof api.getApiVersions === 'function' && typeof api.getApiResources === 'function';
}

function reachabilityFingerprint(event: ContextsHealthsInfo): string {
  return event.healths
    .filter(health => health.reachable)
    .map(health => health.contextName)
    .sort((left, right) => left.localeCompare(right))
    .join(',');
}

function describeFailure(groupVersion: string, reason: unknown): string {
  if (reason instanceof Error && reason.name === 'ApiResourceError') {
    const { statusCode, retryAfter } = reason as ApiResourceError;
    if (statusCode === 403) return `${groupVersion}: not permitted to read this group`;
    if (statusCode === 429) {
      const suffix = retryAfter ? `, retry after ${retryAfter}` : '';
      return `${groupVersion}: throttled${suffix}`;
    }
  }
  return `${groupVersion}: ${reason instanceof Error ? reason.message : String(reason)}`;
}

function retryDelayMs(reason: unknown): number | undefined {
  if (!(reason instanceof Error) || reason.name !== 'ApiResourceError') {
    return undefined;
  }
  const { statusCode, retryAfter } = reason as ApiResourceError;
  if (statusCode !== 429) {
    return undefined;
  }
  const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : 1;
  const windowMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
  // Spread retries across the second half of Retry-After; not a security context.
  // eslint-disable-next-line sonarjs/pseudo-random
  return windowMs / 2 + Math.random() * (windowMs / 2);
}

function groupVersionOf(group: ApiGroup): string | undefined {
  return group.preferredVersion?.groupVersion ?? group.versions[0]?.groupVersion;
}

function toResourceInfo(resource: ApiResource, group: string): ApiResourceInfo {
  return {
    group,
    resource: resource.name,
    kind: resource.kind,
    namespaced: resource.namespaced,
    verbs: [...resource.verbs],
  };
}

function compareResources(left: ApiResourceInfo, right: ApiResourceInfo): number {
  return left.group.localeCompare(right.group) || left.resource.localeCompare(right.resource);
}

async function settledPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) {
    return [];
  }
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) {
        continue;
      }
      try {
        results[index] = { status: 'fulfilled', value: await fn(item) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

interface DiscoveryJob {
  group: string;
  groupVersion: string;
}

@injectable()
export class ApiResourcesManager implements Disposable {
  @inject(DashboardApiManager)
  private dashboardApiManager: DashboardApiManager;

  @inject(DashboardStatesManager)
  private dashboardStatesManager: DashboardStatesManager;

  #onApiResourcesChange = new Emitter<void>();
  onApiResourcesChange: Event<void> = this.#onApiResourcesChange.event;

  #data: ApiResourcesData = { status: 'unknown', resources: [] };
  #refreshing = false;
  #generation = 0;
  #fingerprint: string | undefined;
  #debounceTimer: NodeJS.Timeout | undefined;
  #subscriptions: { dispose(): void }[] = [];

  init(): void {
    this.#subscriptions.push(this.dashboardStatesManager.onContextsHealthChange(event => this.#onHealth(event)));
  }

  dispose(): void {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = undefined;
    }
    for (const subscription of this.#subscriptions) {
      subscription.dispose();
    }
    this.#subscriptions = [];
  }

  getApiResources(): ApiResourcesData {
    return this.#data;
  }

  async refresh(): Promise<void> {
    if (this.#refreshing) {
      return;
    }
    this.#refreshing = true;
    const generation = this.#generation;
    try {
      this.#publish({ status: 'loading', resources: [] });
      const data = await this.#discover();
      if (generation !== this.#generation) {
        return;
      }
      this.#publish(data);
    } catch (reason) {
      if (generation !== this.#generation) {
        return;
      }
      this.#publish({
        status: 'error',
        resources: [],
        error: reason instanceof Error ? reason.message : String(reason),
      });
    } finally {
      this.#refreshing = false;
    }
  }

  #onHealth(event: ContextsHealthsInfo): void {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
    }
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = undefined;
      this.#invalidateIfChanged(event);
    }, HEALTH_DEBOUNCE_MS);
  }

  #invalidateIfChanged(event: ContextsHealthsInfo): void {
    const fingerprint = reachabilityFingerprint(event);
    if (this.#fingerprint === undefined || fingerprint === this.#fingerprint) {
      this.#fingerprint = fingerprint;
      return;
    }
    this.#fingerprint = fingerprint;
    this.#generation += 1;
    this.#publish({ status: 'unknown', resources: [] });
  }

  #publish(data: ApiResourcesData): void {
    this.#data = data;
    this.#onApiResourcesChange.fire();
  }

  async #discover(): Promise<ApiResourcesData> {
    const api = this.dashboardApiManager.getApi();
    if (!api) {
      throw new Error(DASHBOARD_MISSING);
    }
    if (!hasDiscovery(api)) {
      throw new Error(DASHBOARD_TOO_OLD);
    }

    const versions = await api.getApiVersions();
    const jobs: DiscoveryJob[] = [{ group: '', groupVersion: CORE_GROUP_VERSION }];
    const failedGroupVersions: string[] = [];
    for (const group of versions.groups) {
      const groupVersion = groupVersionOf(group);
      if (!groupVersion) {
        failedGroupVersions.push(`${group.name}: no served version`);
        continue;
      }
      jobs.push({ group: group.name, groupVersion });
    }

    const settled = await settledPool(jobs, CONCURRENCY, job => this.#fetchGroup(api, job));
    const resources: ApiResourceInfo[] = [];
    for (const [index, result] of settled.entries()) {
      const job = jobs[index];
      if (!job) {
        continue;
      }
      if (result.status === 'fulfilled') {
        resources.push(...result.value);
      } else {
        failedGroupVersions.push(describeFailure(job.groupVersion, result.reason));
      }
    }
    resources.sort(compareResources);
    failedGroupVersions.sort((left, right) => left.localeCompare(right));

    const data: ApiResourcesData = { status: 'loaded', resources };
    if (failedGroupVersions.length > 0) {
      data.failedGroupVersions = failedGroupVersions;
    }
    return data;
  }

  async #fetchGroup(api: KubernetesDashboardExtensionApi, job: DiscoveryJob): Promise<ApiResourceInfo[]> {
    const list = await this.#getApiResources(api, job.groupVersion);
    return list.resources.map(resource => toResourceInfo(resource, job.group));
  }

  async #getApiResources(api: KubernetesDashboardExtensionApi, groupVersion: string): Promise<ApiResourceList> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await api.getApiResources(groupVersion);
      } catch (reason) {
        lastError = reason;
        const waitMs = retryDelayMs(reason);
        if (waitMs === undefined || attempt === MAX_RETRIES) {
          break;
        }
        await delay(waitMs);
      }
    }
    throw lastError;
  }
}
