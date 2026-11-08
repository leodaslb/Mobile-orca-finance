import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Action, ui } from '@/components/common/FinanceScreen';
import { apiRequest, profilePath, getApiSession } from '@/services/api-client';
export function CategorySuggestion({ description, onAccept }: { description: string; onAccept: (id: string) => void }) {
  const [suggestion, setSuggestion] = useState<{ description: string; category: { id: string; nome: string } } | null>(null);
  useEffect(() => {
    let mounted = true; const revision = getApiSession().revision; const controller = new AbortController();
    if (!description.trim()) return;
    const timer = setTimeout(() => { void apiRequest<{ suggested: boolean; category: { id: string; nome: string } | null }>(profilePath('category-suggestions'), { method: 'POST', body: { descricao: description }, signal: controller.signal })
      .then(r => { if (mounted && revision === getApiSession().revision) setSuggestion(r.suggested && r.category ? { description, category: r.category } : null); }).catch(() => { if (mounted) setSuggestion(null); }); }, 400);
    return () => { mounted = false; clearTimeout(timer); controller.abort(); };
  }, [description]);
  if (!suggestion || suggestion.description !== description) return null;
  return <><Text style={ui.caption}>Sugestão do seu histórico: {suggestion.category.nome}</Text><Action secondary label="Usar sugestão" onPress={() => onAccept(suggestion.category.id)} /></>;
}
