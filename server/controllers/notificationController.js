import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

export async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
  } catch (error) { next(error); }
}
export async function markRead(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Notification not found.' });
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { readAt: new Date() }, { new: true });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, notification });
  } catch (error) { next(error); }
}
export async function markAllRead(req, res, next) {
  try { await Notification.updateMany({ recipient: req.user._id, readAt: null }, { readAt: new Date() }); res.json({ success: true }); } catch (error) { next(error); }
}
export async function deleteNotification(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Notification not found.' });
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) { next(error); }
}
