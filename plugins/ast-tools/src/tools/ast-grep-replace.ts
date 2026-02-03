/**
 * Re-export astGrepReplace handler for backward compatibility with tests
 */

import { astGrepReplaceTool } from "./ast-tools.js";

export const astGrepReplace = astGrepReplaceTool.handler;
