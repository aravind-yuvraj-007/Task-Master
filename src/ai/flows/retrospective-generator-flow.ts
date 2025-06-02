
'use server';
/**
 * @fileOverview An AI agent for generating sprint retrospectives.
 *
 * - generateSprintRetrospective - A function that generates a retrospective.
 * - SprintRetrospectiveInput - The input type for the function.
 * - SprintRetrospectiveOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SprintRetrospectiveInputSchema = z.object({
  tasksJson: z.string().describe('A JSON string representing an array of Task objects from the sprint. Each task should include at least id, title, status, and description. Optional fields like category, assignee, priority, effort can also be included.'),
  sprintGoal: z.string().optional().describe('The overarching objective for this sprint.'),
  teamSentiment: z.string().optional().describe('A brief summary of the team\'s mood or significant non-task related events during the sprint (e.g., "Team felt energized by new tooling", "Unexpected server outage caused frustration").'),
  additionalNotes: z.string().optional().describe('Any other notes or observations about the sprint, such as key decisions, commit log summaries, or external factors encountered.'),
});
export type SprintRetrospectiveInput = z.infer<typeof SprintRetrospectiveInputSchema>;

const SprintRetrospectiveOutputSchema = z.object({
  sprintSummary: z.string().describe('A brief, AI-generated overview of the sprint\'s outcome based on the inputs.'),
  whatWentWell: z.array(z.string()).describe('A list of positive aspects, successes, or things the team did well during the sprint.'),
  whatCouldBeImproved: z.array(z.string()).describe('A list of challenges, areas for improvement, or things that didn\'t go as planned.'),
  actionItems: z.array(z.string()).describe('A list of concrete, actionable steps the team can take in the next sprint to address improvements or build on successes.'),
});
export type SprintRetrospectiveOutput = z.infer<typeof SprintRetrospectiveOutputSchema>;

export async function generateSprintRetrospective(input: SprintRetrospectiveInput): Promise<SprintRetrospectiveOutput> {
  return generateSprintRetrospectiveFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sprintRetrospectivePrompt',
  input: {schema: SprintRetrospectiveInputSchema},
  output: {schema: SprintRetrospectiveOutputSchema},
  config: {
    temperature: 0.4,
  },
  prompt: `You are an expert Agile Coach facilitating a sprint retrospective.
Your goal is to help the team reflect on the past sprint and identify key learnings and improvements.

You will be provided with:
1.  **Tasks JSON:** A JSON string of tasks from the sprint. Analyze this for completion rates (tasks with status 'Done' are considered completed), types of tasks completed vs. not, any apparent delays (e.g., many 'In Progress' tasks, or high-priority tasks not 'Done'), and patterns.
2.  **Sprint Goal (Optional):** The stated objective of the sprint. Assess if the completed tasks align with this goal.
3.  **Team Sentiment (Optional):** User's input on the team's general mood or significant non-task events. Incorporate this into the tone and focus of the retrospective.
4.  **Additional Notes (Optional):** Other observations like commit summaries or external factors. Use this to enrich the context.

Based on all available inputs, generate a balanced and constructive retrospective. Structure your response strictly according to the SprintRetrospectiveOutputSchema.

Your Analysis Steps:
1.  **Sprint Summary:** Write a concise (2-3 sentences) overview of the sprint. Mention if the sprint goal (if provided) was met, and give a general sense of accomplishment based on task completion.
2.  **What Went Well:** Identify 3-5 positive aspects. Consider:
    *   Successfully completed tasks, especially high-priority ones or those aligned with the sprint goal.
    *   Positive team sentiment or collaboration mentioned.
    *   Efficient handling of certain task types (if discernible from descriptions/categories).
    *   Overcoming challenges mentioned in notes.
3.  **What Could Be Improved:** Identify 3-5 areas for improvement. Consider:
    *   Tasks not completed, especially if high-priority or goal-related.
    *   Potential bottlenecks (e.g., many tasks stuck 'In Review', or tasks with high effort still 'In Progress').
    *   Negative team sentiment or challenges mentioned.
    *   Deviation from the sprint goal.
    *   Recurring issues if patterns are visible in task descriptions/categories (e.g., "multiple bug fixes related to X component").
4.  **Action Items:** Suggest 2-3 concrete, actionable steps for the next sprint based on "What Could Be Improved." Make them specific and achievable. For example, instead of "Improve testing," suggest "Dedicate specific time for integration testing before sprint review."

Input Details:
Tasks JSON:
{{{tasksJson}}}

{{#if sprintGoal}}
Sprint Goal:
{{{sprintGoal}}}
{{/if}}

{{#if teamSentiment}}
Team Sentiment:
{{{teamSentiment}}}
{{/if}}

{{#if additionalNotes}}
Additional Notes:
{{{additionalNotes}}}
{{/if}}

Provide a thoughtful and objective retrospective. Focus on processes and outcomes, not on blaming individuals.
Ensure each section (whatWentWell, whatCouldBeImproved, actionItems) contains distinct points.
`,
});

const generateSprintRetrospectiveFlow = ai.defineFlow(
  {
    name: 'generateSprintRetrospectiveFlow',
    inputSchema: SprintRetrospectiveInputSchema,
    outputSchema: SprintRetrospectiveOutputSchema,
  },
  async (input) => {
    // Basic validation for tasksJson before sending to AI
    try {
      const tasks = JSON.parse(input.tasksJson);
      if (!Array.isArray(tasks)) {
        throw new Error("Tasks JSON must be an array.");
      }
      if (tasks.length === 0 && !input.teamSentiment && !input.additionalNotes) {
        // If tasks are empty and no other context, it might be hard for AI.
        // However, the AI should still attempt a response based on available info.
        // Consider if a more specific error or default response is needed here.
      }
    } catch (e) {
        console.error("Invalid tasksJson format provided to generateSprintRetrospectiveFlow:", e);
        // Depending on strictness, could throw or let AI attempt to handle (prompt asks it to analyze JSON).
        // For now, let AI try, but this log is important.
    }

    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI did not return a valid sprint retrospective.");
    }
    return output;
  }
);
