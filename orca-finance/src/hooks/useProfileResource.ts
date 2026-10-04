import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { errorMessage, getApiSession, SessionChangedError } from '@/services/api-client';

// Reutilizado na lista, detalhe, formulário e dashboard; não mantém cache entre perfis.
export function useProfileResource<T>(load: () => Promise<T>) {
  const { account, activeProfileId } = useAppSession();
  const key = `${account?.id ?? ''}:${activeProfileId ?? ''}:${getApiSession().revision}`;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; loader?: () => Promise<T>; data?: T; error?: string; loading: boolean; refreshing?: boolean }>({ key: '', loading: true });
  const generation = useRef(0);
  const refreshVersion = useRef(0);
  useFocusEffect(useCallback(() => {
    const request = ++generation.current;
    let mounted = true;
    // Refresh mantém o conteúdo somente para a mesma sessão, perfil e consulta.
    setResult(previous => previous.key === key && previous.loader === load && previous.data !== undefined
      ? { ...previous, error: undefined, loading: false, refreshing: !!activeProfileId }
      : { key, loader: load, loading: !!activeProfileId });
    if (activeProfileId) {
      load().then(data => {
        if (mounted && request === generation.current && revision === refreshVersion.current) setResult({ key, loader: load, data, loading: false });
      }).catch(error => {
        if (mounted && request === generation.current && revision === refreshVersion.current && !(error instanceof SessionChangedError)) {
          setResult(previous => ({ key, loader: load, error: errorMessage(error), loading: false,
            data: previous.key === key && previous.loader === load ? previous.data : undefined }));
        }
      });
    }
    return () => { mounted = false; generation.current += 1; };
  }, [key, activeProfileId, load, revision]));
  // A versão participa da requisição e invalida a resposta anterior antes do render.
  // Também mantém a dependência explícita dentro do callback compilado pelo React.
  const reload = useCallback(() => { refreshVersion.current += 1; setRevision(value => value + 1); }, []);
  return { data: result.key === key && result.loader === load ? result.data : undefined,
    error: result.key === key && result.loader === load ? result.error : undefined,
    loading: result.key !== key || result.loader !== load || result.loading,
    refreshing: result.key === key && result.loader === load && !!result.refreshing, reload };
}
