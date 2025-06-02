
'use server';
/**
 * @fileOverview An AI agent for sprint planning.
 *
 * - suggestSprintPlan - A function that suggests a sprint plan based on tasks, capacity, and goal.
 * - SprintPlanInput - The input type for the suggestSprintPlan function.
 * - SprintPlanOutput - The return type for the suggestSprintPlan function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Updated Schema based on new prompt requirements
const SprintPlanInputSchema = z.object({
  tasksText: z.string().describe('A textual list of all upcoming tasks. Each task should be on a new line in the format: <Task Title> – <Priority: High/Medium/Low> – <Story Points: number>. For example: "Implement login feature – High – 5".'),
  sprintDuration: z.string().optional().describe("The duration of the sprint (e.g., '2 weeks', '10 working days')."),
  teamSize: z.string().optional().describe("The size or composition of the team (e.g., '5 developers', '3 devs, 1 QA')."),
  teamStoryPointCapacity: z.number().optional().describe("The total story point capacity for the team for this sprint (as a number)."),
  sprintGoal: z.string().optional().describe('An optional overall goal for the sprint to help focus task selection.'),
});
export type SprintPlanInput = z.infer<typeof SprintPlanInputSchema>;

const SprintPlanOutputSchema = z.object({
  sprintPlan: z.string().describe('The AI-generated sprint plan, formatted clearly in Markdown. This section should include "## Sprint Plan" listing selected tasks and "## Deferred Tasks" listing tasks not included.'),
  warningsOrSuggestions: z.string().optional().describe('Any warnings about the plan (e.g., overload, deferred high-priority items) or suggestions for improvement, under a "## Warnings & Suggestions" heading.'),
});
export type SprintPlanOutput = z.infer<typeof SprintPlanOutputSchema>;

// Deduplication function
function deduplicateTasks(tasksText: string): string {
  const seen = new Set<string>();
  const lines = tasksText
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line || seen.has(line)) return false;
      seen.add(line);
      return true;
    });
  return lines.join('\n');
}

export async function suggestSprintPlan(input: SprintPlanInput): Promise<SprintPlanOutput> {
  try {
    if (!input.tasksText.trim()) {
      console.warn("[sprint-planner-flow.ts suggestSprintPlan wrapper] Called with empty tasksText.");
    }

    const flowInput: SprintPlanInput = {
      ...input,
      tasksText: deduplicateTasks(input.tasksText),
    };

    return sprintPlannerFlow(flowInput);

  } catch (error) {
    console.error('[sprint-planner-flow.ts suggestSprintPlan wrapper] Error during sprint plan suggestion:', error);

    let userFriendlyMessage = "An unexpected error occurred while generating the sprint plan. Please check server console for details and try again.";
    if (error instanceof Error) {
      if (error.message.includes("503") || error.message.toLowerCase().includes("model is overloaded") || error.message.toLowerCase().includes("service unavailable")) {
        const serviceErrorMatch = error.message.match(/50\d|overloaded|unavailable/i);
        const serviceErrorDetail = serviceErrorMatch ? serviceErrorMatch[0] : 'Error';
        userFriendlyMessage = `The AI service is currently overloaded or unavailable (${serviceErrorDetail}). Please try again in a few moments.`;
      } else if (error.message.startsWith("AI_EMPTY_RESPONSE:") || error.message.startsWith("AI_FORMAT_ERROR:")) {
        userFriendlyMessage = error.message;
      } else {
        userFriendlyMessage = error.message || userFriendlyMessage;
      }
    }
    throw new Error(userFriendlyMessage);
  }
}

const prompt = ai.definePrompt({
  name: 'sprintPlannerPrompt',
  input: { schema: SprintPlanInputSchema },
  output: { schema: SprintPlanOutputSchema },
  config: {
    temperature: 0.4,
  },
  prompt: `You are an expert sprint planning assistant. Given a list of upcoming tasks with their priorities and estimated story points (SP), and information about the team's sprint, create an optimal sprint plan.

## Inputs:

{{#if sprintDuration}}
- Sprint Duration: {{sprintDuration}}
{{/if}}
{{#if teamSize}}
- Team Size: {{teamSize}}
{{/if}}
{{#if teamStoryPointCapacity}}
- Team Capacity: {{teamStoryPointCapacity}} story points per sprint
{{/if}}
{{#if sprintGoal}}
- Sprint Goal: {{sprintGoal}}
{{/if}}

### Task List:
{{{tasksText}}}

Each task in the Task List is described in the format:
<Task Title> – <Priority: High/Medium/Low> – <Story Points: number>
(If priority is "N/A" or story points are "0" for some tasks, acknowledge this and proceed with planning based on available information.)

## Your Goal:

1. Select the best combination of tasks to fit within the given capacity (if provided), prioritizing high-priority tasks and tasks that align with the sprint goal (if provided).
2. If story points are available for tasks and a team story point capacity is given, use these as the primary measure for fitting tasks into the sprint. If story points are not consistently available, or capacity is described qualitatively (e.g., team size and duration), make a reasonable judgment.
3. Output a markdown-formatted response with these sections exactly as follows:

---

## Sprint Plan
[List selected tasks, each on a new line. For each task, include its title, priority, and story points. Briefly (1 sentence) describe the purpose or value of including this task in the sprint. If a task was vague, note that.]

## Deferred Tasks
[List tasks not included in the sprint plan, especially if they were high or medium priority but couldn't fit due to capacity constraints or other reasons. State the reason for deferral if clear (e.g., "Exceeds capacity", "Lower priority than selected tasks"). If no tasks are deferred, explicitly state "N/A" or "None".]

## Warnings & Suggestions
[Provide actionable tips. For example:
- Suggest breaking down very large tasks (e.g., tasks with SP > 13, or significantly larger than others).
- Identify potential high load on the team if the plan is very ambitious.
- Note if critical information (like consistent story points or clear priorities) was missing for many tasks, making planning difficult.
- Suggest clarifying ambiguous tasks.
- If the sprint goal was provided and some selected tasks don't align well, mention this as a point for discussion.]

---

Only include markdown text in the response, starting with "## Sprint Plan". Do not invent details not provided in the inputs.
Structure your entire response strictly according to the SprintPlanOutputSchema. The 'sprintPlan' field in the output schema should contain the "## Sprint Plan" and "## Deferred Tasks" sections. The 'warningsOrSuggestions' field should contain the "## Warnings & Suggestions" section.
`,
});

const sprintPlannerFlow = ai.defineFlow(
  {
    name: 'sprintPlannerFlow',
    inputSchema: SprintPlanInputSchema,
    outputSchema: SprintPlanOutputSchema,
  },
  async (input) => {
    if (!input.tasksText.trim()) {
      console.warn("[sprintPlannerFlow - ai.defineFlow internal] Flow called with empty tasksText.");
    }

    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error("AI_EMPTY_RESPONSE: AI did not return a valid plan. The output was empty.");
      }
      if (!output.sprintPlan.includes("## Sprint Plan")) {
        // This check is important for the frontend parsing.
        // The AI response structure might have changed or be malformed.
        console.error("[sprintPlannerFlow] AI response object:", JSON.stringify(output, null, 2));
        throw new Error("AI_FORMAT_ERROR: AI response is missing the required '## Sprint Plan' heading. This might indicate an unexpected AI output structure or a problem with the AI model's adherence to the output schema.");
      }
      return output;
    } catch (error) {
      console.error('[sprintPlannerFlow - ai.defineFlow internal] Error during AI prompt execution:', error);
      throw error; // Re-throw to be caught by the wrapper or page
    }
  }
);

