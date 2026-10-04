import { categoryPresentation } from '@/utils/category-presentation';

export function CategoryIcon({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  const appearance = categoryPresentation(name);
  const Icon = appearance.icon;
  return <Icon size={size} color={color ?? appearance.color} strokeWidth={2} accessibilityLabel={`Categoria ${name || 'não selecionada'}`} />;
}
