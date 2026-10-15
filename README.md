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


## Phase II: reliable AI and pharmacy information (2026-10-15)

This release adds scoped integration readiness (/api/admin/integrations/status), a defensive browser voice fallback when signed ElevenLabs websocket fails, a deterministic non-persistent triage warning for unsafe spoken clinical questions, and manual POS inventory snapshots (PUT /api/admin/inventory/snapshot with items [{id,priceMnt,stock}]). Only previously pharmacist-verified catalog items matching exact IDs get stock/prices; demo medicines remain unpriced. No real-time POS connection or vendor API was configured; inventory livePOSConnected is intentionally false. The browser warns users to seek qualified pharmacists and does not claim to suppress already-spoken ElevenLabs audio. ElevenLabs agent-side medical system prompts and tooling MUST be reviewed and approved by a licensed pharmacist before setting approval flags; do not claim these new browser warnings are a safety boundary for provider model output. Per-device heartbeat and manual protected backup export were shipped in previous phase. Browser/microphone hardware tests, real provider execution and real POS API end-to-end checks depend on supplier credentials and licensed staff review and remain unverified.


## Organization operations (2026-10-15)

Central ADMIN_TOKEN users see the multi-branch organization dashboard inside `/admin.html`. It aggregates 7/30/90 day server-counted question volumes, independently tracked verified catalog answers and pharmacist handoffs with each branch's subscription and current kiosk heartbeat. Only central administrators can read `/api/admin/organization/report`, `/api/admin/organization/sla`, `/api/admin/organization/backups`, `/api/admin/organization/backups/create`. Branch administrator tokens cannot see other branch data or org-wide reports.

Audit: `DATA_DIR/operations-audit.json` contains server-recorded allowlisted action metadata (time, action type, branch slug, hash-link), not questions, medication information, patient identity, credentials, API keys or transcript content. Events include branch creation, subscriptions, device enrollment/revocation, inventory/settings/catalog changes, and manual backup exports. The log is capped to 2000 entries; hash linking is tamper-evident within its retained chain, **not** external immutable compliance-grade audit storage.

Backup: in addition to existing admin-only one-branch JSON export, local operational snapshots are taken at startup, on an every-24-hour interval while this Node service runs, and via central admin. Maximum 14 JSON copies under `DATA_DIR/scheduled-backups` on the existing Railway persistent volume, SHA-256 digest calculated. Exports include a limited 90-day analytics report and *sanitized* settings (no Agent ID), catalogue and device statuses, but **not full database recovery**, hashed authentication records, raw medical data, external provider secrets, or full analytics history. `GET /api/admin/organization/backups` shows retained filenames. This is a local *operational export* and NOT off-site backup or tested restore; production recovery requires independent encrypted object storage, retention, periodic restore drills and backups tested against tenant authentication records.

SLA: `/api/admin/organization/sla` reports present device heartbeat online/offline status only. It deliberately exposes `slaUptimePercent:null`, because a real availability claim requires an independent probe with historical time windows, exclusion policy and separately measured failures. The dashboard must not claim contractual uptime or guaranteed SLA from a single snapshot.


## PostgreSQL shadow migration, AES-GCM offsite snapshot, independent SLA probe (2026-10-15)

The Railway project now has a managed PostgreSQL service and separate S3-compatible bucket. `DATABASE_URL` is a Railway private-service reference. The app safely starts with the original persistent file store as source of truth; at startup and every 24 hours it mirrors sanitized per-branch operational data into PostgreSQL JSONB rows keyed by branch_slug and creates local + encrypted S3 snapshots. **No automatic cutover or delete of source files**, and PostgreSQL must NOT be advertised as primary until transactional writes, reconciliation and restore of branch credentials have been validated. Original token hashes and secrets are never included in the PostgreSQL shadow copy.

Offsite payload uses random 12-byte IV and AES-256-GCM per snapshot, with SHA-256 plaintext integrity verification and S3 object retrieval + decrypt validation (non-destructive restore drill). Secret key is configured as BACKUP_ENCRYPTION_KEY on Railway; do not log or export it. Backup health is explicitly represented as verified only when a real S3 write/read/decrypt roundtrip passes. Backups exclude API secrets and raw user transcripts; they are **operational snapshots, not yet a full recovery package for authentication data**. A disaster recovery cutover and independent encrypted copies of complete database and tenant credentials remain separate work.

Independent external SLA checks run using GitHub-hosted Actions at a requested five-minute schedule, with actual run outcomes in GitHub Actions history and failed checks visible as failed workflows. GitHub scheduling can be delayed. This monitor does not yet persist a tamper-resistant uptime time series, calculate contractual SLA percentages or automatically send incident notifications; do not claim 99.9% uptime. Never embed provider credentials in the workflow.


## Organization access and visitor session privacy (2026-10-15)

Central admin creates a pharmacy branch with slug, display name, and login name. One-time, cryptographically random login code and legacy admin token are returned at creation only; only salted HMAC hashes persist in the branch registry. Visit `/admin.html?branch=<slug>` and use login name/code (HTTP Basic over HTTPS) or the previous branch token. Never share codes publicly. Previous branches without named logins keep using their existing tokens; no automatic account reset/migration. Central admin continues using `ADMIN_TOKEN`. Branch scope and expiration checks remain server-side. Future security work: per-person accounts, MFA, credential rotation/revocation and rate limits per identity.

Each branch controls `idleTimeoutSec` (30–900 seconds, default 120) and `resetOnDisconnect` in **Brand, AI settings**. With no pointer, keyboard, new chat or conversation messages for the configured period, browser closes the active ElevenLabs/browser voice connection, stops microphone recognition, clears current chat and medicine card, resets the form and greets the next visitor without persisting the previous chat. The user can also press **Шинэ үйлчлүүлэгч**. Disconnected voice sessions can optionally trigger the same reset; stale asynchronous text answers are discarded by per-visitor epoch. This is **activity-based presence inference**, not physical person detection; no camera tracking, face recognition or recorded transcripts. A configured wake-word listener may resume after closing the session and remains subject to the user's microphone permissions.

**Integrations:** each organization's ElevenLabs Agent ID is editable from the AI/POS integration tab. Clinical approval flags and shared provider API secrets stay server-side in Railway environment settings; the admin page reports configured/unconfigured status without showing provider keys. POS snapshots and medicine catalog editing remain available in admin; real-time third-party POS/provider configuration requires vendor API credentials and commercial approval, so these are not falsely marked live.


## Living avatar — gentle waiting gestures (2026-10-15)

All five existing 2.5D AI characters have an optional, lightweight ambient animation director. When the kiosk is ready or in wake-greeting mode without interaction, the characters occasionally glance aside, tilt their heads curiously, sway, stretch, look drowsy, or yawn. Rare extended-wait gestures only become eligible after 28–45 seconds of quiet time; animations are short and do not run continuously. Blink and gentle floating remain CSS-driven. User interaction cancels current waiting gestures immediately. Listening, connecting, speaking and emergency voice states suppress ambient gestures so facial speech and clinical feedback have priority. Page visibility, disposal and operating-system `prefers-reduced-motion` are respected. There is no webcam/presence recognition, audio analytics, extra API cost or stored visitor identity.

**Tenant controls:** central admin → Салбар ба эрх → organization AI settings, or branch admin → Брэнд, AI тохиргоо → `AI дүрийн амьд хүлээлтийн хөдөлгөөн`. `avatarIdleEnabled` defaults to `true` and can be turned off per organization. Saving takes effect after the kiosk page reloads. Decorative actions are scripted illustration animations, not an assertion of sentience or a physical person actually being observed.


## Reliable living avatar motion QA (October 2026)

All five 2.5D characters use independent controllers. Ambient blinks are randomized every 2.8–5.5 seconds, subtle eye movement every 1.2–3 seconds, with gentle CSS floating/head motion. Eye micro-movements continue through active speech or listening; lip sync remains unaffected. The first large waiting gesture occurs after 10–14 seconds, then other gestures roughly 10–20 seconds apart (plus each gesture's duration). Yawn, drowsiness and stretches are only eligible after extended quiet time.

Idle gestures are canceled when speech starts, while micro-movements pause only when the tab is hidden, emergency state is on, the device requests reduced motion, or the organization has disabled the live avatar option. Pointer drift does not count as an interaction; deliberate taps and keystrokes do. Both controllers tear down their own timers to prevent stale activity after avatar disposal.

Verification: Node tests cover fake-timer state transitions and all five SVG shapes. GitHub CI additionally executes a real headless Chromium smoke test via node scripts/avatar-browser-smoke.mjs, checking each character's blink, gaze, yawn, and stretching CSS layers in a mounted SVG. The smoke fixture disables CSS transition interpolation during the gaze style assertion because Chrome virtual-time clocks may skip compositor frames. Physical device microphone and portrait visual QA remain separate checks.


## Daily kiosk operations — 24/7

Public voice conversations are available at any hour, independent of server timezone. Idle and session-duration limits control paid conversations separately from wall-clock access.

**Cost safeguards:** One voice session has a three-minute hard timeout and the server caps new signed-link issues to 24 per rolling hour per branch/IP. Browser wake recognition is manually enabled by authorized staff; it should not trigger billable ElevenLabs sessions merely from normal ambient sound. Low-confidence local STT results and one-word fragments are ignored. Repeated provider failures fall back to locally available browser STT / typed chat. No guarantee of zero provider charges or exact monthly budget; review ElevenLabs usage dashboard and configure an account-level spending cap, if available, with the provider.

**Audio in a real pharmacy:** Software cannot reliably identify a specific speaker or direction from one generic microphone. Use a **directional, close-range USB microphone or headset** positioned by the kiosk with acoustic shielding and noise suppression; test it during the busiest pharmacy hours. For ElevenLabs Agent set the correct Mongolian language/voice, a reviewed Mongolian system prompt, patient/normal turn eagerness, VAD and maximum conversation duration **180 seconds** in the provider dashboard. Avoid wide-field far microphones and avoid automatically turning voice on at unattended kiosks. Require explicit action or a clearly recognized wake phrase. The clinic's medication catalog and pharmacist handoff remain the only appropriate sources for clinical specifics; AI must never guess medicine dosing.

This is a cost/safety defense-in-depth configuration, **not** speaker diarization, active beamforming or proven medical-grade audio isolation. Real close/far speech tests on the intended 9:16 kiosk hardware are required before claiming those properties.


## Continuous operating mode (2026-10-15 clarification)

RAINY Pharmacy Kiosk accepts customers at any hour. The mistaken 08:00-22:00 access limitation has been removed. Idle waiting does not open ElevenLabs paid conversations. Provider connections start only after a manual visitor action or a staff-enabled and recognized greeting. The visitor idle reset and 180-second maximum conversation guard close paid sessions; the server also caps repeated signed URL issuance. The microphone wake listener may use browser speech recognition while awaiting a greeting, so it is NOT guaranteed to be free of third-party processing. Use near-field directional microphones and explicitly configure wake/listening and budgets with your provider. No generic microphone can completely ignore background speakers.


## Subscription pricing display (2026-10-15)

The draft commercial rate card starts at **Starter ₮399,000/month**, then **Pro ₮699,000/month** and **Enterprise ₮1,299,000/month**. These are suggested, editable business rates, **not** automatically collected payments, invoices, receipts or binding quotes. Central admin can choose a tier and manually grant access until a specified expiration date. Future billing must reconcile verified payment, per-branch rate and duration before activation. No automatic payment claim is made.

## Organization medicine catalogs and central account controls (2026-10-15)

Owner console > **Салбар ба эрх** now includes a per-organization medicine catalog manager. Each branch retains its own server-scoped `catalog.json` under `DATA_DIR/branches/<slug>`; server-side authorization prevents cross-tenant reads and writes. The owner may select a branch, load its private catalog, review an unverified CSV import (or prepare an empty catalog), then explicitly confirm replacing **only that branch's** catalog. A BOM-prefixed UTF-8 CSV template is downloadable in both owner and branch admin views. All medication facts need independent pharmacist review; CSV cannot auto-verify data. This is logical tenant isolation in one running service, **not** dedicated physical PostgreSQL databases per organization. Existing PostgreSQL remains a JSONB shadow mirror; do not advertise a completed transactional database migration.

Central admins may rotate branch login name, login code (min 16 chars) and branch admin token (min 24 chars) via the owner console. New secrets are **never returned or redisplayed** and are stored only as salted hashes; changed secrets immediately invalidate old ones, without affecting other organizations. Record the new supplied values in an approved secure password vault. Avoid reuse across organizations. The platform's own `ADMIN_TOKEN` remains a server environment secret and cannot be rotated from an ordinary organization account.

The organization operations dashboard now separately shows observed `voiceConnected` event counts, not billable ElevenLabs units. Precise provider credits are explicitly marked as unavailable pending provider usage metering with proper credentials and attribution. Never infer provider costs or remaining credits from connection counts. The original owner-wide counts and CSV analytics continue to be available.

## Verified Mongolian catalogue guide (2026-10-15)

Public branch kiosks show only verified medicines. New branches start with empty catalogues, not copied samples. Older draft medicines are retained in authenticated admin for pharmacist approval but hidden from tenant-facing public endpoints, including medicine images and name vocabulary. Only the central root/demo site shows the unverified sample warning.

A pharmacist can add name, aliases (Mongolian, Latin, spoken variants), approved description, category, form, warnings, sourceUrl, verifiedAt, priceMnt, stock, shelf, and an optional HTTPS imageUrl to admin catalogue JSON. Only entries with verified: true, an HTTPS source, and a review date publish. The organization's verification claim does not constitute independent verification by RAINY.

The kiosk matches typed and spoken names, grammar suffixes and conservative long-word Cyrillic single-letter variations. It does not guess unknown or ambiguous drug names. Drug photo, description, stock and price are displayed as an interactive product card within chat, not above the assistant. A purchase-interest action requests pharmacist handoff, not a completed reservation, payment or order. Medical diagnoses, dosing, replacement medicines and emergencies require qualified care. The next visitor session clears all cards.

For ElevenLabs Agent, enable the System prompt and ASR keywords overrides in Security -> Overrides and pharmacist-review the agent configuration. The kiosk passes a scoped Mongolian medicine-only prompt and up to 50 verified medicine names/aliases as ASR keywords at conversation startup. Providers that disallow overrides fall back to browser recognition when supported. Third-party STT accuracy, clinical safety and absolute topic adherence require external provider tests; no prompt can guarantee them. Large catalogues beyond the per-session 70 detailed items require a provider-side live catalog tool for complete voice coverage.


## ElevenLabs subscription credit sync (2026-10-15)

The platform owner admin (not branch admins or public kiosks) can see the ElevenLabs API key's **shared workspace included subscription quota** under **AI ба POS → ElevenLabs · бодит хэрэглээ**. A read-only server-side call to official `GET https://api.elevenlabs.io/v1/user/subscription` with the Railway `ELEVENLABS_API_KEY` is cached for 60 seconds and de-duplicated between requests. The admin UI refreshes automatically every 120 seconds while visible (or with its refresh button). The provider key, raw invoices, unneeded account details and billing tokens are NEVER sent to the browser, written into logs, or persisted. If the provider key has endpoint scope restrictions, an explicit permission error is displayed; incorrect/missing data is **unknown, never zero**. Rolling out a new API key or plan quota no longer requires redeploy to update this included-quota display.

**Crucial limit:** ElevenLabs calls these fields `character_count` and `character_limit`; they correspond to the included quota. New separately purchased **Pay As You Go Top Up** funds are a prepaid *separate balance* displayed by ElevenLabs in **Developers → Top Up** and are **not guaranteed to be included** in this API response. This screen does NOT invent or merge a PAYG balance, nor initiate auto purchases or subscriptions. Usage is SHARED by all organizations using this Railway API key, not attributable to each branch. Grant the API key permission to read user/subscription information in ElevenLabs Developer API key settings if access is denied. Normal kiosk functionality must stay available when account-usage polling fails; this is informational only.

## ElevenLabs PAYG API usage

The existing server-side ELEVENLABS_API_KEY is used for API requests and signed Agent connections. There is no separate PAYG endpoint or key. Enable and fund Top Up in the same ElevenLabs workspace as the key and agent. The provider consumes included subscription credits first, then PAYG. The admin included-credit monitor never blocks API requests when the included balance reaches zero or is unavailable. PAYG availability and balance are not inferred from the subscription endpoint. Top Up purchases and auto-recharge remain provider-account actions. Reference: https://elevenlabs.io/docs/overview/administration/pay-as-you-go
