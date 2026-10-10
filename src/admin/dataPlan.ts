/** Query only the selected screen's data. Raw records require an approved manager role. */
export type AdminView = 'overview' | 'users' | 'sessions' | 'finance' | 'settings' | 'team' | 'audit';

export function adminDataPlan(view: AdminView, canReadRestricted: boolean) {
  return {
    overview: view === 'overview' || view === 'finance',
    users: view === 'users' && canReadRestricted,
    sessions: view === 'sessions' && canReadRestricted,
    finance: view === 'finance',
  } as const;
}

/** Enables behavioral tests that assert unneeded endpoints are not contacted. */
export async function queryAdminData<S, U, A, F>(
  plan: ReturnType<typeof adminDataPlan>,
  requests: {
    overview: () => Promise<S>;
    users: () => Promise<U>;
    sessions: () => Promise<A>;
    finance: () => Promise<F>;
  },
) {
  const [stats, users, sessions, finance] = await Promise.all([
    plan.overview ? requests.overview() : Promise.resolve(null),
    plan.users ? requests.users() : Promise.resolve(null),
    plan.sessions ? requests.sessions() : Promise.resolve(null),
    plan.finance ? requests.finance() : Promise.resolve(null),
  ]);
  return { stats, users, sessions, finance };
}
