# 02 — Scoring Logic Spec (คณิตศาสตร์)

**Project:** YorDor
**Version:** 0.1 (draft)
**Last updated:** 2026-06-20
**คู่กับ:** `01_GAME_RULES.md` (กติกาภาษาคน), `07_TEST_CASES.md` (golden test)

> เอกสารนี้เป็น **single source of truth** ของการคำนวณ ทุกสูตรเขียนแบบ deterministic
> engine ต้องเป็น **pure function** (input เดิม → output เดิมเสมอ) แยกจาก UI ใช้ซ้ำได้ทั้ง client preview และ server authoritative result

---

## 0. Notation & Data Model

```
Player   = { id, name, handicap: { 3: number, 4: number, 5: number } }
Hole     = { index: 0..H-1, par: 3|4|5, turbo: boolean }
Scores   = scores[playerId][holeIndex] = strokes (number) | null
Bet      = เดิมพันหนึ่งรายการในรอบ (มี mode + config + ผู้เข้าร่วม)
Round    = { holes: Hole[], players: Player[], scores: Scores, bets: Bet[] }
```

ค่าคงที่:
```
PARS            = [3, 4, 5]
BONUS_BIRDIE    = 2     // gross = par - 1
BONUS_EAGLE     = 3     // gross = par - 2
BONUS_ALBATROSS = 5     // gross <= par - 3
TURBO_MULT      = 2
```

สัญลักษณ์:
- `s` = strokes (gross) ของผู้เล่นในหลุมหนึ่ง
- `h(p, par)` = handicap ของ player p ที่ par นั้น
- `net` = สกอร์สุทธิหลังหักแต้มต่อ
- `⊘` = ไม่มีข้อมูล / ไม่นับ (null)

---

## 1. Net Score

```
net(s, p, par):
    if s == null: return ⊘
    return s - h(p, par)
```

> ⚠️ **แก้จาก prototype:** ของเดิมเป็น `s + h` ต้องเปลี่ยนเป็น `s - h`
> "ต่อ" = ช่วยคนตีอ่อน → handicap หักออก → net ต่ำลง = ได้เปรียบ

**ตัวอย่าง:** par 5, ตีจริง 7, handicap[5] = 2 → net = 7 − 2 = **5**

net เป็นทศนิยมได้ (handicap 0.5) — เปรียบเทียบด้วย `<` `>` ปกติ ไม่ปัดเศษ

---

## 2. Bonus (gross-based)

ดูจาก **gross ของผู้ชนะ** เทียบ par ของหลุม:

```
bonusMult(gross, par):
    if gross == null: return 1
    diff = par - gross
    if diff >= 3: return 5    // Albatross+
    if diff == 2: return 3    // Eagle
    if diff == 1: return 2    // Birdie
    return 1                  // par หรือแย่กว่า

bonusLabel(gross, par):
    diff = par - gross
    if diff >= 3: return "Albatross"
    if diff == 2: return "Eagle"
    if diff == 1: return "Birdie"
    return null
```

**ตัวอย่าง:** par 4 ตี 2 → diff 2 → Eagle ×3

---

## 3. Turbo (modifier)

```
turboMult(hole):
    return hole.turbo ? TURBO_MULT : 1
```

- **โหมดรายหลุม** (Team, Match-style, High-Low): คูณ point ของหลุมนั้น
- **โหมดสกอร์รวม** (Stroke, Match stroke-style): ส่วนต่าง stroke ของหลุม turbo นับ ×2 ตอนรวม (ดู §6, §7)

point รวมต่อเกมหนึ่งคู่ในหลุมหนึ่ง:
```
pts = BASE(1) * bonusMult(winnerGross, par) * turboMult(hole)
```

---

## 4. Mode: Team (Best N)

### 4.1 จัดอันดับในทีม (ต่อหลุม)
```
teamRanked(team, par, scores, holeIdx):
    list = []
    for p in team.players:
        s = scores[p.id][holeIdx]
        n = net(s, p, par)
        if n != ⊘:
            list.push({ player: p, net: n, gross: s })
    sort list by net ascending   // tie-break: ดู §9
    return list   // [0] = Best1, [1] = Best2
```

### 4.2 เทียบหนึ่งเกม (best rank ระหว่าง 2 ทีม)
```
compareNet(aNet, bNet):
    if aNet == ⊘ or bNet == ⊘: return ⊘
    if aNet < bNet: return +1     // A ชนะ
    if aNet > bNet: return -1     // B ชนะ
    return 0                      // เสมอ
```

### 4.3 คำนวณทั้งรอบ
```
computeTeam(teams, holes, scores):
    totals[t] = 0 ; matrix[from][to] = 0
    for hole, hIdx in holes:
        mult = turboMult(hole)
        ranked[t] = teamRanked(t, hole.par, scores, hIdx) for each team
        for each pair (A, B) where i < j:        // round-robin
            for rank in [0, 1]:                  // Best1, Best2
                a = ranked[A][rank] ; b = ranked[B][rank]
                r = compareNet(a?.net, b?.net)
                if r == ⊘ or r == 0: continue
                winnerGross = (r==+1) ? a.gross : b.gross
                pts = 1 * bonusMult(winnerGross, hole.par) * mult
                if r == +1:
                    matrix[B][A] += pts ; totals[A] += pts ; totals[B] -= pts
                else:
                    matrix[A][B] += pts ; totals[B] += pts ; totals[A] -= pts
    return { totals, matrix, holeLog }
```

> `matrix[from][to]` = point ที่ `from` จ่ายให้ `to`
> `totals[t]` = ยอดสุทธิ (รับ − จ่าย)

### 4.4 ตัวอย่างเลขจริง
2 ทีม, หลุม par 4, Turbo ปิด
- Team A: Som ตี 3 (hcp0 → net 3), Lek ตี 5 (net 5)
- Team B: Joe ตี 4 (net 4), Kan ตี 5 (net 5)
- Best1: A net 3 vs B net 4 → A ชนะ, winnerGross=3 → Birdie ×2 → pts 2 → **B จ่าย A 2**
- Best2: A net 5 vs B net 5 → เสมอ → 0
- ผล: totals A=+2, B=−2 ; matrix[B][A]=2

---

## 5. Mode: Match Play (1-vs-1)

จับคู่เอง 2 คน เลือก sub-method ตอนสร้าง bet

### 5.1 Match-style (นับหลุม, เล่นครบทุกหลุม)
```
computeMatchHoles(pA, pB, holes, scores, config):
    up = 0          // + = A นำ, - = B นำ (หน่วย: หลุม หรือ point)
    for hole, hIdx in holes:
        nA = net(scores[pA][hIdx], pA, hole.par)
        nB = net(scores[pB][hIdx], pB, hole.par)
        r = compareNet(nA, nB)
        if r == ⊘ or r == 0: continue        // เสมอ/ขาดข้อมูล = halved
        winnerGross = (r==+1) ? scores[pA][hIdx] : scores[pB][hIdx]
        holePts = 1
        if config.bonus: holePts *= bonusMult(winnerGross, hole.par)
        holePts *= turboMult(hole)
        up += (r==+1) ? holePts : -holePts
    // margin สุดท้าย
    if up > 0: B จ่าย A = up
    if up < 0: A จ่าย B = -up
    if up == 0: AS ไม่มีใครจ่าย
```

- **default config.bonus = false** (match-style เป็นเกมหลุมล้วน) — เปิดได้
- ไม่ปิดเกมก่อนจบ (เล่นครบ เอา margin)

**ตัวอย่าง (bonus ปิด, turbo ปิด, 9 หลุม):**
A ชนะ 4 หลุม, B ชนะ 2 หลุม, เสมอ 3 → up = +2 → **B จ่าย A 2**

### 5.2 Stroke-style (สกอร์รวม)
```
computeMatchStroke(pA, pB, holes, scores, config):
    basis = config.basis   // "net" | "gross", default "net"
    totA = sum over holes of value(pA, hole) * weight(hole)
    totB = sum over holes of value(pB, hole) * weight(hole)
    // value = net หรือ gross ; weight = turboMult(hole) (turbo นับสองเท่าส่วนต่าง — ดูหมายเหตุ)
    diff = totB - totA
    if diff > 0: B จ่าย A = diff * config.pointPerStroke
    if diff < 0: A จ่าย B = -diff * config.pointPerStroke
```

> **Turbo ในโหมดสกอร์รวม:** ให้คิดที่ "ส่วนต่างต่อหลุม" ไม่ใช่สกอร์ดิบ เพื่อไม่ให้ยอดเพี้ยน:
> `diff = Σ (valueB_hole − valueA_hole) * turboMult(hole)`
> หลุม turbo จึงทำให้ส่วนต่าง "ของหลุมนั้น" คูณสอง — ใช้สูตรนี้เป็น canonical

**ตัวอย่าง (net, pointPerStroke=1, ไม่มี turbo):**
A net รวม 70, B net รวม 74 → diff 4 → **B จ่าย A 4**

---

## 6. Mode: Stroke Play (เดี่ยว, round-robin)

แสดง 2 leaderboard (net, gross) — settlement คิดบนฐานที่เลือก (default net)

```
computeStroke(players, holes, scores, config):
    basis = config.basis        // "net" | "gross"
    total[p] = Σ over holes of value(p, hole) * turboMult(hole)
               where value = net(...) หรือ gross
    // round-robin ทุกคู่
    for each pair (A, B):
        d = total[B] - total[A]
        if d > 0: matrix[B][A] += d * config.pointPerStroke ; totals[A]+=...; totals[B]-=...
        if d < 0: matrix[A][B] += -d * config.pointPerStroke ; ...
        if d == 0: continue
```

> turbo: ใช้หลัก "ส่วนต่างต่อหลุม ×2" เหมือน §5.2 ถ้าเปิด config.turbo
> ถ้าต้องการ leaderboard ทั้ง net และ gross พร้อมกัน → คำนวณสองรอบด้วย basis ต่างกัน (settlement ใช้ basis เดียวตาม config)

### 6.1 ตัวอย่างเลขจริง (net, pointPerStroke=1)
3 คน net รวม: A=72, B=75, C=78
- A-B: d=3 → B จ่าย A 3
- A-C: d=6 → C จ่าย A 6
- B-C: d=3 → C จ่าย B 3
- totals: A=+9, B=0, C=−9

---

## 7. Mode: บ๊วยจ่ายหัว (High-Low รายหลุม)

หลายคนไม่จับทีม คิดรายหลุม ฐาน **net** (default)

```
computeHighLow(players, holes, scores, config):
    basis = config.basis        // "net" | "gross", default "net"
    totals[p] = 0 ; matrix[from][to] = 0
    for hole, hIdx in holes:
        vals = []
        for p in players:
            s = scores[p.id][hIdx]
            v = (basis=="net") ? net(s, p, hole.par) : s
            if v != ⊘: vals.push({ p, v, gross: s })
        if vals.length < 2: continue
        best  = min v in vals
        worst = max v in vals
        if best == worst: continue          // ทุกคนเสมอ → ไม่จ่าย
        heads = vals where v == best        // หัว (อาจหลายคน)
        tails = vals where v == worst        // บ๊วย (อาจหลายคน)
        mult = turboMult(hole)
        for tail in tails:
            for head in heads:
                pts = 1 * (config.bonus ? bonusMult(head.gross, hole.par) : 1) * mult
                matrix[tail.p][head.p] += pts
                totals[head.p] += pts ; totals[tail.p] -= pts
    return { totals, matrix, holeLog }
```

> ทุกบ๊วยจ่ายทุกหัว **คนละ 1 point** (× bonus/turbo ถ้าเปิด) — คนกลางไม่เกี่ยว
> bonus คิดจาก gross ของ "หัว" (ผู้ชนะ)

### 7.1 ตัวอย่างเลขจริง (net, bonus/turbo ปิด)
5 คน หลุมหนึ่ง net: P1=3, P2=4, P3=4, P4=5, P5=5
- best=3 (heads: P1), worst=5 (tails: P4, P5)
- P4 จ่าย P1 1, P5 จ่าย P1 1
- ผลหลุมนี้: P1=+2, P4=−1, P5=−1, P2=P3=0

### 7.2 ตัวอย่างหัวเสมอ
net: P1=3, P2=3, P3=5 → heads {P1,P2}, tails {P3}
- P3 จ่าย P1 1 + จ่าย P2 1 → P3=−2, P1=+1, P2=+1

---

## 8. การรวมหลายเดิมพัน (bet layers)

หนึ่งรอบมีหลาย bet — แต่ละ bet คำนวณ totals/matrix ของตัวเองแยกกัน แล้วรวม:

```
roundTotals[p] = Σ over bets of betTotals[bet][p]
roundMatrix[from][to] = Σ over bets of betMatrix[bet][from][to]
```

> หน่วยเป็น point เดียวกันทั้งหมด → บวกตรงๆ ได้
> **scope ของผลลัพธ์คงตามโหมด:** Team mode สรุปเป็น point **ระดับทีม** (totals[team], matrix[team][team]) ไม่ต้อง map ลงผู้เล่นรายคน — เพราะ point ไม่ผูกเงิน โหมดอื่น (Match, Stroke, High-Low) สรุป **ระดับผู้เล่น**
> หน้าแสดงผลรวมจึงมี 2 ส่วน: ตารางทีม (จาก Team bets) + ตารางผู้เล่น (จาก bets อื่น) ไม่ปนกัน

---

## 9. Edge cases & rules ตัดสิน

| กรณี | การจัดการ |
|---|---|
| สกอร์ยังไม่กรอก (null) | net = ⊘ เกม/คู่นั้นไม่นับ (ไม่ใช่ 0) |
| net เสมอในคู่เทียบ | r = 0 ไม่มีใครจ่าย |
| ทีมมีคนเดียว | ไม่มี Best2 → เกม Best2 ที่เกี่ยวข้องข้าม |
| High-Low ทุกคนเสมอ | best == worst → ข้ามหลุม |
| handicap ทศนิยม | ไม่ปัด เทียบ float ตรงๆ |
| tie-break การจัดอันดับใน Best N | net เท่ากัน → ลำดับคงที่ (stable sort ตามลำดับผู้เล่นใน input) เพื่อ deterministic |
| Albatross+ (diff ≥ 3) | ×5 (เพดานเดียว ไม่เพิ่มตาม diff) |

---

## 10. Invariants (ต้องจริงเสมอ — ใช้เป็น property test)

1. **Zero-sum:** `Σ totals[*] == 0` ในทุก bet (รับเท่ากับจ่ายเสมอ)
2. **Matrix↔totals:** `totals[p] == Σ matrix[*][p] − Σ matrix[p][*]`
3. **Determinism:** input เดิม → output เดิม (ไม่มี random, ไม่พึ่ง iteration order ที่ไม่ stable)
4. **Null safety:** ผู้เล่นที่ยังไม่กรอกสกอร์ไม่ทำให้ผลของผู้อื่นเปลี่ยน
5. **Non-negative pts:** point ที่จ่ายในแต่ละเกม ≥ 0 เสมอ

> ทั้ง 10 ข้อนี้ + ตัวอย่างเลขจริงในแต่ละ §  → ย้ายเป็น golden test ใน `07_TEST_CASES.md`
