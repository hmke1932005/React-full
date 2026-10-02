// Shared strings reused across many admin/list pages — table headers, loading
// and empty states, pagination, and generic row actions. Merged into each
// page's own dict (page-specific keys always win on conflict) rather than
// imported separately, to keep every page's useTranslations(dict) call
// working off a single flat object.
export default {
  'Name': 'الاسم',
  'Email': 'البريد الإلكتروني',
  'Role': 'الدور',
  'Status': 'الحالة',
  'Joined': 'تاريخ الانضمام',
  'Action': 'الإجراء',
  'Active': 'نشط',
  'Suspended': 'موقوف',
  'Pending': 'قيد الانتظار',
  'Banned': 'محظور',
  'Activate': 'تفعيل',
  'Suspend': 'إيقاف',
  'Edit': 'تعديل',
  'Delete': 'حذف',
  'Save': 'حفظ',
  'Cancel': 'إلغاء',
  'Search': 'بحث',
  'All Roles': 'كل الأدوار',
  'All Statuses': 'كل الحالات',
  'Loading…': 'جارٍ التحميل…',
};
