import type { AvatarId } from "./avatars";
export type Nutrient =
  | "calories_kcal"
  | "protein_g"
  | "carbohydrate_g"
  | "total_fat_g"
  | "fiber_g"
  | "sugar_g"
  | "sodium_mg"
  | "saturated_fat_g";
export type Nutrition = Record<Nutrient, number | null>;
export type NutritionField = Nutrient | "trans_fat_g" | "cholesterol_mg";
export type NutritionFacts = Record<
  string,
  { value: string; unit: string; label: string }
>;
export type NutritionEstimate = {
  nutrients: NutritionFacts;
  serving?: string;
  bounded?: boolean;
  reference_fl_oz?: number;
  note: string;
  sources: { name: string; url: string; grams?: number; note?: string }[];
};
export type Food = Nutrition & {
  id: string;
  food_item_id: string;
  name: string;
  description: string | null;
  ingredients_text: string | null;
  serving_description: string | null;
  dietary_tags: string[];
  source_recipe_ids?: string[];
  allergen_tags: string[];
  allergen_information_available: boolean;
  nutrition_source: string;
  trans_fat_g?: number | null;
  cholesterol_mg?: number | null;
  incomplete_nutrients?: NutritionField[];
  source_url: string;
  captured_at: string;
  published_nutrition: NutritionFacts;
  estimated_nutrition?: NutritionEstimate | null;
};
export type Cafe = {
  id: string;
  name: string;
  source_key: string;
  timezone: string;
  source_url: string;
};
export type Station = {
  id: string;
  cafe_id: string;
  name: string;
  source_key: string;
};
export type StationExtra = { source_id: string; name: string; section: string };
export type Service = {
  closure_message?: string | null;
  station_extras?: Partial<Record<string, StationExtra[]>>;
  id: string;
  cafe_id: string;
  name: string;
  service_date: string;
  starts_at: string | null;
  ends_at: string | null;
  last_successful_sync_at: string | null;
  status: string;
};
export type ServingOption = {
  label: string;
  price?: number;
  portion?: string;
  published_serving?: boolean;
};
export type MenuOption = {
  key: string;
  label: string;
  component_id?: string;
  price?: number;
  default?: boolean;
  observed_unavailable_on?: string;
};
export type ModifierGroup = {
  name: string;
  min?: number;
  max?: number;
  options: MenuOption[];
};
export type MenuSelection = {
  offering_id: string;
  size?: string;
  choices: string[];
};
export type SavedMenuSelection = Omit<MenuSelection, "choices"> & {
  choices: { group: string; label: string }[];
};
export type Offering = {
  id: string;
  cafe_id: string;
  menu_service_id: string;
  station_id: string | null;
  food_version_id: string;
  is_listed: boolean;
  sort_order: number;
  price: number | null;
  menu_section?: string | null;
  menu_source_url?: string | null;
  source_occurrence_key?: string;
  serving_options?: ServingOption[];
  modifier_groups?: ModifierGroup[];
};
export type Component = {
  id: string;
  component_key: string;
  name: string;
  published_serving_candidates: unknown[];
  estimated_nutrition?: NutritionEstimate | null;
};
export type ComponentLink = {
  food_version_id: string;
  component_id: string;
  position: number;
  display_label: string;
  choice_group: string | null;
};
export type Catalog = {
  cafes: Cafe[];
  foods: Food[];
  stations: Station[];
  services: Service[];
  offerings: Offering[];
  components: Component[];
  links: ComponentLink[];
  images: {
    key: string;
    foodId: string | null;
    componentId: string | null;
    path: string | null;
  }[];
};
export type Meal = "Breakfast" | "Lunch" | "Dinner" | "Dessert" | "Snack";
export type FoodLog = {
  id: string;
  user_id: string;
  food_version_id: string;
  servings: number;
  eaten_at: string;
  local_date: string;
  meal_label: string;
  food: Food;
  menu_selection?: SavedMenuSelection | null;
};
export type Eating = {
  id: string;
  user_id: string;
  food_item_id: string;
  log_id: string | null;
  eaten_at: string;
  meal_label: string;
};
export type Review = {
  id: string;
  user_id: string;
  food_item_id: string;
  eating_id: string | null;
  stars: number;
  comment: string | null;
  eaten_at: string;
  meal_label: string;
  created_at: string;
  updated_at: string;
  display_name: string;
  avatar_id?: AvatarId;
  karma: number;
  upvotes: number;
  downvotes: number;
  score: number;
};
export type Goals = Partial<Record<Nutrient, number>>;
export type Profile = {
  display_name: string;
  avatar_id: AvatarId;
  goals: Goals;
  goals_initialized?: boolean;
  dietary: string[];
  starred_kitchens?: string[];
  haptics: boolean;
};
export type ReviewSubmission = {
  user_id: string;
  food_item_id: string;
  review_id: string | null;
  submitted_at: string;
};
export type AppData = {
  submissions: ReviewSubmission[];
  logs: FoodLog[];
  history: Eating[];
  favorites: string[]; // Legacy bookmarks retained for data export; UI uses review history.
  reviews: Review[];
  votes: Record<string, number>;
  profile: Profile;
};
