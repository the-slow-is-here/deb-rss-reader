import { Injectable, signal, inject, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Locale = 'en' | 'ar';

const RTL_LOCALES: Set<Locale> = new Set(['ar']);

// ── Translation maps ────────────────────────────────────────
const TX: Record<Locale, Record<string, string>> = {
  en: {
    // Header
    'search.placeholder': 'Search articles...',
    'date.from': 'From',
    'date.to': 'To',
    'button.apply': 'Apply',
    'button.clear': 'Clear',
    'button.save': 'Save',
    'button.close': 'Close',
    'button.delete': 'Delete',
    'button.add': '+ Add',
    'button.logout': 'Log out',
    'button.testEmail': 'Test Email ✉️',
    'settings.title': 'Settings',
    'settings.account': 'Account',
    'settings.digest': 'Email Digest',
    'settings.frequency': 'Frequency',
    'settings.notifiedFeeds': 'Notified Feeds',
    'digest.24h': 'Every 24 hours',
    'digest.12h': 'Every 12 hours',
    'digest.6h': 'Every 6 hours',
    'digest.48h': 'Every 48 hours',
    'logout.title': 'Log Out',
    'logout.confirm': 'Are you sure you want to log out?',
    'logout.button': 'Log out',

    // Sidebar
    'tabs.feeds': 'Feeds',
    'tabs.playlists': 'Playlists',
    'feed.urlPlaceholder': 'RSS / Atom URL...',
    'feed.allFeeds': 'All Feeds',
    'feed.noFeeds': 'No feeds yet — add one above',
    'feed.noFeedsShort': 'No feeds yet — add some first',
    'feed.refreshTooltip': 'Refresh feed',
    'feed.starTooltip': 'Star feed',
    'feed.settingsTooltip': 'Feed settings',
    'playlist.newPlaceholder': 'New playlist name...',
    'playlist.noPlaylists': 'No playlists yet — create one above',
    'playlist.refreshTooltip': 'Refresh playlist',
    'playlist.starTooltip': 'Star playlist',
    'playlist.settingsTooltip': 'Playlist settings',
    'sidebar.refreshAll': 'Refresh All',
    'feedSettings.title': 'Feed Settings',
    'feedSettings.color': 'Color',
    'feedSettings.title2': 'Title',
    'feedSettings.titlePlaceholder': 'Feed title',
    'feedSettings.url': 'URL',
    'feedSettings.urlPlaceholder': 'Feed URL',
    'playlistSettings.title': 'Playlist Settings',
    'playlistSettings.icon': 'Icon',
    'playlistSettings.name': 'Name',
    'playlistSettings.namePlaceholder': 'Playlist name',
    'playlistSettings.feedsIn': 'Feeds in this playlist',
    'playlistSettings.noFeeds': 'No feeds in this playlist yet',
    'playlistSettings.addFeed': '+ Add Feed',
    'playlistSettings.hideFeed': '− Hide',
    'playlistSettings.noMoreFeeds': 'No more feeds available',
    'playlistSettings.removeFrom': 'Remove from playlist',
    'playlistSettings.addTo': 'Add to playlist',
    'toast.feedAdded': 'Feed added',
    'toast.feedRemoved': 'Feed removed',
    'toast.pulledArticles': 'Pulled {count} new articles',
    'toast.noNewArticles': 'No new articles',
    'toast.feedsFailed': ' — {count} feeds failed',
    'toast.playlistCreated': 'Playlist created',
    'toast.playlistDeleted': 'Playlist deleted',

    // Email popup
    'email.title': 'Email Notifications',
    'email.message': 'Would you like to receive email updates for new articles in your starred items?',
    'email.confirm': 'Yes, send me emails',

    // Pagination
    'pagination.prev': '◀ Previous',
    'pagination.next': 'Next ▶',
    'pagination.page': 'Page {current} of {total}',

    // App / empty states
    'loading': 'Loading...',
    'empty.search': 'No matches found',
    'empty.searchFor': ' for &ldquo;<strong>{term}</strong>&rdquo;',
    'empty.searchDateRange': ' in the selected date range',
    'empty.searchHint': 'Try adjusting your search or clearing the filters.',
    'empty.noPlaylistSelected': 'No playlist selected',
    'empty.noPlaylistHint': 'Choose a playlist from the sidebar to see its articles.',
    'empty.playlistEmpty': 'This playlist has no articles',
    'empty.playlistHint': 'Hit <strong>↻</strong> beside the playlist to pull in the latest articles.',
    'empty.noFeedSelected': 'No feed selected',
    'empty.noFeedHint': 'Choose feeds from the sidebar or select <strong>All Feeds</strong> to see articles.',
    'empty.singleFeedEmpty': 'This feed has no articles',
    'empty.singleFeedHint': 'Hit <strong>↻</strong> beside the feed to pull in the latest articles.',
    'empty.noStarred': 'No starred articles',
    'empty.noStarredHint': 'Star some feeds (click ☆) to see them here.',
    'empty.firstBoot': 'Add a feed and hit <strong>↻ Refresh All</strong> to pull in the latest articles.',
    'empty.allFeedsEmpty': 'No articles found',
    'empty.allFeedsHint': 'Hit <strong>↻ Refresh All</strong> or the <strong>↻</strong> button beside a feed to pull in the latest.',
    'summary.starred': '⭐ starred feeds',
    'summary.since': 'since {from}',
    'summary.until': 'until {to}',
    'summary.range': '{from} – {to}',
    'summary.found': 'Found {count} results for {filters}',
    'modal.removeFeed': 'Remove Feed',
    'modal.remove': 'Remove',
    'modal.cancel': 'Cancel',
    'modal.confirmFeed': 'Are you sure you want to remove "{name}"?',

    // Login
    'login.heading': 'Sign In',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.button': 'Sign In',
    'login.loading': 'Signing in...',
    'login.noAccount': "Don't have an account?",
    'login.register': 'Register',
    'login.errorRequired': 'Email and password are required.',
    'login.errorEmail': 'Please enter a valid email address.',

    // Register
    'register.heading': 'Create Account',
    'register.email': 'Email',
    'register.password': 'Password',
    'register.confirm': 'Confirm password',
    'register.button': 'Create Account',
    'register.loading': 'Creating account...',
    'register.hasAccount': 'Already have an account?',
    'register.signIn': 'Sign In',
    'register.errorRequired': 'Email and password are required.',
    'register.errorEmail': 'Please enter a valid email address.',
    'register.errorMismatch': 'Passwords do not match.',
  },

  ar: {
    // Header
    'search.placeholder': 'بحث في المقالات...',
    'date.from': 'من',
    'date.to': 'إلى',
    'button.apply': 'تطبيق',
    'button.clear': 'مسح',
    'button.save': 'حفظ',
    'button.close': 'إغلاق',
    'button.delete': 'حذف',
    'button.add': '+ إضافة',
    'button.logout': 'تسجيل الخروج',
    'button.testEmail': 'بريد تجريبي ✉️',
    'settings.title': 'الإعدادات',
    'settings.account': 'الحساب',
    'settings.digest': 'الملخص البريدي',
    'settings.frequency': 'التكرار',
    'settings.notifiedFeeds': 'المصادر المُنبَّهة',
    'digest.24h': 'كل ٢٤ ساعة',
    'digest.12h': 'كل ١٢ ساعة',
    'digest.6h': 'كل ٦ ساعات',
    'digest.48h': 'كل ٤٨ ساعة',
    'logout.title': 'تسجيل الخروج',
    'logout.confirm': 'هل أنت متأكد أنك تريد تسجيل الخروج؟',
    'logout.button': 'تسجيل الخروج',

    // Sidebar
    'tabs.feeds': 'المصادر',
    'tabs.playlists': 'القوائم',
    'feed.urlPlaceholder': 'رابط RSS / Atom...',
    'feed.allFeeds': 'كل المصادر',
    'feed.noFeeds': 'لا توجد مصادر — أضف واحداً أعلاه',
    'feed.noFeedsShort': 'لا توجد مصادر — أضف بعضها أولاً',
    'feed.refreshTooltip': 'تحديث المصدر',
    'feed.starTooltip': 'تمييز المصدر',
    'feed.settingsTooltip': 'إعدادات المصدر',
    'playlist.newPlaceholder': 'اسم قائمة جديد...',
    'playlist.noPlaylists': 'لا توجد قوائم — أنشئ واحدة أعلاه',
    'playlist.refreshTooltip': 'تحديث القائمة',
    'playlist.starTooltip': 'تمييز القائمة',
    'playlist.settingsTooltip': 'إعدادات القائمة',
    'sidebar.refreshAll': 'تحديث الكل',
    'feedSettings.title': 'إعدادات المصدر',
    'feedSettings.color': 'اللون',
    'feedSettings.title2': 'العنوان',
    'feedSettings.titlePlaceholder': 'عنوان المصدر',
    'feedSettings.url': 'الرابط',
    'feedSettings.urlPlaceholder': 'رابط المصدر',
    'playlistSettings.title': 'إعدادات القائمة',
    'playlistSettings.icon': 'الأيقونة',
    'playlistSettings.name': 'الاسم',
    'playlistSettings.namePlaceholder': 'اسم القائمة',
    'playlistSettings.feedsIn': 'المصادر في هذه القائمة',
    'playlistSettings.noFeeds': 'لا توجد مصادر في هذه القائمة بعد',
    'playlistSettings.addFeed': '+ إضافة مصدر',
    'playlistSettings.hideFeed': '− إخفاء',
    'playlistSettings.noMoreFeeds': 'لا توجد مصادر أخرى متاحة',
    'playlistSettings.removeFrom': 'إزالة من القائمة',
    'playlistSettings.addTo': 'إضافة إلى القائمة',
    'toast.feedAdded': 'تمت إضافة المصدر',
    'toast.feedRemoved': 'تم حذف المصدر',
    'toast.pulledArticles': 'تم جلب {count} مقالة جديدة',
    'toast.noNewArticles': 'لا توجد مقالات جديدة',
    'toast.feedsFailed': ' — فشل {count} مصدر',
    'toast.playlistCreated': 'تم إنشاء القائمة',
    'toast.playlistDeleted': 'تم حذف القائمة',

    // Email popup
    'email.title': 'إشعارات البريد',
    'email.message': 'هل تريد تلقي تحديثات بريدية للمقالات الجديدة في عناصرك المميزة؟',
    'email.confirm': 'نعم، أرسل لي رسائل',

    // Pagination (arrows flipped for RTL)
    'pagination.prev': '▶ السابق',
    'pagination.next': 'التالي ◀',
    'pagination.page': 'صفحة {current} من {total}',

    // App / empty states
    'loading': 'جار التحميل...',
    'empty.search': 'لا توجد نتائج',
    'empty.searchFor': ' عن &ldquo;<strong>{term}</strong>&rdquo;',
    'empty.searchDateRange': ' في نطاق التاريخ المحدد',
    'empty.searchHint': 'جرّب تعديل البحث أو مسح عوامل التصفية.',
    'empty.noPlaylistSelected': 'لم يتم اختيار قائمة',
    'empty.noPlaylistHint': 'اختر قائمة من الشريط الجانبي لعرض مقالاتها.',
    'empty.playlistEmpty': 'هذه القائمة لا تحتوي على مقالات',
    'empty.playlistHint': 'اضغط <strong>↻</strong> بجانب القائمة لجلب أحدث المقالات.',
    'empty.noFeedSelected': 'لم يتم اختيار مصدر',
    'empty.noFeedHint': 'اختر مصادر من الشريط الجانبي أو اختر <strong>كل المصادر</strong> لعرض المقالات.',
    'empty.singleFeedEmpty': 'هذا المصدر لا يحتوي على مقالات',
    'empty.singleFeedHint': 'اضغط <strong>↻</strong> بجانب المصدر لجلب أحدث المقالات.',
    'empty.noStarred': 'لا توجد مقالات مميزة',
    'empty.noStarredHint': 'ميّز بعض المصادر (اضغط ☆) لرؤيتها هنا.',
    'empty.firstBoot': 'أضف مصدراً واضغط <strong>↻ تحديث الكل</strong> لجلب أحدث المقالات.',
    'empty.allFeedsEmpty': 'لا توجد مقالات',
    'empty.allFeedsHint': 'اضغط <strong>↻ تحديث الكل</strong> أو زر <strong>↻</strong> بجانب المصدر لجلب الأحدث.',
    'summary.starred': '⭐ مصادر مميزة',
    'summary.since': 'منذ {from}',
    'summary.until': 'حتى {to}',
    'summary.range': '{from} – {to}',
    'summary.found': 'تم العثور على {count} نتيجة لـ {filters}',
    'modal.removeFeed': 'حذف المصدر',
    'modal.remove': 'حذف',
    'modal.cancel': 'إلغاء',
    'modal.confirmFeed': 'هل أنت متأكد أنك تريد حذف "{name}"؟',

    // Login
    'login.heading': 'تسجيل الدخول',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.button': 'تسجيل الدخول',
    'login.loading': 'جار تسجيل الدخول...',
    'login.noAccount': 'ليس لديك حساب؟',
    'login.register': 'إنشاء حساب',
    'login.errorRequired': 'البريد الإلكتروني وكلمة المرور مطلوبان.',
    'login.errorEmail': 'يرجى إدخال عنوان بريد إلكتروني صالح.',

    // Register
    'register.heading': 'إنشاء حساب',
    'register.email': 'البريد الإلكتروني',
    'register.password': 'كلمة المرور',
    'register.confirm': 'تأكيد كلمة المرور',
    'register.button': 'إنشاء حساب',
    'register.loading': 'جار إنشاء الحساب...',
    'register.hasAccount': 'لديك حساب بالفعل؟',
    'register.signIn': 'تسجيل الدخول',
    'register.errorRequired': 'البريد الإلكتروني وكلمة المرور مطلوبان.',
    'register.errorEmail': 'يرجى إدخال عنوان بريد إلكتروني صالح.',
    'register.errorMismatch': 'كلمات المرور غير متطابقة.',
  },
};

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private doc = inject(DOCUMENT);

  readonly locale = signal<Locale>(this.detectLocale());
  readonly isRtl = signal(RTL_LOCALES.has(this.locale()));

  constructor() {
    effect(() => {
      const lang = this.locale();
      const dir = RTL_LOCALES.has(lang) ? 'rtl' : 'ltr';
      this.doc.documentElement.lang = lang;
      this.doc.documentElement.dir = dir;
    });
  }

  /** Get a translated string by key, with optional {placeholder} substitution. */
  t(key: string, params?: Record<string, string | number>): string {
    const map = TX[this.locale()] ?? TX['en'];
    let text = map[key];
    if (text === undefined) text = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }

  private detectLocale(): Locale {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('lang')?.slice(0, 2);
    if (param === 'ar') return 'ar';
    if (param === 'en') return 'en';
    const stored = localStorage.getItem('locale');
    if (stored === 'ar' || stored === 'en') return stored;
    if (navigator.language?.slice(0, 2) === 'ar') return 'ar';
    return 'en';
  }

  /** Toggle between English and Arabic instantly (no page reload). */
  toggleLocale(): void {
    const next: Locale = this.locale() === 'en' ? 'ar' : 'en';
    this.locale.set(next);
    this.isRtl.set(RTL_LOCALES.has(next));
    localStorage.setItem('locale', next);
  }

  setLocale(lang: Locale): void {
    this.locale.set(lang);
    this.isRtl.set(RTL_LOCALES.has(lang));
    localStorage.setItem('locale', lang);
  }
}
