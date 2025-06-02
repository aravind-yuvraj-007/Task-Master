
'use server';
/**
 * @fileOverview An AI agent for analyzing sprint risks based on task assignments.
 *
 * - analyzeSprintRisks - A function that analyzes tasks for potential risks.
 * - RiskAnalysisInput - The input type for the analyzeSprintRisks function.
 * - RiskAnalysisOutput - The return type for the analyzeSprintRisks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(), // Assuming TaskStatus enum values as strings
  assignee: z.string().optional().describe("Name or ID of the person assigned to the task."),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().describe("Priority of the task."),
  effort: z.number().optional().describe("Estimated effort for the task (e.g., story points, hours).")
});

const RiskAnalysisInputSchema = z.object({
  tasksJson: z.string().describe('A JSON string representing an array of Task objects. Each task should include id, title, status, and optionally assignee, priority, and effort.'),
  teamContext: z.string().optional().describe('Optional text providing context about the team, like typical capacity, number of members, skills, or known constraints.'),
});
export type RiskAnalysisInput = z.infer<typeof RiskAnalysisInputSchema>;

const MemberRiskSchema = z.object({
  memberIdOrName: z.string().describe("Identifier or name of the team member."),
  riskLevel: z.enum(["Low", "Medium", "High", "Critical"]).describe("Assessed risk level for this member."),
  riskFactors: z.array(z.string()).describe("Specific reasons contributing to this risk level (e.g., 'High task count', 'Multiple critical tasks')."),
  relevantTasksSummary: z.array(z.object({id: z.string(), title: z.string(), priority: z.string().optional() })).describe("A brief list of tasks assigned to this member contributing to the risk assessment.")
});

const TaskRiskSchema = z.object({
  taskId: z.string(),
  taskTitle: z.string(),
  riskLevel: z.enum(["Low", "Medium", "High", "Critical"]).describe("Assessed risk level for this task."),
  riskFactors: z.array(z.string()).describe("Specific reasons contributing to this risk level (e.g., 'High priority assigned to potentially overloaded member', 'No assignee for critical task')."),
});

const RiskAnalysisOutputSchema = z.object({
  memberRiskAnalysis: z.array(MemberRiskSchema).describe("Analysis of risks associated with each team member derived from the tasks."),
  taskRiskAnalysis: z.array(TaskRiskSchema).describe("Analysis of risks associated with specific tasks."),
  overallAssessment: z.string().describe("A concise summary of the sprint's overall risk profile based on task assignments and potential bottlenecks."),
  recommendations: z.array(z.string()).describe("Actionable suggestions to mitigate identified risks."),
});
export type RiskAnalysisOutput = z.infer<typeof RiskAnalysisOutputSchema>;

export async function analyzeSprintRisks(input: RiskAnalysisInput): Promise<RiskAnalysisOutput> {
  return riskAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sprintRiskAnalysisPrompt',
  input: {schema: RiskAnalysisInputSchema},
  output: {schema: RiskAnalysisOutputSchema},
  config: {
    temperature: 0.4,
  },
  prompt: `You are an expert Agile Coach and Project Manager specializing in risk assessment for software development sprints.
Your task is to analyze a list of tasks and provide a risk report.

You will be provided with:
1.  **Tasks JSON:** A JSON string representing an array of tasks. Each task includes an id, title, status, and may include an assignee, priority ('Low', 'Medium', 'High', 'Critical'), and effort (numeric).
2.  **Team Context (Optional):** A brief text description of the team (e.g., "Team of 5 developers, 2-week sprint, focus on backend features", "Team is new to this technology").

Your Analysis Steps:
1.  **Parse Tasks:** Interpret the tasks from the provided JSON string.
2.  **Member-Level Risk Assessment:**
    a.  Identify unique assignees from the tasks. These are your team members for this analysis.
    b.  For each member, assess their risk level ("Low", "Medium", "High", "Critical") based on:
        - The number of tasks assigned.
        - The number of 'High' or 'Critical' priority tasks assigned.
        - The total 'effort' of tasks assigned, if effort data is present and seems significant.
        - If 'teamContext' suggests constraints (e.g., a junior member, someone part-time), factor that in.
    c.  List specific 'riskFactors' for each member (e.g., "3 Critical tasks assigned", "Total effort of 15 points exceeds typical individual capacity of 10").
    d.  Include a 'relevantTasksSummary' listing key tasks (id, title, priority) contributing to their risk.
3.  **Task-Level Risk Assessment:**
    a.  Identify tasks that pose a risk. Focus on tasks that are:
        - 'High' or 'Critical' priority but have no assignee.
        - 'High' or 'Critical' priority and are assigned to a member you've identified as 'High' or 'Critical' risk.
        - Have unusually high effort if assigned to a single individual who might be a bottleneck.
    b.  Assign a 'riskLevel' to these tasks and list 'riskFactors'.
4.  **Overall Assessment:** Provide a brief summary of the sprint's risk profile.
5.  **Recommendations:** Offer 2-3 actionable recommendations to mitigate the highest-priority risks.

Input Details:
Tasks JSON:
{{{tasksJson}}}

{{#if teamContext}}
Team Context:
{{{teamContext}}}
{{/if}}

Structure your entire response strictly according to the RiskAnalysisOutputSchema.
Focus on identifying assignees from the tasks provided. If a task has no assignee, note that as a risk for high-priority items.
Base "overload" on the quantity and priority of tasks provided in the input for each assignee. Do not assume external knowledge of team capacity unless given in teamContext.
Prioritize actionable insights.
`,
});

const riskAnalysisFlow = ai.defineFlow(
  {
    name: 'riskAnalysisFlow',
    inputSchema: RiskAnalysisInputSchema,
    outputSchema: RiskAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI did not return a valid risk analysis.");
    }
    return output;
  }
);

    
