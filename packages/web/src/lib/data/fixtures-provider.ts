import type { DashboardProvider } from "./provider.js";
import type { CompanyRecord } from "./types.js";
import { fixtureCompanies } from "./fixtures.js";
import { measuredCompanies } from "./measured.js";

// 실측 데이터(measured.ts, gen-measured 생성)가 있으면 우선 사용하고,
// 없으면 개발용 시드(fixtures)로 폴백한다.
export class FixtureProvider implements DashboardProvider {
  async getCompanies(): Promise<CompanyRecord[]> {
    const measured = measuredCompanies();
    return measured.length > 0 ? measured : fixtureCompanies();
  }
}
