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

## Premium 3D avatar engine

`src/avatar-3d.js` uses Three.js WebGL2 + physically based materials to render **five distinct procedural 3D characters** (robots, a stylized human avatar and hologram). Facial rig reacts to live ElevenLabs input/output signal level (energy lip sync, **not phoneme-accurate** visemes). Eye blinking, brows, head and idle breathing are stateful. Idle and fullscreen are responsive via ResizeObserver, capped devicePixelRatio for kiosk hardware. Failed/lost GPU context falls back to the existing 2D CSS avatar. Actual photoreal human/GLB avatar models and precise viseme retargeting are separate work, not shipped in this version.

**Agent ID:** admin login at `/admin.html` → *ElevenLabs Agent ID* → Save. Permanent settings require Railway volume mounted at `/app/storage` and `DATA_DIR=/app/storage`. Alternatively set `ELEVENLABS_AGENT_ID` in Railway Variables (server fallback). Set secret `ELEVENLABS_API_KEY` only in Railway Variables; it is never included in frontend output. Voice remains disabled until a licensed pharmacist approves the agent knowledge and policies and explicitly enables `VOICE_AGENT_CLINICAL_APPROVED=true`. No clinical advice by default.
