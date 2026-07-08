import type { DashboardProvider } from "./provider.js";
import type { CompanyRecord } from "./types.js";
import { fixtureCompanies } from "./fixtures.js";

export class FixtureProvider implements DashboardProvider {
  async getCompanies(): Promise<CompanyRecord[]> {
    return fixtureCompanies();
  }
}
