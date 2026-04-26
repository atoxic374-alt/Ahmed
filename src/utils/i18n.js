// Bilingual (Arabic/English) translation system with RTL support.
const DICT = {
  en: {
    'app.title': 'Discord Account Manager',
    'app.welcome': 'Welcome Back',
    'app.token_placeholder': 'Enter your Discord token',
    'app.connect': 'Connect',
    'app.save_token': 'Save Token',
    'app.no_saved': 'No saved tokens',
    'app.disconnect': 'Disconnect',
    'app.about': 'About',
    'app.theme': 'Toggle theme',
    'app.lang': 'العربية',

    'nav.login': 'Login',
    'nav.tokens': 'Tokens',
    'nav.friends': 'Friends',
    'nav.servers': 'Servers',
    'nav.dms': 'DMs',
    'nav.groups': 'Groups',
    'nav.messages': 'Messages',
    'nav.reactions': 'Reactions',
    'nav.history': 'Old Manager',

    'tk.title': 'Tokens Manager',
    'tk.subtitle': 'Save, connect & control multiple accounts at once.',
    'tk.tab.accounts': 'Accounts',
    'tk.tab.presence': 'Presence',
    'tk.tab.bio': 'Bio',
    'tk.tab.avatar': 'Avatar',
    'tk.tab.rotate': 'Rotate Status',
    'tk.tab.activity': 'Activity Simulator',
    'tk.add_token': 'Add Token',
    'tk.add_desc': 'Save a Discord token; optionally auto-connect at startup',
    'tk.account_name': 'Account name (e.g. main)',
    'tk.discord_token': 'Discord token',
    'tk.auto_connect': 'Auto-connect on start',
    'tk.save': 'Save',
    'tk.saved_connected': 'Saved & Connected',
    'tk.saved_desc': 'Click an account to make it active in the UI',
    'tk.no_accounts': 'No saved or connected accounts yet.',
    'tk.connect': 'Connect',
    'tk.make_active': 'Make Active',
    'tk.dc': 'Disconnect',
    'tk.enable_auto': 'Enable Auto',
    'tk.disable_auto': 'Disable Auto',
    'tk.delete': 'Delete',
    'tk.apply_to': 'Apply To',
    'tk.apply_to_desc': 'Pick accounts (empty = active)',
    'tk.apply_all': 'Apply to ALL connected',
    'tk.online_status': 'Online Status',
    'tk.online_desc': 'Set presence color',
    'tk.custom_status': 'Custom Status',
    'tk.custom_desc': 'Display under your name',
    'tk.emoji': 'Emoji (e.g. 🔥 or :fire:)',
    'tk.status_text': 'Status text',
    'tk.apply': 'Apply',
    'tk.clear_custom': 'Clear Custom',
    'tk.profile_bio': 'Profile Bio',
    'tk.profile_bio_desc': 'Set the about-me text',
    'tk.your_bio': 'Your bio…',
    'tk.apply_bio': 'Apply Bio',
    'tk.profile_avatar': 'Profile Avatar',
    'tk.profile_avatar_desc': 'Upload an image (PNG/JPG/GIF, ≤ 8 MB)',
    'tk.choose_image': 'Choose image',
    'tk.apply_avatar': 'Apply Avatar',
    'tk.interval': 'Interval',
    'tk.interval_desc': 'Seconds between rotations (min 15s)',
    'tk.status_seq': 'Status Sequence',
    'tk.status_seq_desc': 'Loop through these statuses',
    'tk.add_status': '＋ Add Status',
    'tk.start_rotation': '▶ Start Rotation',
    'tk.stop_rotation': '■ Stop Rotation',
    'tk.activity_title': 'Human-like Activity Simulator',
    'tk.activity_desc': 'Cycles between online ↔ idle ↔ invisible at random intervals to look natural',
    'tk.activity_min': 'Min cycle (seconds)',
    'tk.activity_max': 'Max cycle (seconds)',
    'tk.activity_modes': 'Cycle modes',
    'tk.start_activity': '▶ Start Simulator',
    'tk.stop_activity': '■ Stop Simulator',
    'tk.select_all': 'Select all',
    'tk.clear_sel': 'Clear',

    'mm.title': 'Messages Manager',
    'mm.subtitle': 'Send, repeat or schedule messages across servers, DMs and groups.',
    'mm.test_log': 'Test message',

    'rm.title': 'Reaction Manager',
    'rm.subtitle': 'Auto-react to messages and auto-click buttons by name.',

    'common.copy_link': 'Copy Link',
    'common.copied': 'Copied!',
    'common.cancel': 'Cancel',
    'common.start': 'Start',
    'common.stop': 'Stop',
    'common.close': 'Close',
  },
  ar: {
    'app.title': 'مدير حسابات ديسكورد',
    'app.welcome': 'أهلًا بعودتك',
    'app.token_placeholder': 'أدخل توكن ديسكورد',
    'app.connect': 'اتصال',
    'app.save_token': 'حفظ التوكن',
    'app.no_saved': 'لا يوجد توكنات محفوظة',
    'app.disconnect': 'فصل',
    'app.about': 'حول',
    'app.theme': 'تبديل الوضع',
    'app.lang': 'English',

    'nav.login': 'تسجيل الدخول',
    'nav.tokens': 'التوكنات',
    'nav.friends': 'الأصدقاء',
    'nav.servers': 'السيرفرات',
    'nav.dms': 'الرسائل الخاصة',
    'nav.groups': 'القروبات',
    'nav.messages': 'الرسائل',
    'nav.reactions': 'التفاعلات',
    'nav.history': 'الإدارة القديمة',

    'tk.title': 'إدارة التوكنات',
    'tk.subtitle': 'احفظ واتصل وتحكم بعدة حسابات في نفس الوقت.',
    'tk.tab.accounts': 'الحسابات',
    'tk.tab.presence': 'الحالة',
    'tk.tab.bio': 'البايو',
    'tk.tab.avatar': 'الصورة',
    'tk.tab.rotate': 'تدوير الحالة',
    'tk.tab.activity': 'محاكي النشاط',
    'tk.add_token': 'إضافة توكن',
    'tk.add_desc': 'احفظ توكن ديسكورد، مع خيار الاتصال التلقائي عند البدء',
    'tk.account_name': 'اسم الحساب (مثلاً: main)',
    'tk.discord_token': 'توكن ديسكورد',
    'tk.auto_connect': 'اتصال تلقائي عند البدء',
    'tk.save': 'حفظ',
    'tk.saved_connected': 'المحفوظة والمتصلة',
    'tk.saved_desc': 'اضغط على حساب لجعله النشط في الواجهة',
    'tk.no_accounts': 'لا يوجد حسابات محفوظة أو متصلة بعد.',
    'tk.connect': 'اتصل',
    'tk.make_active': 'اجعله النشط',
    'tk.dc': 'افصل',
    'tk.enable_auto': 'تفعيل التلقائي',
    'tk.disable_auto': 'إيقاف التلقائي',
    'tk.delete': 'حذف',
    'tk.apply_to': 'التطبيق على',
    'tk.apply_to_desc': 'اختر حسابات (فارغ = النشط فقط)',
    'tk.apply_all': 'طبّق على كل المتصلين',
    'tk.online_status': 'حالة الاتصال',
    'tk.online_desc': 'لون الحالة',
    'tk.custom_status': 'الحالة المخصصة',
    'tk.custom_desc': 'تظهر تحت اسمك',
    'tk.emoji': 'إيموجي (مثل 🔥 أو :fire:)',
    'tk.status_text': 'نص الحالة',
    'tk.apply': 'تطبيق',
    'tk.clear_custom': 'مسح المخصص',
    'tk.profile_bio': 'البايو الشخصي',
    'tk.profile_bio_desc': 'حدّث نص "نبذة عني"',
    'tk.your_bio': 'البايو…',
    'tk.apply_bio': 'تطبيق البايو',
    'tk.profile_avatar': 'الصورة الشخصية',
    'tk.profile_avatar_desc': 'ارفع صورة (PNG/JPG/GIF، أقل من 8 ميجا)',
    'tk.choose_image': 'اختر صورة',
    'tk.apply_avatar': 'تطبيق الصورة',
    'tk.interval': 'الفاصل الزمني',
    'tk.interval_desc': 'بالثواني بين التدويرات (الحد الأدنى 15ث)',
    'tk.status_seq': 'سلسلة الحالات',
    'tk.status_seq_desc': 'دوّر بين هذه الحالات',
    'tk.add_status': '＋ إضافة حالة',
    'tk.start_rotation': '▶ بدء التدوير',
    'tk.stop_rotation': '■ إيقاف التدوير',
    'tk.activity_title': 'محاكي نشاط بشري',
    'tk.activity_desc': 'يبدّل بين online ↔ idle ↔ invisible بفواصل عشوائية لمظهر طبيعي',
    'tk.activity_min': 'أقل دورة (ثانية)',
    'tk.activity_max': 'أعلى دورة (ثانية)',
    'tk.activity_modes': 'حالات الدورة',
    'tk.start_activity': '▶ تشغيل المحاكي',
    'tk.stop_activity': '■ إيقاف المحاكي',
    'tk.select_all': 'تحديد الكل',
    'tk.clear_sel': 'مسح',

    'mm.title': 'إدارة الرسائل',
    'mm.subtitle': 'إرسال أو تكرار أو جدولة الرسائل في القنوات والخاص والقروبات.',
    'mm.test_log': 'رسالة اختبار',

    'rm.title': 'إدارة التفاعلات',
    'rm.subtitle': 'تفاعل تلقائي مع الرسائل وضغط الأزرار بالاسم.',

    'common.copy_link': 'نسخ الرابط',
    'common.copied': 'تم النسخ!',
    'common.cancel': 'إلغاء',
    'common.start': 'بدء',
    'common.stop': 'إيقاف',
    'common.close': 'إغلاق',
  }
};

let currentLang = localStorage.getItem('lang') || 'en';

export function t(key) {
  return (DICT[currentLang] && DICT[currentLang][key]) || (DICT.en[key]) || key;
}

export function getLang() { return currentLang; }
export function isRTL() { return currentLang === 'ar'; }

export function setLang(lang) {
  if (!DICT[lang]) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyLang();
  // Re-render dynamic managers
  ['tokensManager', 'messagesManager', 'reactionManager'].forEach(k => {
    try {
      const mgr = window[k];
      if (mgr && typeof mgr.render === 'function' && mgr.contentArea?.innerHTML) {
        mgr.render();
      }
    } catch (e) {}
  });
  window.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
}

export function applyLang() {
  const html = document.documentElement;
  html.setAttribute('lang', currentLang);
  html.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
  document.body.classList.toggle('rtl', isRTL());

  // Translate marked elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });

  // Update lang button label
  const btn = document.getElementById('langToggleBtn');
  if (btn) btn.textContent = t('app.lang');
}
