# Meetings — Round 2 (Lobby & Access) — Frontend

بند 2 من خطة الـ 9 بنود: Pre-Join screen (اختبار كاميرا/مايك حقيقي عبر
getUserMedia)، Waiting Room (ناحية الداخل والهوست)، شاشة دخول ضيف،
كلمة سر.

## ملفات جديدة

- `src/pages/meetings/MeetingPreJoin.jsx` — صفحة `/join/:joinToken` العامة (مفيش تسجيل دخول مطلوب). فيها:
  - كلمة السر (لو الاجتماع محمي) عبر `verify-password` قبل ما تفتح باقي الشاشة.
  - اختبار كاميرا/مايك حقيقي: `getUserMedia` + `enumerateDevices`، preview فيديو حي، مؤشر مستوى الصوت (Web Audio API `AnalyserNode`)، تبديل جهاز الكاميرا/المايك/السماعة لحظيًا، وأزرار كتم/تشغيل.
  - اسم عرض للضيف (لو مسجّلاش دخول) + رابط "سجّل دخول بدل كده".
  - إرسال طلب الدخول (`POST .../request`) وبعدها إما دخول فوري (هوست/co-host أو waiting room متعطل) أو الانتقال لشاشة "مستني موافقة الهوست" بعمل poll كل 3 ثواني على حالة الطلب لحد القبول/الرفض.
- `src/components/meetings/MeetingWaitingRoomPanel.jsx` — بانel جوه صفحة تفاصيل الاجتماع للهوست: قائمة الطلبات المعلّقة (poll كل 5 ثواني)، قبول/رفض فردي، أو Admit All/Deny All.

## ملفات معدّلة

- `src/pages/meetings/MeetingDetails.jsx` — رابط "Join Link" بقى بيشاور على `/join/{token}` بتاع الفرونت نفسه (مش الـ token الخام)، وبانel الـ Waiting Room بقى ظاهر للهوست تلقائيًا لو `waiting_room_enabled` والاجتماع لسه ممكن يتدخل (مش ended/cancelled) — قبول حد من الـ waiting room بيعمل reload لقائمة الـ Participants تلقائيًا.
- `src/i18n/shared/meetings.js` — قاموس AR/EN جديد لكل نصوص الـ Pre-Join/Waiting Room.
- `src/App.jsx` — `lazy import` لـ `MeetingPreJoin` + route عام (برّه أي بورتال، زي `/p/:uuid`) على `/join/:joinToken`.

## طريقة التطبيق

فك الزيب فوق نسخة المشروع اللي فيها بند 1 (Foundation) بالفعل — الملفات
دي نسخة كاملة بعد التعديل (مش diff)، استبدلها زي ما هي. `MyMeetings.jsx`
ماتغيّرش في البند ده فمش موجود هنا (زي ما هو من بند 1).

## ملاحظات

- الـ endpoints كلها من `MeetingsLobbyApiController` (prefix
  `meetings/join`, ميدلوير `uip.auth.optional`) + `waiting-room/*` من
  `MeetingsApiController` القديم (نفس ميدلوير `uip.auth` العادي بتاع
  الهوست).
- `guest_token` بتاع الضيف بيتخزن في `sessionStorage` (مفتاحه
  `uip_meeting_guest_token_{joinToken}`) عشان بند 3 (Signaling) يقدر
  يستخدمه بعدين — مفيش استخدام ليه لسه في البند ده.
- الدخول الفعلي لغرفة الاجتماع (WebRTC) لسه مش موجود — أزرار
  "You've been admitted" هنا بس تأكيد، الغرفة نفسها بند 3-4.
- مستخدم مسجّل دخول وله بورتال بيتنقل تلقائيًا لصفحة تفاصيل الاجتماع
  (`/${role}/meetings/{uuid}`) بمجرد القبول، بدل ما يشوف شاشة تأكيد
  ثابتة زي الضيف.
