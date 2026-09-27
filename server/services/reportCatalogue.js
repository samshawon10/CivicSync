import mongoose from 'mongoose';
import ReportCategory from '../models/ReportCategory.js';
import Department from '../models/Department.js';
import SystemSetting from '../models/SystemSetting.js';
import {
  reportCategories,
  reportDepartments,
  defaultReportCategories,
  defaultReportDepartments
} from '../config/reportOptions.js';

const SEED_KEY = 'reportCatalogueSeed';

/** Active categories in display order. Empty when nothing is configured. */
export async function activeReportCategories() {
  return ReportCategory.find({ active: true }).sort({ order: 1, label: 1 }).lean();
}

/** Every category, active or not — admin view. */
export async function allReportCategories() {
  return ReportCategory.find().sort({ order: 1, label: 1 }).lean();
}

export async function reportCategoryCatalogue() {
  const [categories, departments] = await Promise.all([
    activeReportCategories(),
    Department.find({ status: 'active' }).select('name').lean()
  ]);
  const activeNames = new Set(departments.map((department) => department.name));
  return categories.map((category) => ({
    key: category.key,
    label: category.label,
    description: category.description,
    order: category.order,
    defaultDepartment: category.defaultDepartment,
    departmentAvailable: activeNames.has(category.defaultDepartment)
  }));
}

export async function isReportCategory(key) {
  const value = String(key || '').trim();
  if (!value) return false;
  if (await ReportCategory.exists({ key: value, active: true })) return true;
  const total = await ReportCategory.countDocuments();
  return total === 0 && reportCategories.includes(value);
}

export async function isReportDepartment(name) {
  const value = String(name || '').trim();
  if (!value) return false;
  if (await Department.exists({ name: value, status: 'active' })) return true;
  const total = await Department.countDocuments({ status: 'active' });
  return total === 0 && reportDepartments.includes(value);
}

/** Default department for a category, used to pre-fill the citizen form. */
export async function defaultDepartmentFor(key) {
  const category = await ReportCategory.findOne({ key: String(key || '').trim() }).lean();
  return category?.defaultDepartment || '';
}

export async function seedReportCatalogue({ force = false } = {}) {
  if (!force && await SystemSetting.exists({ key: SEED_KEY })) {
    return { seeded: false, categories: 0, departments: 0 };
  }

  const existingDepartments = new Set(
    (await Department.find().select('name').lean()).map((department) => department.name)
  );
  const missingDepartments = defaultReportDepartments.filter(
    (department) => !existingDepartments.has(department.name)
  );
  if (missingDepartments.length) await Department.insertMany(missingDepartments, { ordered: false });

  const existingCategories = new Set(
    (await ReportCategory.find().select('key').lean()).map((category) => category.key)
  );
  const missingCategories = defaultReportCategories.filter(
    (category) => !existingCategories.has(category.key)
  );
  if (missingCategories.length) await ReportCategory.insertMany(missingCategories, { ordered: false });

  await SystemSetting.findOneAndUpdate(
    { key: SEED_KEY },
    { $set: { value: { version: 1, at: new Date() } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    seeded: true,
    categories: missingCategories.length,
    departments: missingDepartments.length
  };
}

export async function restoreReportCatalogue() {
  const result = await seedReportCatalogue({ force: true });
  return {
    categoriesRestored: result.categories,
    departmentsRestored: result.departments
  };
}

export function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}