// Scenario discovery for the pre-call picker.
//
// `GET /scenarios` is unauthenticated (it runs before the credential exchange)
// and returns operator-facing metadata only — slug / name / version, no flow
// definitions. The user picks one before connecting; the chosen `slug` is sent
// on `POST /offer` as `scenario_slug`.

import { apiUrl } from "./config";

export interface ScenarioSummary {
  slug: string;
  name: string;
  version: string;
}

export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const res = await fetch(apiUrl("/scenarios"));
  if (!res.ok) throw new Error(`Scenario list failed: ${res.status}`);
  const data: { scenarios: ScenarioSummary[] } = await res.json();
  return data.scenarios;
}
