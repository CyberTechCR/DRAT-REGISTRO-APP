import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { login } from '@/services/api';
import { SessionContext, type Session } from './SessionContext';
import { readCache, removeCache, saveCache } from '@/offline/storage';

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => { void readCache<Session>('active-session').then((saved) => { if (saved) setSession(saved); }); }, []);

  const value = useMemo(() => ({
    session,
    signIn: async (email: string, password: string) => { const next = await login(email, password); setSession(next); await saveCache('active-session', next); },
    signOut: () => { setSession(null); void removeCache('active-session'); },
  }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
