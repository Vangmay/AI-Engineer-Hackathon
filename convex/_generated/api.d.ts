/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accusations from "../accusations.js";
import type * as caseEngine from "../caseEngine.js";
import type * as cases from "../cases.js";
import type * as exaSearch from "../exaSearch.js";
import type * as imports from "../imports.js";
import type * as media from "../media.js";
import type * as openaiJson from "../openaiJson.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accusations: typeof accusations;
  caseEngine: typeof caseEngine;
  cases: typeof cases;
  exaSearch: typeof exaSearch;
  imports: typeof imports;
  media: typeof media;
  openaiJson: typeof openaiJson;
  sessions: typeof sessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
