import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, Choices, FinanceScreen, money, Notice, ui } from '@/components/common/FinanceScreen';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { pickImport, confirmImport } from '@/services/import.service';
export default function ImportRoute() { const { activeProfileId } = useAppSession(); return <ImportTransactions key={activeProfileId} />; }
function ImportTransactions() {
  const [file, setFile] = useState<Awaited<ReturnType<typeof pickImport>>>(null); const [duplicates, setDuplicates] = useState('no'); const [created, setCreated] = useState<number | null>(null); const [uncertain, setUncertain] = useState(false);
  const mutation = useProfileMutation(); const router = useRouter();
  const [visibleRows, setVisibleRows] = useState(20);
  return <FinanceScreen title="Importar transações" subtitle="Revise seu CSV antes de confirmar. Nenhum dado é salvo na prévia.">
    <AppCard style={ui.card}><Text style={ui.heading}>Formato CSV</Text><Text selectable style={ui.caption}>tipo;valor;data_hora;descricao;categoria</Text><Text style={ui.caption}>UTF-8, separador ponto e vírgula, valor decimal com ponto, tipo RECEITA/DESPESA. Data: AAAA-MM-DDTHH:mm:ss (UTC). Até 5 MiB e 1000 registros.</Text></AppCard>
    <Action disabled={mutation.busy || uncertain} label={mutation.busy ? 'Processando…' : 'Selecionar arquivo'} onPress={() => { if (uncertain) return; return mutation.run(pickImport, result => { if (result) { setFile(result); setCreated(null); setDuplicates('no'); setUncertain(false); setVisibleRows(20); } }); }} />
    {file && created === null && <><Text style={ui.heading}>{file.name}</Text><AppCard style={ui.card}><Text style={ui.caption}>{file.preview.summary.totalRows} linhas · {file.preview.summary.validRows} válidas · {file.preview.summary.rejectedRows} rejeitadas</Text><Text style={ui.caption}>{file.preview.summary.withoutCategory} sem categoria · {file.preview.summary.possibleDuplicates} possíveis duplicatas</Text></AppCard>
      {file.preview.rows.slice(0, visibleRows).map(r => <AppCard key={r.rowNumber} style={ui.card}><View style={ui.split}><Text style={ui.heading}>Linha {r.rowNumber}</Text><Badge label={r.status === 'VALID' ? 'Válida' : 'Rejeitada'} tone={r.status === 'VALID' ? 'positive' : 'negative'} /></View><Text style={ui.heading}>{r.descricao}</Text><Text style={ui.amount}>{r.status === 'VALID' ? money(r.valor) : r.valor}</Text><Text style={ui.caption}>{r.dataHora}</Text><Text style={ui.caption}>{r.categoria.resolved ? `Categoria: ${r.categoria.input}` : 'Sem categoria reconhecida'}</Text>{r.possibleDuplicate && <Badge label="Possível duplicata" tone="warning" />}{r.errors.map((e, i) => <Notice key={i}>{e}</Notice>)}</AppCard>)}
      {visibleRows < file.preview.rows.length && <Action secondary label="Mostrar mais linhas da prévia" onPress={() => setVisibleRows(v => v + 20)} />}
      <Choices label="Autoriza importar possíveis duplicatas?" value={duplicates} onChange={setDuplicates} options={[{ value: 'no', label: 'Não autorizar' }, { value: 'yes', label: 'Sim, revisei e autorizo' }]} />
      <Text style={ui.caption}>Somente linhas válidas serão enviadas. O servidor verificará duplicatas novamente. A importação é confirmada como um lote.</Text>
      {!uncertain && <Action disabled={mutation.busy || file.preview.summary.validRows === 0 || (file.preview.summary.possibleDuplicates > 0 && duplicates !== 'yes')} label="Confirmar importação" onPress={() => { if (uncertain || !file.preview.summary.validRows || (file.preview.summary.possibleDuplicates > 0 && duplicates !== 'yes')) return; return mutation.run(async () => { try { return await confirmImport(file.preview, duplicates === 'yes'); } catch (e) { /* Evita repetição cega após resposta incerta. */ if (!(e instanceof Error && 'status' in e && e.status !== 0 && Number(e.status) < 500)) setUncertain(true); throw e; } }, result => { setCreated(result.created); setFile(null); }); }} />}
      {uncertain && <Notice>A resposta não confirmou o resultado. Consulte suas transações antes de selecionar e importar o arquivo novamente.</Notice>}
    </>}{created !== null && <AppCard style={ui.card}><Badge label="Importação concluída" tone="positive" /><Text accessibilityLiveRegion="polite" style={ui.heading}>{created} transações importadas.</Text><Text style={ui.caption}>Consulte seus lançamentos para conferir os registros criados.</Text></AppCard>}{!!mutation.error && <Notice>{mutation.error}</Notice>}
    <Action secondary label="Consultar transações" onPress={() => router.replace('/(tabs)/transacoes')} />
  </FinanceScreen>;
}
