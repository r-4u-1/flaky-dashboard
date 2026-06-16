import "dotenv/config";

export interface AppConfig {
  key: string;
  name: string;
  pipeline: string;
  org: string;
  project: string;
}

const ORG = process.env.AZDO_ORG ?? "my-org";
const PROJECT = process.env.AZDO_PROJECT ?? "my-project";

function parseApp(raw: string | undefined): AppConfig | null {
  if (!raw) return null;
  const parts = raw.split("|").map((p) => p.trim());
  const [key, name, pipeline, org, project] = parts;
  if (!key || !name || !pipeline) return null;
  return {
    key,
    name,
    pipeline,
    org: org || ORG,
    project: project || PROJECT,
  };
}

export const APPS: AppConfig[] = [
  parseApp(process.env.APP_1),
  parseApp(process.env.APP_2),
  parseApp(process.env.APP_3),
  parseApp(process.env.APP_4),
].filter((a): a is AppConfig => a !== null);

export const PAT = process.env.AZDO_PAT?.trim() ?? "";
export const WORKFLOW = process.env.AZDO_WORKFLOW?.trim() || "Build";
export const PORT = Number(process.env.PORT ?? 3001);
export const MOCK = PAT.length === 0;

export function getApp(key: string): AppConfig | undefined {
  return APPS.find((a) => a.key === key);
}
