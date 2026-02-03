/**
 * Re-export astGrepSearch handler for backward compatibility with tests
 */

import { astGrepSearchTool } from "./ast-tools.js";

export const astGrepSearch = astGrepSearchTool.handler;
