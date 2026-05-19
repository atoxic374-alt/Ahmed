# Discord Presence Studio

لوحة ويب آمنة لتشغيل وتخصيص حالة **Streaming** لبوت ديسكورد رسمي عبر Discord Bot API.

> لا يستخدم المشروع self-bots أو توكنات حسابات المستخدمين، ولا يحتوي على أي آليات إخفاء أو تجاوز لأن ذلك يخالف سياسات Discord. استخدم توكن Bot من Discord Developer Portal فقط.

## التشغيل

```bash
npm start
```

افتح: <http://localhost:5000>

## المزايا

- اتصال فعلي ببوت Discord رسمي عبر Gateway و REST API بدون مكتبات خارجية.
- تفعيل/إيقاف Streaming presence مباشرة.
- تخصيص الاسم، الرابط، الحالة، ونص الحالة المساعد.
- حفظ الإعدادات محليًا داخل `.data/settings.json` حتى بعد تحديث الصفحة أو إعادة تشغيل المشروع.
- محاولة إعادة الاتصال تلقائيًا عند تشغيل الخادم إذا كانت ميزة Auto reconnect مفعلة.

## ملاحظات مهمة

- نوع Streaming في Discord يدعم روابط Twitch و YouTube فقط.
- بوتات Discord تستطيع ضبط حقول presence محددة فقط حسب وثائق Discord الرسمية.
