# Production readiness and external-key checklist

ส่วนที่ทำงานได้โดยไม่ต้องใช้ external key แล้ว:

- OAuth token verification code, profile/health/goals, devices และ session sync/history
- Mobile health summary queue สำหรับ Apple Health / Health Connect
- Session metric, relative pressure-zone และ measured gait aggregation
- Admin content review/publish workflow, YouTube oEmbed link checking และ deterministic recommendation
- Notification outbox/in-app delivery, Expo Push adapter, link-check/episode/notification schedules
- Production JWT fail-fast, encrypted TOTP seeds และ 2FA enforcement สำหรับ privileged routes

## Secrets/keys ที่ต้องใส่ก่อนทดสอบ staging

| กลุ่ม          | ตัวแปร                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| Core security  | `JWT_ACCESS_SECRET`, `TOTP_ENCRYPTION_KEY`, `INTERNAL_API_KEY`                        |
| OAuth          | `GOOGLE_CLIENT_ID(S)`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `APPLE_CLIENT_ID(S)` |
| AI/RAG         | `OPENAI_API_KEY` และ model settings                                                   |
| Expo Push      | `EXPO_ACCESS_TOKEN` เฉพาะเมื่อเปิด access-token security ใน Expo                      |
| Infrastructure | production Postgres/Redis/S3 credentials, domain, CORS และ TLS                        |

ใช้ค่า random คนละค่ากันอย่างน้อย 32 ตัวอักษรสำหรับ secret ทุกตัว ห้าม commit `.env` หรือ service-account JSON.

## สิ่งที่ตั้งใจไม่เดาและต้องรอข้อมูลจริง

1. **BLE protocol:** ต้องมี service UUID, characteristic UUID, packet layout, units และ sample rate ก่อนเขียน decoder.
2. **Fall/pain risk:** API/schema พร้อมอ่านผล แต่ยังไม่สร้าง clinical score จาก heuristic ที่ไม่ได้ validate. ต้องมี
   algorithm specification, threshold source, version และชุดข้อมูล validation ก่อนเปิดใช้งาน.
3. **Gait phases/absolute pressure:** worker คำนวณเฉพาะ measured/relative values. Absolute pressure ต้องใช้ sensor unit,
   calibration protocol และ baseline ที่ยืนยันแล้ว.
4. **Direct FCM/APNs:** Expo Push path พร้อมใช้งานกับ Expo app แล้ว; direct-native registrations จะถูกบันทึกเป็น
   `not_configured` จนกว่าจะเพิ่ม provider adapter และ credential rotation procedure.
5. **JWT revocation:** logout ปัจจุบันเป็น stateless access token. ถ้าต้องการ logout ทุกเครื่อง/ยกเลิก token ทันที
   ให้เพิ่ม refresh-token rotation, hashed token store และ revocation list ก่อนเพิ่ม refresh endpoint.
6. **Data lifecycle:** ต้องกำหนด retention และ purge สำหรับ sensor/object-storage data ก่อน production จริง.

## Security follow-up ก่อน public launch

- เพิ่ม refresh-token rotation/revocation และ device-session management หากผลิตภัณฑ์ต้องการ logout ทันทีทุกเครื่อง
- ตรวจสถานะ `active/suspended/deleted` จาก DB หรือ cache ระหว่าง JWT authentication สำหรับ endpoint สำคัญ
- เพิ่ม OAuth nonce/state binding ใน mobile flow และทดสอบ account-linking ของแต่ละ provider ด้วยบัญชีจริง
- แยกผู้ submit content กับ Admin ผู้ approve ใน production และเก็บ audit log ลงระบบที่แก้ย้อนหลังไม่ได้ง่าย
- วาง push token และ database volume บน encrypted storage; พิจารณา application-level encryption หาก threat model ต้องการ
- ย้าย production secrets จาก `.env` ไป secret manager/Docker secrets และกำหนด rotation/recovery procedure
- ทำ real integration tests กับ PostgreSQL/Redis/MinIO และ provider sandbox เพราะ e2e ปัจจุบันยัง mock service layer หลายส่วน

## One-shot verification หลังใส่ key

```sh
npm run db:migrate:deploy
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
node test-deployment.js
```

ถ้าฐานข้อมูลเคยพยายามใช้ migration `20260720000000_frontend_readiness` รุ่นเดิมและค้างเป็น `failed` จาก UUID/TEXT foreign-key mismatch ให้ยืนยันก่อนว่า migration rollback แล้ว จากนั้นรันครั้งเดียว:

```sh
npx prisma migrate resolve --rolled-back 20260720000000_frontend_readiness
npm run db:migrate:deploy
```

ไม่ต้องใช้คำสั่ง `resolve` กับฐานใหม่หรือฐานที่ migration ไม่เคยล้มเหลว

หลัง container healthy ให้ทดสอบตามลำดับ OAuth → 2FA admin → admin publish content → recommendation →
session upload/finish → notification → health sync → AI chat/RAG.
