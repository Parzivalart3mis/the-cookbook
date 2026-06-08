import { getAllRecipes } from '@/lib/notion';
import MealPlanClient from './MealPlanClient';

export const metadata = { title: 'Meal Planner — The Cookbook' };
export const revalidate = 60;

export default async function MealPlanPage() {
  const recipes = await getAllRecipes();
  return <MealPlanClient allRecipes={recipes} />;
}
