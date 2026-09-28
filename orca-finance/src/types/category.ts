export interface Category {
  id: string;
  name: string;
}

export interface Subcategory {
  id: string;
  profileId: string;
  categoryId: string;
  name: string;
}