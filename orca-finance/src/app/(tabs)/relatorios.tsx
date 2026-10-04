import { categoryPresentation } from '@/utils/category-presentation';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { IconChartBar, IconChevronRight, IconDownload, IconFileText, IconTable, IconCircle, IconCircleCheck, IconX } from '@tabler/icons-react-native';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { AsyncState } from '@/components/common/AsyncState';
import { MonthSelector } from '@/components/common/MonthSelector';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getApiSession } from '@/services/api-client';
import { saveExportFile } from '@/services/export-file.service';
import { useAppSession } from '@/contexts/AppSessionContext';
import { localDate, calendarPeriod } from '@/utils/date';
import { AppCard } from '@/components/common/AppCard';
import { generateFinancialExport, getReportData, type ReportWindowMonths } from '@/services/report.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';

const windowOptions: { value: ReportWindowMonths; label: string }[] = [
  { value: 1, label: 'Mês' },
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
];
const donutSize = 124;
const donutRadius = 47;
const circumference = 2 * Math.PI * donutRadius;

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export default function RelatoriosScreen() {
  const { activeProfileId } = useAppSession();
  return <ReportsContent key={activeProfileId} />;
}
function ReportsContent() {
  const [selectedMonth, setSelectedMonth] = useState(localDate().slice(0, 7));
  const [windowMonths, setWindowMonths] = useState<ReportWindowMonths>(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
  const [exportMessage, setExportMessage] = useState('');
  const effectiveMonth = selectedMonth;
  const resource = useProfileResource(useCallback(() => getReportData(effectiveMonth, windowMonths), [effectiveMonth, windowMonths]));
  const report = resource.data;
  const period = calendarPeriod(effectiveMonth, windowMonths);
  const mutation = useProfileMutation();

  let donutOffset = 0;
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.reload} />} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Relatórios</Text>
          <Text style={styles.subtitle}>Acompanhe seus gastos e entenda seus hábitos financeiros</Text>
        </View>
      </View>
      <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
      <View style={styles.periodRow}>
        {windowOptions.map((option) => <Pressable key={option.value}
          onPress={() => setWindowMonths(option.value)} style={[styles.periodButton,
            option.value === windowMonths && styles.periodButtonActive]}
          accessibilityRole="button" accessibilityState={{ selected: option.value === windowMonths }}>
          <Text style={[styles.periodText, option.value === windowMonths && styles.periodTextActive]}>
            {option.label}
          </Text>
        </Pressable>)}
      </View>

      <Text style={styles.caption}>Períodos agregados em UTC.</Text>
      {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
      {report && <>
      <AppCard style={styles.summaryCard}>
        <View style={styles.summaryText}>
          <Text style={styles.cardTitle}>Gastos no período</Text>
          <Text style={styles.total}>{formatCurrency(report.totalCents)}</Text>
          <Text style={styles.caption}>{dateLabel(period.startDate)} — {dateLabel(period.endDate)}</Text>
        </View>
        <View style={styles.summaryIcon}><IconChartBar size={28} color={colors.primary} /></View>
      </AppCard>

      <AppCard style={styles.chartCard}>
        <Text style={styles.cardTitle}>Gastos por categoria</Text>
        {report.totalCents === 0 ? <Text style={styles.emptyText}>Sem despesas efetivadas neste período.</Text>
          : <View style={styles.chartBody}>
            <View style={styles.donutWrapper} accessibilityLabel="Distribuição de gastos por categoria">
              <Svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                {report.categories.map((category) => {
                  const offset = donutOffset;
                  donutOffset += category.percentage * circumference;
                  return <Circle key={category.categoryId} cx={donutSize / 2} cy={donutSize / 2}
                    r={donutRadius} fill="none" stroke={categoryPresentation(category.categoryName).chart}
                    strokeWidth={18} strokeDasharray={`${category.percentage * circumference} ${circumference}`}
                    strokeDashoffset={-offset} rotation={-90} originX={donutSize / 2} originY={donutSize / 2} />;
                })}
              </Svg>
              <View style={styles.donutCenter} pointerEvents="none">
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.donutTotal}>
                  {formatCurrency(report.totalCents)}
                </Text>
                <Text style={styles.donutCaption}>no período</Text>
              </View>
            </View>
            <View style={styles.legend}>
              {report.categories.map((category) => <View key={category.categoryId} style={styles.legendRow}>
                <CategoryIcon name={category.categoryName} size={16} />
                <View style={[styles.legendDot,
                  { backgroundColor: categoryPresentation(category.categoryName).chart }]} />
                <Text numberOfLines={1} style={styles.legendName}>{category.categoryName}</Text>
                <Text style={styles.legendValue}>{formatCurrency(category.amountCents)}</Text>
                <Text style={styles.legendPercentage}>{Math.round(category.percentage * 100)}%</Text>
              </View>)}
            </View>
          </View>}
      </AppCard>

      <AppCard style={styles.distributionCard}>
        <Text style={styles.cardTitle}>Distribuição</Text>
        {report.totalCents === 0 ? <Text style={styles.emptyText}>Sem dados para distribuir.</Text>
          : report.categories.map((category) => <View key={category.categoryId} style={styles.barRow}>
            <CategoryIcon name={category.categoryName} size={18} /><Text style={styles.barName}>{category.categoryName}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, {
              width: `${category.percentage * 100}%`,
              backgroundColor: categoryPresentation(category.categoryName).chart,
            }]} /></View>
            <Text style={styles.barPercentage}>{Math.round(category.percentage * 100)}%</Text>
          </View>)}
      </AppCard>

      <Pressable onPress={() => { setExportMessage(''); setExportOpen(true); }}
        style={styles.exportCard} accessibilityRole="button" accessibilityLabel="Exportar dados">
        <View style={styles.exportIcon}><IconDownload size={23} color={colors.primary} /></View>
        <View style={styles.exportText}><Text style={styles.exportTitle}>Exportar dados</Text>
          <Text style={styles.caption}>CSV ou Excel</Text></View>
        <IconChevronRight size={21} color={colors.textSecondary} />
      </Pressable>
      </>}
    </ScrollView>

    <Modal visible={exportOpen} transparent animationType="slide"
      onRequestClose={() => { if (!mutation.busy) setExportOpen(false); }}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={() => { if (!mutation.busy) setExportOpen(false); }}
          accessibilityLabel="Fechar exportação" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Exportar dados</Text>
            <Pressable onPress={() => { if (!mutation.busy) setExportOpen(false); }} accessibilityRole="button"
              accessibilityLabel="Fechar"><IconX size={22} color={colors.textSecondary} /></Pressable></View>
          <Text style={styles.sheetHint}>Escolha o formato do arquivo.</Text>
          <View style={styles.formatRow}>
            {(['csv', 'excel'] as const).map((format) => <Pressable key={format}
              disabled={mutation.busy} onPress={() => { setExportFormat(format); setExportMessage(''); }}
              style={[styles.formatButton, exportFormat === format && styles.formatSelected]}
              accessibilityLabel={format === 'csv' ? 'CSV' : 'Excel'} accessibilityRole="radio" accessibilityState={{ selected: exportFormat === format }}>
              <View style={styles.exportIcon}>{format === 'csv' ? <IconFileText color={colors.primary} /> : <IconTable color={colors.textSecondary} />}</View>
              <View style={styles.exportText}><Text style={[styles.formatText, exportFormat === format && styles.formatTextSelected]}>{format === 'csv' ? 'CSV' : 'Excel'}</Text><Text style={styles.sheetHint}>{format === 'csv' ? 'Dados separados por vírgulas.' : 'Planilha no formato XLSX.'}</Text></View>
              {exportFormat === format ? <IconCircleCheck color={colors.primary} /> : <IconCircle color={colors.border} />}
            </Pressable>)}
          </View>
          <Text style={styles.sheetLabel}>Período</Text>
          <Text style={styles.sheetPeriod}>{dateLabel(period.startDate)} — {dateLabel(period.endDate)}</Text>
          <Text style={styles.sheetHint}>Para alterar o período, use os controles do relatório.</Text>
          {!!exportMessage && <Text accessibilityRole="alert" style={styles.sheetHint}>{exportMessage}</Text>}
          {!!mutation.error && <Text accessibilityRole="alert" style={styles.unavailable}>{mutation.error}</Text>}
          <Pressable disabled={mutation.busy} onPress={() => {
            const revision = getApiSession().revision;
            setExportMessage('');
            void mutation.run(async () => {
              const file = await generateFinancialExport(exportFormat, effectiveMonth, windowMonths);
              return saveExportFile(file, revision);
            }, saved => setExportMessage(saved ? 'Arquivo salvo na pasta escolhida.' : 'Seleção de pasta cancelada.'));
          }} style={styles.exportButton}
            accessibilityRole="button"><Text style={styles.exportButtonText}>{mutation.busy ? 'Exportando…' : 'Exportar'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={mutation.busy} onPress={() => setExportOpen(false)} style={styles.cancelExport}><Text style={styles.formatTextSelected}>Cancelar</Text></Pressable>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 28, gap: spacing.lg },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.border, marginTop: spacing.sm, marginBottom: spacing.sm },
  header: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  headerText: { flex: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: 29, color: colors.textPrimary },
  subtitle: { marginTop: spacing.xs, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, lineHeight: 20, color: colors.textSecondary },
  monthButton: { minHeight: 42, paddingHorizontal: spacing.sm, gap: 4, flexDirection: 'row',
    alignItems: 'center', borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.input, backgroundColor: colors.surface },
  monthButtonText: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textSecondary },
  monthPicker: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.card,
    backgroundColor: colors.surface, overflow: 'hidden' },
  monthOption: { minHeight: 42, paddingHorizontal: spacing.lg, justifyContent: 'center',
    borderBottomWidth: 0.5, borderBottomColor: colors.border },
  monthOptionText: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textPrimary },
  selectedMonthText: { color: colors.primary },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodButton: { minHeight: 38, paddingHorizontal: spacing.lg, justifyContent: 'center',
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.pill,
    backgroundColor: colors.surface },
  periodButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textSecondary },
  periodTextActive: { color: colors.surface },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryText: { flex: 1 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title,
    color: colors.textPrimary },
  total: { marginTop: spacing.sm, fontFamily: fontFamily.bold, fontSize: fontSize.display,
    color: colors.textPrimary },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.body,
    color: colors.textSecondary },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryTint },
  chartCard: { gap: spacing.lg },
  chartBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  donutWrapper: { width: donutSize, height: donutSize, justifyContent: 'center',
    alignItems: 'center' },
  donutCenter: { position: 'absolute', width: 87, alignItems: 'center' },
  donutTotal: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  donutCaption: { fontFamily: fontFamily.regular, fontSize: fontSize.caption,
    color: colors.textSecondary },
  legend: { flex: 1, minWidth: 0, gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  legendName: { flex: 1, minWidth: 0, fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  legendValue: { fontFamily: fontFamily.medium, fontSize: fontSize.caption,
    color: colors.textPrimary },
  legendPercentage: { width: 29, textAlign: 'right', fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  distributionCard: { gap: spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barName: { width: 82, fontFamily: fontFamily.regular, fontSize: fontSize.caption,
    color: colors.textSecondary },
  barTrack: { flex: 1, height: 9, borderRadius: radius.pill,
    backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  barPercentage: { width: 32, textAlign: 'right', fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  emptyText: { fontFamily: fontFamily.regular, fontSize: fontSize.body,
    color: colors.textSecondary },
  exportCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    padding: spacing.lg, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.card, backgroundColor: colors.surface },
  exportIcon: { width: 42, height: 42, borderRadius: radius.icon,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryTint },
  exportText: { flex: 1 },
  exportTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title,
    color: colors.textPrimary },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16, 32, 46, 0.38)' },
  sheet: { padding: spacing.lg, paddingBottom: 28, gap: spacing.md,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface },
  sheetHandle: { alignSelf: 'center', width: 44, height: 4, marginBottom: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title,
    color: colors.textPrimary },
  sheetLabel: { marginTop: spacing.sm, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textPrimary },
  formatRow: { gap: spacing.sm },
  formatButton: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, minHeight: 72, alignItems: 'center',
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.input },
  formatSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  formatText: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textSecondary },
  formatTextSelected: { color: colors.primary },
  cancelExport: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sheetPeriod: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textPrimary },
  sheetHint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption,
    color: colors.textSecondary },
  unavailable: { fontFamily: fontFamily.regular, fontSize: fontSize.body,
    color: colors.negative },
  exportButton: { minHeight: 46, marginTop: spacing.sm, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  exportButtonText: { fontFamily: fontFamily.bold, fontSize: fontSize.body,
    color: colors.surface },
});
