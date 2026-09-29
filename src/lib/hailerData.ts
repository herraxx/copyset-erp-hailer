import type { Activity, HailerApi } from '@hailer/app-sdk';

// Pagination cap 200 per the app-sdk gotcha: larger limits silently return [].
export async function listAllPhase(
  hailer: HailerApi,
  workflowId: string,
  phaseId: string,
  pageSize = 200,
): Promise<Activity[]> {
  const all: Activity[] = [];
  let skip = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await hailer.activity.list(workflowId, phaseId, { limit: pageSize, skip } as never);
    all.push(...page);
    if (page.length < pageSize) break;
    skip += pageSize;
    if (skip > 20000) break;
  }
  return all;
}

// Lists a workflow across every one of its phases (needed for datasets like
// Asiakkaat/Tuotteet that use enableUnlinkedMode with a single "Kaikki"
// phase, and for pipelines where we need "all phases at once" views).
export async function listAllWorkflow(hailer: HailerApi, workflowId: string, phaseIds: string[]): Promise<Activity[]> {
  const results = await Promise.all(phaseIds.map((phaseId) => listAllPhase(hailer, workflowId, phaseId)));
  return results.flat();
}
