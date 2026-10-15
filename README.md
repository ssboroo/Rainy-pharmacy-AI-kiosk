# RAINY Pharmacy AI Kiosk

Монгол хэлтэй, 5 солих боломжтой хөдөлгөөнт AI дүртэй, камерын шошго танилт, мэдээллийн каталог, дуут ElevenLabs Agent дэмжлэгтэй эмийн сангийн мэдрэгчтэй дэлгэцийн программ.

## Ашиглах

Node.js 22 болон npm шаардлагатай.

1. npm install
2. npm run build
3. npm start
4. Browser: http://localhost:3000
5. Admin: http://localhost:3000/admin.html

Хөгжүүлэх үед хоёр терминалд npm start болон npm run dev ажиллуулна. Vite frontend нь http://localhost:5173, API нь 3000 портод байна.

Windows PowerShell дээр environment-д нууц утга өгөх жишээ:

    $env:ADMIN_TOKEN="choose-your-own-long-random-admin-token"
    npm start

Railway-д Dockerfile + railway.json бэлэн. Project repo-г Railway-д холбож, Node environment хувьсагч нэмж, DATA_DIR-ийн persistent volume холбоно. DNS/HTTPS тохируулахад WebRTC/microphone/camera-г зөвшөөрүүлнэ. Дурын browser-оос ажиллах web/PWA бүтээгдэхүүн; native Android APK эсвэл iOS IPA хараахан биш.

## Тохируулга — бүгдийг дараа сольж болно

ADMIN_TOKEN — 24-с дээш тэмдэгт, нууц.

Админ хуудаснаас нэр, мэндчилгээ, үндсэн өнгө, киоск байрлал, Номи / Мира / Кики / Ариа / Бобо дүрүүд, ElevenLabs Agent ID болон эмийн каталогийг өөрчилнө. Нууц API түлхүүрүүд browser биш зөвхөн серверийн environment-д байна. Админ token client storage-д хадгалагдахгүй.

Тохируулах нууц environment хувьсагчид:

- ELEVENLABS_API_KEY — private agent signed URL авах API түлхүүр
- ELEVENLABS_AGENT_ID — fallback agent ID; админд шинэ agent ID тохируулж болно
- VOICE_AGENT_CLINICAL_APPROVED=true — мэргэжлийн эм зүйч voice agent-ийн knowledge, system prompt, guardrails-ийг хянаж зөвшөөрсөн үед л асаана; default false
- OPENAI_API_KEY — camera label OCR; зөвшөөрөлтэй зураг бүрийг OpenAI API руу илгээнэ
- OPENAI_VISION_MODEL — default gpt-4.1-mini; дараа солих боломжтой
- PHARMACIST_WEBHOOK_URL — эм зүйч рүү бодитоор мэдэгдэх HTTPS endpoint
- DATA_DIR — каталог ба тохиргоог хадгалах persistent volume path, default ./storage
- PORT — default 3000

.env.example нь үлгэрчилсэн жагсаалт. Production-д secrets-ийг Railway Variables гэх мэт secret store ашиглан тохируул. Төслийн repo-д API key бүү хадгал.

## Үйлчлүүлэгчийн боломж

- 5 AI дүрийн сонголт, амны хөдөлгөөн, сонсох/ярих долгион дүрслэл.
- Browser-ийн дуут танилт дэмжигдвэл browser fallback; Монгол хэлний найдвартай байдал төхөөрөмжөөс хамаарна.
- Voice agent эм зүйчийн хяналтаар зөвшөөрөгдөж, ElevenLabs account тохируулсан үед дуут live conversation.
- Камер асаах эсвэл зураг сонгох; explicit consent-д үндэслэн эмийн савны бичвэр уншуулж, каталогтой тулгах. Гараар нэрийг нягталж баталгаажуулна.
- Эмийн нэрээр хайх, зөвхөн verified каталог дээр үнэ, үлдэгдэл, тавиур асуух.
- Эм зүйч дуудах webhook. Хэрэв webhook холбогдоогүй бол бодит хүсэлт илгээгдээгүйг ил тод харуулна.
- Touch, keyboard, mouse; responsive tablet/mobile/desktop PWA UI; серверийн API офлайнаар ажиллахгүй.

## Эмийн аюулгүй байдал

Энэ бол **эм зүйчийн мэдээлэл өгөх ажлыг дэмжих киоск**, эмч/эм зүйчийн орлуулагч, оношилгоо, эмийн тунгийн систем биш. Эмийн тун, хүүхэд, жирэмслэлт, хавсарсан эмийн хэрэглээ зэрэг эмнэлзүйн асуултыг мэргэжилтэн рүү шилжүүлнэ. Яаралтай үед ажилтанд болон 103-т хандана.

Анхны 3 бүтээгдэхүүний бүртгэл нь ЗӨВХӨН ДЕМО. Эмийн бодит мэдээлэл, үнэ, үлдэгдэл, эмийн улсын бүртгэлтэй хамааралгүй. Админ verified=true гэж тохируулахад HTTPS эх сурвалж, баталгаажуулсан огноог систем шаардана. Энэ нь автоматаар баталгаатай гэсэн баталгаа биш: лицензтэй эм зүйч баримтаар нь шалгана.

**ElevenLabs Agent-ийн system prompt-д заавал:**
- Өөрийгөө AI туслах гэж үнэн зөв танилцуулах.
- Эмийн тун, онош, эмийн сонголт, эм орлуулалт, жор бичихгүй.
- Зөвхөн мэргэжлийн баг баталгаажуулсан knowledge-base ба inventory API-г ашиглах.
- Баталгаагүй, эмнэлзүйн болон яаралтай асуултад эм зүйчид шилжүүлэх.
- Нийтийн киоск дээр эмзэг өвчтөний мэдээллийг давтан чангаар хэлэхгүй.

Энэ prompt-ыг ElevenLabs dashboard-д тусад нь тохируулах шаардлагатай. Server-ийн deterministic /api/ask хамгаалалт нь тусдаа voice agent-ийн response-ийг шүүдэггүй. Тиймээс clinical approval flag-г мэргэжлийн хяналтын дараа л идэвхжүүл.

## API

GET /api/health — health.
GET /api/bootstrap — public settings without agent ID or API keys.
GET /api/catalog?q= — catalog search.
POST /api/ask — safe deterministic answer or pharmacist handoff.
POST /api/vision — explicit consent OCR via OpenAI; no drug advice.
POST /api/handoff — staff webhook status.
GET /api/agent/signed-url — private agent session.
GET, PUT /api/admin/settings — Bearer ADMIN_TOKEN.
GET, PUT /api/admin/catalog — Bearer ADMIN_TOKEN.

## Test and deployment

    npm test
    npm run build
    npm start

GitHub Actions automatically runs npm run check on push. Unit tests cover risky clinical escalation, source validation and all avatar IDs. HTTP integration test covers real routes, admin updates, voice safety flag and camera consent.

Before pharmacy rollout: verified Mongolian medicines catalog, pharmacist approval and legal review, POS/stock API, staff webhook, real-device and noisy-room speech QA, TLS, server persistence, data privacy notice and vendor agreements, monitoring, backups, accessibility and site-specific signage.

**Current scope:** functional code and demo workflows with optional provider integration. API keys, approved ElevenLabs Agent, verified pharmacy inventory, real pharmacist integration, privacy/legal review and physical-device acceptance testing are not supplied by the repository and remain mandatory before production use.

## Эмийн сангийн hands-free киоск тохиргоо

1. Эмийн сангийн **тогтмол компьютер дээр HTTPS Chrome/Edge** ашиглан сайт нээнэ.
2. Ажилтан **«Микрофон зөвшөөрөх»** товч дарж browser-ийн зөвшөөрлийг олгоно. Дараа нь микрофоны сонсох төлөв дэлгэц дээр үргэлж ил харагдана. Хэрэглэгч «Сайн байна уу?» гэж хэлэхэд туслах ярианы горим руу шилжинэ.
3. **«Томруулах»** товч дарж том дүртэй киоск горим болон browser fullscreen ажиллуулна. UI layout тухайн browser дээр хадгалагдана; browser fullscreen нь page reload/OS boot дараа автоматаар баталгаатай хадгалагдахгүй. 24/7 төхөөрөмжид managed Chrome `--kiosk` эсвэл Edge Assigned Access хэрэглэнэ.
4. Wake detection-д Chrome/Edge Web Speech Recognition хэрэгтэй бөгөөд браузераас хамааран network ашиглаж, сонсгол нь тасалдаж болно. Бодит 24/7 unattended киоск бол local wake-word hardware/runtime ба хяналтын restart policy-г тусад нь баталгаажуулна.
5. ElevenLabs Agent approved, API key, agent ID, `VOICE_AGENT_CLINICAL_APPROVED=true` зэрэг тохиргоо бүгд хийгдээгүй бол зөвхөн browser-ийн demo/safe text QA боломжтой. Эмчилгээ, тун зөвлөхгүй.
6. Хэрэглэгч 2 минут идэвхгүй үед хувь хүний ярианы UI цэвэрлэгдэж мэндчилгээний горимд буцна.
7. Дууны waveform ба нүүрний хөдөлгөөн нь ElevenLabs SDK-ийн live audio volume дээр суурилсан **energy lip sync** болохоос viseme / 3D facial rig биш. Дараагийн шатанд лицензтэй GLB/ARKit morph targets ашиглаж болно.

**Нууцлал:** Ойр байгаа хүмүүсийн яриа browser-ийн Speech Recognition provider-д дамжиж болох тул үйлчлүүлэгчид ойлгомжтой анхааруулга, байгууллагын зөвшөөрлийн журам шаардлагатай. Browser permission нь төхөөрөмж, site origin-той холбоотой бөгөөд OS-ийн бодлогоос хамаарна.

## Өмнөх 3D хөдөлгүүр — ашиглахаа больсон

**2026-10-14:** Хэрэглэгчийн хүсэлтээр 3D загварыг үндсэн интерфейсээс бүрэн салгаж, 2.5D head-only дүрүүдээр сольсон. Доорх хуучин мэдээлэл нь архивын тайлбар юм.

## Premium 3D avatar engine (архив)

`src/avatar-3d.js` uses Three.js WebGL2 + physically based materials to render **five distinct procedural 3D characters** (robots, a stylized human avatar and hologram). Facial rig reacts to live ElevenLabs input/output signal level (energy lip sync, **not phoneme-accurate** visemes). Eye blinking, brows, head and idle breathing are stateful. Idle and fullscreen are responsive via ResizeObserver, capped devicePixelRatio for kiosk hardware. Failed/lost GPU context falls back to the existing 2D CSS avatar. Actual photoreal human/GLB avatar models and precise viseme retargeting are separate work, not shipped in this version.

**Agent ID:** admin login at `/admin.html` → *ElevenLabs Agent ID* → Save. Permanent settings require Railway volume mounted at `/app/storage` and `DATA_DIR=/app/storage`. Alternatively set `ELEVENLABS_AGENT_ID` in Railway Variables (server fallback). Set secret `ELEVENLABS_API_KEY` only in Railway Variables; it is never included in frontend output. Voice remains disabled until a licensed pharmacist approves the agent knowledge and policies and explicitly enables `VOICE_AGENT_CLINICAL_APPROVED=true`. No clinical advice by default.


## Одоогийн 2.5D AI дүрүүд — зөвхөн том толгой

Хэрэглэгчийн дэлгэцэнд зөвхөн **AI дүрийн толгой** харагдана. Цээж, мөр, хүзүү байхгүй. src/avatar-25d.js нь гаднын зураг, WebGL, Three.js ашиглахгүй SVG vector илэрхийллийг үүсгэдэг.

- **Номи:** цагаан/ногоон робот толгой, гэрэлт антенн, чихэвч хэлбэрийн хоёр тал
- **Мира:** дулаан хүн төрх, өвөрмөц үс, зөөлөн нүүрний хувирал
- **Кики:** тоорын өнгөтэй үнэгэн чихтэй AI толгой
- **Ариа:** цэнхэр hologram/halo эффект
- **Бобо:** сарнайн өнгөтэй туулайн чихтэй AI толгой

Бүгд толгой дохих, нүд анивчлах, харц дагах, сонсох/бодох/ярих төлөв болон real-time waveform-тэй. Зөвшөөрөгдсөн ElevenLabs Agent ажиллаж байгаа үед дууны хүчээр амны хөдөлгөөн хэмжигдэнэ. Энэ нь яг үг/авианд тохируулсан viseme lip-sync биш.

Микрофон, wake greeting, эмийн аюулгүй байдлын хамгаалалт, admin Agent ID тохиргоо болон Railway volume хэвээр хадгалагдсан. Fullscreen үед толгой томорно; гар утас, таблет дээр SVG өөрөө хэмжээгээ тааруулна. GPU 3D шаардлагагүй.

## 2026-10-14: ElevenLabs AudioWorklet CSP fix

ElevenLabs SDK defaults to blob/data-based AudioWorklets. The kiosk's strict `script-src 'self'` CSP blocks them, resulting in `Failed to load the rawAudioProcessor worklet module`. Build now **copies version-matched upstream processors** from `@elevenlabs/client/worklets/rawAudioProcessor.js` and `audioConcatProcessor.js` to `public/vendor/elevenlabs/` **before** Vite generates `dist`. `Conversation.startSession` uses same-origin `workletPaths` for WebSocket signed-URL connections, without weakening the CSP. The service worker never intercepts those processor URLs, avoiding HTML/offline fallbacks. After deploy, verify that both URLs return HTTP 200 with a JavaScript content type and contain `registerProcessor`.

This fixes the reported CSP AudioWorklet issue; it does **not** replace microphone permission, agent provider configuration or licensed pharmacist sign-off. Test voice on a supported browser (current Chrome/Edge via HTTPS). Ask the kiosk operator to refresh/reload once after deployment.


## RAINY Insights: pharmacy business ROI dashboard

After logging into /admin.html, the owner sees privacy-preserving day-by-day metrics for 7/30/90 days: device-initiated interaction counts (not unique customers), typed questions processed on our server, VERIFIED catalog answers, UNVERIFIED demo information, unanswered questions, pharmacist referrals, emergency escalations, medicine details viewed, ElevenLabs voice connections / browser-observed AI messages, and pharmacist handoff requests. No mock usage statistics are seeded: reporting starts at zero. Metrics accumulate in /app/storage/analytics.json on the persistent Railway volume, separated from catalog/settings.

Daily counters can be exported to CSV only using an authenticated administrator request. The report does NOT store/transmit question text, medicine names, patient details, audio, transcription, IP addresses or individual session identifiers. Public browser telemetry is intentionally low-trust (usable only for operational insight, not audits/billing). Server-side verified catalog answers are recorded separately.

The potential staff time saved card is an interactive assumption, default 2 minutes per VERIFIED catalog answer, not a factual observed wait-time reduction or monetary ROI. For a genuine customer-facing sales case, establish baseline staffing, pharmacist-reviewed catalog/POS data, and opt-in time studies before publishing financial impact claims.

Customer deployment note: The current app is one independent kiosk/one pharmacy instance. To sell to multiple organizations in production, give each pharmacy its own isolated deployment and storage/ADMIN_TOKEN or build a proper multi-tenant service with per-tenant authentication, access control and data partitions. Do NOT share a single admin token or shared analytics file among pharmacy customers.

Operational privacy: Inform visitors that wake-word detection/browser voice services may send microphone input to external providers; no conversation content is included in this analytics dashboard. Clinical triage decisions must be handled by a licensed pharmacist.


## Салбар бүрийн тусгаарлалт + брэнд лого + AI-тай хамт харагдах эмийн карт (2026-10-15)

**Үндсэн буюу хуучин салбар:** / ба /admin.html — урьдын /app/storage/settings.json, catalog.json, analytics.json өгөгдөлд огт өөрчлөлт хийхгүй.

**Шинэ салбарууд:** Үндсэн админ ADMIN_TOKEN-оор /admin.html-д нэвтрээд **Салбаруудын удирдлага** хэсэгт нэр, URL код оруулж үүсгэнэ. Нууц хүчтэй админ токеныг *зөвхөн нэг удаа* харуулна. Үүнийг тусгай салбарын эрхтэй ажилтанд аюулгүй сувгаар өгнө. Салбарын нэвтрэх холбоос /admin.html?branch=sukhbaatar-01, үйлчлүүлэгчийн киоск /?branch=sukhbaatar-01 хэлбэртэй. Нууц токеныг URL-д бүү оруул. Салбарын token өөр салбар, төв салбарын админ, бүх салбарын жагсаалтад нэвтрэх эрхгүй.

- Салбар бүрийн settings, catalog, analytics нь DATA_DIR/branches/<slug>/ дотор тусдаа; /app/storage дээрх Railway persistent volume үргэлжилнэ. branches-registry.json нь зөвхөн *salted SHA-256 HMAC hash* хэлбэрийн админуудын токеныг хадгална. Токены анхны утгыг дотроос дахин унших боломжгүй.
- Салбарын админ фармацийн нэр, AI нэр, мэндчилгээ, дүр, ElevenLabs Agent ID, каталог, 7/30/90 хоногийн статистик, логог тусдаа засна. Лого PNG/JPEG/WebP, 210 KB хүртэл; зураг аюулгүй MIME болон signature шалгаад JSON тохиргоонд хадгалагдах бөгөөд киоскын робот толгойн дэргэд ба header-д гарна.
- Эмийн талаар ярьж/бичиж байхад каталогийн *танигдсан нэртэй* бүтээгдэхүүний баталгаажсан эсвэл жишээ бүртгэлийн ерөнхий тайлбар/хэлбэр/анхааруулгыг AI дүрийн дэргэд карт болгон харуулна. AI-ийн чөлөөт текстээс тун, жор эсвэл шинэ эмийн бүтээгдэхүүн зохион гаргахгүй. Каталогийн нэрс local browser-д ачаалагдаж, танилт зөвхөн төхөөрөмжид ажиллана; сервер рүү зөвхөн сонгогдсон бүтээгдэхүүний ID-гаар тайлбар авна.
- Хөдөлгөөнт картын мэдээлэл нь баталгаажсан эх сурвалж биш бол тодорхой **туршилтын** шошготой байна. 30 жишээ эм нь бодит үнэ/үлдэгдэл биш.

**Дуут аюулгүй байдлын давхар зөвшөөрөл:** Үндсэн салбарын VOICE_AGENT_CLINICAL_APPROVED тохиргоо хэвээр. Шинэ салбарын дуут agent *өөрөө автоматаар идэвхжихгүй*: глобал VOICE_AGENT_CLINICAL_APPROVED=true бөгөөд тус салбарын slug VOICE_AGENT_APPROVED_BRANCHES-д тодорхой жагсаагдсан үед л ярих эрх нээгдэнэ (жишээ: VOICE_AGENT_APPROVED_BRANCHES=sukhbaatar-01,central-east). Үүнийг тус тусын эм зүйч/клиник хяналтад батлуулсны дараа Railway Variables-д тохируулна. Provider API key одоогоор нэг платформын environment-д төвлөрсөн; шинэ салбаруудын хувьд Agent ID тус тусдаа байх шаардлагатай.

**Хязгаарлалт:** Энэ бол нэг Node.js/Railway процесст суурилсан *логик тусгаарлалттай* эхний олон салбарын MVP; физик тусдаа өгөгдлийн сан, tenant тус бүрийн encryption key, аж ахуйн нэгжийн IAM, billing, POS интеграц биш. Том хэмжээний борлуулалтад PostgreSQL tenant_id + row-level security, аудит, backup-restore, токен сэргээх/солих, шаталсан байгууллага/салбарын эрх нэвтрүүлэх шаардлагатай. Дуунд хариулах ElevenLabs-ийн медицин систем prompt нь provider дээр тусдаа хянагдах ёстой, зөвхөн энэ аппийн аюулгүй /api/ask route нь дуут LLM-ийн output-ийг хязгаарлахгүй.


## Manual admin subscriptions (2026-10-15)

The central platform admin (ADMIN_TOKEN) can assign each new branch a manually entered Starter/Pro/Enterprise plan and expiry day using /admin.html > Branch Manager > Manage Subscription. New branches start as pending. Active access lasts through the selected date at 23:59:59.999 UTC. When expired or paused, server API refuses public catalog, search, AI question, voice, vision and analytics events with HTTP 403; branch admins can still log in and edit or export data. Legacy default pharmacy remains active. Entitlement and last 150 manual changes (date, plan, status, note) persist in branches-registry.json. Platform API: PUT /api/admin/branches/subscription; branch API: GET /api/admin/subscription?branch=slug. No QPay or automatic payment processing is involved.

New branch-admin CSV medicine import supports UTF-8 headers and escaped commas and previews data in the JSON editor without saving immediately. Imports cannot mark records verified. A licensed pharmacist must independently verify entries before operational use. Enterprise PostgreSQL/RLS, user accounts, POS sync, backup automation and device provisioning are still separate work.
