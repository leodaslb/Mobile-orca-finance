import { useEffect, useRef, useState } from 'react';
import { errorMessage, getApiSession, SessionChangedError } from '@/services/api-client';
// Mesmo mecanismo de sessão do Bloco 1, com trava imediata para duplo toque.
export function useProfileMutation() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const locked = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run<T>(operation: () => Promise<T>, onSuccess: (value: T) => void) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); const revision = getApiSession().revision;
    try { const value = await operation(); if (mounted.current && revision === getApiSession().revision) onSuccess(value); }
    catch (e) { if (mounted.current && revision === getApiSession().revision && !(e instanceof SessionChangedError)) setError(errorMessage(e)); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  return { busy, error, run };
}
