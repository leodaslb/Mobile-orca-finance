import { IconBook, IconCar, IconHeart, IconHome, IconMovie, IconShoppingCart, IconTag, IconWallet } from '@tabler/icons-react-native';
import { colors } from '@/theme';

const catalog = {
  'moradia': { icon: IconHome, background: colors.categories.housing.background, color: colors.categories.housing.icon, chart: colors.chart.housing },
  'transporte': { icon: IconCar, background: colors.categories.transport.background, color: colors.categories.transport.icon, chart: colors.chart.transport },
  'alimentação': { icon: IconShoppingCart, background: colors.categories.food.background, color: colors.categories.food.icon, chart: colors.chart.food },
  'lazer e estilo de vida': { icon: IconMovie, background: colors.categories.leisure.background, color: colors.categories.leisure.icon, chart: colors.chart.leisure },
  'saúde e autocuidado': { icon: IconHeart, background: colors.positiveTint, color: colors.positive, chart: colors.positive },
  'educação e carreira': { icon: IconBook, background: colors.primaryTint, color: colors.primary, chart: colors.brand },
  'rendas e investimentos': { icon: IconWallet, background: colors.positiveTint, color: colors.positive, chart: colors.warning },
};
const fallback = { icon: IconTag, background: colors.background, color: colors.textSecondary, chart: colors.chart.other };

// A identidade visual depende do nome do catálogo, nunca do UUID nem de um campo no banco.
export function categoryPresentation(name: string) {
  const key = name.normalize('NFC').trim().toLocaleLowerCase('pt-BR');
  const item = catalog[key as keyof typeof catalog];
  return item ?? fallback;
}
