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

declare module 'tinro/dist/tinro_lib' {
  interface RouteObject {
    update(options: { path: string | boolean; redirect: string | boolean; firstmatch: boolean }): void;
    destroy(): void;
  }

  interface RouteObjectOptions {
    fallback: boolean;
    onShow(): void;
    onHide(): void;
    onMeta(meta: Record<string, unknown>): void;
  }

  export function createRouteObject(options: RouteObjectOptions): RouteObject;
}
