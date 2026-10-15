export interface JobOpening {
  id: string;
  title: string;
  department: string;
  experience: string;
  skills: string[];
  description: string;
  status: "active" | "closed";
  createdAt: string;
}

export const DEFAULT_JOBS: JobOpening[] = [
  {
    id: "job-jr-ai-fullstack",
    title: "Associate Full-Stack AI Developer",
    department: "AI & Innovation",
    experience: "0-2 years (Entry / Early Career)",
    skills: ["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker", "RAG", "LLM APIs"],
    description: `We are hiring an Associate / Junior Full-Stack AI Developer to build cutting-edge LLM-powered applications and web telemetry systems.
Key Requirements:
- Hands-on experience building full-stack applications with Python (FastAPI) and React / TypeScript.
- Working knowledge of relational databases (PostgreSQL), Redis Streams, and Docker containerization.
- Experience with Generative AI, LLM APIs (Groq / OpenAI), LangChain, and RAG pipelines.
- Demonstrated portfolio of shipped projects with clean Git commits and CI/CD pipelines.
- 0-2 years experience (Fresh graduates with strong internship and project background are highly encouraged to apply).`,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "job-backend-eng",
    title: "Senior Backend Engineer",
    department: "Engineering",
    experience: "3-5 years",
    skills: ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "AWS"],
    description: `We are looking for a Senior Backend Engineer to architect and build scalable microservices and APIs.
Key Requirements:
- 3+ years experience with Python and modern async frameworks (FastAPI or Django).
- Strong proficiency in relational databases (PostgreSQL) and schema design.
- Experience with containerization (Docker) and cloud deployments (AWS / GCP).
- Familiarity with CI/CD pipelines, caching (Redis), and RESTful API standards.
- Bonus: Knowledge of vector databases (pgvector) and LLM integration.`,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "job-fullstack-dev",
    title: "Full-Stack Engineer",
    department: "Product Engineering",
    experience: "2-4 years",
    skills: ["React", "TypeScript", "Python/FastAPI", "Tailwind CSS", "PostgreSQL"],
    description: `Looking for a versatile Full-Stack Engineer who can build polished user experiences and robust APIs.
Key Requirements:
- Strong experience with modern React, TypeScript, and state management.
- Backend proficiency with Python (FastAPI) or Node.js.
- Eye for UI/UX details, responsive design, and component-driven architecture.
- Experience writing unit tests, end-to-end tests, and integrating third-party APIs.
- Self-starter with startup agility and product mindset.`,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "job-ai-engineer",
    title: "AI / LLM Application Engineer",
    department: "AI Research & Development",
    experience: "2-5 years",
    skills: ["Python", "LangChain", "Groq / OpenAI API", "pgvector", "RAG Systems", "FastAPI"],
    description: `Join us to build next-generation agentic AI workflows and LLM pipelines.
Key Requirements:
- Deep hands-on experience building production RAG (Retrieval-Augmented Generation) systems.
- Proficiency with vector search, embeddings, and vector databases (pgvector / Pinecone).
- Experience chaining LLM calls, structured output parsing, and fallback cascades.
- Strong Python fundamentals and API development using FastAPI.
- Knowledge of prompt engineering, model evaluation, and latency optimization.`,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "job-devops-cloud",
    title: "DevOps & Cloud Infrastructure Engineer",
    department: "Infrastructure",
    experience: "3+ years",
    skills: ["Docker", "Kubernetes", "AWS", "Terraform", "CI/CD GitHub Actions", "Monitoring"],
    description: `Seeking a DevOps Engineer to own our cloud infrastructure, security, and continuous deployment pipelines.
Key Requirements:
- Hands-on experience managing production cloud infrastructure (AWS / GCP).
- Deep knowledge of Docker, container orchestration (Kubernetes or ECS).
- Infrastructure-as-Code using Terraform.
- Automated CI/CD pipeline creation via GitHub Actions.
- Implementation of observability, logging, and monitoring (Prometheus, Grafana, CloudWatch).`,
    status: "active",
    createdAt: new Date().toISOString(),
  },
];

const STORAGE_KEY = "hiremind_job_openings";

export function getJobOpenings(): JobOpening[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load jobs from storage:", e);
  }
  // Initialize default
  saveJobOpenings(DEFAULT_JOBS);
  return DEFAULT_JOBS;
}

export function saveJobOpenings(jobs: JobOpening[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.error("Failed to save jobs to storage:", e);
  }
}

export function addJobOpening(job: Omit<JobOpening, "id" | "createdAt">): JobOpening {
  const jobs = getJobOpenings();
  const newJob: JobOpening = {
    ...job,
    id: `job-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  saveJobOpenings([newJob, ...jobs]);
  return newJob;
}
