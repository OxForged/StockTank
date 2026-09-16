export interface CategoryGroup {
  readonly group: string;
  readonly categories: readonly string[];
}

export interface CategoriesResponse {
  readonly groups: readonly CategoryGroup[];
}

export interface InterestsResponse {
  readonly interests: readonly string[];
}
