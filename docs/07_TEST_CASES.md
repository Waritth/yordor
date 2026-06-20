# 07 — Test Cases (Golden Tests)

**Project:** YorDor
**Version:** 0.1 (draft)
**Last updated:** 2026-06-20
**คู่กับ:** `02_SCORING_LOGIC_SPEC.md` (สูตร)

> ทุกค่าคาดหวังในไฟล์นี้ **verify แล้วด้วย reference implementation ของ spec** (zero-sum ผ่านทุกเคส)
> เป็น golden test ของ `packages/engine` — input เดิมต้องได้ output เดิมเป๊ะ
> convention: `totals[id]` = ยอดสุทธิ (+ รับ / − จ่าย), `matrix[from][to]` = point ที่ from จ่าย to

---

## 0. Helper fixtures

```
handicap ว่าง = {3:0,4:0,5:0}  → net = gross
hole = { par, turbo }
```

---

## 1. Unit: net score

| par | gross | handicap[par] | net คาดหวัง |
|---|---|---|---|
| 5 | 7 | 2 | **9** |
| 4 | 4 | 0 | **4** |
| 3 | 5 | 0.5 | **5.5** |
| 4 | null | 1 | **null** (ไม่นับ) |

> สูตร `net = gross + handicap[par]` ("ต่อ" บวกเข้า net ตามกติกาก๊วน)

---

## 2. Unit: bonus multiplier (จาก gross ผู้ชนะ)

| par | gross | diff | ชื่อ | mult คาดหวัง |
|---|---|---|---|---|
| 4 | 4 | 0 | — | **1** |
| 4 | 3 | 1 | Birdie | **2** |
| 4 | 2 | 2 | Eagle | **3** |
| 5 | 2 | 3 | Albatross | **5** |
| 3 | 4 | −1 | (bogey) | **1** |
| any | null | — | — | **1** |

---

## 3. Unit: turbo

| hole.turbo | mult |
|---|---|
| false | **1** |
| true | **2** |

---

## 4. Team Mode

### 4.1 เคสพื้นฐาน (1 หลุม, no turbo) — verified
**Input:** par 4, turbo off, hcp ว่างทุกคน
```
Team A: som gross 3, lek gross 5
Team B: joe gross 4, kan gross 5
```
**Expected:**
```
totals = { A: +2, B: -2 }
matrix.B.A = 2          // B จ่าย A 2
Σ totals = 0
```
ที่มา: Best1 A net3 vs B net4 → A ชนะ, gross3=Birdie ×2 → 2pt · Best2 net5=net5 เสมอ → 0

### 4.2 Birdie + Turbo คูณซ้อน — verified
**Input:** par 4, **turbo on**, hcp ว่าง
```
Team A: som 3, lek 5
Team B: joe 4, kan 6
```
**Expected:**
```
totals = { A: +6, B: -6 }
Σ totals = 0
```
ที่มา: Best1 A win gross3 Birdie ×2 × turbo ×2 = **4** · Best2 A net5 vs B net6 win gross5 (no bonus) × turbo ×2 = **2** · รวม A = 6

### 4.3 ทีมคนเดียว (no Best2)
**Input:** Team A = [som] (1 คน), Team B = [joe,kan], par 4
**Expected:** เกม Best2 ที่เกี่ยวกับ A ถูกข้าม (A ไม่มี rank[1]) — คำนวณเฉพาะ Best1

### 4.4 ขาดข้อมูล
**Input:** kan ยังไม่กรอก (null)
**Expected:** เกมที่ kan เป็นคู่เทียบไม่ถูกนับ, ผู้เล่นอื่นไม่กระทบ

---

## 5. Match Play

### 5.1 Match-style 9 หลุม (bonus off, turbo off) — verified
**Input:** A vs B, hcp ว่าง, par 4 ทุกหลุม
```
gross A = [3,3,3,3,5,5,4,4,4]
gross B = [4,4,4,4,3,3,4,4,4]
→ A ชนะ 4 หลุม (0-3), B ชนะ 2 (4-5), เสมอ 3 (6-8)
```
**Expected:**
```
up = +2   (+ = A นำ)
→ B จ่าย A 2
```

### 5.2 Match-style AS (เสมอทั้งรอบ)
**Input:** A ชนะ = B ชนะ
**Expected:** `up = 0` → ไม่มีใครจ่าย

### 5.3 Match-style + Turbo
**Input:** หลุมที่ A ชนะเป็น turbo
**Expected:** หลุมนั้นนับ ±2 แทน ±1 ใน up

### 5.4 Stroke-style (net, pointPerStroke 1)
**Input:** net รวม A=70, B=74
**Expected:** diff 4 → **B จ่าย A 4**

---

## 6. Stroke Play (round-robin)

### 6.1 3 คน (gross basis, pps 1) — verified
**Input:** total A=72, B=75, C=78
**Expected:**
```
totals = { A: +9, B: 0, C: -9 }
matrix.B.A = 3
matrix.C.A = 6
matrix.C.B = 3
Σ totals = 0
```

### 6.2 เสมอในคู่
**Input:** A=75, B=75
**Expected:** คู่ A-B ไม่จ่าย (d=0)

### 6.3 net vs gross ต่างผล
**Input:** เลือก basis ต่างกัน → leaderboard/settlement ต่างกัน
**Expected:** settlement ใช้ basis เดียวตาม config, leaderboard แสดงทั้งคู่

---

## 7. High-Low (บ๊วยจ่ายหัว, รายหลุม)

### 7.1 5 คน 1 หลุม (net, no bonus/turbo) — verified
**Input:** net = P1:3, P2:4, P3:4, P4:5, P5:5
**Expected:**
```
totals = { P1: +2, P2: 0, P3: 0, P4: -1, P5: -1 }
Σ totals = 0
```
ที่มา: หัว=P1(3), บ๊วย=P4,P5(5) → P4,P5 จ่าย P1 คนละ 1

### 7.2 หัวเสมอ 2 คน — verified
**Input:** net = P1:3, P2:3, P3:5
**Expected:**
```
totals = { P1: +1, P2: +1, P3: -2 }
Σ totals = 0
```
ที่มา: P3(บ๊วย) จ่าย P1 และ P2 คนละ 1

### 7.3 ทุกคนเสมอ
**Input:** net เท่ากันหมด
**Expected:** best == worst → ข้ามหลุม ไม่มีใครจ่าย

### 7.4 บ๊วยเสมอ 2 คน
**Input:** net = P1:3, P2:5, P3:5
**Expected:** P2,P3 จ่าย P1 คนละ 1 → P1 +2, P2 −1, P3 −1

---

## 8. Bet Layers (aggregation)

### 8.1 Team + Match ซ้อนในรอบเดียว
**Input:** Bet#1 Team (A:som,lek / B:joe,kan), Bet#2 Match som-vs-joe
**Expected:**
```
betTotals แยกกัน 2 ชุด
roundTotals (ผู้เล่น) = ผลรวม bet ที่ผู้เล่นนั้นเกี่ยว
ตารางทีม (จาก Bet#1) แยกจากตารางผู้เล่น (จาก Bet#2)
```
> ตรวจ: ผลรวมแต่ละ bet zero-sum อิสระ, รวมรอบหน่วย point เดียวกัน

---

## 9. Invariants (property tests — รันกับ input สุ่ม)

| # | invariant | เช็ค |
|---|---|---|
| 1 | **Zero-sum** | `Σ totals[*] === 0` ทุก bet |
| 2 | **Matrix↔totals** | `totals[x] === Σ matrix[*][x] − Σ matrix[x][*]` |
| 3 | **Determinism** | เรียกซ้ำ input เดิม → output identical |
| 4 | **Null safety** | ลบสกอร์ 1 cell ไม่เปลี่ยนผลของคู่ที่ไม่เกี่ยว |
| 5 | **Non-negative pts** | ทุก `matrix[from][to] >= 0` |
| 6 | **Tie → no transfer** | net เสมอ ไม่มี point ไหล |

> เคส verified ทั้งหมดข้างบนผ่าน invariant 1 (zero-sum) แล้ว ใช้เป็น seed ของ property test

---

## 10. แนะนำการ implement test

```ts
// packages/engine/__tests__/team.test.ts
import { computeTeam } from "../team";

test("4.1 team basic birdie", () => {
  const r = computeTeam(teamsFixture, [{par:4,turbo:false}], scores411);
  expect(r.totals).toEqual({ A: 2, B: -2 });
  expect(r.matrix.B.A).toBe(2);
  expect(sum(r.totals)).toBe(0);
});
```

- ใช้ค่า **verified** ในไฟล์นี้เป็น expected ตรงๆ
- property test (§9) ใช้ fast-check หรือสุ่ม fixture เอง
- รัน golden test ใน CI ทุก commit (P0 ของ `06_ROADMAP.md`)
- **ห้าม merge** ถ้า golden test ไม่ผ่าน — logic คือหัวใจของแอป
