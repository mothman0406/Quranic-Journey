import { Router, type IRouter } from "express";
import {
  DUA_CATEGORIES,
  getCategoryBySlug,
  getDuasByCategory,
  getRandomDua,
  type Dua,
} from "../data/duas.js";

const router: IRouter = Router();

function getAllDuas(): Dua[] {
  return DUA_CATEGORIES.flatMap((category) => getDuasByCategory(category.slug));
}

router.get("/duas/categories", (_req, res) => {
  const categories = [...DUA_CATEGORIES]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((category) => ({
      ...category,
      duaCount: getDuasByCategory(category.slug).length,
    }));

  res.json({ categories });
});

router.get("/duas/categories/:slug", (req, res) => {
  const category = getCategoryBySlug(req.params.slug);
  if (!category) {
    res.status(404).json({ error: "Dua category not found" });
    return;
  }

  res.json({ category, duas: getDuasByCategory(category.slug) });
});

router.get("/duas/random", (req, res) => {
  const categorySlug = typeof req.query.categorySlug === "string"
    ? req.query.categorySlug
    : undefined;

  if (categorySlug && !getCategoryBySlug(categorySlug)) {
    res.status(404).json({ error: "Dua category not found" });
    return;
  }

  const dua = getRandomDua(categorySlug);
  if (!dua) {
    res.status(404).json({ error: "Dua not found" });
    return;
  }

  res.json({ dua });
});

router.get("/duas/:id", (req, res) => {
  const id = Number(req.params.id);
  const dua = Number.isInteger(id) ? getAllDuas().find((item) => item.id === id) : undefined;
  if (!dua) {
    res.status(404).json({ error: "Dua not found" });
    return;
  }

  res.json({ dua });
});

export default router;
