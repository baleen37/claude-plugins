import {
  Observation,
  SessionSummary
} from './types.js';

const LOW_VALUE_TOOLS = new Set([
  'TodoWrite',
  'TodoRead',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet'
]);

/**
 * Build the initial system prompt for the observer.
 * This establishes the observer's role and expectations.
 */
export function buildInitPrompt(): string {
  return `<system>
You are an Observer AI that watches Claude Code sessions and extracts structured observations.

Your role:
1. Watch tool executions and identify meaningful observations
2. Extract facts, concepts, and technical insights
3. Track files read and modified
4. Generate session summaries when requested

Observation types:
- "decision": Architectural or technical decisions made
- "learning": New information learned or discovered
- "bugfix": Bugs identified or fixed
- "refactor": Code restructuring or improvements
- "feature": New features implemented
- "debug": Debugging activities and findings
- "test": Testing activities and results
- "config": Configuration changes or setup

Response format:
- For observations: Return XML <observation>...</observation>
- For unimportant events: Return XML <skip><reason>...</reason></skip>
- For session summaries: Return XML <session_summary>...</session_summary>

Always respond with valid XML. No markdown, no explanations outside XML.
</system>`;
}

/**
 * Build a prompt for processing a tool use event.
 */
export function buildObservationPrompt(
  toolName: string,
  toolInput: any,
  toolResponse: string,
  cwd: string,
  project: string,
  previousContext?: string
): string {
  const context = previousContext
    ? `\n\n<previous_context>\n${previousContext}\n</previous_context>`
    : '';

  return `${context}

<tool_event>
  <tool_name>${toolName}</tool_name>
  <cwd>${cwd}</cwd>
  <project>${project}</project>
  <tool_input>${JSON.stringify(toolInput, null, 2)}</tool_input>
  <tool_response>${escapeXml(toolResponse)}</tool_response>
</tool_event>

Analyze this tool execution and:
1. If it's a low-value tool (like TodoWrite, TaskCreate, etc), respond with <skip>
2. If it produced meaningful results, respond with <observation> containing:
   - type: observation type (decision, learning, bugfix, etc)
   - title: brief descriptive title
   - subtitle: additional context or detail
   - narrative: detailed explanation of what happened
   - facts: array of concrete facts learned
   - concepts: array of technical concepts involved
   - files_read: array of files that were read
   - files_modified: array of files that were modified
   - correlation_id: optional ID to correlate related observations

Respond with valid XML only.`;
}

/**
 * Build a prompt for generating a session summary.
 */
export function buildSummaryPrompt(
  sessionContext: string,
  project: string
): string {
  return `<session_context>
${sessionContext}
</session_context>

<project>${project}</project>

Generate a comprehensive session summary with:
- request: What the user was trying to accomplish
- investigated: Topics or issues investigated
- learned: New knowledge or insights gained
- completed: Tasks or features completed
- next_steps: Outstanding work or follow-ups needed
- notes: Additional observations or context

Respond with valid <session_summary> XML only.`;
}

/**
 * Parse an XML response from the LLM into typed objects.
 */
export function parseObservationResponse(
  response: string
): { type: 'observation' | 'skip'; data?: Observation; reason?: string } {
  // Try to parse as observation
  const observationMatch = response.match(/<observation>([\s\S]*?)<\/observation>/);
  if (observationMatch) {
    try {
      const parsed = parseObservationXML(observationMatch[1]);
      return { type: 'observation', data: parsed };
    } catch (error) {
      console.warn('Failed to parse observation XML:', error);
    }
  }

  // Try to parse as skip
  const skipMatch = response.match(/<skip>([\s\S]*?)<\/skip>/);
  if (skipMatch) {
    const reasonMatch = skipMatch[1].match(/<reason>(.*?)<\/reason>/);
    return {
      type: 'skip',
      reason: reasonMatch ? reasonMatch[1].trim() : 'Unspecified reason'
    };
  }

  // Default: treat as skip if we can't parse
  return { type: 'skip', reason: 'Failed to parse response' };
}

/**
 * Parse a session summary XML response.
 */
export function parseSummaryResponse(
  response: string,
  sessionId: string,
  project: string
): SessionSummary | null {
  const match = response.match(/<session_summary>([\s\S]*?)<\/session_summary>/);
  if (!match) {
    return null;
  }

  try {
    return parseSessionSummaryXML(match[1], sessionId, project);
  } catch (error) {
    console.warn('Failed to parse session summary XML:', error);
    return null;
  }
}

/**
 * Parse observation XML into an Observation object.
 */
function parseObservationXML(xml: string): Observation {
  const type = extractXmlTag(xml, 'type') || 'general';
  const title = extractXmlTag(xml, 'title') || 'Untitled';
  const subtitle = extractXmlTag(xml, 'subtitle') || '';
  const narrative = extractXmlTag(xml, 'narrative') || '';

  const facts = parseXmlArray(extractXmlTag(xml, 'facts') || '');
  const concepts = parseXmlArray(extractXmlTag(xml, 'concepts') || '');
  const filesRead = parseXmlArray(extractXmlTag(xml, 'files_read') || '');
  const filesModified = parseXmlArray(extractXmlTag(xml, 'files_modified') || '');
  const correlationId = extractXmlTag(xml, 'correlation_id') || undefined;

  return {
    id: generateId(),
    sessionId: '', // Will be set by caller
    project: '', // Will be set by caller
    promptNumber: 0, // Will be set by caller
    timestamp: Date.now(),
    type,
    title,
    subtitle,
    narrative,
    facts,
    concepts,
    filesRead,
    filesModified,
    toolName: undefined,
    correlationId,
    createdAt: Date.now()
  };
}

/**
 * Parse session summary XML into a SessionSummary object.
 */
function parseSessionSummaryXML(
  xml: string,
  sessionId: string,
  project: string
): SessionSummary {
  const request = extractXmlTag(xml, 'request') || '';
  const investigated = parseXmlArray(extractXmlTag(xml, 'investigated') || '');
  const learned = parseXmlArray(extractXmlTag(xml, 'learned') || '');
  const completed = parseXmlArray(extractXmlTag(xml, 'completed') || '');
  const nextSteps = parseXmlArray(extractXmlTag(xml, 'next_steps') || '');
  const notes = extractXmlTag(xml, 'notes') || '';

  return {
    id: generateId(),
    sessionId,
    project,
    request,
    investigated,
    learned,
    completed,
    nextSteps,
    notes,
    createdAt: Date.now()
  };
}

/**
 * Extract content from an XML tag.
 */
function extractXmlTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse an XML array (e.g., <item>1</item><item>2</item>).
 */
function parseXmlArray(xml: string): string[] {
  const items: string[] = [];
  const regex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1].trim());
  }

  return items;
}

/**
 * Escape special XML characters.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Check if a tool should be skipped (low-value).
 */
export function isLowValueTool(toolName: string): boolean {
  return LOW_VALUE_TOOLS.has(toolName);
}
