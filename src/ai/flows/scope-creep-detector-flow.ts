
'use server';
/**
 * @fileOverview An AI agent for detecting sprint scope creep.
 *
 * - detectScopeCreep - A function that analyzes tasks for potential scope creep.
 * - ScopeCreepInput - The input type for the detectScopeCreep function.
 * - ScopeCreepOutput - The return type for the detectScopeCreep function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScopeCreepInputSchema = z.object({
  currentTasksText: z.string().min(1, "Current sprint tasks cannot be empty.").describe('A textual list of all tasks currently considered part of the sprint. Include details like priority and estimation if available.'),
  originalTasksText: z.string().optional().describe('A textual list of tasks that were originally planned or committed to at the start of the sprint. This is the baseline for comparison.'),
  sprintGoal: z.string().optional().describe('The overarching objective for this sprint, used to assess task relevance.'),
});
export type ScopeCreepInput = z.infer<typeof ScopeCreepInputSchema>;

const ScopeCreepOutputSchema = z.object({
  analysisReport: z.string().describe('A Markdown formatted report detailing the scope creep analysis, including newly added tasks and their alignment with the sprint goal.'),
  creepLevel: z.enum(["None", "Low", "Moderate", "High"]).describe('The assessed level of scope creep: None, Low, Moderate, or High.'),
  recommendations: z.string().optional().describe('Actionable recommendations for managing identified scope creep, if any.'),
});
export type ScopeCreepOutput = z.infer<typeof ScopeCreepOutputSchema>;

export async function detectScopeCreep(input: ScopeCreepInput): Promise<ScopeCreepOutput> {
  return scopeCreepDetectorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scopeCreepDetectorPrompt',
  input: {schema: ScopeCreepInputSchema},
  output: {schema: ScopeCreepOutputSchema},
  config: {
    temperature: 0.4,
  },
  prompt: `You are an AI assistant specializing in Agile project management, specifically in detecting sprint scope creep.
Your goal is to help teams identify when a sprint's scope is expanding beyond its original commitments or capacity.

You will be provided with:
1.  **Current Sprint Tasks:** A list of tasks currently planned or being worked on in the sprint. Tasks might include implicit priority or effort.
2.  **Original Sprint Tasks (Optional):** The list of tasks that were committed to at the beginning of the sprint. This is the baseline.
3.  **Sprint Goal (Optional):** The main objective of the sprint.

Your Analysis Steps:
1.  **Baseline Comparison (if Original Sprint Tasks provided):**
    a.  Compare 'Current Sprint Tasks' against 'Original Sprint Tasks'.
    b.  Identify tasks in the 'Current' list that are NOT in the 'Original' list. These are "Newly Added Tasks."
    c.  For each newly added task, assess its relevance to the 'Sprint Goal' (if provided). Note if it seems to support or detract from the goal.
    d.  Comment on any significant increase in the total number of tasks or perceived workload due to these additions.
2.  **Current Scope Assessment (if Original Sprint Tasks NOT provided):**
    a.  Analyze the 'Current Sprint Tasks' list in isolation.
    b.  Look for:
        - A very high volume of tasks relative to typical sprint capacity (use general knowledge if capacity isn't specified).
        - Tasks that seem unrelated to the 'Sprint Goal' (if provided).
        - A mix of many low-priority items if high-priority items are also present and numerous.
    c.  Clearly state that without an original baseline, "creep" is harder to definitively quantify, but you can highlight potential risks of overload or lack of focus.

Output Generation (Strictly follow the schema):

-   **analysisReport (Markdown Format):**
    *   Start with a concise summary statement of your findings regarding scope creep.
    *   If 'Original Sprint Tasks' were provided and new tasks identified:
        *   Create a "## Newly Added Tasks" section.
        *   List each new task (e.g., using bullet points).
        *   Briefly comment on its potential impact (e.g., "Adds X effort," "May divert focus from goal") and alignment with the 'Sprint Goal'.
    *   If 'Original Sprint Tasks' were NOT provided:
        *   Describe the current scope based on 'Current Sprint Tasks'.
        *   Point out any observations about its size, focus, or potential risks (e.g., "The current scope includes X tasks. Without a baseline, it's hard to measure creep, but ensure these align with the team's capacity and the sprint goal.").
    *   If a 'Sprint Goal' was provided, mention any tasks (new or original) that seem to deviate significantly from it.

-   **creepLevel (Enum: "None", "Low", "Moderate", "High"):**
    *   **"None":** Current tasks align well with original (if provided) and goal. Scope seems stable and focused.
    *   **"Low":** Minor additions, mostly aligned with the goal. Slight increase in work.
    *   **"Moderate":** Several new tasks, some potentially misaligned or of lower priority. Noticeable increase in workload or potential distraction from the goal.
    *   **"High":** Significant number of new tasks, many misaligned or of questionable priority. Clear signs of potential overload, lack of focus, or risk to the sprint goal. If original tasks are missing but current tasks appear excessive, unfocused, or contain many new unexpected items, this can also be "Moderate" to "High".

-   **recommendations (Optional string):**
    *   If creepLevel is "Moderate" or "High", provide 1-2 brief, actionable recommendations.
    *   Examples: "Re-evaluate newly added tasks against the sprint goal and team capacity.", "Discuss with the Product Owner if these new tasks are critical for the current sprint.", "Consider moving non-critical new items to the backlog to protect the sprint goal."

Input Details:
Current Sprint Tasks:
{{{currentTasksText}}}

{{#if originalTasksText}}
Original Sprint Tasks:
{{{originalTasksText}}}
{{/if}}

{{#if sprintGoal}}
Sprint Goal:
{{{sprintGoal}}}
{{/if}}

Remember to structure your entire response strictly according to the ScopeCreepOutputSchema (analysisReport as Markdown, creepLevel as one of the enum values, and optional recommendations).
`,
});

const scopeCreepDetectorFlow = ai.defineFlow(
  {
    name: 'scopeCreepDetectorFlow',
    inputSchema: ScopeCreepInputSchema,
    outputSchema: ScopeCreepOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI did not return a valid scope creep analysis.");
    }
    return output;
  }
);

    
