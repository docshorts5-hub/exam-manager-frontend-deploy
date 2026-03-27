import type { Lang } from "./I18nProvider";

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsArabic(input: string) {
  return /[\u0600-\u06FF]/.test(String(input || ""));
}

function normalize(input: string) {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EXACT_AR_TO_EN: Record<string, string> = {
  "جاري التحميل...": "Loading...",
  "هل تريد تسجيل الخروج؟": "Do you want to sign out?",
  "🛠 وضع الدعم": "🛠 Support Mode",
  "👤 مستخدم": "👤 User",
  "نظام إدارة الامتحانات المطور": "Advanced Exam Management System",
  "نظام الامتحانات المدرسية المطور": "Enhanced School Exam System",
  "تسجيل دخول أمن للمستخدمين المصرح لهم فقط": "Secure login for authorized users only",
  "سلطنة عمان - وزارة التعليم": "Sultanate of Oman - Ministry of Education",
  "Google تسجيل الدخول بواسطة": "Sign in with Google",
  "تم تسجيل الدخول:": "Signed in as:",
  "الحالة:": "Status:",
  "مفعّل ✅": "Enabled ✅",
  "غير مفعّل": "Disabled",
  "الجهة:": "Tenant:",
  "الصلاحية:": "Role:",
  "جاري المعالجة...": "Processing...",
  "الانتقال للنظام": "Go to App",
  "المطور المعتمد": "Certified Developer",
  "الأستاذ: يوسف النعماني": "Mr. Youssef Al-Numani",
  "العربية": "Arabic",
  "شعار النظام": "System Logo",
  "لوحة التحكم": "Dashboard",
  "المعلمين": "Teachers",
  "الكادر التعليمي": "Teaching Staff",
  "عدم التوفر": "Unavailability",
  "الغياب": "Absence",
  "القاعات": "Rooms",
  "حجز القاعات": "Room Blocks",
  "الامتحانات": "Exams",
  "التوزيع": "Distribution",
  "توزيع المهام": "Task Distribution",
  "تشغيل التوزيع": "Run Distribution",
  "نتائج التوزيع": "Distribution Results",
  "إصدارات واعتماد التوزيع": "Distribution Versions & Approval",
  "طباعة التوزيع": "Print Distribution",
  "أرشيف التوزيعات": "Distribution Archive",
  "التقارير": "Reports",
  "التقارير والكشوفات": "Reports & Sheets",
  "الأرشيف": "Archive",
  "المزامنة": "Sync",
  "الإعدادات": "Settings",
  "السجلات": "Logs",
  "سجل النشاط": "Activity Log",
  "سجل الأنشطة": "Activity Logs",
  "قاعدة البيانات": "Database",
  "ترحيل البيانات": "Data Migration",
  "منصة المالك": "Owner Portal",
  "وزارة التعليم": "Ministry of Education",
  "الوزارة": "Ministry",
  "وضع دعم مالك المنصة:": "Platform Owner Support Mode:",
  "وضع الدعم:": "Support Mode:",
  "الجهة الحالية": "Current Tenant",
  "المتبقي": "Remaining",
  "الجهة الفعلية": "Actual Tenant",
  "دعم فني": "Technical Support",
  "تعذر تفعيل الدعم": "Failed to enable support",
  "تفعيل الدعم": "Enable Support",
  "إلغاء الدعم": "Disable Support",
  "الرجوع إلى بوابة السوبر": "Back to Super Portal",
  "رجوع": "Back",
  "غير مُفعّل": "Disabled",
  "— اختر —": "— Select —",
  "اختر...": "Select...",
  "اختر": "Select",
  "إضافة": "Add",
  "إضافة جديد": "Add New",
  "حفظ": "Save",
  "حفظ التغييرات": "Save Changes",
  "تعديل": "Edit",
  "حذف": "Delete",
  "تطبيق التعديل": "Apply Changes",
  "إلغاء": "Cancel",
  "إغلاق": "Close",
  "فتح": "Open",
  "بحث": "Search",
  "بحث...": "Search...",
  "مسح": "Clear",
  "مسح البحث": "Clear Search",
  "مسح الاختيارات": "Clear Selection",
  "تحديث": "Refresh",
  "إعادة تحميل البيانات": "Reload Data",
  "إظهار": "Show",
  "إخفاء": "Hide",
  "ملء الشاشة": "Fullscreen",
  "إغلاق ملء الشاشة": "Exit Fullscreen",
  "الاسم": "Name",
  "اسم المستخدم": "User Name",
  "اسم المدرسة": "School Name",
  "المدرسة": "School",
  "المحافظة": "Governorate",
  "المحافظة / المديرية": "Governorate / Directorate",
  "المحافظة / المديرية ...": "Governorate / Directorate ...",
  "المدرسة ...": "School ...",
  "الفصل الدراسي": "Semester",
  "الفصل الدراسي الأول": "First Semester",
  "الفصل الدراسي الثاني": "Second Semester",
  "رقم الهاتف": "Phone Number",
  "العنوان": "Address",
  "بيانات المدرسة": "School Profile",
  "مكتبة الصور": "Gallery",
  "مصمم البرنامج": "About Developer",
  "المستخدم:": "User:",
  "الوقت": "Time",
  "التاريخ": "Date",
  "اليوم": "Day",
  "المادة": "Subject",
  "الفترة": "Period",
  "المطلوب": "Required",
  "المجموع": "Total",
  "المدة": "Duration",
  "عدد القاعات": "Room Count",
  "مراقبين/قاعة": "Invigilators/Room",
  "عدد المراقبين": "Invigilators Count",
  "عدد الاحتياط": "Reserve Count",
  "التغطية %": "Coverage %",
  "العجز": "Shortage",
  "عجز بدون احتياط": "Shortage Without Reserve",
  "المجموع (م+ا)": "Total (Inv+Res)",
  "المجموع (م+ا+م+ت)": "Total",
  "الاحتياط اليومي": "Daily Reserve",
  "حد أيام التصحيح": "Correction Days Limit",
  "الحد الأقصى للمهام": "Max Tasks",
  "مراقبة": "Invigilation",
  "احتياط": "Reserve",
  "مراجعة": "Review",
  "تصحيح": "Correction",
  "مهمة": "Task",
  "فاضي للمراجعة": "Free for Review",
  "فاضي للتصحيح": "Free for Correction",
  "فارغ": "Empty",
  "الجدول الشامل": "Master Table",
  "الكل": "All",
  "تقرير إحصائية التوزيع": "Distribution Statistics",
  "الإحصائيات والرسوم البيانية": "Analytics & Charts",
  "إدارة الإصدارات": "Versioning",
  "صلاحيات Multi-Role": "Multi-Role Permissions",
  "ترتيب حسب التاريخ (الأقدم أولاً)": "Sort by date (oldest first)",
  "ترتيب حسب التاريخ (الأحدث أولاً)": "Sort by date (newest first)",
  "لا توجد بيانات": "No data available",
  "لا يوجد توزيع محفوظ حاليًا (لم يتم العثور على بيانات في Run أو الجدول الشامل).":
    "No saved distribution found currently (no data found in Run or Master Table).",
  "جاري المزامنة…": "Syncing…",
  "مزامنة الأرشيف": "Archive Sync",
  "جاري رفع النسخة…": "Uploading backup…",
  "نسخ سحابي الآن (يدوي)": "Cloud Backup Now (Manual)",
  "لا توجد نسخ سحابية بعد.": "No cloud backups yet.",
  "جاري الاستيراد…": "Importing…",
  "استيراد من السحابة": "Import from Cloud",
  "حالة العملية": "Operation Status",
  "حالة العملية: خطأ": "Operation Status: Error",
  "حالة العملية: تنبيه": "Operation Status: Warning",
  "⚠️ Cloud Functions مطلوبة": "⚠️ Cloud Functions Required",
  "Cloud Functions مطلوبة": "Cloud Functions Required",
  "لا توجد نسخ": "No backups",
  "إنشاء مدرسة جديدة (Tenant)": "Create New School (Tenant)",
  "إدارة المدارس (Tenants)": "Manage Schools (Tenants)",
  "فتح بيانات المدرسة": "Open School Data",
  "تعذر فتح بيانات المدرسة": "Failed to open school data",
  "حذف المدرسة": "Delete School",
  "إضافة/ربط مستخدم بالمدرسة": "Add/Link User to School",
  "قائمة المستخدمين (allowlist)": "Users List (allowlist)",
  "لا يوجد تعديل": "No changes",
  "معالج مالك واحد لكل مدرسة (meta/owner)": "One Owner per School Wizard (meta/owner)",
  "أدخل tenantId أولاً": "Enter tenantId first",
  "حذف جميع بيانات التوزيع": "Delete All Distribution Data",
  "بحث في الكادر التعليمي (اسم/ID)...": "Search teaching staff (name/ID)...",
  "تحديث/إعادة تحميل القيود": "Refresh / Reload Constraints",
  "حفظ القيود": "Save Constraints",
  "حذف القيود المحفوظة": "Delete Saved Constraints",
  "الاقتراحات": "Suggestions",
  "تفريغ في كل أيام التصحيح": "Free for all correction days",
  "تفريغ حسب تواريخ محددة": "Free on specific dates",
  "تحديد كل الأيام المتاحة": "Select all available days",
  "كل الأيام": "All Days",
  "أدخل الكادر التعليمي وجدول الامتحانات أولاً":
    "Enter teaching staff and exam schedule first",
  "جارٍ تشغيل الخوارزمية...": "Running algorithm...",
  "تشغيل خوارزمية التوزيع": "Run Distribution Algorithm",
  "الفترة الأولى": "First Period",
  "الفترة الثانية": "Second Period",
  "التقرير فقط": "Report Only",
  "صفحة واحدة": "One Page",
  "صفحة بيضاء": "Blank Page",
  "الأولى": "First",
  "الثانية": "Second",
  "سلطنة عمان": "Sultanate of Oman",
  "المديرية العامة للتعليم": "General Directorate of Education",
  "تقرير معلم (فردي)": "Teacher Report (Individual)",
  "تقرير الكادر التعليمي (الكل)": "Teaching Staff Report (All)",
  "كشف يومي (امتحانات)": "Daily Sheet (Exams)",
  "اسم القاعة": "Room Name",
  "المبنى": "Building",
  "السعة": "Capacity",
  "الدور": "Floor",
  "النوع": "Type",
  "المبنى A": "Building A",
  "المبنى B": "Building B",
  "الدور الأرضي": "Ground Floor",
  "الدور الأول": "First Floor",
  "الدور الثاني": "Second Floor",
  "قاعة دراسية": "Classroom",
  "مختبر": "Laboratory",
  "قاعة حاسب": "Computer Lab",
  "قاعة متعددة": "Multi-purpose Hall",
  "— اختر المبنى —": "— Select Building —",
  "— اختر النوع —": "— Select Type —",
  "— اختر المادة —": "— Select Subject —",
  "— اختر الفترة —": "— Select Period —",
  "المادة مطلوبة.": "Subject is required.",
  "التاريخ مطلوب.": "Date is required.",
  "الوقت مطلوب.": "Time is required.",
  "المدة مطلوبة.": "Duration is required.",
  "الفترة مطلوبة.": "Period is required.",
  "عدد القاعات مطلوب.": "Room count is required.",
  "هل تريد حذف هذا الامتحان؟": "Do you want to delete this exam?",
  "يُحسب تلقائيًا إن تركت فارغًا": "Calculated automatically if left blank",
  "اختيار صورة": "Choose Image",
  "التعديل للمدير فقط": "Editing is for admins only",
  "الشعار الحالي": "Current Logo",
  "رابط خارجي": "External Link",
  "محفوظ محلياً (Base64)": "Saved Locally (Base64)",
  "غير محدد": "Not specified",
  "تم حفظ التغييرات بنجاح!": "Changes saved successfully!",
  "تم حفظ السوبر بنجاح ✅": "Supervisor saved successfully ✅",
  "تعذر تحميل المدارس.": "Failed to load schools.",
  "أدخل بريد إلكتروني صحيح.": "Enter a valid email address.",
  "اختر المحافظة.": "Select a governorate.",
  "الدخول للدعم": "Enter Support",
  "لديك وصول كامل بصفة مالك المنصة.": "You have full access as Platform Owner.",
  "اختر طريقة الدخول المتاحة لك ضمن نطاقك.":
    "Choose the available entry method within your scope.",
  "تعذر تحميل قائمة المدارس": "Failed to load schools list",
  "الدخول للبرنامج": "Enter Program",
  "فشل تفعيل وضع الدعم": "Failed to activate support mode",
  "جارٍ فتح…": "Opening…",
  "تم إنشاء المدرسة بنجاح ✅": "School created successfully ✅",
  "حساب السوبر غير مرتبط بمحافظة.": "The supervisor account is not linked to a governorate.",
  "اختر مدرسة أولاً.": "Select a school first.",
  "يرجى إدخال اسم المدرسة.": "Please enter the school name.",
  "تم حفظ بيانات المدرسة بنجاح.": "School data saved successfully.",
  "تعذر حفظ بيانات المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.":
    "Failed to save school data. Check permissions and try again.",
  "المدرسة غير موجودة.": "School not found.",
  "لا يمكنك إضافة مستخدم لمدرسة خارج محافظتك.":
    "You cannot add a user to a school outside your governorate.",
  "تم حفظ المستخدم بنجاح.": "User saved successfully.",
  "يرجى إدخال بريد صحيح.": "Please enter a valid email.",
  "مالك المنصة داخل نطاق المحافظات": "Platform Owner within Governorates Scope",
  "عرض جميع المحافظات": "View All Governorates",
  "مدير المحافظة - إدارة المدارس والمستخدمين":
    "Governorate Manager - Manage Schools & Users",
  "حفظ المستخدم": "Save User",
  "غير محددة": "Unspecified",
  "جارٍ الحفظ...": "Saving...",
  "تم استيراد البيانات.": "Data imported successfully.",
  "لا توجد سجلات حتى الآن.": "No records yet.",
  "بحث (إجراء/مستخدم/كيان)...": "Search (action/user/entity)...",
  "كل المستويات": "All levels",
  "كل الإجراءات": "All actions",
  "لا توجد نسخ قديمة للحذف.": "No old backups to delete.",
  "لا يوجد معلمين": "No teachers",
  "وصل الحد الأقصى للنصاب": "Maximum quota reached",
  "تعارض في نفس الفترة": "Conflict in same period",
  "منع حسب القيود": "Blocked by constraints",
  "مفرّغ للمراجعة": "Free for review",
  "مفرّغ للتصحيح": "Free for correction",
  "ممنوع لمعلم المادة": "Not allowed for subject teacher",
  "اللغة العربية (مرة واحدة)": "Arabic Language (once)",
  "مراقبة 3 ساعات سبق تنفيذها": "3-hour invigilation already assigned",
  "غير متاح (غياب/عدم توفر)": "Unavailable (absence/unavailability)",
  "سبب غير معروف": "Unknown reason",
  "تجنب المهام المتتالية (Back-to-Back)": "Avoid back-to-back tasks",
  "توزيع ذكي حسب التخصص": "Smart distribution by specialty",
  "تفريغ جميع معلمي المادة للتصحيح": "Free all subject teachers for correction",
  "السماح بفترتين في اليوم الواحد": "Allow two periods in the same day",
  "صفوف 10": "Grade 10",
  "صفوف 11": "Grade 11",
  "أخرى (12)": "Others (12)",
  "تسجيل خروج": "Sign out",
  "فتح القائمة": "Expand menu",
  "طي القائمة": "Collapse menu",
  "اكتب اسم المعلم...": "Type teacher name...",
  "اكتب tenantId مثال azaan-9-12": "Type tenantId, e.g. azaan-9-12",
  "مثال: azaan-9-12": "Example: azaan-9-12",
  "مثال: أزان 9-12": "Example: Azaan 9-12",
  "مثال: أزان 12-9": "Example: Azaan 12-9",
  "مثال: بوشر": "Example: Bausher",
  "مثال: مدرسة النور / أحمد سالم": "Example: Al Noor School / Ahmed Salem",
  "اختيار": "Select",
  "مفعل": "Enabled",
  "غير مفعل": "Disabled",
  "بدء الترحيل إلى Firestore": "Start Migration to Firestore",
  "جاري الترحيل...": "Migrating...",
  "حفظ والمتابعة": "Save & Continue",
  "المديرية العامة للتعليم بمحافظة مسقط":
    "General Directorate of Education in Muscat Governorate",
  "المديرية العامة للتعليم بمحافظة ظفار":
    "General Directorate of Education in Dhofar Governorate",
  "المديرية العامة للتعليم بمحافظة الداخلية":
    "General Directorate of Education in Al Dakhiliyah Governorate",
  "المديرية العامة للتعليم بمحافظة الظاهرة":
    "General Directorate of Education in Al Dhahirah Governorate",
  "المديرية العامة للتعليم بمحافظة البريمي":
    "General Directorate of Education in Al Buraimi Governorate",
  "المديرية العامة للتعليم بمحافظة شمال الشرقية":
    "General Directorate of Education in North Al Sharqiyah Governorate",
  "المديرية العامة للتعليم بمحافظة جنوب الشرقية":
    "General Directorate of Education in South Al Sharqiyah Governorate",
  "المديرية العامة للتعليم بمحافظة الوسطى":
    "General Directorate of Education in Al Wusta Governorate",
  "المديرية العامة للتعليم بمحافظة شمال الباطنة":
    "General Directorate of Education in North Al Batinah Governorate",
  "المديرية العامة للتعليم بمحافظة جنوب الباطنة":
    "General Directorate of Education in South Al Batinah Governorate",
  "المديرية العامة للتعليم بمحافظة مسندم":
    "General Directorate of Education in Musandam Governorate",
  "الأحد": "Sunday",
  "الاثنين": "Monday",
  "الثلاثاء": "Tuesday",
  "الأربعاء": "Wednesday",
  "الخميس": "Thursday",
  "الجمعة": "Friday",
  "السبت": "Saturday",
  "رياضيات": "Mathematics",
  "الرياضيات": "Mathematics",
  "الرياضيات الأساسية": "Basic Mathematics",
  "الرياضيات المتقدمة": "Advanced Mathematics",
  "التربية الإسلامية": "Islamic Education",
  "تربية إسلامية": "Islamic Education",
  "اسلامية": "Islamic Education",
  "إسلامية": "Islamic Education",
  "اللغة العربية": "Arabic Language",
  "عربي": "Arabic",
  "عربية": "Arabic",
  "اللغة الإنجليزية": "English Language",
  "انجليزي": "English",
  "إنجليزي": "English",
  "الدراسات الاجتماعية": "Social Studies",
  "الفيزياء": "Physics",
  "فيزياء": "Physics",
  "الكيمياء": "Chemistry",
  "كيمياء": "Chemistry",
  "الأحياء": "Biology",
  "احياء": "Biology",
  "أحياء": "Biology",
  "تقنية المعلومات": "Information Technology",
  "العلوم البيئية": "Environmental Science",
  "العلوم و البيئة": "Science and Environment",
  "علوم و البيئة": "Science and Environment",
  "العلوم والبيئة": "Science and Environment",
  "البيئة": "Environment",
  "الفنون التشكيلية": "Visual Arts",
  "المهارات الموسيقية": "Music Skills",
  "الرياضة المدرسية": "School Sports",
  "مواد التخصصات الهندسية والصناعية": "Engineering and Industrial Specializations",
  "مهارات اللغة الإنجليزية": "English Language Skills",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات":
    "Travel, Tourism, Business Management and IT",
  "اللغة الفرنسية": "French Language",
  "اللغة الألمانية": "German Language",
  "اللغة الصينية": "Chinese Language",
};

const EXTRA_EXACT_AR_TO_EN: Record<string, string> = {
  "وزارة التعليم": "Ministry of Education",
  "مالك المنصة داخل نطاق المحافظات": "Platform Owner within the governorates scope",
  "عرض جميع المحافظات": "View all governorates",
  "مدير المحافظة - إدارة المدارس والمستخدمين":
    "Governorate manager - schools and users management",
  "أنت مالك المنصة، ويمكنك من هذه الشاشة مراجعة نطاق المحافظات بالكامل، كما يمكنك العودة إلى لوحة المالك لإدارة كل الصلاحيات العليا والمستخدمين والمدارس.":
    "You are the Platform Owner. From this screen, you can review the full governorates scope, and you can return to the owner portal to manage all elevated permissions, users, and schools.",
  "أنت مشرف نطاق، لذلك ترى وتدير فقط المدارس والمستخدمين المرتبطين بنطاقك الإداري.":
    "You are a scope supervisor, so you can only view and manage schools and users linked to your administrative scope.",
  "حفظ التغييرات": "Save changes",
  "إعادة تحميل البيانات": "Reload data",
  "اسم المستخدم": "User name",
  "المحافظة:": "Governorate:",
  "مدير الجهة": "Tenant manager",
  "تشغيل": "Operator",
  "مشاهد": "Viewer",
  "موقوف": "Suspended",
  "تم حفظ العضو وربطه بالجهة.": "Member saved and linked to the tenant.",
  "تعذر حفظ العضو.": "Failed to save member.",
  "البريد الإلكتروني": "Email address",
  "الاسم الظاهر": "Display name",
  "حفظ العضو": "Save member",
  "محلي + سحابي": "Local + cloud",
  "محلي": "Local",
  "سحابي": "Cloud",
  "لم يتم الفحص بعد": "Not checked yet",
  "تم فحص الاتاحة": "Availability checked",
  "هل تريد المتابعة؟": "Do you want to continue?",
  "تم الاستيراد بنجاح": "Imported successfully",
  "فشل التصدير": "Export failed",
  "فشل الاستيراد": "Import failed",
  "فشل الحذف": "Delete failed",
  "فشل مزامنة الأرشيف": "Archive sync failed",
  "أنت غير متصل بالإنترنت.": "You are offline.",
  "جاري التصدير…": "Exporting…",
  "تصدير (Download JSON)": "Export (Download JSON)",
  "جاري الاستيراد…": "Importing…",
  "استيراد (Upload JSON)": "Import (Upload JSON)",
  "جاري الحذف…": "Deleting…",
  "حذف بيانات البرنامج الأساسية": "Delete core app data",
  "اسم القاعة مطلوب.": "Room name is required.",
  "المبنى مطلوب.": "Building is required.",
  "نوع القاعة مطلوب.": "Room type is required.",
  "السعة مطلوبة.": "Capacity is required.",
  "هل تريد حذف هذه القاعة؟": "Do you want to delete this room?",
  "⚠️ هل أنت متأكد من حذف جدول القاعات كاملًا؟ لا يمكن التراجع.":
    "⚠️ Are you sure you want to delete the entire rooms table? This cannot be undone.",
  "اسم القاعة": "Room name",
  "المبنى": "Building",
  "النوع": "Type",
  "السعة": "Capacity",
  "ملاحظات": "Notes",
  "بحث...": "Search...",
  "الاسم الكامل": "Full name",
  "الرقم الوظيفي": "Employee number",
  "المادة 1": "Subject 1",
  "المادة 2": "Subject 2",
  "المادة 3": "Subject 3",
  "المادة 4": "Subject 4",
  "الصفوف": "Grades",
  "رقم الهاتف": "Phone number",
  "الرقم الوظيفي مطلوب.": "Employee number is required.",
  "الاسم الكامل مطلوب.": "Full name is required.",
  "هل تريد حذف هذا المعلم؟": "Do you want to delete this teacher?",
  "⚠️ هل أنت متأكد من حذف جدول الكادر التعليمي كاملًا؟ لا يمكن التراجع.":
    "⚠️ Are you sure you want to delete the entire teaching staff table? This cannot be undone.",
  "بحث بالاسم أو الرقم الوظيفي...": "Search by name or employee number...",
  "مثال: 10-5": "Example: 10-5",
  "تكبير الجدول ملء الشاشة": "Expand table to fullscreen",
  "عودة للحجم الطبيعي": "Return to normal size",
  "إغلاق ملء الشاشة": "Exit fullscreen",
  "ملء الشاشة": "Fullscreen",
  "برنامج ادارة الامتحانات الذكي": "Smart Exam Management Program",
  "لا يوجد معلمين": "No teachers available",
  "وصل الحد الأقصى للنصاب": "Maximum workload reached",
  "تعارض في نفس الفترة": "Conflict in the same period",
  "منع حسب القيود": "Blocked by constraints",
  "مفرّغ للمراجعة": "Freed for review",
  "مفرّغ للتصحيح": "Freed for correction",
  "ممنوع لمعلم المادة": "Blocked for the subject teacher",
  "اللغة العربية (مرة واحدة)": "Arabic language (one time)",
  "مراقبة 3 ساعات سبق تنفيذها": "A 3-hour invigilation was already assigned",
  "غير متاح (غياب/عدم توفر)": "Unavailable (absence/unavailability)",
  "سبب غير معروف": "Unknown reason",
  "غير محدد": "Unspecified",
  "مطابقة مادة": "Subject match",
  "لا يمكن التشغيل قبل إدخال بيانات الكادر التعليمي  + جدول الامتحانات.":
    "You cannot run distribution before entering teaching staff data and the exam schedule.",
  "الحد الأقصى للنصاب يجب أن يكون أكبر من 0.":
    "The maximum workload must be greater than 0.",
  "الاحتياط لكل فترة لا يمكن أن يكون سالب.": "Reserve per period cannot be negative.",
  "مراقبين لكل قاعة (صفوف 10) يجب أن يكون أكبر من 0.":
    "Invigilators per room (Grade 10) must be greater than 0.",
  "مراقبين لكل قاعة (صفوف 11) يجب أن يكون أكبر من 0.":
    "Invigilators per room (Grade 11) must be greater than 0.",
  "مراقبين لكل قاعة (أخرى/12) يجب أن يكون أكبر من 0.":
    "Invigilators per room (Others/12) must be greater than 0.",
  "عدد أيام التصحيح يجب أن يكون أكبر من 0.":
    "The number of correction days must be greater than 0.",
  "السماح بفترتين (تواريخ محددة): اختر تاريخًا واحدًا على الأقل أو فعّل خيار (كل الأيام).":
    "Allowing two periods (specific dates): choose at least one date or enable the (All days) option.",
  "التقرير فقط": "Report only",
  "صفحة واحدة": "One page",
  "صفحة بيضاء": "Blank page",
  "سلطنة عمان": "Sultanate of Oman",
  "المديرية العامة للتعليم": "General Directorate of Education",
  "المدرسة": "School",
  "تقرير معلم (فردي)": "Teacher report (individual)",
  "تقرير الكادر التعليمي (الكل)": "Teaching staff report (all)",
  "كشف يومي (امتحانات)": "Daily sheet (exams)",
  "طباعة الكل (كل معلم صفحة)": "Print all (one page per teacher)",
  "طباعة (تقرير فقط)": "Print (report only)",
  "PDF (Save as PDF) تقرير فقط": "PDF (Save as PDF) report only",
  "واتساب + PNG + PDF": "WhatsApp + PNG + PDF",
  "تعذر إنشاء صورة للتقرير (قد يكون بسبب الشعار الخارجي). يمكنك استخدام حفظ PDF من زر الطباعة.":
    "Unable to generate a report image (possibly because of an external logo). You can use Save as PDF from the print button.",
  "لا يوجد تشغيل حالي لحفظه.": "There is no current run to save.",
  "تم إنشاء إصدار جديد للتوزيع.": "A new distribution version was created.",
  "تعذر إنشاء الإصدار.": "Failed to create the version.",
  "تم اعتماد التوزيع الحالي وقفله كنسخة رسمية.":
    "The current distribution was approved and locked as an official version.",
  "تعذر اعتماد التوزيع.": "Failed to approve the distribution.",
  "اسم الإصدار": "Version name",
  "ملاحظات الاعتماد / الإصدار": "Approval / version notes",
  "النسخة التجريبية": "Trial version",
  "نسخة سابقة": "Previous version",
  "توزيع قبل التعديل": "Distribution before modification",
  "قديمة": "Old",
  "أرشيف": "Archive",
  "معتمد": "Approved",
  "تعذر تحميل المدارس.": "Failed to load schools.",
  "أدخل بريد إلكتروني صحيح.": "Enter a valid email address.",
  "فشل حفظ السوبر. تأكد من الصلاحيات ثم حاول مرة أخرى.":
    "Failed to save the supervisor. Check permissions and try again.",
  "فشل الدخول للدعم. جرّب تحديث الصلاحيات ثم أعد المحاولة.":
    "Failed to enter support mode. Refresh permissions and try again.",
  "(بدون محافظة)": "(No governorate)",
  "الدخول للدعم": "Enter support",
  "بحث": "Search",
  "جارٍ الحفظ...": "Saving...",
  "جاري الحفظ...": "Saving...",
  "مفعل": "Enabled",
  "غير مفعل": "Disabled",
  "تم حذف المدرسة بنجاح.": "School deleted successfully.",
  "تم حفظ بيانات المدرسة بنجاح.": "School data saved successfully.",
  "تم حفظ المستخدم بنجاح.": "User saved successfully.",
  "يرجى إدخال بريد صحيح.": "Please enter a valid email.",
  "تعذر حذف المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.":
    "Failed to delete the school. Check permissions and try again.",
  "تعذر إنشاء المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.":
    "Failed to create the school. Check permissions and try again.",
  "تعذر حفظ المستخدم. تأكد من الصلاحيات ثم جرّب مرة أخرى.":
    "Failed to save the user. Check permissions and try again.",
  "⚠️ لا يمكن الاستيراد الآن: يوجد تشغيل/توزيع نشط. أوقفه أولاً ثم أعد المحاولة.":
    "⚠️ Import is not available right now: there is an active run/distribution. Stop it first and try again.",
  "هذه النسخة غير مدعومة (schema=${schema}).":
    "This backup is not supported (schema=${schema}).",
  "ملخص البيانات التي ستُستبدل:": "Summary of data to be replaced:",
  "سيتم **استبدال** بيانات البرنامج الأساسية (IndexedDB).":
    "The core app data (IndexedDB) will be **replaced**.",
  "سيتم **دمج** الأرشيف (لا حذف للأرشيف):":
    "The archive will be **merged** (no archive deletion):",
  "✅ تم الاستيراد بنجاح: تم استبدال بيانات البرنامج ودمج الأرشيف (محلي/سحابي).":
    "✅ Import completed successfully: app data was replaced and the archive was merged (local/cloud).",
  "⚠️ سيتم حذف بيانات البرنامج الأساسية (IndexedDB) فقط. لن نحذف الأرشيف المحلي أو السحابي من هذه الصفحة. هل أنت متأكد؟":
    "⚠️ Only the core app data (IndexedDB) will be deleted. Local or cloud archive data will not be deleted from this page. Are you sure?",
  "✅ تم حذف بيانات البرنامج الأساسية وإعادة الإعدادات الافتراضية.":
    "✅ Core app data was deleted and the default settings were restored.",
  "لا توجد نسخ سحابية للحذف.": "There are no cloud backups to delete.",
  "✅ تم حذف النسخة السحابية.": "✅ Cloud backup deleted.",
  "فترة أولى": "First Period",
  "فترة ثانية": "Second Period",
  "• محلي + سحابي": "• Local + cloud",
  "• سحابي": "• Cloud",
  "• محلي": "• Local",
  "لوحة المدير": "Admin Dashboard",
  "مالك المنصة": "Platform Owner",
  "مشرف نطاق": "Scope Supervisor",
  "مدير جهة": "Tenant Manager",
  "مدير": "Manager",
  "مستخدم تشغيلي": "Operational User",
  "مستخدم": "User",
  "شعار": "Logo",
  "الإثنين": "Monday",
  "تحديث الصلاحيات": "Refresh Permissions",
  "إدارة المستخدمين": "User Management",
  "إدارة الجهات": "Tenant Management",
  "إدارة المشرفين": "Supervisor Management",
  "إدارة النظام": "System Administration",
  "إدارة المعلمين": "Teacher Management",
  "إدارة الاختبارات": "Exam Management",
  "إدارة القاعات": "Room Management",
  "إدارة الأرشيف": "Archive Management",
  "إدارة المزامنة": "Sync Management",
  "إدارة الإعدادات": "Settings Management",
  "إجمالي المستخدمين": "Total Users",
  "إجمالي الأدوار المسندة": "Total Assigned Roles",
  "الحسابات المفعلة": "Active Accounts",
  "الحسابات الموقوفة": "Disabled Accounts",
  "صلاحياتك الفعلية الآن": "Your Effective Permissions Now",
  "الدور الأساسي": "Primary Role",
  "الأدوار النشطة": "Active Roles",
  "مسموح": "Allowed",
  "عرض فقط": "View Only",
  "لا توجد صلاحيات ظاهرة": "No Visible Permissions",
  "إضافة مستخدم بصلاحيات فعلية": "Add User with Effective Permissions",
  "الحساب مفعل": "Account Enabled",
  "إضافة المستخدم": "Add User",
  "المستخدمون وصلاحياتهم الفعلية": "Users and Their Effective Permissions",
  "بحث بالبريد أو الاسم أو الدور": "Search by email, name, or role",
  "الأدوار الفعلية": "Effective Roles",
  "القدرات الناتجة": "Derived Capabilities",
  "المصدر": "Source",
  "إجراء": "Action",
  "بانتظار تحميل البيانات": "Waiting for data to load",
  "المعلم": "Teacher",
  "لا توجد بيانات صالحة للاستيراد.": "No valid data available for import.",
  "✅ تم استيراد البيانات.": "✅ Data imported successfully.",
  "✅ تم استيراد القاعات.": "✅ Rooms imported successfully.",
  "تعذر قراءة Excel. تأكد من وجود مكتبة xlsx أو استخدم CSV.":
    "Failed to read Excel. Make sure the xlsx library is available or use CSV.",
  "مكتبة xlsx غير متوفرة. استخدم تصدير CSV أو ثبّت xlsx.":
    "The xlsx library is unavailable. Use CSV export or install xlsx.",
  "إخفاء قائمة المعلمين": "Hide Teachers List",
  "إظهار قائمة المعلمين": "Show Teachers List",
  "التراجع عن آخر تعديل": "Undo Last Change",
  "لا يوجد تعديلات للتراجع": "There are no changes to undo",
  "اغلاق": "Close",
  "نعم": "Yes",
  "استبدال بيانات الجدول الشامل": "Replace Master Table Data",
  "إفلات هنا لنقل المهمة لهذا المعلم": "Drop here to move the task to this teacher",
  "اسحب وأسقط فوق نفس نوع المهمة للتبديل":
    "Drag and drop onto the same task type to swap",
  "بيانات الكادر التعليمي": "Teaching Staff Data",
  "إدارة الكادر التعليمي والأنصبة": "Manage teaching staff and workloads",
  "المواعيد والقاعات والمواضيع": "Dates, rooms, and subjects",
  "الكشوفات اليومية والرسمية": "Daily and official reports",
  "الهوية والشعار والإعدادات": "Identity, logo, and settings",
  "إدارة الشعارات والملفات": "Manage logos and files",
  "السجلات المحفوظة والتاريخ": "Saved records and history",
  "الإعدادات والسجلات": "Settings and Logs",
  "التواصل": "Contact",
  "المدرسة الحالية": "Current School",
  "المسمى الوظيفي": "Job Title",
  "اسم المراقب": "Invigilator Name",
  "التوقيع": "Signature",
  "اسم المعلم": "Teacher Name",
  "الجوال": "Mobile",
  "الهاتف": "Phone",
  "الصف": "Grade",
  "المادة الأولى": "First Subject",
  "المادة الثانية": "Second Subject",
  "المادة الثالثة": "Third Subject",
  "المادة الرابعة": "Fourth Subject",
  "المادة الاولى": "First Subject",
  "المادة الثانيه": "Second Subject",
  "المادة الثالثه": "Third Subject",
  "المادة الرابعه": "Fourth Subject",
  "المادة1": "Subject 1",
  "المادة2": "Subject 2",
  "المادة3": "Subject 3",
  "المادة4": "Subject 4",
  "اسم المادة": "Subject Name",
  "الرياضة": "Sports",
  "رياضة": "Sports",
  "الفنون": "Arts",
  "الجغرافيا": "Geography",
  "اجتماعية": "Social Studies",
  "العلوم": "Science",
  "علوم": "Science",
  "حاسوب": "Computer Science",
  "كمبيوتر": "Computer Science",
  "موسيقى": "Music",
  "هذا وطني": "This Is My Homeland",
  "آخر تشغيل": "Last Run",
  "الجدول المحفوظ": "Saved Table",
  "آخر تشغيل (Run)": "Last Run",
  "© جميع الحقوق محفوظة": "© All rights reserved",
  "المطور": "Developer",
  "فقط": "Only",
  "حظر القاعات": "Room Blocks",
  "اقتراحات": "Suggestions",
  "أدخل بريدًا إلكترونيًا صحيحًا.": "Enter a valid email address.",
  "الصفحة مرتبطة بالمستخدمين الفعليين داخل الجهة وتسحب الأدوار الحقيقية من بيانات الأعضاء وربطها مع allowlist.":
    "This page is connected to real tenant members and reads effective roles from member records linked with the allowlist.",
  "أي تعديل تحفظه هنا يتم تخزينه في أعضاء الجهة ثم مزامنته مع allowlist حتى تصبح الصلاحيات الفعلية للمستخدم مرتبطة بما تراه في هذه الصفحة.":
    "Any change you save here is stored in tenant members and synchronized with the allowlist so the user's effective access matches what you see on this page.",
  "التاريخ والحضارة الإسلامية": "Islamic History and Civilization",
  "الجغرافيا البشرية": "Human Geography",
  "الرياضة المدرسية": "School Sports",
  "مهارات اللغة الإنجليزية": "English Language Skills",
  "مواد التخصصات الهندسية والصناعية":
    "Engineering and Industrial Specialization Subjects",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات":
    "Travel, Tourism, Business Administration and Information Technology",
  "جدول الامتحانات": "Exam Schedule",
  "الحالة": "Status",
  "تحليل المعلمين": "Teacher Analysis",
  "ملاحظات تحليلية": "Analytical Insights",
  "لا توجد بيانات كافية لاستخراج ملاحظات تحليلية حالياً.":
    "There is not enough data yet to generate analytical insights.",
  "عدد المعلمين المشاركين": "Participating Teachers Count",
  "عدد السجلات المعروضة": "Displayed Records Count",
  "فريق العمل والصلاحيات": "Team & Permissions",
  "قراءة بيانات الجهة": "Read Tenant Data",
  "تعديل بيانات الجهة": "Edit Tenant Data",
  "عرض التقارير": "View Reports",
  "عرض السجل الرقابي": "View Audit Log",
  "وضع الدعم": "Support Mode",
  "لا توجد صلاحيات تشغيلية": "No Operational Permissions",
  "تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.":
    "The sign-in window was closed before the process was completed.",
  "الملف يجب أن يكون صورة": "The file must be an image",
  "القاعة": "Room",
  "حالة": "Status",
};

const REGEX_RULES: Array<[RegExp, string]> = [
  [/^المحافظة:\s*(.+)$/u, "Governorate: $1"],
  [/^تأكيد حذف المدرسة \((.+)\)[\?؟]?$/u, "Confirm deleting school ($1)?"],
  [/^✅ تم رفع نسخة سحابية:\s*(.+)$/u, "✅ Cloud backup uploaded: $1"],
  [/^⚠️ هل تريد حذف هذه النسخة السحابية نهائيًا؟$/u, "⚠️ Do you want to permanently delete this cloud backup?"],
  [/^✅ تم حذف النسخة السحابية\.?$/u, "✅ Cloud backup deleted."],
  [/^✅ تم حذف (\d+) نسخة قديمة وترك آخر (\d+) نسخ\.?$/u, "✅ Deleted $1 old backups and kept the latest $2 backups."],
  [/^✅ لا يوجد نسخ قديمة \(عدد النسخ ≤ (\d+)\)\.?$/u, "✅ There are no old backups (backup count ≤ $1)."],
  [/^⚠️ سيتم حذف النسخ السحابية القديمة وترك آخر (\d+) نسخ فقط\. هل تريد المتابعة؟$/u, "⚠️ Old cloud backups will be deleted and only the latest $1 backups will be kept. Do you want to continue?"],
  [/^تم استرجاع النسخة رقم (.+) بنجاح \(تجريبي\)\.?$/u, "Version $1 restored successfully (demo)."],
  [/^تم اعتماد النسخة رقم (.+)\.?$/u, "Version $1 approved."],
  [/^• (محلي \+ سحابي|سحابي|محلي)$/u, "• $1"],
  [/^(.+?)\s+\(وضع الدعم\)$/u, "$1 (Support Mode)"],
  [/^تعذر تسجيل الخروج:\s*(.+)$/u, "Unable to sign out: $1"],
  [/^❌ فشل الحفظ:\s*(.+)$/u, "❌ Save failed: $1"],
  [/^❌ لا يوجد tenantId فعّال$/u, "❌ No active tenantId"],
  [/^ملاحظة:\s*(.+)$/u, "Note: $1"],
  [/^Tenant الحالي:\s*(.+)$/u, "Current tenant: $1"],
  [/^العام الدراسي:\s*(.+)$/u, "Academic year: $1"],
  [/^تم حفظ صلاحيات\s+(.+)\s+وربطها بالصلاحيات الفعلية\.?$/u, "Permissions for $1 were saved and linked to effective access."],
  [/^تعذر حفظ صلاحيات\s+(.+)\.?$/u, "Failed to save permissions for $1."],
  [/^عدد السجلات المعروضة\s+(\d+)$/u, "Displayed records: $1"],
  [/^عدد المعلمين المشاركين$/u, "Participating teachers count"],
  [/^يوجد تقارب جيد في توزيع المهام لدى\s+(\d+)\s+من المعلمين مع قابلية لتحسين التوازن بشكل أكبر\.?$/u, "$1 teachers already have a fairly balanced workload, with room for even better balancing."],
  [/^يوجد\s+(\d+)\s+من المعلمين بدون مهام احتياط في هذا التشغيل\.?$/u, "$1 teachers have no reserve assignments in this run."],
  [/^يوجد\s+(\d+)\s+من المعلمين بدون مهام مراجعة في هذا التشغيل\.?$/u, "$1 teachers have no review assignments in this run."],
];

const PHRASES: Array<[string, string]> = [
  ["تقرير توزيع المهام", "Task Distribution Report"],
  ["نوع التقرير:", "Report Type:"],
  ["المعلم:", "Teacher:"],
  ["الرقم الوظيفي:", "Employee No.:"],
  ["المادة:", "Subject:"],
  ["التاريخ:", "Date:"],
  ["المحافظة:", "Governorate:"],
  ["الجهة:", "Tenant:"],
  ["الصلاحية:", "Role:"],
  ["الحالة:", "Status:"],
  ["اختر مدرسة أولاً", "Select a school first"],
  ["اختر المحافظة", "Select the governorate"],
  ["مثال:", "Example:"],
  ["بحث:", "Search:"],
  ["محلي + سحابي", "Local + cloud"],
  ["سحابي", "Cloud"],
  ["محلي", "Local"],
  ["الجهة الحالية", "Current tenant"],
  ["الجهة الفعلية", "Effective tenant"],
  ["غير متاح", "Unavailable"],
  ["غير موجود", "Not found"],
  ["غير مدعوم", "Unsupported"],
  ["خطأ غير معروف", "Unknown error"],
  ["خطأ", "Error"],
  ["تنبيه", "Warning"],
  ["احتياط", "Reserve"],
  ["مراقبة", "Invigilation"],
  ["مراجعة", "Review"],
  ["تصحيح", "Correction"],
  ["الأحد", "Sunday"],
  ["الاثنين", "Monday"],
  ["الثلاثاء", "Tuesday"],
  ["الأربعاء", "Wednesday"],
  ["الخميس", "Thursday"],
  ["الجمعة", "Friday"],
  ["السبت", "Saturday"],
  ["الفترة الأولى", "First Period"],
  ["الفترة الثانية", "Second Period"],
  ["مالك المنصة", "Platform Owner"],
  ["مشرف نطاق", "Scope Supervisor"],
  ["مدير جهة", "Tenant Manager"],
  ["مدير", "Manager"],
  ["مستخدم تشغيلي", "Operational User"],
  ["مستخدم", "User"],
  ["لوحة المدير", "Admin Dashboard"],
  ["إدارة المستخدمين", "User Management"],
  ["إدارة الجهات", "Tenant Management"],
  ["إدارة المشرفين", "Supervisor Management"],
  ["إدارة النظام", "System Administration"],
  ["إدارة المعلمين", "Teacher Management"],
  ["إدارة الاختبارات", "Exam Management"],
  ["إدارة القاعات", "Room Management"],
  ["إدارة الأرشيف", "Archive Management"],
  ["إدارة المزامنة", "Sync Management"],
  ["إدارة الإعدادات", "Settings Management"],
  ["إجمالي المستخدمين", "Total Users"],
  ["إجمالي الأدوار المسندة", "Total Assigned Roles"],
  ["الحسابات المفعلة", "Active Accounts"],
  ["الحسابات الموقوفة", "Disabled Accounts"],
  ["الحساب مفعل", "Account Enabled"],
  ["الدور الأساسي", "Primary Role"],
  ["الأدوار النشطة", "Active Roles"],
  ["الأدوار الفعلية", "Effective Roles"],
  ["القدرات الناتجة", "Derived Capabilities"],
  ["بحث بالبريد أو الاسم أو الدور", "Search by email, name, or role"],
  ["إضافة مستخدم بصلاحيات فعلية", "Add User with Effective Permissions"],
  ["المستخدمون وصلاحياتهم الفعلية", "Users and Their Effective Permissions"],
  ["بيانات الكادر التعليمي", "Teaching Staff Data"],
  ["إدارة الكادر التعليمي والأنصبة", "Manage teaching staff and workloads"],
  ["المواعيد والقاعات والمواضيع", "Dates, rooms, and subjects"],
  ["الكشوفات اليومية والرسمية", "Daily and official reports"],
  ["الهوية والشعار والإعدادات", "Identity, logo, and settings"],
  ["إدارة الشعارات والملفات", "Manage logos and files"],
  ["السجلات المحفوظة والتاريخ", "Saved records and history"],
  ["التواصل", "Contact"],
  ["المدرسة الحالية", "Current School"],
  ["المسمى الوظيفي", "Job Title"],
  ["اسم المراقب", "Invigilator Name"],
  ["التوقيع", "Signature"],
  ["اسم المعلم", "Teacher Name"],
  ["الجوال", "Mobile"],
  ["الهاتف", "Phone"],
  ["الصف", "Grade"],
  ["المادة الأولى", "First Subject"],
  ["المادة الثانية", "Second Subject"],
  ["المادة الثالثة", "Third Subject"],
  ["المادة الرابعة", "Fourth Subject"],
  ["المادة1", "Subject 1"],
  ["المادة2", "Subject 2"],
  ["المادة3", "Subject 3"],
  ["المادة4", "Subject 4"],
  ["اسم المادة", "Subject Name"],
  ["التاريخ والحضارة الإسلامية", "Islamic History and Civilization"],
  ["الجغرافيا البشرية", "Human Geography"],
  ["الرياضة المدرسية", "School Sports"],
  ["مهارات اللغة الإنجليزية", "English Language Skills"],
  ["مواد التخصصات الهندسية والصناعية", "Engineering and Industrial Specialization Subjects"],
  ["السفر و السياحة و إدارة الأعمال و تقنية المعلومات", "Travel, Tourism, Business Administration and Information Technology"],
  ["هذا وطني", "This Is My Homeland"],
  ["حاسوب", "Computer Science"],
  ["كمبيوتر", "Computer Science"],
  ["موسيقى", "Music"],
  ["الفنون", "Arts"],
  ["الرياضة", "Sports"],
  ["رياضة", "Sports"],
  ["العلوم", "Science"],
  ["علوم", "Science"],
  ["الجغرافيا", "Geography"],
  ["اجتماعية", "Social Studies"],
  ["جدول الامتحانات", "Exam Schedule"],
  ["فريق العمل والصلاحيات", "Team & Permissions"],
  ["قراءة بيانات الجهة", "Read Tenant Data"],
  ["تعديل بيانات الجهة", "Edit Tenant Data"],
  ["عرض التقارير", "View Reports"],
  ["عرض السجل الرقابي", "View Audit Log"],
  ["وضع الدعم", "Support Mode"],
  ["لا توجد صلاحيات تشغيلية", "No Operational Permissions"],
  ["تحليل المعلمين", "Teacher Analysis"],
  ["ملاحظات تحليلية", "Analytical Insights"],
];

const ATTRS = ["placeholder", "title", "aria-label", "value"] as const;

export function translateUiText(input: string, lang: Lang): string {
  const raw = String(input ?? "");
  if (lang === "ar" || !containsArabic(raw)) return raw;

  if (raw.includes("\n")) {
    const lines = raw.split("\n");
    const translatedLines = lines.map((line) =>
      containsArabic(line) ? translateUiText(line, "en") : line
    );
    if (translatedLines.some((line, index) => line !== lines[index])) {
      return translatedLines.join("\n");
    }
  }

  const normalized = normalize(raw);
  const exact = EXTRA_EXACT_AR_TO_EN[normalized] ?? EXACT_AR_TO_EN[normalized];
  if (exact) return exact;

  for (const [pattern, replacement] of REGEX_RULES) {
    if (pattern.test(normalized)) return normalized.replace(pattern, replacement);
  }

  const gradeMatch = normalized.match(/^(.+?)\s+(\d{1,2})$/u);
  if (gradeMatch) {
    const stem = translateUiText(gradeMatch[1], "en");
    if (stem !== gradeMatch[1]) return `${stem} ${gradeMatch[2]}`;
  }

  const labelValueMatch = normalized.match(/^([\-•]\s*)?(.+?)\s*:\s*(.+)$/u);
  if (labelValueMatch) {
    const prefix = labelValueMatch[1] ?? "";
    const label = labelValueMatch[2];
    const value = labelValueMatch[3];
    const translatedLabel = translateUiText(label, "en");
    if (translatedLabel !== label) {
      return `${prefix}${translatedLabel}: ${value}`;
    }
  }

  let out = raw;
  for (const [ar, en] of PHRASES.sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(esc(ar), "g"), en);
  }

  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+:/g, ":")
    .trim();

  return out;
}

export function attachDomTranslator(lang: Lang) {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const originalTexts = new WeakMap<Text, string>();
  const originalAttrs = new WeakMap<Element, Record<string, string>>();
  const timeouts: number[] = [];
  let rafId = 0;

  const shouldSkip = (el: Element | null) => {
    if (!el) return true;
    const tag = el.tagName;
    return (
      tag === "SCRIPT" ||
      tag === "STYLE" ||
      tag === "NOSCRIPT" ||
      tag === "TEXTAREA" ||
      tag === "CODE" ||
      tag === "PRE"
    );
  };

  const syncTextNode = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || shouldSkip(parent)) return;
    const current = node.nodeValue || "";

    if (lang === "en") {
      if (containsArabic(current)) {
        if (!originalTexts.has(node)) originalTexts.set(node, current);
        const translated = translateUiText(current, "en");
        if (translated !== current) node.nodeValue = translated;
      }
      return;
    }

    const original = originalTexts.get(node);
    if (typeof original === "string" && node.nodeValue !== original) {
      node.nodeValue = original;
    }
  };

  const syncAttrs = (el: Element) => {
    if (shouldSkip(el)) return;
    for (const attr of ATTRS) {
      const value = el.getAttribute(attr);
      if (value == null) continue;
      let store = originalAttrs.get(el);
      if (!store) {
        store = {};
        originalAttrs.set(el, store);
      }
      if (lang === "en") {
        if (containsArabic(value)) {
          if (store[attr] == null) store[attr] = value;
          const translated = translateUiText(value, "en");
          if (translated !== value) el.setAttribute(attr, translated);
        }
      } else if (store[attr] != null && el.getAttribute(attr) !== store[attr]) {
        el.setAttribute(attr, store[attr]);
      }
    }
  };

  const walk = (root: Node) => {
    if (!document.body) return;
    if (root.nodeType === Node.TEXT_NODE) {
      syncTextNode(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) syncAttrs(root as Element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current: Node | null = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) syncTextNode(current as Text);
      else if (current.nodeType === Node.ELEMENT_NODE) syncAttrs(current as Element);
      current = walker.nextNode();
    }
  };

  const restore = (root: Node) => {
    if (!document.body) return;
    if (root.nodeType === Node.TEXT_NODE) {
      const node = root as Text;
      const original = originalTexts.get(node);
      if (typeof original === "string") node.nodeValue = original;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      const el = root as Element;
      const store = originalAttrs.get(el);
      if (store) {
        for (const attr of ATTRS) {
          if (store[attr] != null) el.setAttribute(attr, store[attr]);
        }
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current: Node | null = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const node = current as Text;
        const original = originalTexts.get(node);
        if (typeof original === "string") node.nodeValue = original;
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as Element;
        const store = originalAttrs.get(el);
        if (store) {
          for (const attr of ATTRS) {
            if (store[attr] != null) el.setAttribute(attr, store[attr]);
          }
        }
      }
      current = walker.nextNode();
    }
  };

  const run = () => {
    if (!document.body) return;
    if (lang === "ar") restore(document.body);
    else walk(document.body);
  };

  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  const nativePrompt = window.prompt.bind(window);

  window.alert = ((message?: any) =>
    nativeAlert(lang === "en" ? translateUiText(String(message ?? ""), "en") : String(message ?? ""))) as typeof window.alert;

  window.confirm = ((message?: string) =>
    nativeConfirm(lang === "en" ? translateUiText(String(message ?? ""), "en") : String(message ?? ""))) as typeof window.confirm;

  window.prompt = ((message?: string, _default?: string) =>
    nativePrompt(
      lang === "en" ? translateUiText(String(message ?? ""), "en") : String(message ?? ""),
      _default
    )) as typeof window.prompt;

  run();
  rafId = window.requestAnimationFrame(run);
  [120, 450, 1000].forEach((ms) => {
    timeouts.push(window.setTimeout(run, ms));
  });

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    timeouts.forEach((id) => window.clearTimeout(id));
    window.alert = nativeAlert;
    window.confirm = nativeConfirm;
    window.prompt = nativePrompt;
    restore(document.body);
  };
}