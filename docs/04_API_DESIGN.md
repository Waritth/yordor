# 04 — API Design (tRPC)

**Project:** YorDor
**Version:** 0.1 (draft)
**Last updated:** 2026-06-20
**Stack:** tRPC v11 + Prisma + Next.js (App Router) + Postgres (Railway)

> **Realtime requirement:** หลายคนกรอกสกอร์พร้อมกันจากหลาย device → ซิงก์อัตโนมัติ
> วิธี v1: **optimistic update ฝั่ง client + live subscription (SSE)** พร้อม **polling fallback**
> **Auth:** guest — เข้าถึงรอบผ่าน `accessToken` (อยู่ใน URL) ไม่มี login

---

## 1. หลักการ

1. **Read = query, Write = mutation, Live = subscription** ตาม convention tRPC
2. **accessToken เป็น authz** — ทุก procedure ที่แตะรอบรับ `token` แล้ว resolve เป็น `roundId` (middleware)
3. **Score write เป็น cell-level upsert** — แต่ละ (player, hole) อิสระ → last-write-wins ปลอดภัย ไม่ต้อง lock
4. **Engine คำนวณบน server** เป็น source of truth (client คำนวณ preview ได้ด้วย pure function เดียวกันใน shared package)
5. **Mutation ทุกตัว bump `Round.updatedAt`** ใช้เป็นสัญญาณ invalidate ของ subscription/poll

---

## 2. Context & Middleware

```ts
// server/trpc.ts
type Ctx = { db: PrismaClient };

const roundProcedure = publicProcedure
  .input(z.object({ token: z.string() }).passthrough())
  .use(async ({ ctx, input, next }) => {
    const round = await ctx.db.round.findUnique({ where: { accessToken: input.token } });
    if (!round) throw new TRPCError({ code: "NOT_FOUND" });
    return next({ ctx: { ...ctx, round } });
  });
```

> ไม่มี user session — `accessToken` คือ capability เดียวที่ใช้เข้าถึง/แก้รอบ
> ใครมีลิงก์ = แก้ได้ (เหมาะกับ guest collaborative) v1 ยอมรับ trade-off นี้

---

## 3. Router Map (สรุป)

| Router | Procedure | Type | หน้าที่ |
|---|---|---|---|
| **round** | `create` | mutation | สร้างรอบใหม่ + holes default → คืน `{ id, accessToken }` |
| | `get` | query | รอบเต็ม (holes, players, scores, bets) + ผลคำนวณ |
| | `live` | subscription | push เมื่อรอบเปลี่ยน (SSE) |
| | `updateMeta` | mutation | name, holeCount |
| | `setStatus` | mutation | SETUP → PLAYING → FINISHED |
| | `delete` | mutation | ลบรอบ (cascade) |
| **hole** | `setPar` | mutation | par ของหลุม |
| | `setTurbo` | mutation | turboOn / turboAllowed |
| **player** | `add` / `remove` | mutation | จัดการผู้เล่นในรอบ |
| | `rename` / `setColor` | mutation | แก้ข้อมูล |
| | `setHandicap` | mutation | hcpPar3/4/5 |
| **score** | `set` | mutation | upsert 1 cell (player, hole) |
| | `setMany` | mutation | batch (กรอกทั้งหลุม/หลายช่อง) |
| **bet** | `create` | mutation | สร้างเดิมพัน (mode + config) |
| | `update` | mutation | แก้ config / name |
| | `setParticipants` | mutation | จัดทีม/จับคู่/เลือกผู้เล่น |
| | `remove` | mutation | ลบเดิมพัน |
| **result** | `get` | query | totals/matrix/holeLog ต่อ bet + รวมรอบ (คำนวณสด) |

---

## 4. Input/Output ที่สำคัญ (Zod)

```ts
// round.create
input:  z.object({ name: z.string().default(""), holeCount: z.union([z.literal(9), z.literal(18)]).default(18) })
output: z.object({ id: z.string(), accessToken: z.string() })

// round.get
input:  z.object({ token: z.string() })
output: RoundFull  // round + holes[] + players[] + scores[] + bets[] + results

// score.set  (cell-level, idempotent)
input:  z.object({
          token: z.string(),
          playerId: z.string(),
          holeId: z.string(),
          strokes: z.number().int().min(1).max(20).nullable(),  // null = ลบ cell
        })
output: z.object({ ok: z.literal(true), updatedAt: z.date() })

// score.setMany
input:  z.object({
          token: z.string(),
          cells: z.array(z.object({ playerId: z.string(), holeId: z.string(), strokes: z.number().int().nullable() })),
        })

// player.setHandicap
input:  z.object({ token: z.string(), playerId: z.string(),
          hcpPar3: z.number(), hcpPar4: z.number(), hcpPar5: z.number() })

// bet.create
input:  z.object({
          token: z.string(),
          mode: z.enum(["TEAM","MATCH","STROKE","HIGHLOW"]),
          name: z.string().default(""),
          config: z.record(z.any()),         // validate ต่อ mode ใน resolver (ดู §5)
        })

// bet.setParticipants
input:  z.object({
          token: z.string(),
          betId: z.string(),
          teams: z.array(z.object({ id: z.string().optional(), name: z.string(), color: z.string(),
                    playerIds: z.array(z.string()) })).optional(),   // TEAM
          pairs: z.object({ aPlayerId: z.string(), bPlayerId: z.string() }).optional(), // MATCH
          playerIds: z.array(z.string()).optional(),  // STROKE / HIGHLOW
        })
```

---

## 5. Config validation ต่อโหมด

`bet.create` / `bet.update` ต้อง validate `config` ตาม `mode` ด้วย discriminated schema (สอดคล้อง `03` §4):

```ts
const teamConfig    = z.object({ bestN: z.literal(2), bonus: z.boolean().default(true), useTurbo: z.boolean().default(true) });
const matchConfig   = z.object({ method: z.enum(["holes","stroke"]), basis: z.enum(["net","gross"]).default("net"),
                                 bonus: z.boolean().default(false), pointPerStroke: z.number().default(1), useTurbo: z.boolean().default(true) });
const strokeConfig  = z.object({ basis: z.enum(["net","gross"]).default("net"), pointPerStroke: z.number().default(1), useTurbo: z.boolean().default(true) });
const highlowConfig = z.object({ basis: z.enum(["net","gross"]).default("net"), bonus: z.boolean().default(false),
                                 pointPerHead: z.number().default(1), useTurbo: z.boolean().default(true) });

function parseConfig(mode, config) {
  switch (mode) {
    case "TEAM":    return teamConfig.parse(config);
    case "MATCH":   return matchConfig.parse(config);
    case "STROKE":  return strokeConfig.parse(config);
    case "HIGHLOW": return highlowConfig.parse(config);
  }
}
```

---

## 6. Realtime sync (หลาย device)

### กลไก
1. ทุก mutation ที่แก้ source data → `db.round.update({ updatedAt: now })`
2. **subscription `round.live`** (tRPC v11 over SSE) push event `{ updatedAt }` เมื่อรอบเปลี่ยน
3. client ได้ event → `utils.round.get.invalidate()` → refetch
4. **fallback:** ถ้า SSE ไม่ติด ใช้ React Query `refetchInterval: 4000` (poll ทุก 4 วิ)

```ts
// server
live: roundProcedure.subscription(({ ctx }) =>
  observable<{ updatedAt: Date }>((emit) => {
    const unsub = roundEvents.on(ctx.round.id, (u) => emit.next(u));
    return unsub;
  })
);
```

> v1 ใช้ in-memory event emitter (single instance บน Railway ก็พอ)
> ถ้า scale หลาย instance → เปลี่ยน backend เป็น Postgres `LISTEN/NOTIFY` หรือ Redis pub/sub (roadmap)

### Optimistic update (client)
- `score.set` → อัปเดต cache ทันที (optimistic) แล้วค่อย confirm
- conflict: cell-level last-write-wins → ถ้าสองคนแก้ช่องเดียวกัน คนหลังชนะ (ยอมรับได้ ช่องเดียวกันคนเดียวกรอกอยู่แล้วตามจริง)

---

## 7. ตัวอย่าง flow (ฝั่ง client)

```ts
// สร้างรอบ → ได้ลิงก์แชร์
const { accessToken } = await trpc.round.create.mutate({ holeCount: 18 });
// → /round/{accessToken}

// subscribe ความเปลี่ยนแปลง
trpc.round.live.useSubscription({ token }, { onData: () => utils.round.get.invalidate() });

// กรอกสกอร์ (optimistic)
trpc.score.set.mutate({ token, playerId, holeId, strokes: 4 });

// ผลคำนวณสด
const { data } = trpc.result.get.useQuery({ token });
```

---

## 8. Error handling

| สถานการณ์ | code | หมายเหตุ |
|---|---|---|
| token ไม่พบ | `NOT_FOUND` | รอบถูกลบ/ลิงก์ผิด |
| config ผิด schema | `BAD_REQUEST` | zod error ต่อ mode |
| strokes นอกช่วง (1–20) | `BAD_REQUEST` | กัน fat-finger |
| แก้รอบที่ FINISHED | `FORBIDDEN` | ล็อกหลังจบ (ปลดได้ผ่าน setStatus) |

---

## 9. Shared engine package

```
packages/
  engine/          // pure functions จาก 02_SCORING_LOGIC_SPEC (ไม่พึ่ง React/Prisma)
    net.ts  team.ts  match.ts  stroke.ts  highlow.ts  aggregate.ts
    index.ts        // computeBet(bet, round) → { totals, matrix, holeLog }
```

- ใช้ทั้ง **server** (`result.get`) และ **client** (preview ระหว่างกรอก)
- เป็นที่อยู่ของ golden test (`07_TEST_CASES.md`) → import ตรงเข้า test runner
- รับ input เป็น plain object (mapped จาก Prisma) → test ได้โดยไม่แตะ DB

---

## 10. สรุปการตัดสิน (locked)

1. **Authz = accessToken ในลิงก์** ไม่มี login (v1)
2. **Realtime = SSE subscription + polling fallback**, event ผ่าน in-memory emitter
3. **Score = cell-level upsert, last-write-wins**
4. **Engine = shared pure package** ใช้ร่วม client/server/test
5. **Config validate ต่อ mode** ด้วย discriminated zod schema
