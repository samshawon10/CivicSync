import { searchForUser, suggestForUser } from '../services/civicSearch.js';
import { searchCategories, visibleCategories } from '../services/civicSearchScope.js';

/** Accepts `?categories=cases,alerts` or repeated `?categories=`. */
const toList = (value) => {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return items.map((item) => String(item).trim()).filter(Boolean);
};

/**
 * Global CivicSearch. Every authenticated role searches through this one
 * endpoint; the authorized category set is resolved server-side from the role
 * (services/civicSearchScope.js), so an unauthorized category can never be
 * requested into existence.
 */
export async function globalSearch(req, res, next) {
  try {
    const result = await searchForUser({
      user: req.user,
      query: req.query.q,
      categories: toList(req.query.categories),
      limit: req.query.limit
    });
    res.json({ success: true, ...result, available: visibleCategories(req.user) });
  } catch (error) { next(error); }
}

/** Type-ahead suggestions (titles only) for the search overlay. */
export async function searchSuggest(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ success: true, query, suggestions: [] });
    res.json({ success: true, query, suggestions: await suggestForUser({ user: req.user, query }) });
  } catch (error) { next(error); }
}

/** The category chips/filters this role is allowed to use. */
export async function listSearchCategories(req, res, next) {
  try {
    const categories = visibleCategories(req.user).map((key) => ({
      key,
      label: searchCategories[key].label,
      icon: searchCategories[key].icon
    }));
    res.json({ success: true, categories });
  } catch (error) { next(error); }
}
