import ReportCategory from '../models/ReportCategory.js';
import Department from '../models/Department.js';
import Report from '../models/Report.js';
import ActivityLog from '../models/ActivityLog.js';
import { emitDepartmentEvent } from '../realtime/emergencyRealtime.js';
import { reportCategoryEvents } from '../config/reportOptions.js';
import {
  allReportCategories,
  isValidObjectId,
  reportCategoryCatalogue,
  restoreReportCatalogue
} from '../services/reportCatalogue.js';

const clean = (value, max) => String(value || '').trim().slice(0, max);

async function log(admin, action, targetType, targetId, targetName, description) {
  try {
    await ActivityLog.create({
      admin: admin._id,
      actorRole: admin.role,
      action,
      targetType,
      targetId,
      targetName,
      description,
      result: 'success'
    });
  } catch {
    /* auditing must never block the catalogue change itself */
  }
}

/** Every client that shows a category picker re-fetches on this event. */
function announce(event, category) {
  emitDepartmentEvent(event, {
    categoryId: category?._id,
    key: category?.key,
    label: category?.label,
    defaultDepartment: category?.defaultDepartment,
    active: category?.active
  }, { roles: ['admin', 'citizen', 'department_head', 'department_officer', 'officer', 'field_worker'] });
}

export async function listReportCategories(req, res, next) {
  try {
    return res.json({ success: true, categories: await reportCategoryCatalogue() });
  } catch (error) { next(error); }
}

/** Admin view: every category, including retired ones, with usage counts. */
export async function listManagedReportCategories(req, res, next) {
  try {
    const [categories, usage] = await Promise.all([
      allReportCategories(),
      Report.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
    ]);
    const usageByKey = Object.fromEntries(usage.map((row) => [row._id, row.count]));
    return res.json({
      success: true,
      categories: categories.map((category) => ({
        ...category,
        reportCount: usageByKey[category.key] || 0
      }))
    });
  } catch (error) { next(error); }
}

export async function createReportCategory(req, res, next) {
  try {
    const key = clean(req.body.key, 60).toLowerCase();
    const label = clean(req.body.label, 80);
    if (!/^[a-z0-9_]+$/.test(key)) {
      return res.status(400).json({ success: false, message: 'Key may only use lowercase letters, numbers and underscores.' });
    }
    if (!label) return res.status(400).json({ success: false, message: 'A display label is required.' });
    if (await ReportCategory.exists({ key })) {
      return res.status(409).json({ success: false, message: `A category with the key “${key}” already exists.` });
    }
    const defaultDepartment = clean(req.body.defaultDepartment, 120);
    if (defaultDepartment && !(await Department.exists({ name: defaultDepartment }))) {
      return res.status(400).json({ success: false, message: `No department named “${defaultDepartment}” exists.` });
    }
    const category = await ReportCategory.create({
      key,
      label,
      description: clean(req.body.description, 300),
      defaultDepartment,
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 500,
      active: req.body.active !== false,
      createdBy: req.user._id
    });
    await log(req.user, 'report_category_created', 'report_category', category._id, category.label, `Report category “${category.label}” created and pushed live to citizen forms.`);
    announce(reportCategoryEvents.created, category);
    return res.status(201).json({ success: true, message: `Category “${category.label}” created.`, category });
  } catch (error) { next(error); }
}

export async function updateReportCategory(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found.' });
    const category = await ReportCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

    if (req.body.label !== undefined) {
      const label = clean(req.body.label, 80);
      if (!label) return res.status(400).json({ success: false, message: 'A display label is required.' });
      category.label = label;
    }
    if (req.body.description !== undefined) category.description = clean(req.body.description, 300);
    if (req.body.order !== undefined && Number.isFinite(Number(req.body.order))) category.order = Number(req.body.order);
    if (req.body.active !== undefined) category.active = Boolean(req.body.active);
    if (req.body.defaultDepartment !== undefined) {
      const defaultDepartment = clean(req.body.defaultDepartment, 120);
      if (defaultDepartment && !(await Department.exists({ name: defaultDepartment }))) {
        return res.status(400).json({ success: false, message: `No department named “${defaultDepartment}” exists.` });
      }
      category.defaultDepartment = defaultDepartment;
    }
    await category.save();
    await log(req.user, 'report_category_updated', 'report_category', category._id, category.label, `Report category “${category.label}” updated.`);
    announce(reportCategoryEvents.updated, category);
    return res.json({ success: true, message: `Category “${category.label}” updated.`, category });
  } catch (error) { next(error); }
}

export async function deleteReportCategory(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found.' });
    const category = await ReportCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    const reportCount = await Report.countDocuments({ category: category.key });
    if (reportCount) {
      category.active = false;
      await category.save();
      await log(req.user, 'report_category_retired', 'report_category', category._id, category.label, `Report category “${category.label}” retired; ${reportCount} report(s) keep their history.`);
      announce(reportCategoryEvents.updated, category);
      return res.json({
        success: true,
        retired: true,
        message: `“${category.label}” is used by ${reportCount} report(s), so it was hidden from new reports instead of deleted.`
      });
    }
    await category.deleteOne();
    await log(req.user, 'report_category_deleted', 'report_category', category._id, category.label, `Report category “${category.label}” deleted.`);
    announce(reportCategoryEvents.deleted, category);
    return res.json({ success: true, message: `Category “${category.label}” deleted.` });
  } catch (error) { next(error); }
}

/** Re-adds any default category or department that is currently missing. */
export async function restoreDefaultReportCategories(req, res, next) {
  try {
    const restored = await restoreReportCatalogue();
    await log(req.user, 'report_catalogue_restored', 'report_category', null, 'Default catalogue', `Restored ${restored.categoriesRestored} categor(y/ies) and ${restored.departmentsRestored} department(s).`);
    announce(reportCategoryEvents.restored, null);
    return res.json({
      success: true,
      message: restored.categoriesRestored || restored.departmentsRestored
        ? `Restored ${restored.categoriesRestored} categor(y/ies) and ${restored.departmentsRestored} department(s).`
        : 'Every default category and department is already present.',
      ...restored
    });
  } catch (error) { next(error); }
}

