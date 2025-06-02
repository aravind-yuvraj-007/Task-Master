# TaskMaster

TaskMaster is a Next.js application designed for streamlined project and task management, enhanced with AI-powered features to boost productivity.

## Setup Instructions (Running Locally)

1.  **Prerequisites**:
    *   Node.js (v18 or later recommended)
    *   npm or yarn

2.  **Clone the repository**:
    ```bash
    git clone <your-repository-url>
    cd task-master 
    ```

3.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

4.  **Set up Environment Variables**:
    *   Create a `.env.local` file in the root of the project.
    *   Add your Firebase project configuration details. You can get these from your Firebase project settings (Project settings > General > Your apps > Web app > SDK setup and configuration > Config).
        ```
        NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
        NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
        NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url (optional, if using Realtime Database)
        ```
    *   **(Optional for AI Features)** If you are using specific API keys for Genkit (e.g., Google AI/Gemini), ensure they are set up. For Gemini, this might be `GOOGLE_API_KEY` in your `.env.local` if not configured globally for Genkit.

5.  **Run the development server**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will be available at `http://localhost:3000` (or the port specified by the `dev` script, usually 3000 if not overridden).

6.  **(Optional) Run Genkit development server (if testing AI flows directly)**:
    ```bash
    npm run genkit:dev
    ```
    This typically starts Genkit on port 4000 and the Genkit Developer UI on port 4001.

## Live Deployed Link

[ Live App Link  - e.g., https://your-taskmaster-app.web.app]

## Overview of AI Features Implemented

TaskMaster leverages Generative AI (via Genkit and Google's Gemini models) to provide intelligent assistance for project management:

1.  **AI Sprint Planner (`/sprint-planner`)**:
    *   **Functionality**: Suggests an optimal sprint plan based on a list of upcoming tasks (with priorities and story points), team capacity, sprint duration, and an overall sprint goal.
    *   **Inputs**: Text list of tasks, sprint duration, team size, team story point capacity, sprint goal.
    *   **Output**: A Markdown-formatted plan including selected tasks for the sprint, deferred tasks, and warnings/suggestions for improvement.

2.  **AI Scope Creep Detector (`/scope-creep-detector`)**:
    *   **Functionality**: Analyzes sprint tasks to identify potential scope creep by comparing current tasks against an original baseline (if provided) and evaluating alignment with the sprint goal.
    *   **Inputs**: Text list of current sprint tasks, optional original sprint tasks, optional sprint goal.
    *   **Output**: A Markdown report detailing newly added tasks, an assessed "creep level" (None, Low, Moderate, High), and actionable recommendations.

3.  **AI Sprint Risk Analysis (`/risk-analysis`)**:
    *   **Functionality**: Assesses potential risks within a sprint by analyzing task assignments, priorities, and effort, considering team context.
    *   **Inputs**: JSON string of tasks, optional team context.
    *   **Output**: A report including member-level risk analysis (identifying overloaded members), task-level risks (e.g., unassigned critical tasks), an overall sprint risk assessment, and mitigation recommendations.

4.  **AI Retrospective Generator (`/retrospective-generator`)**:
    *   **Functionality**: Facilitates sprint retrospectives by generating insights based on completed/incomplete tasks, sprint goals, and team sentiment.
    *   **Inputs**: JSON string of sprint tasks, optional sprint goal, optional team sentiment, optional additional notes.
    *   **Output**: A structured retrospective including a sprint summary, what went well, what could be improved, and actionable items for the next sprint.

These AI features aim to automate and enhance common agile project management activities, providing valuable insights and saving time for the team.
