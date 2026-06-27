# 00 — Product Requirements Document (PRD)

**Project:** YorDor (ยด) — แอปนับแต้มและเคลียร์เงินกอล์ฟแบบหลายโหมด
**Codename ที่มา:** "ยกยอดเดิมพัน" / "All in หลุมสุดท้าย" (ชื่อเล่นกันเอง)
**Version:** 0.1 (draft)
**Last updated:** 2026-06-20
**Owner:** PLY

---

## 1. Summary

YorDor คือแอปสำหรับ **นับแต้มกอล์ฟ + คำนวณว่าใครได้/เสียกี่ point** ในวงเล่นแบบแข่งกันเอง รองรับหลายรูปแบบการนับ (Team / Match / Stroke / Skin) บน engine คำนวณเดียวที่ออกแบบให้ขยาย mode ได้

แอปทำงานในหน่วย **point ล้วน** — ไม่ถือเงิน ไม่มี wallet ไม่มี payment ไม่แปลงเป็นค่าเงินในระบบ หน้าที่ของแอปคือคำนวณผลลัพธ์ให้ชัดเจนว่า "ใครได้/เสียกี่ point และใครจ่าย point ให้ใคร" จะตีค่า point เป็นอะไรเป็นเรื่องของผู้เล่นนอกแอป ทำให้ลด legal/compliance risk ของการเป็น gambling platform

ปัจจุบันมี prototype ของ **Team Mode (Best 1 / Best 2, round-robin)** ที่ทำงานได้แล้วใน frontend (state ใน React hooks ล้วน ยังไม่ต่อ backend)

---

## 2. Problem & Motivation

ก๊วนกอล์ฟไทยนิยมเล่นแบบมีเดิมพันต่อหลุม/ต่อเกม แต่การนับแต้มจริงมีปัญหา:

- **คำนวณยาก** — มี handicap (แต้มต่อ) ต่อคน, มี bonus birdie/eagle, มีการคูณ (turbo), เทียบหลายคู่ทีม คนคิดในหัวพลาดบ่อย
- **เถียงกันตอนจบ** — ไม่มี log ว่าหลุมไหนใครได้แต้มเพราะอะไร พอจบรอบสรุปยอดไม่ตรงกัน
- **เคลียร์เงินวุ่น** — หลายคนหลายทีม ใครจ่ายใครเท่าไหร่ต้องนั่งกระดาษ

YorDor แก้โดยให้กรอกสกอร์รายหลุม แล้วระบบคำนวณ net, bonus, แต้มต่อคู่, และ settlement matrix แบบ real-time พร้อม breakdown ที่ตรวจสอบย้อนได้ทุกหลุม

---

## 3. Goals & Non-Goals

### Goals (v1)
- รองรับ 4 mode: **Team (Best N)**, **Match Play**, **Stroke Play**, **บ๊วยจ่ายหัว** + **Turbo** บน engine เดียว
- หนึ่งรอบใส่ได้หลายเดิมพันพร้อมกัน (bet layers) บนสกอร์ชุดเดียว
- คำนวณ net score จาก handicap ต่อคนต่อ par ได้ถูกต้อง 100% (มี golden test)
- แสดง settlement matrix แบบ point (ใครจ่าย point ให้ใคร) + breakdown รายหลุมที่ตรวจสอบย้อนได้
- บันทึกรอบการเล่น (save game) ลง backend และเปิดดูย้อนหลังได้
- ใช้บนมือถือเป็นหลัก (mobile-first, กรอกข้างสนามได้)

### Non-Goals (v1)
- **ไม่มี** ระบบเงินในแอป (wallet, top-up, payment gateway, การแปลง point เป็นค่าเงิน)
- **ไม่มี** player ถาวรข้ามรอบ — ผู้เล่นผูกกับ game เดี่ยวๆ (กรอกชื่อ + handicap ใหม่ทุกรอบ)
- **ไม่มี** ระบบ handicap index มาตรฐาน WHS/USGA — ใช้ handicap แบบกรอกเองต่อ par
- **ไม่มี** GPS / yardage / course map
- **ไม่มี** social feed, ranking ข้ามก๊วน, leaderboard สาธารณะ
- **ไม่มี** Skin mode (ขยายใน roadmap)

---

## 4. Target Users

### Persona A — ก๊วนเพื่อนเล่นสนุก (primary)
นัดตีกันประจำ 4–12 คน เดิมพันกันเล่นๆ จำนวนเงินไม่เยอะ เน้นความสะดวก กรอกง่าย จบในมือถือ ไม่อยากนั่งคิดเลข ไม่ซีเรียสเรื่อง handicap มาตรฐาน

### Persona B — กลุ่มจริงจัง / มีแต้มต่อระบบ (primary)
นักกอล์ฟที่มี handicap ของตัวเองชัดเจน เล่นเป็นประจำ ต้องการความแม่นยำในการคำนวณ net และอยากเก็บสถิติย้อนหลัง ตรวจสอบ breakdown ได้ว่าแต้มมาจากไหน

> v1 ออกแบบให้ทั้งสอง persona ใช้ร่วมกันได้ — handicap เป็น optional (default 0 = เล่นแบบ gross ล้วน), persona A ข้ามได้, persona B กรอกละเอียดได้

### ไม่ใช่กลุ่มเป้าหมาย v1
จัด tournament/society ขนาดใหญ่ (หลายฟลайท์ หลายวัน) — เป็นไปได้ใน roadmap แต่ไม่ optimize ให้ v1

---

## 5. Scope by Mode

| Mode | v1 | คำอธิบายสั้น | หน่วยการแข่ง |
|------|----|--------------|--------------|
| **Best 1 Best 2** (Team) | ✅ | จับทีม เทียบ Best 1 / Best 2 แบบ round-robin ทุกคู่ทีม — ชื่อที่โชว์ผู้ใช้ = "Best 1 Best 2" | ทีม vs ทีม |
| **Match Play** | ✅ | 1-vs-1 เลือกคิดแบบนับหลุม (margin) หรือสกอร์รวม — แปะซ้อนในรอบ Team ได้ | คน vs คน |
| **Stroke Play** | ✅ | นับสกอร์รวมทั้งรอบ จัดอันดับ net + gross, settle round-robin | คนเดี่ยว |
| **บ๊วยจ่ายหัว (High-Low)** | ✅ | เล่นหลายคนไม่จับทีม รายหลุม บ๊วยจ่ายหัวคนละ 1 point | คนเดี่ยว ต่อหลุม |
| **Turbo multiplier** | ✅ | คูณแต้มหลุมที่เปิด (×2) toggle ได้ทุกโหมด — modifier ซ้อนกับ bonus | modifier |
| **Skin** | 🔜 roadmap | แต่ละหลุมมี point กอง คนชนะเดี่ยวกินหมด เสมอทบหลุมถัดไป | คน/ทีม ต่อหลุม |

> **หน้าแรก = เลือกเกม:** เปิดแอปเจอเมนูเลือกเกม (game picker) แต่ละการ์ด = โหมด v1 เปิดเฉพาะ **Best 1 Best 2** ที่เหลือ "เร็วๆ นี้" (ดู `05_UI_FLOWS.md` §2)
> **หมายเหตุ:** หนึ่งรอบมีได้หลายเดิมพันพร้อมกัน (bet layers) บนสกอร์ชุดเดียว เช่น Team + Match ส่วนตัวซ้อนกัน — ดู `01_GAME_RULES.md` §2
> **Bonus:** Birdie ×2, Eagle ×3, Albatross ×5 (คิดจาก gross ผู้ชนะ) — ดู `02_SCORING_LOGIC_SPEC.md`

---

## 6. Core Concepts (shared engine)

แนวคิดที่ทุก mode ใช้ร่วมกัน — รายละเอียดคณิตศาสตร์อยู่ใน `02_SCORING_LOGIC_SPEC.md`

- **Strokes (gross):** จำนวนตีจริงต่อคนต่อหลุม
- **Handicap (แต้มต่อ):** ค่าต่อคน แยกตาม par (3/4/5) บวกกลับเข้า net → `net = strokes + handicap[par]`
- **Net score:** สกอร์หลังหักแต้มต่อ ใช้ตัดสินแพ้ชนะ (น้อย = ดี)
- **Bonus (gross-based):** Birdie ×2, Eagle+ ×3 — ดูจาก gross ของผู้ชนะเทียบ par
- **Turbo:** modifier ×2 ต่อหลุมที่อนุญาต คูณซ้อนกับ bonus
- **Settlement matrix:** ตาราง "แถวจ่าย point ให้คอลัมน์" + ยอด point สุทธิต่อผู้เล่น/ทีม
- **Hole log / breakdown:** บันทึกรายหลุมว่าแต้มเกิดจากอะไร ตรวจสอบย้อนได้

---

## 7. Platform & Tech (สรุป — รายละเอียดในไฟล์ถัดไป)

- **Frontend:** Next.js (App Router), mobile-first PWA
- **API:** tRPC (type-safe end-to-end)
- **DB:** Prisma + PostgreSQL
- **Deploy:** Railway (web + Postgres)
- **Auth:** (เลือกใน roadmap — เริ่มจาก guest/local ได้)

> engine คำนวณเป็น **pure function แยกจาก UI** (ใน prototype อยู่ section LOGIC) — ใช้ซ้ำได้ทั้ง client (live preview) และ server (authoritative result + golden test)

---

## 8. Success Metrics (เบื้องต้น)

- คำนวณ point settlement ตรงกับการคิดมือ 100% บน golden test set (`07_TEST_CASES.md`)
- กรอกครบ 18 หลุม 4 คนจบได้ภายใน ≤ เวลาที่เล่นจริง (กรอกทันระหว่างรอบ)
- เปิดรอบเก่าดู breakdown ย้อนหลังได้ครบทุกหลุม
- 1 ก๊วนใช้ซ้ำ ≥ 3 รอบ (retention เชิงพฤติกรรม)

---

## 9. Decisions (locked)

ตัดสินใจแล้ว ใช้เป็นฐานของไฟล์ที่เหลือ:

- **ผู้เล่น = per-game** — ไม่มี player entity ถาวร กรอกชื่อ + handicap ใหม่ทุกรอบ player ผูกกับ game เดียว (schema เรียบง่ายขึ้น ไม่มี cross-round identity)
- **Handicap = ต่อ par** — กรอกแต้มต่อแยกตาม par 3/4/5 ต่อคน (ไม่ทำ hole stroke index มาตรฐานใน v1)
- **หน่วย = point ล้วน** — ไม่พูดถึง/ไม่แปลงค่าเงินในแอป
- **Turbo = อยู่ใน v1** — modifier ×2 เปิดได้เฉพาะหลุมที่อนุญาต

- **Auth model:** ✅ **Guest ก่อน — ไม่ต้อง login** (v1) ผูกรอบกับ device/ลิงก์ ค่อยเพิ่ม account ทีหลัง
- **Team settlement scope:** ✅ สรุป point **ระดับทีม** ไม่ map ลงรายคน (ไม่ผูกเงิน)

---

## 10. Related Documents

| File | เนื้อหา |
|------|---------|
| `01_GAME_RULES.md` | กติกาทุก mode เป็นภาษาคน |
| `02_SCORING_LOGIC_SPEC.md` | สเปกคณิตศาสตร์การคำนวณ |
| `03_DATABASE_SCHEMA.md` | ER diagram + Prisma model |
| `04_API_DESIGN.md` | tRPC router/procedure |
| `05_UI_FLOWS.md` | flow แต่ละหน้า + wireframe |
| `06_ROADMAP.md` | ลำดับการพัฒนา + milestone |
| `07_TEST_CASES.md` | golden test คำนวณ |
