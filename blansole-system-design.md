# Blansole / Blan Sole Pre — Smart Insole Health App
## System Design Document (Backend-focused) v3

> เอกสารนี้ปรับปรุงจาก v2 โดยเพิ่ม: **AI Memory Architecture** (Memory Orchestrator + semantic/episodic/cohort memory), **Content Library & Video Recommendation System** (รองรับลิงก์ YouTube ช่องตัวเอง), และ **Admin Panel** สำหรับควบคุมเนื้อหาที่ AI ใช้ได้

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [System Architecture Diagram](#2-system-architecture-diagram)
3. [Database Design](#3-database-design)
4. [Redis Design](#4-redis-design)
5. [AI + RAG Architecture](#5-ai--rag-architecture)
6. [Content Library & Video Recommendation System](#6-content-library--video-recommendation-system)
7. [Admin Panel](#7-admin-panel)
8. [API Design](#8-api-design)
9. [Worker / Queue Architecture](#9-worker--queue-architecture)
10. [Notification System](#10-notification-system)
11. [Security & Privacy (PDPA)](#11-security--privacy-pdpa)
12. [Mobile & Device Considerations](#12-mobile--device-considerations)
13. [Docker Architecture](#13-docker-architecture)
14. [CI/CD Pipeline (Git-based)](#14-cicd-pipeline-git-based)
15. [Tech Stack สรุป](#15-tech-stack-สรุป)
16. [MVP Roadmap (ปรับปรุง)](#16-mvp-roadmap-ปรับปรุง)
17. [Open Decisions / สิ่งที่ต้องตัดสินใจเพิ่ม](#17-open-decisions--สิ่งที่ต้องตัดสินใจเพิ่ม)

---

## 1. ภาพรวมระบบ

ระบบมี 5 แกนหลักเหมือนเดิม แต่เพิ่มความชัดเจนเรื่อง **layer ของข้อมูล** และ **จุดที่ต้อง guardrail**:

```text
Raw Sensor Data → Calculated Metrics → Risk/Gait Analysis → AI Insight → Notification/Recommendation → Historical Trend
```

หลักการออกแบบที่ยึดตลอดเอกสารนี้:

- **Deterministic ก่อน, AI ทีหลัง** — ค่าที่คำนวณได้ด้วย logic ปกติ (threshold, average, score) ต้องไม่ให้ LLM คำนวณเอง รวมถึง **การเลือกเนื้อหา/วิดีโอที่จะแนะนำ** ก็ต้อง deterministic เช่นกัน (ดู §6) ไม่ใช่ให้ AI แต่งเอง
- **Versioning ทุกจุดที่มีการคำนวณ/AI** — algorithm เปลี่ยน, prompt เปลี่ยน, guideline เปลี่ยน ต้อง trace ย้อนหลังได้ว่า session เก่าคำนวณด้วย version ไหน
- **Consent & data lifecycle ชัดเจน** — ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว
- **Modular monolith ก่อน** — ยังไม่ทำ microservices/K8s จนกว่าจะจำเป็นจริง แต่ **แยก container ตาม responsibility** ไว้ตั้งแต่แรกด้วย Docker เพื่อให้ scale แยกส่วนได้ทีหลังโดยไม่ต้อง refactor ใหญ่
- **มนุษย์ต้อง approve เนื้อหาก่อน AI จะแนะนำได้เสมอ** — ทั้งความรู้ (RAG) และวิดีโอ/โปรแกรม (§6-7) ต้องผ่าน publish workflow ก่อน AI จะมองเห็น

---

## 2. System Architecture Diagram

```mermaid
flowchart TB
    subgraph Device["Smart Insole Device"]
        SENSOR[Pressure Sensors L/R]
    end

    subgraph Mobile["Mobile App (Flutter)"]
        BLE[BLE Client]
        LOCALDB[(SQLite / Secure Storage)]
        LIVECALC[Local Real-time Calc]
    end

    subgraph Edge["API Gateway"]
        GW[Nginx / API Gateway]
    end

    subgraph Backend["Backend API (Modular Monolith)"]
        AUTH[Auth Module]
        PROFILE[Profile Module]
        DEVICEAPI[Device Module]
        SESSIONAPI[Session Module]
        AIAPI[AI Module]
        NOTIFAPI[Notification Module]
        HEALTHAPI[Health Integration Module]
        ADMINAPI[Admin Content Module]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL + pgvector)]
        REDIS[(Redis: cache/queue/state)]
        OBJ[(Object Storage: MinIO/S3)]
    end

    subgraph Workers["Worker Services (separate containers)"]
        WSESSION[Session Processing Worker]
        WAI[AI Worker]
        WNOTIF[Notification Worker]
        WHEALTH[Health Sync Worker]
        WLINK[Link Checker Worker]
        WEPISODE[Episode Summary Worker]
    end

    subgraph AISvc["AI Service"]
        LLM[LLM API]
        RAG[RAG Retriever]
    end

    subgraph External["External"]
        YT[YouTube oEmbed]
    end

    subgraph Push["Push Delivery"]
        FCM[Firebase Cloud Messaging / APNs]
    end

    SENSOR -->|BLE| BLE
    BLE --> LIVECALC --> LOCALDB
    LOCALDB -->|HTTPS sync| GW
    GW --> AUTH & PROFILE & DEVICEAPI & SESSIONAPI & AIAPI & NOTIFAPI & HEALTHAPI & ADMINAPI

    AUTH & PROFILE & DEVICEAPI & SESSIONAPI & NOTIFAPI & HEALTHAPI & ADMINAPI --> PG
    SESSIONAPI --> OBJ
    SESSIONAPI --> REDIS
    AIAPI --> REDIS
    REDIS -->|enqueue job| WSESSION
    REDIS -->|enqueue job| WAI
    REDIS -->|enqueue job| WNOTIF
    REDIS -->|enqueue job| WHEALTH
    REDIS -->|scheduled job| WLINK
    REDIS -->|scheduled job| WEPISODE

    WSESSION --> PG
    WSESSION --> OBJ
    WAI --> RAG --> PG
    WAI --> LLM
    WAI --> PG
    WNOTIF --> FCM
    WNOTIF --> PG
    WHEALTH --> PG
    WLINK --> YT
    WLINK --> PG
    WEPISODE --> PG

    FCM -->|push| Mobile
```

**หมายเหตุสำคัญ:** แต่ละกล่องใน `Backend` และ `Workers` คือ **Docker container แยกกัน** (ดูหัวข้อ 13) แม้จะ deploy เป็น modular monolith ในเชิง codebase (repo เดียว, deploy พร้อมกันได้) ก็ตาม เพื่อให้ scale worker ที่หนัก (AI Worker) แยกจาก API ได้โดยไม่กระทบ traffic หลัก `Admin Content Module` เป็น route กลุ่มหนึ่งใน `api` container เดิม ไม่ใช่ service แยก (เหตุผลดู §7.3)

---

## 3. Database Design

### 3.1 หลักการ

- ใช้ PostgreSQL เป็นแหล่งความจริงหลัก (source of truth) สำหรับ metadata และ summary
- ข้อมูลหนัก (pressure map raw, route raw, sensor raw) → Object Storage เท่านั้น โดย PostgreSQL เก็บแค่ pointer + checksum
- ทุกตารางที่เกี่ยวกับการคำนวณ ต้องมี `algorithm_version` หรือ `model_version`
- พิจารณา **TimescaleDB extension** (บน PostgreSQL ตัวเดิม ไม่ต้องเปลี่ยน DB) สำหรับตาราง time-series ที่โตเร็ว เช่น `session_metrics_timeseries`, `device_battery_logs` — ทำ hypertable + retention policy ได้ตั้งแต่ต้น ย้ายทีหลังยากกว่า

### 3.2 กลุ่ม User / Auth

```text
users
  id, email, created_at, deleted_at, status

auth_providers
  id, user_id, provider (google/facebook/apple), provider_uid

user_profiles
  user_id, name, age, gender, weight_kg, height_cm,
  activity_level, exercise_frequency, sedentary_hours_per_day,
  updated_at

user_health_notes
  user_id, condition_note, pain_area, reported_at
  -- แยกออกจาก user_profiles เพราะเป็น sensitive data ที่ต้อง consent แยก

user_goals
  user_id, goal_type, target_value, start_date, end_date, status

user_settings
  user_id, language, dark_mode, unit_system, time_format, date_format

notification_preferences
  user_id, channel (push/email), category, enabled, quiet_hours_start, quiet_hours_end

user_consents
  user_id, consent_type (health_data_processing / ai_training / marketing),
  granted_at, revoked_at, version
```

### 3.3 กลุ่ม Device

```text
devices
  id, device_model, hardware_version

user_devices
  id, user_id, device_id, device_serial, paired_at, unpaired_at, auto_reconnect

device_status_logs
  id, user_device_id, sensor_status, bluetooth_status, signal_strength, logged_at

device_battery_logs
  id, user_device_id, battery_left, battery_right, logged_at   -- candidate: hypertable

device_sync_logs
  id, user_device_id, sync_type, steps_synced, distance_synced,
  pressure_data_synced, status, synced_at

firmware_versions
  id, device_model, version, release_notes, released_at

device_calibrations
  id, user_device_id, foot_size, weight_at_calibration_kg,
  baseline_pressure_map, calibrated_at
  -- ใช้เป็น baseline เทียบ pressure ต่อคน ไม่งั้น AI insight เทียบผิดคน
```

### 3.4 กลุ่ม Session

```text
activity_sessions
  id, user_id, device_id, activity_type, started_at, ended_at,
  duration_sec, status, sync_status (synced/pending/conflict),
  client_session_uuid,   -- ใช้กัน duplicate ตอน sync แบบ offline-first
  created_at

session_routes
  id, session_id, route_storage_url, checksum, points_count

session_metrics
  session_id, steps, distance_km, calories, speed_kmh, pace,
  cadence, ground_contact_ms, foot_lift_height_cm,
  walk_quality_score, balance_score,
  algorithm_version

session_pressure_maps
  id, session_id, storage_url, checksum, algorithm_version,
  captured_at

session_pressure_zones
  session_id, foot_side, forefoot_percent, midfoot_percent, heel_percent,
  max_pressure, avg_pressure, hotspot_area, pressure_level,
  algorithm_version

session_gait_metrics
  session_id, cadence, step_length, step_time, stance_time, swing_time,
  double_support_time, stride_length, gait_speed, variability_cv,
  gait_score, algorithm_version

session_gait_phases
  session_id, phase_name (heel_strike/loading_response/mid_stance/...),
  start_pct, end_pct, foot_side

session_alerts
  id, session_id, alert_type, severity, message, created_at
```

### 3.5 กลุ่ม Risk (แยกจาก session เดี่ยว เพราะควรดูจากแนวโน้ม)

```text
risk_assessments
  id, user_id, assessment_type (fall_risk/pain_risk),
  scope (single_session/rolling_7d/rolling_30d),
  source_session_id (nullable ถ้าเป็น rolling),
  score, risk_level, computed_at, algorithm_version
```

### 3.6 กลุ่ม AI (ขยายเพิ่ม Memory Architecture)

```text
ai_summaries
  id, session_id, summary_text, model_version, prompt_version, created_at

ai_insights
  id, user_id, session_id (nullable), insight_text, insight_type,
  model_version, prompt_version, created_at

ai_chat_threads
  id, user_id, title, created_at, archived_at

ai_chat_messages
  id, thread_id, role (user/assistant), content,
  context_snapshot_ref,   -- เก็บ pointer ไปยัง context ที่ใช้ตอบ เพื่อ audit
  model_version, created_at

ai_recommendations
  id, user_id, session_id (nullable), recommendation_text,
  category (exercise/rest/posture), model_version, created_at

user_memory_facts          -- ⭐ เพิ่มใหม่ (semantic memory เฉพาะ user)
  id, user_id, fact_text, fact_category (pain_pattern/preference/constraint),
  confidence, derived_from_episode_ids[], is_active,
  created_at, superseded_at
  -- กลั่นจาก episode ที่เกิดซ้ำๆ ไม่ใช่ raw data ตรงๆ
  -- เช่น "ลงน้ำหนักส้นขวาเกินต่อเนื่อง 3 เดือน" ไม่ใช่แค่ session เดียว

episode_summaries          -- ⭐ เพิ่มใหม่ (episodic memory แบบสรุป)
  id, user_id, period_type (weekly/monthly), period_start, period_end,
  summary_text, key_metrics_json, generated_at, algorithm_version
  -- กัน AI ต้อง scan raw session ทุกครั้งที่ตอบคำถามเชิงเทรนด์

user_percentile_stats      -- ⭐ เพิ่มใหม่ (shared/cohort memory)
  user_id, cohort_key (age_band + gender), metric_name,
  percentile_rank, computed_at
  -- materialized view รีเฟรชเป็น batch รายเดือน
  -- ต้องมี user จำนวนมากพอถึงจะมีความหมายทางสถิติ (ทำหลัง MVP)

rag_documents
  id, title, category (gait_knowledge/pressure_explain/guideline/faq/safety_rule),
  version, is_active, related_condition_tags[],   -- ⭐ relation แบบเบา แทน knowledge graph เต็มรูปแบบ
  created_at

rag_chunks
  id, document_id, chunk_text, chunk_index

rag_embeddings
  id, chunk_id, embedding vector(1536), embedding_model_version
```

> **หมายเหตุ knowledge graph:** ยังไม่ทำ graph database (เช่น Neo4j) ในเฟสนี้ ใช้ field `related_condition_tags[]` ใน `rag_documents` เป็น "graph จำลอง" ใน Postgres แทน ถ้าอนาคต reasoning ต้องการ multi-hop จริงจัง (เช่น อาการ → สาเหตุ → ท่าออกกำลังกาย → ข้อห้าม หลายชั้น) ค่อยพิจารณาย้าย

### 3.7 กลุ่ม Content Library & Video Recommendation ⭐ ใหม่

```text
exercise_programs
  id, title, description, duration_weeks, difficulty,
  status (draft/in_review/published/archived), version, created_by,
  created_at, published_at

exercise_videos
  id, program_id,                     -- nullable ถ้าวิดีโอ standalone ไม่ผูกโปรแกรม
  order_index,
  youtube_url, youtube_video_id,
  source_type (own_channel/external_licensed),
  title,
  ai_description,                     -- ⭐ ข้อความบอก AI ว่าวิดีโอนี้คืออะไร เหมาะกับใคร
                                          ใช้สำหรับ "grounding" AI พูดได้แค่ในกรอบนี้ ห้ามเดาเพิ่ม
  thumbnail_url, duration_sec,        -- ดึงอัตโนมัติจาก YouTube oEmbed ไม่ต้องพิมพ์เอง
  language,
  status (draft/in_review/published/archived),
  link_status (active/broken/private/removed),
  last_link_checked_at,
  created_by, reviewed_by, published_at

content_tags
  id, tag_name, category (condition/body_part/risk_level/goal)
  -- ตัวอย่าง: heel_pressure_high, right_foot, balance_issue, beginner

program_tags                          -- many-to-many
  program_id, tag_id

program_recommendation_rules
  id, condition_tag, severity_min, severity_max,
  target_program_id, priority
  -- "สมอง" ของการ match แบบ deterministic — ไม่ใช่ AI เลือกเอง

user_program_assignments
  id, user_id, program_id, source (ai_chat/manual/admin),
  assigned_at, status (in_progress/completed/skipped), user_feedback

content_review_logs
  id, content_id, content_type (program/video), reviewer_id,
  action (approved/rejected/unpublished), note, reviewed_at
```

### 3.8 กลุ่ม Notification

```text
notifications
  id, user_id, category, title, body, status (pending/sent/read), created_at

notification_events
  id, user_id, event_type, payload_json, created_at

notification_rules
  id, event_type, condition_json, cooldown_minutes

notification_delivery_logs
  id, notification_id, channel, provider_message_id, status, delivered_at
```

### 3.9 กลุ่ม Health Integration

```text
health_integrations
  id, user_id, provider (apple_health/health_connect), status, connected_at

health_sync_logs
  id, integration_id, sync_started_at, sync_finished_at, status, records_synced

health_daily_summaries
  id, user_id, date, steps, distance_km, calories, heart_rate_avg
```

### 3.10 ER Diagram (ภาพรวม ไม่ลงทุก column)

```mermaid
erDiagram
    users ||--o| user_profiles : has
    users ||--o{ user_devices : owns
    users ||--o{ activity_sessions : records
    users ||--o{ ai_chat_threads : chats
    users ||--o{ risk_assessments : tracked_by
    users ||--o{ user_consents : grants
    users ||--o{ user_memory_facts : has
    users ||--o{ episode_summaries : has
    users ||--o{ user_program_assignments : assigned

    user_devices ||--o{ device_calibrations : calibrated
    user_devices ||--o{ device_battery_logs : logs
    user_devices ||--o{ activity_sessions : used_in

    activity_sessions ||--|| session_metrics : has
    activity_sessions ||--o{ session_pressure_maps : has
    activity_sessions ||--o{ session_pressure_zones : has
    activity_sessions ||--o{ session_gait_metrics : has
    activity_sessions ||--o{ session_alerts : triggers
    activity_sessions ||--o| ai_summaries : summarized_by

    ai_chat_threads ||--o{ ai_chat_messages : contains
    rag_documents ||--o{ rag_chunks : split_into
    rag_chunks ||--o| rag_embeddings : embedded_as

    exercise_programs ||--o{ exercise_videos : contains
    exercise_programs ||--o{ program_tags : tagged
    exercise_programs ||--o{ user_program_assignments : assigned_as
    content_tags ||--o{ program_tags : used_in
    exercise_programs ||--o{ program_recommendation_rules : targeted_by
```

---

## 4. Redis Design

| ประเภท | Key pattern | ตัวอย่างการใช้ | TTL |
|---|---|---|---|
| Cache | `dashboard:user:{user_id}` | cache dashboard summary | 60-300s |
| Cache | `device_status:{device_id}` | current status | 30s |
| Queue | `queue:process_session` | job หลังจบ session | - |
| Queue | `queue:generate_ai_summary` | job ให้ AI worker | - |
| Queue | `queue:send_notification` | job แจ้งเตือน | - |
| Scheduled | `schedule:check_video_links` | ⭐ job รายวันเช็คลิงก์ YouTube | - |
| Scheduled | `schedule:generate_episode_summary` | ⭐ job รายสัปดาห์/เดือน | - |
| Realtime | `live_session:{session_id}` | session กำลังบันทึก | หมดตอนจบ session |
| Realtime | `device_online:{device_id}` | heartbeat | 15s (heartbeat refresh) |
| Rate limit | `rate_limit:user:{user_id}:ai_chat` | กัน spam AI chat | 60s window |
| Cooldown | `alert_cooldown:{user_id}:{alert_type}` | กัน notification ซ้ำ | ตาม `notification_rules.cooldown_minutes` |

**คำแนะนำ:** ใช้ Redis Streams หรือ BullMQ (ถ้า Node) / Celery+Redis (ถ้า Python) แทนการทำ queue เองด้วย List — จะได้ retry, dead-letter queue, และ cron/scheduled job มาตรฐาน

---

## 5. AI + RAG Architecture

### 5.1 หลักการ 2 ชั้น

```mermaid
flowchart LR
    A[Event: Session Finished / Threshold Hit] --> B{Rule-based Check}
    B -->|Deterministic case| C[Rule-based Alert]
    B -->|ต้องอธิบาย/แนะนำ| D[AI Analysis Pipeline]
    D --> E[Backend รวบรวม Structured Data]
    E --> F[RAG: ดึง Knowledge ที่เกี่ยวข้อง]
    F --> G[Compose Prompt + Context]
    G --> H[LLM API]
    H --> I[Guardrail Layer]
    I -->|ผ่าน| J[บันทึก + ส่งให้ผู้ใช้]
    I -->|ไม่ผ่าน| K[Fallback response / เตือน dev]
```

### 5.2 Guardrail Layer & Prompt Injection Protection

อย่าพึ่ง system prompt อย่างเดียวให้ AI "ระวังคำพูด" เอง ให้ backend enforce เพิ่ม:

1. **Input Sanitization & Injection Protection** — ตรวจสอบและทำความสะอาดข้อความจากผู้ใช้ (Sanitization) ก่อนส่งให้ LLM เพื่อป้องกัน Jailbreaking หรือ Prompt Injection (เช่น คำสั่ง "ละทิ้งคำสั่งเดิมทั้งหมด") ห้ามให้ System Prompt หลุดไปถึงผู้ใช้เด็ดขาด
2. **Deterministic disclaimer ต่อท้าย** — response ที่เกี่ยวกับ pain/risk ต้องแปะ disclaimer มาตรฐานจาก backend เสมอ ไม่ใช่ให้ LLM เขียนเอง
3. **Post-processing filter** — เช็คคำต้องห้าม/รูปแบบการวินิจฉัย ก่อนส่งกลับผู้ใช้ ถ้าเจอ → fallback เป็น template ปลอดภัย
4. **Structured input only** — AI ไม่รับ raw sensor data ตรงๆ รับเฉพาะค่าที่ backend คำนวณ/สรุปแล้ว
5. **Eval set ก่อนขึ้น production** — เก็บชุดคำถาม-คำตอบมาตรฐาน (รวมถึงชุดทดสอบ Jailbreak) รัน regression test ทุกครั้งที่เปลี่ยน prompt/model
6. **Logging เต็มรูปแบบ** — เก็บ `context_snapshot_ref` ของทุกคำตอบ เพื่อ audit ย้อนหลัง
7. **ห้ามอธิบายวิดีโอเกินกว่าที่ `ai_description` ระบุ** ⭐ — AI ไม่มีสิทธิ์เดาเนื้อหาวิดีโอเองจากชื่อคลิปหรือ URL (ดู §6)

### 5.3 RAG Content

```text
rag_documents (category)
- gait_analysis_knowledge
- pressure_zone_explanation
- basic_recommendation_guideline
- device_usage_guide
- faq
- ai_safety_policy       -- prompt/behavior rules, versioned
- response_templates
```

ทุก document มี `version` + `is_active` → เวลาอัปเดต guideline ไม่ overwrite ของเก่า แต่สร้าง version ใหม่แล้ว deactivate เก่า (rollback ได้)

### 5.4 Chat Flow

```mermaid
sequenceDiagram
    participant U as User (Mobile)
    participant API as Backend AI Module
    participant PG as PostgreSQL
    participant RAG as RAG Retriever
    participant LLM as LLM API

    U->>API: POST /ai/chat {message}
    API->>PG: ดึง profile, latest sessions, risk score
    API->>RAG: ค้น knowledge ที่เกี่ยวข้อง (pgvector similarity)
    RAG->>PG: query rag_embeddings
    RAG-->>API: top-k chunks
    API->>API: compose context + guardrail system prompt
    API->>LLM: send prompt + context
    LLM-->>API: raw response
    API->>API: post-process guardrail filter
    API->>PG: บันทึก ai_chat_messages + context_snapshot_ref
    API-->>U: final response (+ disclaimer ถ้าเข้าเงื่อนไข)
```

### 5.5 Memory Architecture (Memory Orchestrator) ⭐ ใหม่

AI ของระบบนี้ไม่ใช่แค่ chatbot ที่ตอบจาก context ก้อนเดียว แต่ต้องดึง "ความจำ" จากหลายแหล่งมาประกอบกันก่อนตอบทุกครั้ง แนวคิดนี้จับคู่กับ memory type มาตรฐานของ AI agent ได้ดังนี้:

| Memory type | ในระบบนี้คือ | เก็บที่ไหน |
|---|---|---|
| Short-term (working) | ข้อความไม่กี่เทิร์นล่าสุดในแชทเดียวกัน | Redis buffer + `ai_chat_messages` |
| Long-term | ข้อมูลข้ามเซสชันทั้งหมด (profile, goal, ประวัติ) | PostgreSQL (ตารางหลักทั้งหมด) |
| Episodic | เหตุการณ์เจาะจงมีเวลา + สรุปรายสัปดาห์/เดือน | `activity_sessions`, `ai_chat_messages`, `episode_summaries` |
| Semantic | ข้อเท็จจริงที่กลั่นแล้วว่าเชื่อถือได้ + ความรู้ทั่วไป | `user_memory_facts` (เฉพาะ user) + `rag_documents` (domain) |
| Procedural | กฎ/ขั้นตอนการตอบในแต่ละสถานการณ์ | rule-based logic + RAG guideline + prompt template (versioned) |
| Shared | ความรู้ระดับ population ที่ใช้ร่วมกันข้าม user/module | `user_percentile_stats` (materialized view) |

```mermaid
flowchart TB
    WM["Working memory<br/>Redis: current thread"]
    LM["Long-term memory<br/>Postgres: history & facts"]
    KB["Knowledge base<br/>RAG + procedural rules"]
    ORCH["Memory orchestrator<br/>assembles context, applies guardrail"]
    LLM["LLM<br/>generates response"]

    WM --> ORCH
    LM --> ORCH
    KB --> ORCH
    ORCH --> LLM
    LLM -.->|extract & write back new facts| ORCH
```

**Memory Orchestrator ไม่ใช่ service แยกใหม่** — เป็น layer ที่ชัดเจนภายใน `worker-ai` / `AI Module` เดิม มีหน้าที่ 2 อย่าง:

1. **ก่อนเรียก LLM**: ดึงจาก working + long-term/episodic/semantic + knowledge/procedural → ประกอบ context ตาม token budget → ใส่ guardrail system prompt
2. **หลัง LLM ตอบ**: กรองผ่าน guardrail filter → เขียนกลับความจำที่เกี่ยวข้อง (เช่น insight ใหม่ที่ควรจำ → บันทึกลง `user_memory_facts`)

**ลำดับการทำ**: เริ่มจาก working + long-term + RAG ให้พอใช้งานได้ใน Phase 5-6 (MVP) ส่วน `episode_summaries`, `user_memory_facts` ทำเมื่อเห็นว่า query ช้าหรือ AI เริ่มตอบเทรนด์ผิด และ `user_percentile_stats` ทำเมื่อมี user มากพอให้ benchmark มีความหมายทางสถิติ (หลัง MVP)

### 5.6 Video / Program Recommendation Flow ⭐ ใหม่

หลักการสำคัญ: **LLM ไม่แต่งคำแนะนำวิดีโอเอง** มันแค่ตีความ intent แล้ว "ขอ" ข้อมูลจาก backend ที่ query แบบ deterministic

```mermaid
sequenceDiagram
    participant U as User (Mobile)
    participant API as Backend AI Module
    participant PG as PostgreSQL
    participant LLM as LLM API

    U->>API: "มีวิธีแก้ยังไงบ้าง"
    API->>PG: ดึง risk/pressure ล่าสุด → แปลงเป็น condition tag
    API->>PG: query program_recommendation_rules (deterministic, published only)
    PG-->>API: matched program + videos (title, ai_description)
    API->>LLM: ส่ง structured data ให้เรียบเรียงประโยค (ห้ามเดาเพิ่ม)
    LLM-->>API: ข้อความแนะนำ
    API->>PG: บันทึก user_program_assignments
    API-->>U: การ์ดโปรแกรม + วิดีโอ
```

ขั้นตอน:

1. LLM ตีความ intent ว่า user ต้องการ "โปรแกรมออกกำลังกาย" (ใช้ function calling/tool use ไม่ใช่ตอบเป็นข้อความล้วน)
2. Backend ดึง risk/pressure ล่าสุดของ user จริง → แปลงเป็น tag (เช่น `heel_pressure_high`, `right_foot`)
3. Backend query `program_recommendation_rules` แบบ deterministic จาก content ที่ `status = published` เท่านั้น
4. ส่งผลลัพธ์เป็น structured data (`title`, `ai_description`) ให้ LLM ใช้แค่เรียบเรียงประโยค
5. บันทึกลง `user_program_assignments` — กัน AI แนะนำซ้ำเดิมทุกครั้ง และเป็น episodic memory ให้ AI ตอบคำถามแบบ "ทำโปรแกรมที่แนะนำไปหรือยัง" ได้ในอนาคต

---

## 6. Content Library & Video Recommendation System ⭐ ใหม่

### 6.1 หลักการ

ระบบนี้ **ไม่ใช่ RAG** (RAG = ความรู้ที่เอาไปอธิบายเป็นข้อความ) แต่เป็น **content catalog** ที่มี metadata ให้ match แบบ deterministic ได้ ใช้ schema ที่นิยามไว้ใน §3.7

### 6.2 การใช้ลิงก์ YouTube (ช่องตัวเอง)

เนื่องจากวิดีโอส่วนใหญ่มาจากช่อง YouTube ของทีมเอง ไม่ต้องอัปโหลดไฟล์เข้าระบบ แต่ **ลิงก์อย่างเดียวไม่พอ** เพราะ AI ไม่สามารถเปิดวิดีโอไปดูเนื้อหาเองได้ — ถ้าไม่มี description กำกับ AI จะเดาจากชื่อคลิป/URL แทน ซึ่งเสี่ยง hallucinate

**field ที่ต้องมีคู่กับทุกลิงก์:**

- `ai_description` — ข้อความสั้นๆ เขียนโดยแอดมิน บอกว่าวิดีโอนี้คืออะไร เหมาะกับใคร ท่าไหนบ้าง ระดับความยาก ตัวอย่าง: *"ท่ายืดน่องแบบมีผนังช่วยพยุง 3 ท่า เหมาะกับคนที่มีแรงกดส้นเท้าสูง ทำได้ 5-10 นาที ระดับเริ่มต้น ไม่เหมาะกับคนที่มีอาการปวดเฉียบพลัน"*
- `thumbnail_url`, `duration_sec` — ดึงอัตโนมัติจาก **YouTube oEmbed API** (ไม่ต้อง API key เต็มรูปแบบ ไม่ต้องพิมพ์เอง)
- `source_type` — แยก `own_channel` กับ `external_licensed` ไว้ตั้งแต่แรก เผื่ออนาคตอยากเอาคลิปคนอื่นมาแนะนำด้วย จะได้ track สิทธิ์การใช้งานแยกจากคลิปตัวเอง

**ทำไม `ai_description` ต้องแยกจาก `title`:** ชื่อคลิปมักตั้งให้คนดูคลิก ไม่ได้ตั้งเพื่อให้ machine เข้าใจ (เช่น "ท่านี้ช่วยได้จริง! ลองดู 5 นาที") AI อ่านแล้วไม่รู้ว่าเกี่ยวกับอะไร ต้องมี description ที่เป็นข้อเท็จจริงล้วนกำกับเสมอ

**การใช้งาน 2 แบบที่ต้องแยกกันชัดเจน:**

1. **Matching** (เลือกวิดีโอให้ user) → ใช้ `content_tags` + `program_recommendation_rules` เป็น deterministic ไม่ใช่ AI เลือกเอง
2. **Grounding** (AI พูดถึงวิดีโอตอนแชท) → AI อ่าน `ai_description` ได้ แต่ต้องพูดในกรอบนั้นเท่านั้น (บังคับผ่าน guardrail §5.2 ข้อ 6)

### 6.3 การดูแลลิงก์ที่อาจเจ๊ง

ลิงก์ YouTube อาจถูก unlist/private/ลบทีหลังโดยระบบไม่รู้ตัว จึงต้องมี **Link Checker Worker** (ดู §9) เช็คเป็นระยะผ่าน YouTube oEmbed ถ้าลิงก์ตาย → เปลี่ยน `link_status = broken` และดึงออกจากรายการที่ AI มองเห็นทันที (อย่าให้ user เจอ error ตอนกดวิดีโอจากที่ AI แนะนำ)

---

## 7. Admin Panel ⭐ ใหม่

### 7.1 เหตุผลที่ต้องมี

1. **ทีมที่อัปโหลด/แก้เนื้อหาไม่ใช่ engineer** — ควรเป็นนักกายภาพ/content team ที่ upload วิดีโอ ตั้งชื่อ ผูก tag ได้เอง โดยไม่ต้อง deploy code
2. **ต้องมี workflow อนุมัติก่อนขึ้นจริงเสมอ** — เนื้อหาเกี่ยวกับการออกกำลังกายสำหรับคนที่มีอาการปวด/เสี่ยงล้ม ต้องมีคนตรวจสอบก่อน ไม่ใช่ upload แล้วขึ้นทันที
3. **ต้องถอดออกได้เร็วถ้าพบว่าผิด** — unpublish ได้ทันทีจาก panel โดยไม่ต้องรอ engineer และ track ได้ว่า user คนไหนเคยได้รับคำแนะนำนั้นไปแล้ว (join กับ `user_program_assignments`)
4. **Security & Accountability** — บัญชีแอดมินสามารถเปลี่ยนเนื้อหาที่มีผลต่อสุขภาพผู้ใช้ได้ จึงต้องบังคับทำ 2FA/MFA และบันทึก Audit Logs ทุกการกระทำ

### 7.2 Workflow

```text
draft → in_review → published → archived
                ↓
          (rejected → กลับไป draft พร้อม note จาก content_review_logs)

published → unpublished ทันที (admin สิทธิ์พิเศษ) → archived
```

**กฎที่ตายตัว:** AI (ทั้ง matching และ grounding) อ่านได้เฉพาะ content ที่ `status = published` เท่านั้น — ทำให้ admin panel เป็น single source of truth ที่ AI มองเห็น ไม่มีทางเลี่ยง

### 7.3 Scope สำหรับ MVP (ข้อตัดสินใจที่ค้างไว้ — เลือกทางนี้เป็นค่าเริ่มต้น)

**สรุปสั้นๆ ก่อนอธิบาย: เริ่มจาก admin panel เป็น protected route module ในตัว backend-api เดิม ไม่แยกเป็น service/frontend ต่างหากในช่วง MVP**

เหตุผล:

- ลด scope งานช่วงแรก ไม่ต้องตั้ง frontend project ใหม่ + auth แยก + deploy pipeline แยก
- ใช้ schema เดียวกับที่ออกแบบใน §3.7 อยู่แล้ว ต่อ API `/admin/content/*` (ดู §8) เป็น REST ธรรมดา แล้วทำ UI ง่ายๆ ด้วย framework ฝั่ง frontend ที่ทีมถนัด (แม้เป็นหน้าเว็บ static เรียก API เดียวกัน)
- ถ้าทีม content โตขึ้นและต้องการ UI ที่ซับซ้อนกว่านี้ (bulk upload, workflow approval หลายขั้น) **แยกเป็น dashboard ต่างหากได้ทีหลังโดยไม่ต้องแก้ schema หรือ API เดิม** เพราะ endpoint ออกแบบเป็น REST มาตรฐานอยู่แล้ว

ถ้าทีมมีคนทำ frontend แยกต่างหากอยู่แล้วและอยากได้ dashboard ที่ดูดีตั้งแต่ต้น ก็สามารถแยกเป็น service ตั้งแต่แรกได้เช่นกัน — เป็นการแลก scope งานกับ UX ของทีม content ซึ่งขึ้นกับกำลังคนที่มี

---

## 8. API Design

โครงสร้างเดิมยังใช้ได้ดี เพิ่มเติมกลุ่ม Admin และ AI recommend:

```text
Auth
POST /auth/google
POST /auth/facebook
POST /auth/logout
DELETE /account                     -- ต้อง trigger data purge job (ดู §11)

Consent
GET  /me/consents
PUT  /me/consents/{type}

Profile
GET  /me
PUT  /me/profile
GET  /me/goals
PUT  /me/goals
GET  /me/settings
PUT  /me/settings

Device
GET  /devices
POST /devices/pair
PUT  /devices/{id}
DELETE /devices/{id}
POST /devices/{id}/sync
GET  /devices/{id}/status
POST /devices/{id}/battery
POST /devices/{id}/calibrate

Session
POST /sessions/start
POST /sessions/{id}/data
POST /sessions/{id}/finish
POST /sessions/sync-batch            -- offline sync หลาย session
GET  /sessions
GET  /sessions/{id}
GET  /sessions/{id}/pressure-map
GET  /sessions/{id}/gait-analysis
GET  /sessions/{id}/insight

AI
POST /ai/session-summary
POST /ai/insight
POST /ai/chat
GET  /ai/chat/threads
GET  /ai/chat/threads/{id}
POST /ai/recommend-program           ⭐ เพิ่มใหม่ — คืน matched program + video ตาม tag ปัจจุบันของ user

Notification
GET  /notifications
POST /notifications/read
GET  /notification-settings
PUT  /notification-settings

Health Integration
GET  /health-integrations
POST /health-integrations/connect
POST /health-integrations/sync
DELETE /health-integrations/{id}

Admin — Content Management ⭐ เพิ่มใหม่ (ต้อง auth role = admin/content_editor)
GET    /admin/content/programs
POST   /admin/content/programs
PUT    /admin/content/programs/{id}
POST   /admin/content/programs/{id}/submit-review
POST   /admin/content/programs/{id}/publish
POST   /admin/content/programs/{id}/unpublish
GET    /admin/content/videos
POST   /admin/content/videos                    -- รับ youtube_url + ai_description
PUT    /admin/content/videos/{id}
POST   /admin/content/videos/{id}/recheck-link
GET    /admin/content/tags
POST   /admin/content/rules                     -- CRUD program_recommendation_rules
GET    /admin/content/review-logs
```

**เรื่อง `sync-batch`:** สำคัญเพราะมือถือเก็บ session แบบ offline ใน SQLite ได้ ตอน sync กลับมาต้องรองรับหลาย session พร้อม `client_session_uuid` เพื่อ dedupe และต้องตอบกลับ conflict list ถ้ามี

---

## 9. Worker / Queue Architecture

```mermaid
sequenceDiagram
    participant M as Mobile
    participant API as Backend API
    participant R as Redis Queue
    participant W1 as Session Worker
    participant W2 as AI Worker
    participant W3 as Notification Worker
    participant PG as PostgreSQL
    participant OBJ as Object Storage

    M->>API: POST /sessions/{id}/finish
    API->>PG: save raw summary (status=processing)
    API->>R: enqueue process_session
    API-->>M: 202 Accepted

    R->>W1: job: process_session
    W1->>OBJ: upload pressure map / route
    W1->>PG: compute & save metrics, gait, zones (algorithm_version)
    W1->>R: enqueue generate_ai_summary
    W1->>R: enqueue check_notification_rules

    R->>W2: job: generate_ai_summary
    W2->>PG: read metrics + profile + history
    W2->>PG: save ai_summary, ai_insight
    W2->>R: enqueue check_notification_rules (ai_insight_ready)

    R->>W3: job: check_notification_rules
    W3->>PG: evaluate rules + cooldown (Redis)
    W3->>PG: save notification
    W3-->>M: push via FCM/APNs

    M->>API: GET /sessions/{id}
    API->>PG: read status=completed + data
    API-->>M: full session result
```

### 9.1 Link Checker Worker ⭐ ใหม่

เช็คลิงก์ YouTube เป็นระยะ กันวิดีโอที่ AI แนะนำแล้วเปิดไม่ได้:

```mermaid
flowchart LR
    CRON[Scheduled trigger ทุก 24 ชม.] --> LCW[Link Checker Worker]
    LCW --> YT[YouTube oEmbed API]
    YT -->|valid| OK[link_status = active]
    YT -->|invalid/private| BROKEN[link_status = broken → unpublish อัตโนมัติ]
    LCW --> PG[(PostgreSQL)]
```

ถ้าเจอ broken link ให้ auto-unpublish วิดีโอนั้นทันที และแจ้งเตือน admin panel ให้ทีม content เข้าไปแก้/แทนที่

### 9.2 Episode Summary Worker ⭐ ใหม่

รันเป็น cron รายสัปดาห์/เดือนต่อ user:

```text
ดึง activity_sessions, session_metrics, ai_chat_messages ของ user ในช่วงเวลา
   ↓
สรุปเป็น episode_summaries (summary_text + key_metrics_json)
   ↓
ถ้าพบ pattern ที่เกิดซ้ำติดต่อกันหลาย episode (เช่น pressure สูงต่อเนื่อง 3 เดือน)
   ↓
สร้าง/อัปเดต user_memory_facts (semantic memory)
```

---

## 10. Notification System

- **Cooldown/debounce ต่อ `alert_type` ต่อ user** เก็บใน Redis (`alert_cooldown:{user_id}:{type}`) — ถ้ายังอยู่ใน cooldown ไม่ยิงซ้ำแม้ rule จะ trigger อีก
- **Severity tiering** — แบ่งเป็น `info / warning / critical` เพื่อให้ผู้ใช้ปิดเฉพาะ tier ที่ไม่ critical ได้ โดย critical (เช่น battery หมด, sensor error) บังคับส่งเสมอ
- **Digest mode** — ถ้า alert ประเภทเดียวกันเกิดถี่ ให้รวมเป็น daily digest แทนการยิงทีละครั้ง

---

## 11. Security & Privacy (PDPA) & General Security

1. **Consent แยกประเภท** ผ่านตาราง `user_consents`:
   - `health_data_processing` (จำเป็นต่อการใช้แอป)
   - `ai_training` (optional — อนุญาตให้เอา chat/insight ไปช่วยปรับปรุงโมเดล)
   - `marketing`
2. **Data retention policy** — กำหนด TTL ของ raw sensor/pressure map ใน object storage (เช่น เก็บ raw 12 เดือน, summary เก็บถาวรจนกว่าจะลบบัญชี)
3. **Delete Account ต้องเป็น cascading purge job** ไม่ใช่ soft delete อย่างเดียว:
   ```text
   DELETE /account
     → mark users.deleted_at
     → enqueue purge_user_data job
         → ลบ object storage files
         → ลบ/anonymize PostgreSQL rows ที่ระบุตัวตนได้ (รวม user_memory_facts, user_program_assignments)
         → ลบ rag_embeddings ที่ผูกกับ user (ถ้ามี user-specific)
         → ลบ vector ใน pgvector ที่เกี่ยวกับ personal chat
   ```
4. **Encryption**: TLS in-transit ทุก endpoint, encryption at rest สำหรับ PostgreSQL/Object Storage, secret management ผ่าน env/secret manager (ห้าม hardcode ใน image — ดู §13-14)
5. **Access control & Admin Security**: RBAC ระดับ backend (user เห็นแค่ข้อมูลตัวเอง, admin/content_editor มี audit log ทุกครั้งที่แก้ไข/unpublish เนื้อหา ผ่าน `content_review_logs`, admin/support มี audit log ทุกครั้งที่เข้าถึงข้อมูล user คนอื่น) **และบังคับใช้ 2FA / MFA สำหรับบัญชี Admin/Content Editor เสมอเพื่อป้องกันการถูกแฮก**
6. **Audit log** แยกตาราง `admin_access_logs` สำหรับ staff ที่เข้าถึงข้อมูลผู้ใช้ (support ticket)
7. **Rate Limiting & DoS Protection**: ทำ Global Rate Limit ที่ Nginx / API Gateway เพื่อป้องกันการโจมตีแบบ DoS/Brute-force และทำ Strict Rate Limit แยกเฉพาะสำหรับ Endpoint ที่ใช้ทรัพยากรสูง (เช่น `/sessions/sync-batch`, `AI endpoints`, และ `Auth`)

---

## 12. Mobile & Device Considerations

1. **Calibration flow** — ตอน pair device ครั้งแรก ต้องเก็บ baseline: น้ำหนักตัว ณ ตอนนั้น, ขนาดเท้า, baseline pressure ยืนนิ่ง → เก็บใน `device_calibrations` ใช้เป็นตัวหารเทียบ pressure ทุก session ของอุปกรณ์/คนนั้น ควรมี reminder ให้ calibrate ใหม่ถ้าน้ำหนักตัวเปลี่ยนมาก
2. **Offline-first session recording** — บันทึกลง SQLite ก่อนเสมอ, sync เป็น background task, ใช้ `client_session_uuid` กัน duplicate
3. **Conflict resolution** — ถ้า session เดียวกัน sync จากสองอุปกรณ์/สอง client version ให้ backend ใช้ `updated_at` ล่าสุดชนะ (last-write-wins) แต่เก็บ log การ conflict ไว้ตรวจสอบได้

---

## 13. Docker Architecture

แนวทาง: **1 service = 1 container** แม้ codebase จะเป็น monorepo/modular monolith ก็ตาม เพื่อให้ scale/deploy แยกกันได้ และย้ายไป K8s ทีหลังได้ง่ายโดยแทบไม่ต้องแก้ image `admin content module` อยู่ใน container `api` เดิม (ดู §7.3)

```mermaid
flowchart TB
    subgraph Compose["docker-compose (dev/staging)"]
        NGINX[nginx - reverse proxy]
        API["backend-api (รวม admin routes)"]
        WSESSION[worker-session]
        WAI[worker-ai]
        WNOTIF[worker-notification]
        WHEALTH[worker-health-sync]
        WLINK[worker-link-checker]
        WEPISODE[worker-episode-summary]
        PG[(postgres + pgvector)]
        REDIS[(redis)]
        MINIO[(minio)]
    end

    NGINX --> API
    API --> PG
    API --> REDIS
    API --> MINIO
    WSESSION --> PG
    WSESSION --> REDIS
    WSESSION --> MINIO
    WAI --> PG
    WAI --> REDIS
    WNOTIF --> PG
    WNOTIF --> REDIS
    WHEALTH --> PG
    WHEALTH --> REDIS
    WLINK --> PG
    WLINK --> REDIS
    WEPISODE --> PG
    WEPISODE --> REDIS
```

### 13.1 โครงสร้าง repo แนะนำ

```text
blansole-backend/
├── apps/
│   ├── api/                    # backend-api + admin routes
│   │   ├── Dockerfile
│   │   └── src/
│   ├── worker-session/
│   │   ├── Dockerfile
│   │   └── src/
│   ├── worker-ai/
│   │   ├── Dockerfile
│   │   └── src/
│   ├── worker-notification/
│   │   ├── Dockerfile
│   │   └── src/
│   ├── worker-health-sync/
│   │   ├── Dockerfile
│   │   └── src/
│   ├── worker-link-checker/    # ⭐ ใหม่
│   │   ├── Dockerfile
│   │   └── src/
│   └── worker-episode-summary/ # ⭐ ใหม่
│       ├── Dockerfile
│       └── src/
├── libs/                       # shared code (models, db client, types)
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.staging.yml
│   ├── nginx/
│   └── migrations/             # DB migration scripts (Alembic/Prisma/Flyway)
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
└── README.md
```

### 13.2 ตัวอย่าง `docker-compose.yml` (dev)

```yaml
version: "3.9"

services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    volumes:
      - ./infra/nginx/dev.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://blansole:blansole@postgres:5432/blansole
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
    depends_on:
      - postgres
      - redis
      - minio

  worker-session:
    build:
      context: .
      dockerfile: apps/worker-session/Dockerfile
    env_file: .env
    depends_on: [postgres, redis, minio]

  worker-ai:
    build:
      context: .
      dockerfile: apps/worker-ai/Dockerfile
    env_file: .env
    depends_on: [postgres, redis]

  worker-notification:
    build:
      context: .
      dockerfile: apps/worker-notification/Dockerfile
    env_file: .env
    depends_on: [postgres, redis]

  worker-health-sync:
    build:
      context: .
      dockerfile: apps/worker-health-sync/Dockerfile
    env_file: .env
    depends_on: [postgres, redis]

  worker-link-checker:
    build:
      context: .
      dockerfile: apps/worker-link-checker/Dockerfile
    env_file: .env
    depends_on: [postgres, redis]

  worker-episode-summary:
    build:
      context: .
      dockerfile: apps/worker-episode-summary/Dockerfile
    env_file: .env
    depends_on: [postgres, redis]

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_USER=blansole
      - POSTGRES_PASSWORD=blansole
      - POSTGRES_DB=blansole
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  pg_data:
  redis_data:
  minio_data:
```

### 13.3 ตัวอย่าง Dockerfile (multi-stage, ใช้กับทุก service ปรับ path)

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci
COPY . .
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

> ถ้าใช้ Python/FastAPI แทน ให้เปลี่ยนเป็น multi-stage แบบ `python:3.12-slim` + `pip install --no-cache-dir` + non-root user เหมือนกัน หลักการ multi-stage + small final image เหมือนกันไม่ว่าใช้ภาษาไหน

### 13.4 หลักการเลือก container ให้ scale ได้ทีหลัง

- **worker-ai** ควรแยก resource limit ต่างหาก (CPU/memory มากกว่า worker อื่น เพราะเรียก LLM API และ RAG)
- **worker-link-checker** ต้องมี network egress ไปยัง YouTube ได้ (เช็คให้ network policy อนุญาต)
- ทุก service อ่าน config จาก env vars เท่านั้น (12-factor) เพื่อ portable ไป K8s ได้ทันทีถ้าจำเป็นในอนาคต (แค่เปลี่ยนจาก `docker-compose` เป็น `Deployment` + `Service` manifest โดยไม่ต้องแก้ image)

---

## 14. CI/CD Pipeline (Git-based)

ใช้ **GitHub Actions** เป็นตัวอย่าง (ถ้าใช้ GitLab/Bitbucket concept เดียวกัน แค่เปลี่ยน syntax)

```mermaid
flowchart LR
    A[git push / PR] --> B[CI: Lint + Test]
    B --> C{Branch?}
    C -->|feature/PR| D[Build images ทดสอบ + report]
    C -->|main| E[Build + Push image to Registry]
    E --> F[Tag image ด้วย git SHA + latest]
    F --> G[Deploy to Staging]
    G --> H{Manual Approve?}
    H -->|approve| I[Deploy to Production]
    H -->|reject| Z[Stop]
```

### 14.1 Branch strategy แนะนำ

```text
main         → production (protected, ต้อง PR review + CI ผ่าน)
develop      → staging (auto-deploy ทุก merge)
feature/*    → PR ไปที่ develop
hotfix/*     → PR ไปที่ main โดยตรง (กรณีฉุกเฉิน)
```

### 14.2 `.github/workflows/ci.yml` (ตัวอย่าง)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [develop, main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, worker-session, worker-ai, worker-notification, worker-health-sync, worker-link-checker, worker-episode-summary]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint --workspace=apps/${{ matrix.service }}

      - name: Unit test
        run: npm run test --workspace=apps/${{ matrix.service }}

  db-migration-check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - name: Run migrations against clean DB
        run: npm run migrate:up
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres

  build-check:
    needs: [lint-test]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, worker-session, worker-ai, worker-notification, worker-health-sync, worker-link-checker, worker-episode-summary]
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image (ไม่ push)
        run: docker build -f apps/${{ matrix.service }}/Dockerfile -t blansole-${{ matrix.service }}:ci .
```

### 14.3 `.github/workflows/cd.yml` (ตัวอย่าง)

```yaml
name: CD

on:
  push:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_NAMESPACE: your-org/blansole

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, worker-session, worker-ai, worker-notification, worker-health-sync, worker-link-checker, worker-episode-summary]
    steps:
      - uses: actions/checkout@v4

      - name: Log in to registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.service }}/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}-${{ matrix.service }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}-${{ matrix.service }}:${{ github.ref_name == 'main' && 'latest' || 'staging' }}

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging host via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/blansole
            docker compose -f docker-compose.staging.yml pull
            docker compose -f docker-compose.staging.yml up -d
            docker compose -f docker-compose.staging.yml exec -T api npm run migrate:up

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build-and-push
    runs-on: ubuntu-latest
    environment:
      name: production   # ตั้งค่า "required reviewers" ใน GitHub Environment เพื่อบังคับ manual approve
    steps:
      - name: Deploy to production host via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/blansole
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml exec -T api npm run migrate:up
```

### 14.4 หลักการสำคัญของ pipeline นี้

- **Migration รันแยก step เสมอ ก่อน/หลัง deploy** ไม่ฝังใน image entrypoint เพื่อควบคุมและ rollback ได้
- **Tag image ด้วย git SHA เสมอ** ไม่ใช้แค่ `latest` — ทำให้ rollback ทำได้แค่เปลี่ยน tag แล้ว redeploy
- **Production ต้องมี manual approval** (GitHub Environment protection rule) แม้ staging จะ auto-deploy ก็ตาม
- ยังไม่ต้อง K8s ตามที่บอก — ใช้ `docker compose pull && up -d` บน VM ก็เพียงพอสำหรับช่วงแรก และ **ย้ายไป K8s ทีหลังได้โดยแทบไม่แก้ image** เพราะออกแบบทุก service เป็น 12-factor app ตั้งแต่ §13.4
- แนะนำเพิ่ม **health check endpoint** (`GET /healthz`) ทุก service เพื่อให้ deploy script / K8s (ในอนาคต) เช็คได้ว่า container พร้อมรับ traffic จริง

---

## 15. Tech Stack สรุป

| Layer | เลือกใช้ |
|---|---|
| Mobile | Flutter |
| Local mobile storage | SQLite + Secure Storage |
| Backend API | FastAPI (Python) หรือ NestJS (Node) — เลือกอันเดียวให้ทีมถนัด |
| Database | PostgreSQL 16 + pgvector extension |
| Time-series (optional เมื่อข้อมูลโตขึ้น) | TimescaleDB extension บน PostgreSQL เดิม |
| Cache & Queue | Redis 7 (+ BullMQ/Celery) |
| Object Storage | MinIO (self-host) หรือ S3 (cloud) |
| AI | LLM API + RAG (pgvector) |
| Video content | YouTube (ช่องตัวเอง) + YouTube oEmbed API (ดึง thumbnail/duration, ไม่ต้อง API key) |
| Admin panel (MVP) | Route module ใน backend-api เดิม — แยกเป็น dashboard ต่างหากได้ทีหลัง |
| Push Notification | Firebase Cloud Messaging + APNs |
| Container | Docker (1 service/container) |
| Orchestration (ตอนนี้) | Docker Compose บน VM เดียว/สองเครื่อง (แยก staging/prod) |
| Orchestration (อนาคตถ้าจำเป็น) | Kubernetes (migrate ได้ง่ายเพราะ 12-factor) |
| CI/CD | GitHub Actions + GHCR (Container Registry) |
| Reverse Proxy | Nginx |

---

## 16. MVP Roadmap (ปรับปรุง)

```mermaid
gantt
    title Blansole MVP Roadmap
    dateFormat  X
    axisFormat %s

    section Phase 1
    Core Account + Profile + Consent      :p1, 0, 2
    section Phase 2
    Device Pairing + Calibration + Battery/Sedentary Alert (rule-based) :p2, after p1, 2
    section Phase 3
    Session Recording + Offline Sync      :p3, after p2, 3
    section Phase 4
    Gait/Pressure/Risk Analysis           :p4, after p3, 2
    section Phase 5
    AI Summary + Insight + Guardrail + Eval set :p5, after p4, 3
    section Phase 5b
    Content Library + Admin Panel         :p5b, after p4, 3
    section Phase 6
    AI Chat + RAG + Memory + Program Recommendation :p6, after p5, 3
    section Phase 7
    Notification (cooldown/digest)        :p7, after p4, 2
    section Phase 8
    Health App Integration                :p8, after p6, 2
```

การเปลี่ยนแปลงหลักจากแผนเดิม (v2 → v3):

- ย้าย **rule-based alert (battery, sedentary)** เข้ามาตั้งแต่ **Phase 2** — ได้ engagement เร็ว ไม่ต้องรอ AI
- เพิ่ม **Calibration** เข้า Phase 2 เพราะเป็น prerequisite ของ pressure analysis ที่แม่นยำ
- เพิ่ม **Offline Sync** เข้า Phase 3 ชัดเจน เพราะกระทบ schema ตั้งแต่ต้น
- แยก **Guardrail + Eval set** เป็นงานที่ต้องทำคู่กับ AI Summary/Insight ใน Phase 5
- **เพิ่ม Phase 5b: Content Library + Admin Panel** ⭐ — ทำคู่ขนานกับ Phase 5 เพราะเป็น dependency ของ Phase 6 (AI ต้องมีวิดีโอ/โปรแกรมที่ publish แล้วถึงจะแนะนำได้จริง)
- **Phase 6 ขยายขอบเขต** ⭐ — รวม Memory Architecture พื้นฐาน (working + long-term + RAG) และ Program Recommendation เข้าไปด้วยกัน เพราะ chat flow กับ recommend flow ใช้ pipeline เดียวกัน (§5.4-5.6)
- `episode_summaries`, `user_memory_facts`, `user_percentile_stats` **ไม่ใช่ MVP** — ทำหลัง launch เมื่อเห็น pain point จริง (query ช้า/ตอบเทรนด์ผิด/มี user มากพอ)

---

## 17. Open Decisions / สิ่งที่ต้องตัดสินใจเพิ่ม

1. **Backend language**: FastAPI (Python, เหมาะกับทีมที่ต้องทำ data/AI งานเยอะ) vs NestJS (TypeScript, เหมาะถ้าทีม frontend/mobile ใช้ TS อยู่แล้ว)
2. **Self-host MinIO vs Cloud S3/GCS**: ถ้างบจำกัดช่วงแรก self-host MinIO ได้ แต่ต้องมี backup strategy เอง
3. **LLM provider**: เลือก provider + กำหนด budget ต่อ user/เดือน (AI chat cost ควบคุมยากถ้าไม่ตั้ง rate limit ตั้งแต่ต้น — ดู §4)
4. **Deploy target**: VM เดี่ยว ๆ พอสำหรับ MVP หรือใช้ managed service (RDS/Cloud SQL) สำหรับ PostgreSQL เพื่อลดภาระ ops
5. **TimescaleDB ใช้ตั้งแต่วันแรกหรือค่อยเพิ่ม** — แนะนำเปิด extension ไว้เลยตั้งแต่ schema แรก
6. ~~Admin panel เป็น service แยกหรือ module ในระบบเดิม~~ — **ตัดสินใจแล้ว** ใช้เป็น module ในระบบเดิมสำหรับ MVP (ดู §7.3) แยกทีหลังได้ถ้าจำเป็น

---

*จบเอกสาร v3 — พร้อมใช้เป็น reference เริ่มพัฒนา backend, content pipeline, และวาง CI/CD ได้ทันที*
