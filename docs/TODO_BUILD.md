# TODO — Build Checklist (YorDor)

**ใช้ยังไง:** ทำทีละข้อ เสร็จแล้วเปลี่ยน `- [ ]` เป็น `- [x]` (ให้ Claude เช็คถูกให้ทุกครั้งที่ทำเสร็จ)
**อ้างอิง:** `06_ROADMAP.md` (เฟส), `02/03/04` (สเปก), `07` (golden test)
**กติกาเหล็ก:** ห้ามขึ้นเฟสใหม่ถ้า golden test เฟสก่อนยังไม่เขียว · engine มาก่อน UI เสมอ

---

## P0 — Foundation
- [x] สร้างโปรเจกต์ T3 (`create-t3-app`): Next.js App Router + tRPC v11 + Prisma + TypeScript + Tailwind
- [x] ตั้ง monorepo: `apps/web` + `packages/engine`
- [x] สร้าง Postgres บน Railway + ใส่ `DATABASE_URL` ใน env (public proxy)
- [x] วาง `schema.prisma` ตาม `03_DATABASE_SCHEMA.md` (Round, Hole, Player, Score, Bet, Team, BetPlayer + enums)
- [x] `prisma migrate dev` migration แรกผ่าน (`20260620172638_init`)
- [x] ตั้ง CI: typecheck + test (GitHub Actions) — `.github/workflows/ci.yml`
- [x] deploy ขึ้น Railway, เปิดหน้าเปล่าได้ (yordor-production.up.railway.app)
- [x] **เช็ค:** push → deploy เขียว, DB connect ได้ (web + DB อยู่ Singapore region เดียวกัน → เร็ว)

## P1 — Engine + Golden Test (Team)
- [x] `packages/engine`: `net()` (⚠️ `strokes − handicap`), `bonusMult()` (Albatross ×5), `turboMult()`
- [x] `teamRanked()` + `computeTeam()` ตาม `02` §4
- [x] ตั้ง test runner (vitest) ใน `packages/engine`
- [x] เขียน golden test: `07` §1, §2, §3 (unit), §4.1, §4.2 (Team) — รวม 4.3/4.4
- [x] เขียน invariant test: zero-sum, matrix↔totals, determinism (`07` §9) — 50 random rounds + null-safety + tie
- [x] **เช็ค:** test เขียวครบ + invariants ผ่าน (73 tests green)

## P2 — Team Mode End-to-End (single device)
- [x] tRPC: `round.create`, `round.get`
- [x] tRPC: `player.add/remove/rename/setColor/setHandicap`
- [x] tRPC: `hole.setPar/setTurbo`
- [x] tRPC: `score.set/setMany`
- [x] tRPC: `result.get` (เรียก engine)
- [x] UI: หน้าแรก (สร้างรอบ) → `05` §2
- [x] UI: setup (หลุม + รายชื่อผู้เล่น) → `05` §3
- [x] UI: handicap → `05` §4
- [x] UI: play per-hole + breakdown → `05` §6
- [x] UI: result (ตารางทีม + matrix + รายหลุม) → `05` §8
- [x] เชื่อม engine preview ฝั่ง client
- [x] **เช็ค:** เล่น 18 หลุม 2 ทีมจบ, reload ข้อมูลอยู่, matrix ถูก (E2E ผ่านกับ Railway DB)

## P3 — Sync + Share ★ MVP LAUNCH (Team only)
- [x] `accessToken` flow + route `/round/{token}`
- [x] หน้าแชร์ลิงก์ + QR + localStorage รอบล่าสุด → `05` §9
- [x] subscription `round.live` (SSE) + in-memory event emitter
- [x] polling fallback (`refetchInterval` 5s)
- [x] optimistic update `score.set`
- [x] indicator ออนไลน์/ซิงก์
- [x] `round.setStatus` (FINISHED lock) + ปลดล็อกแก้สกอร์
- [x] **เช็ค:** 2 เครื่องเปิดลิงก์เดียว กรอกพร้อมกัน เห็น update สด (verified: client A เห็นการแก้จาก client B เอง) → **ปล่อยก๊วนลอง**

## P4 — Bet Layers Infrastructure
- [ ] tRPC: `bet.create/update/setParticipants/remove` + config validation (`04` §5)
- [ ] refactor Team mode เดิม → เป็น Bet (mode=TEAM)
- [ ] UI: สเตป "เดิมพัน" + sheet เพิ่ม/แก้ bet → `05` §5
- [ ] aggregate หลาย bet (`02` §8): ตารางทีม + ตารางผู้เล่น + รวมสุทธิต่อคน
- [ ] **เช็ค:** Team mode ทำงานผ่านระบบ Bet ใหม่ ไม่ regress (golden test ยังเขียว)

## P5 — Match Play
- [ ] engine: `computeMatchHoles()` + `computeMatchStroke()` (`02` §5)
- [ ] golden test: `07` §5.1–5.4
- [ ] UI: bet sheet โหมดแมตช์ (จับคู่ + นับหลุม/สกอร์รวม + net/gross + Turbo)
- [ ] **เช็ค:** เคส Match เขียว + เล่นซ้อน Team ได้ในรอบเดียว

## P6 — Stroke Play + Scorecard Grid
- [ ] engine: `computeStroke()` (net+gross, round-robin) (`02` §6)
- [ ] golden test: `07` §6.1–6.3
- [ ] UI: มุมมอง scorecard grid + สลับกับ per-hole → `05` §7
- [ ] leaderboard net/gross 2 ตาราง
- [ ] **เช็ค:** เคส Stroke เขียว + สลับ 2 มุมมองกรอกได้

## P7 — High-Low (บ๊วยจ่ายหัว)
- [ ] engine: `computeHighLow()` (รายหลุม, เสมอหลายคน) (`02` §7)
- [ ] golden test: `07` §7.1–7.4
- [ ] UI: bet sheet โหมดบ๊วยจ่ายหัว (net/gross + point/คู่)
- [ ] **เช็ค:** เคส High-Low เขียว (รวมเคสเสมอ)

## P8 — Turbo / Bonus Polish ★ v1 COMPLETE
- [ ] Turbo toggle ครบทุกโหมด (รายหลุม + สกอร์รวมตามนิยาม `02` §3)
- [ ] Bonus breakdown UI (Birdie/Eagle/Albatross) สวยงาม
- [ ] ทบทวน edge cases ทุกโหมด (`02` §9)
- [ ] QA รอบใหญ่: 18 หลุม หลาย bet หลาย device
- [ ] **เช็ค:** ทุกโหมด + Turbo + Bonus เขียว + เล่นจริงไม่มี bug → **v1 สมบูรณ์**

---

## Roadmap+ (หลัง v1 — ยังไม่ติ๊ก)
- [ ] Skin mode (per-hole pot + carry-over)
- [ ] User accounts + claim รอบ guest
- [ ] ประวัติ/สถิติข้ามรอบ
- [ ] Standard handicap index (stroke index ต่อหลุม)
- [ ] Nassau / Stableford
- [ ] Scale realtime (Postgres LISTEN/NOTIFY หรือ Redis)
- [ ] Course library (เก็บ par/turbo สนาม reuse)

---

## หนี้/บัคที่รู้แล้ว
- [x] ~~prototype bug net `+`~~ → **ยืนยันแล้วว่า `+` ถูกต้อง** ตามที่ก๊วนเล่นจริง (เอกสารเดิมตีความผิด) — `packages/engine/src/net.ts` ใช้ `strokes + handicap`, golden test `07` §1 อัปเดตแล้ว
- [ ] ตัดสิน: บ๊วยจ่ายหัว ฐาน net หรือ gross (default net) — ยืนยันก่อน P7
