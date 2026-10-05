import { useState } from 'react';
import { SubcategoryModal } from '@/components/domain/SubcategoryModal';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { createRemoteSubcategory, type CatalogCategory, type CatalogSubcategory } from '@/services/category.service';

export function CreateSubcategoryModal({ category, onCreated, onClose }: {
  category: CatalogCategory; onCreated: (item: CatalogSubcategory) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  const mutation = useProfileMutation();
  function save() {
    if (!name.trim()) { setValidation('Informe o nome da subcategoria.'); return; }
    if (!category.active) return;
    setValidation('');
    void mutation.run(() => createRemoteSubcategory(category.id, name), onCreated);
  }
  return <SubcategoryModal visible editing={false} active onActiveChange={() => {}}
    categoryName={category.name} name={name} onNameChange={value => { setName(value); setValidation(''); }}
    busy={mutation.busy} error={validation || mutation.error} onSave={save}
    onClose={() => { if (!mutation.busy) onClose(); }} />;
}
