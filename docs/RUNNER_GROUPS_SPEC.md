# R — ตัววิ่ง (Runner) + วงส่วนตัว (Groups)

**Project:** YorDor · **Game type:** `GOLF` (ต่อยอด Best 1 Best 2)
**Version:** 0.1 (draft) · **Last updated:** 2026-09-19
**คู่กับ:** `02_SCORING_LOGIC_SPEC.md` (สูตรเดิม), `07_TEST_CASES.md`

> สองฟีเจอร์บนสกอร์ชุดเดียวกัน (กรอกครั้งเดียว):
> **A. ตัววิ่ง** — ก๊วนใหญ่ Best 1 Best 2 ที่คนเป็นเลขคี่ มีคน "วิ่ง" ไปอยู่ทีมต่างๆ ตามช่วงหลุม
> **B. วง (Group)** — เกมส่วนตัวซ้อน: ตัวต่อตัวนับหลุม (เจอกันทุกคู่) และ/หรือ บ๊วยจ่ายหัว
> กติกาเดิมไม่เปลี่ยน: `net = gross + ต่อ`, net ต่ำชนะ, Bonus จาก gross ผู้ชนะ, Turbo ×2

---

## 1. บทบาทผู้เล่นในก๊วนใหญ่ (decisions locked)

| บทบาท | ความหมาย |
|---|---|
| **MEMBER** | อยู่ทีมประจำ (เหมือนเดิม) |
| **RUNNER** | ตัววิ่ง — ไม่มีทีมประจำ อยู่ทีมตาม "ตารางวิ่ง" · **มีได้หลายคน** |
| **OFF** | ไม่เล่นก๊วนใหญ่ (หรือปิดระบบวิ่งของคนนั้น) — ยังอยู่ใน scoreboard กรอกสกอร์ได้ และเข้าวงส่วนตัวได้ |

- ผลก๊วนใหญ่ยัง **สรุประดับทีม** (totals/matrix ต่อทีม) — ตัววิ่งเคลียร์เงินกันเอง แอปไม่แตกรายคน
- ปิด/เปิดตัววิ่งได้ (RUNNER ↔ OFF) โดยตารางวิ่งไม่หาย

## 2. ตารางวิ่ง (Runner schedule)

```
RunnerSegment = { playerId, teamId, fromHole, toHole }   // หลุม 1-based, รวมปลายทั้งสองด้าน
```

- ผู้ใช้กำหนดเอง: **ช่วงหลุม + ลำดับทีม** ของตัววิ่งแต่ละคน
- **Default** (กดสร้างให้อัตโนมัติ แก้ได้): แบ่งหลุมเท่าๆ กันตามจำนวนทีม ตามลำดับทีม
  - 18 หลุม 2 ทีม → 1–9 A, 10–18 B · 3 ทีม → 1–6 A, 7–12 B, 13–18 C
  - หารไม่ลงตัว ช่วงแรกๆ ได้หลุมเกิน (9 หลุม 2 ทีม → 1–5 A, 6–9 B)
  - ตัววิ่งคนที่ k เริ่มหมุนจากทีมที่ k (คนที่ 2 เริ่มทีม B) เพื่อไม่ให้ไปกองทีมเดียว
- Validation: ช่วงของตัววิ่งคนเดียวกัน **ห้ามซ้อนกัน**, อยู่ใน 1..holeCount · หลุมที่ไม่มีช่วง = หลุมนั้นตัววิ่งไม่ถูกนับ

## 3. Logic — ก๊วนใหญ่มีตัววิ่ง

```
membersAt(team, holeIdx) =
    team.players (MEMBER)
  + runners ที่ enabled และมี segment: teamId == team.id และ fromHole <= holeIdx+1 <= toHole

teamRanked(team, par, scores, holeIdx):   // เหมือนเดิม แต่ใช้ membersAt
computeTeam(...)                          // ที่เหลือเหมือน 02 §4 ทุกประการ
```

- ทีมที่มีตัววิ่งหลุมนั้นมีคนให้เลือก Best1/Best2 มากขึ้น (3 คน หรือมากกว่าถ้าตัววิ่งหลายคน)
- ไม่มีตัววิ่ง → ผลต้อง **เท่าเดิมเป๊ะ** (golden test เดิมต้องเขียว)

## 4. วง (Group)

```
Group = {
  name, players[2+],                        // subset ของผู้เล่นในรอบ (รวมคน OFF ได้)
  match:   { on, bonus, turbo },            // ตัวต่อตัวนับหลุม เจอกันทุกคู่ในวง
  highlow: { on, bonus, turbo },            // บ๊วยจ่ายหัว
  handicap[player] = {3,4,5} | null         // null = ใช้ต่อชุดหลักของคนนั้น (default)
}
```

- 1 รอบมีได้หลายวง · 1 คนอยู่ได้หลายวง · วงหนึ่งเปิดได้ทั้ง 2 เกมซ้อนกัน
- อยากเล่นเฉพาะ 2 คน = สร้างวง 2 คนแยก (ต่อรายคู่ก็ปรับในวงนั้น)
- **ฐานคิด = net ของวง** (gross + ต่อของวงนั้น) ทั้ง 2 เกม
- bonus/turbo เปิดปิดได้ **แยกต่อเกมต่อวง** (default: ปิดทั้งคู่)

### 4.1 Match (นับหลุม, round-robin ในวง)
```
for hole: for each pair (A,B) in group:
    r = compareNet(netA, netB)            // ⊘ หรือเสมอ → ข้าม
    pts = 1 × (bonus ? bonusMult(winnerGross, par) : 1) × (turbo ? turboMult(hole) : 1)
    matrix[loser][winner] += pts ; totals ±= pts
```
### 4.2 High-Low (บ๊วยจ่ายหัว) — ตาม `02` §7
ทุกบ๊วยจ่ายทุกหัวคนละ 1 × bonus(จาก gross หัว) × turbo · ทุกคนเสมอ = ข้ามหลุม · ต้องมี ≥2 คนที่มีสกอร์

### 4.3 รวมผล
- แต่ละเกมในแต่ละวง → `{ totals, matrix, holeLog }` ระดับผู้เล่น (zero-sum อิสระ)
- **รวมสุทธิต่อคน** = Σ ทุกเกมทุกวงที่คนนั้นอยู่ · ตารางทีม (ก๊วนใหญ่) แยกไม่ปน

---

## 5. Data Model (เพิ่ม)

```prisma
enum MainRole { MEMBER  RUNNER  OFF }

model Player {            // เพิ่ม field
  mainRole MainRole @default(MEMBER)
}
model RunnerSegment {
  id, roundId, playerId, teamId, fromHole Int, toHole Int
  @@index([roundId])  // cascade ตาม round/player/team
}
model Group {
  id, roundId, name, order Int
  config Json   // { match:{on,bonus,turbo}, highlow:{on,bonus,turbo} }
  players GroupPlayer[]
}
model GroupPlayer {
  id, groupId, playerId
  hcpPar3 Float?  hcpPar4 Float?  hcpPar5 Float?    // null = ใช้ของ Player
  @@unique([groupId, playerId])
}
```
> MEMBER ยังผูกทีมผ่าน `BetPlayer.teamId` เดิม · RUNNER/OFF ไม่มี BetPlayer.teamId
> แผน P4–P7 เดิม (Bet layers / Match / High-Low) ถูกแทนด้วย Group นี้ — Stroke play + scorecard grid (P6) ยังอยู่ใน roadmap

## 6. API (tRPC)

| Procedure | หน้าที่ |
|---|---|
| `player.setMainRole` | MEMBER / RUNNER / OFF (ย้ายเข้าทีม = MEMBER + team.assign) |
| `runner.setSchedule` | แทนที่ segments ทั้งชุดของตัววิ่ง 1 คน (validate ไม่ซ้อน/อยู่ในช่วงหลุม) |
| `runner.autoSchedule` | สร้าง default ตาม §2 |
| `group.create / update / remove` | ชื่อ + config เกม |
| `group.setPlayers` | รายชื่อในวง + handicap override |
| `result.get` | เพิ่ม `groupResults[]` + `playerTotals` (รวมสุทธิต่อคน) |

ทุก mutation → `touchRound` (sync เดิม)

## 7. UI

- **ตั้งค่า:** การ์ดทีมเดิม + การ์ดใหม่ **"ตัววิ่ง / ไม่เล่นก๊วนใหญ่"** — เพิ่มคน, สวิตช์ "วิ่ง" เปิด/ปิด, ตารางวิ่ง (แถว: หลุม _–_ → ทีม, ปุ่ม "จัดอัตโนมัติ")
- **สเตปใหม่ "วง"** (ตั้งค่า → วง → เล่น → ผล): รายการวง + sheet สร้าง/แก้ (ชื่อ, ติ๊กผู้เล่น, เปิดเกม Match/บ๊วยจ่ายหัว, Bonus/Turbo ต่อเกม, ตารางต่อของวง — default จากชุดหลัก) · ข้ามได้ถ้าไม่มีวง
- **เล่น:** ช่องกรอกแสดงทุกคน (รวม OFF) · หลุมนั้นตัววิ่งอยู่ทีมไหนมี badge · live: ยอดทีม + ยอดต่อวง
- **ผล:** ตารางทีม (เดิม) + ตารางต่อวงต่อเกม + **รวมสุทธิต่อคน** + breakdown รายหลุม

---

## 8. Golden Tests (par 4, ต่อ 0, turbo/bonus ตามระบุ)

| # | Input | Expected |
|---|---|---|
| **R1** วิ่งสลับทีม | A:{a1=4,a2=5} B:{b1=4,b2=5} runner r=3 · หลุม1 r อยู่ A, หลุม2 r อยู่ B (สกอร์เหมือนกัน 2 หลุม, bonus เปิด) | หลุม1: Best1 3v4 A ชนะ Birdie×2=2, Best2 4v5 A ชนะ 1 → A+3 · หลุม2 กลับข้าง B+3 · totals A=0,B=0 · matrix A→B=3, B→A=3 |
| **R2** หลุมไม่มีช่วง | R1 แต่ r ไม่มี segment หลุม 2 | หลุม2: 4v4, 5v5 เสมอ → totals A=+3, B=−3 |
| **R3** ตัววิ่ง 2 คนทีมเดียว | r1=3, r2=3 อยู่ A ทั้งคู่ หลุม1 | Best1 3v4 → 2, Best2 3v5 → Birdie×2=2 → A=+4 |
| **R4** ปิดตัววิ่ง (OFF) | R1 แต่ r เป็น OFF | ไม่ถูกนับทั้ง 2 หลุม → totals 0/0, matrix 0 |
| **R5** ไม่ regress | ไม่มี runner | ผลเท่า `07` §4.1/4.2 เป๊ะ |
| **G1** Match 3 คน | วง {p1=3,p2=4,p3=5} bonus ปิด | p1 +2, p2 0, p3 −2 |
| **G2** Match + bonus | G1 เปิด bonus | p1 ชนะ 2 คู่ ×2 → p1 +4, p2 −2+1=−1, p3 −2−1=−3 |
| **G3** ต่อของวง | p1=4,p2=4 ต่อหลัก 0 · วงตั้ง p1 ต่อ par4=1 | net 5v4 → p2 +1, p1 −1 (ก๊วนใหญ่ยังใช้ต่อ 0) |
| **G4** บ๊วยจ่ายหัว | net 3,4,4,5,5 | = `07` §7.1: +2,0,0,−1,−1 |
| **G5** 2 เกมซ้อน + 2 วง | p1 อยู่วง X (match) และวง Y (highlow) | playerTotals[p1] = ผลวง X + ผลวง Y · แต่ละเกม Σ=0 |
| **G6** เสมอ/ยังไม่กรอก | net เท่ากัน / null | คู่นั้นไม่มีแต้มไหล คนอื่นไม่กระทบ |
| **G7** Turbo ต่อเกม | หลุม turbo, วงเปิด turbo เฉพาะ match | match ×2, highlow ×1 |

**Invariants:** ทุกเกมทุกวง Σ totals = 0 · matrix↔totals · determinism · Σ playerTotals = 0
