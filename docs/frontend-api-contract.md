# Frontend API contract

สัญญานี้เป็นจุดเชื่อมระหว่าง Expo/React Native กับ backend ปัจจุบัน ทุก route ยกเว้น OAuth ต้องส่ง
`Authorization: Bearer <accessToken>` และใช้ base path `/api/v1`.

## Authentication

| Method | Route            | Body                                            |
| ------ | ---------------- | ----------------------------------------------- |
| `POST` | `/auth/google`   | `{ "idToken": "..." }`                          |
| `POST` | `/auth/facebook` | `{ "accessToken": "..." }`                      |
| `POST` | `/auth/apple`    | `{ "identityToken": "..." }`                    |
| `POST` | `/auth/logout`   | ไม่มี body; ลบ token จาก secure storage ฝั่งแอป |

OAuth สำเร็จจะคืน `{ accessToken, tokenType, expiresIn, user }`. Backend ตรวจ signature/audience/issuer
กับผู้ให้บริการก่อนสร้างหรือผูกบัญชี ห้ามส่ง profile ที่แอปสร้างเองมาใช้แทน provider token.

## Onboarding and profile

`PUT /me/profile` รับ field จาก wizard ได้ใน request เดียว:

```json
{
  "name": "Somchai",
  "birthday": "20/07/1994",
  "gender": "male",
  "weight": 70,
  "height": 175,
  "activityLevel": "moderate",
  "exerciseFrequency": "3-4_per_week",
  "footSizeLeft": 42,
  "footSizeRight": 42.5,
  "conditions": ["diabetes"],
  "injuryHistory": "Previous right ankle sprain",
  "currentMedications": ["metformin"],
  "shoeType": "running",
  "painLevel": 3,
  "painPoints": ["right_heel"]
}
```

เพื่อรองรับ mobile state ปัจจุบัน backend รับ `birthDate` เป็น alias ของ `birthday`, รับ `age` แต่ไม่เก็บ
(วันเกิดยังเป็น source of truth) และรับ `goal` ใน request เดียวเพื่อสร้าง active goal ได้ด้วย

`birthday` รับทั้ง `YYYY-MM-DD` และ `DD/MM/YYYY`; backend เก็บวันเกิดเป็น `DATE` และคำนวณ `age`
ใน response ใหม่ทุกครั้งโดยไม่เก็บอายุลงฐานข้อมูล ส่วน field แบบรายการรับได้ทั้ง string เดียวหรือ array.
ข้อมูลสุขภาพจะสร้าง assessment record ใหม่เพื่อเก็บประวัติ ส่วนข้อมูล profile จะ upsert.

| Method    | Route                        | Purpose                                                                         |
| --------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `GET`     | `/me`                        | profile ล่าสุด พร้อม health, goals, settings, consents และ `onboardingComplete` |
| `GET/PUT` | `/me/goals`                  | goal และ progress ของวันนี้ (`steps`, `distance`, `calories`, `duration`)       |
| `GET/PUT` | `/me/settings`               | language/theme/unit/time/date settings                                          |
| `GET/PUT` | `/me/health`                 | health assessment history / เพิ่ม assessment                                    |
| `GET`     | `/me/risks?scope=rolling_7d` | risk history และค่าล่าสุดแยกตามชนิด                                             |
| `GET/PUT` | `/me/consents/:type`         | consent history / grant-revoke พร้อม version                                    |

## Devices

Pair ด้วย `POST /devices/pair`:

```json
{
  "deviceSerial": "SOLE-001",
  "deviceModel": "BL-1",
  "hardwareVersion": "1.0",
  "autoReconnect": true
}
```

ใช้ id ของ `UserDevice` ที่ได้กลับมาเป็น `:id` สำหรับ `/devices/:id/status`, `/battery`, `/sync`,
`/calibrate`, update และ unpair. Calibration รองรับ `footSizeLeft`, `footSizeRight`, `weight` และ
`baselinePressureMap`.

## Activity sessions

ลำดับ realtime:

1. `POST /sessions/start` ส่ง `activityType`, `clientSessionUuid` และ `deviceId` (ถ้ามี)
2. `POST /sessions/:id/data` ส่ง `{ samples: [...] }` หรือ `{ data: {...}, sequence, recordedAt }`
3. `POST /sessions/:id/finish` ส่ง summary จากแอป เช่น `steps`, `duration` (นาที), `distance`,
   `calories`, `peakLeft`, `peakRight`

Offline batch ใช้ contract เดิมของ `DataSyncService` ได้ตรง ๆ:

```text
POST /api/v1/sessions/sync-batch
Content-Type: multipart/form-data
file=<application/x-ndjson>
session_id=<client session id>
device_type=android|ios
```

แต่ละบรรทัดต้องเป็น JSON object. ถ้ามี `sequence` backend จะ deduplicate การ retry; raw payload จะถูกเก็บ
แบบ protocol-neutral ใน `session_sensor_samples` เพื่อรอ decoder/algorithm ตัวจริง.

| Method | Route                                | Purpose                                               |
| ------ | ------------------------------------ | ----------------------------------------------------- |
| `GET`  | `/sessions?from=&to=&limit=&cursor=` | history; default ย้อนหลัง 7 วัน                       |
| `GET`  | `/sessions/:id`                      | metrics, zones, gait, alerts, AI และ risk ของ session |
| `GET`  | `/sessions/:id/pressure-map`         | pressure zones และ left/right balance                 |
| `GET`  | `/sessions/:id/gait-analysis`        | gait metrics และ phases                               |
| `GET`  | `/sessions/:id/insight`              | insights ของ session                                  |

## Dashboard and notifications

- `GET /me/goals` ให้ daily goal/progress
- `GET /sessions?limit=7` ให้ activity chart/history
- `GET /me/risks` ให้ fall/pain risk ล่าสุด
- `GET /ai/insight` ให้ insight ล่าสุด; `POST /ai/insight` สร้าง deterministic fallback insight จากข้อมูลล่าสุด
- `GET /notifications` คืน `{ items, unreadCount }`
- `POST /notifications/read` รับ `{ "notificationIds": ["..."] }`
- `GET/PUT /notification-settings` จัดการ preference แยก channel/category
- `GET/POST/DELETE /notification-devices` ใช้ลงทะเบียน Expo/FCM/APNs push token; response ไม่คืน token เต็ม

## Health integrations

HealthKit และ Health Connect อ่านได้จากอุปกรณ์ผู้ใช้ ดังนั้นแอปเป็นผู้ขอ permission และส่ง summary เข้า backend:

1. `POST /health-integrations/connect` ส่ง `{ "provider": "apple_health" | "health_connect" }`
2. `POST /health-integrations/sync` ส่ง `{ integrationId, summaries: [{ date, steps, distanceKm, calories, heartRateAvg }] }`
3. Backend queue งานและ upsert `HealthDailySummary`; ใช้ `GET /health-integrations` ดู sync status
4. `DELETE /health-integrations/:id` disconnect โดยยังเก็บ audit/history เดิม

## Content and deterministic recommendation

- Admin/Content Editor จัดการ draft content ที่ `/admin/content/*`; publish/unpublish ต้องเป็น Admin ที่ยืนยัน 2FA แล้ว
- วิดีโอต้องเป็น YouTube URL ที่ตรวจผ่าน oEmbed และต้องมี `aiDescription` สำหรับ grounding
- `POST /ai/recommend-program` match เฉพาะ published program ผ่าน `ProgramRecommendationRule`; ถ้าไม่ match จะคืน
  `matched: false` แทนการให้ AI สร้างโปรแกรมหรือ URL เอง

## Deployment requirement

ก่อนเปิด API เวอร์ชันนี้ให้รัน `npm run db:migrate:deploy`. Migration
`20260720000000_frontend_readiness` เพิ่ม onboarding fields, health assessment fields, left/right calibration
และ raw sensor sample storage.
