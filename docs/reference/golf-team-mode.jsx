import React, { useState, useMemo } from "react";

/* ============================================================
   GOLF SCORE — TEAM MODE (Best 1 / Best 2, round-robin)
   ------------------------------------------------------------
   Architecture note: ออกแบบให้ขยายเป็น multi-mode ได้
   - core logic แยกออกจาก UI (ดู section LOGIC)
   - mode แรกนี้เก็บ state ใน hooks ทั้งหมด ยังไม่ต่อ backend
   - ตอนทำ save game / multi-mode ค่อย map state นี้เข้า Prisma
   ============================================================ */

/* ---------- CONSTANTS ---------- */
const PARS = [3, 4, 5];
const COLORS = ["#1B5E20", "#C62828", "#1565C0", "#F9A825", "#6A1B9A", "#00838F"];

/* ---------- LOGIC (pure, testable) ---------- */

// net score ต่อคนในหลุมหนึ่ง = strokes + handicap[par]
// "ต่อ" = ได้แต้มต่อ -> บวกกลับเข้า net (คนต่อเยอะตีแย่กว่าได้แต่ยังเสมอ)
function netScore(strokes, handicapByPar, par) {
  if (strokes == null || strokes === "") return null;
  const hcp = handicapByPar?.[par] ?? 0;
  return Number(strokes) + hcp;
}

// จัดอันดับ player ในทีมตาม net (น้อย=ดี). คืน net + gross ของแต่ละคน
function teamRanked(team, holePar, scores, holeIdx) {
  const nets = team.players
    .map((p) => {
      const s = scores?.[p.id]?.[holeIdx];
      const net = netScore(s, p.handicap, holePar);
      const gross = s == null || s === "" ? null : Number(s);
      return { player: p, net, gross };
    })
    .filter((x) => x.net != null)
    .sort((a, b) => a.net - b.net);
  return nets; // index 0 = best1, index 1 = best2
}

// ตัวคูณจาก gross เทียบ par: birdie(par-1)=x2, eagle ขึ้นไป(<=par-2)=x3
function grossMultiplier(gross, par) {
  if (gross == null) return 1;
  const diff = par - gross;
  if (diff >= 2) return 3; // eagle หรือดีกว่า
  if (diff === 1) return 2; // birdie
  return 1;
}
function grossLabel(gross, par) {
  if (gross == null) return null;
  const diff = par - gross;
  if (diff >= 3) return "Albatross";
  if (diff === 2) return "Eagle";
  if (diff === 1) return "Birdie";
  return null;
}

// เทียบ 1 เกม (best N) ระหว่างสองทีม -> 1 / 0 / -1 (perspective ทีม A)
function compareNet(aNet, bNet) {
  if (aNet == null || bNet == null) return null; // ขาดข้อมูล ไม่นับ
  if (aNet < bNet) return 1;
  if (aNet > bNet) return -1;
  return 0;
}

// คำนวณ point ของทุกหลุม -> { matrix[teamId][teamId] = points, totals[teamId] = net point }
function computeResults(teams, holes, scores) {
  const matrix = {}; // matrix[from][to] = แต้มที่ from จ่ายให้ to
  const totals = {};
  teams.forEach((t) => {
    totals[t.id] = 0;
    matrix[t.id] = {};
    teams.forEach((o) => (matrix[t.id][o.id] = 0));
  });

  const holeLog = [];

  holes.forEach((hole, hIdx) => {
    const mult = hole.turbo ? 2 : 1;
    // pre-compute ranked nets per team for this hole
    const ranked = {};
    teams.forEach((t) => (ranked[t.id] = teamRanked(t, hole.par, scores, hIdx)));

    const holeDetail = { hole: hIdx + 1, par: hole.par, turbo: hole.turbo, games: [] };

    // round-robin ทุกคู่ทีม
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const A = teams[i], B = teams[j];
        [0, 1].forEach((rank) => {
          const aEntry = ranked[A.id]?.[rank] ?? null;
          const bEntry = ranked[B.id]?.[rank] ?? null;
          const aNet = aEntry?.net ?? null;
          const bNet = bEntry?.net ?? null;
          const aName = aEntry?.player?.name ?? null;
          const bName = bEntry?.player?.name ?? null;
          const aGross = aEntry?.gross ?? null;
          const bGross = bEntry?.gross ?? null;
          const r = compareNet(aNet, bNet);
          if (r == null || r === 0) {
            holeDetail.games.push({
              best: rank + 1, a: A.id, b: B.id, aNet, bNet, aName, bName, aGross, bGross,
              winner: null, pts: 0, tie: r === 0, bonus: 1, bonusLabel: null,
            });
            return;
          }
          // ตัวคูณ birdie/eagle จาก gross ของผู้ชนะ
          const winGross = r === 1 ? aGross : bGross;
          const bonus = grossMultiplier(winGross, hole.par);
          const bonusLabel = grossLabel(winGross, hole.par);
          const pts = 1 * mult * bonus;
          if (r === 1) { matrix[B.id][A.id] += pts; totals[A.id] += pts; totals[B.id] -= pts; }
          else { matrix[A.id][B.id] += pts; totals[B.id] += pts; totals[A.id] -= pts; }
          holeDetail.games.push({
            best: rank + 1, a: A.id, b: B.id, aNet, bNet, aName, bName, aGross, bGross,
            winner: r === 1 ? A.id : B.id, pts, tie: false, bonus, bonusLabel,
          });
        });
      }
    }
    holeLog.push(holeDetail);
  });

  return { matrix, totals, holeLog };
}

/* ---------- DEFAULT STATE BUILDERS ---------- */
function makeHoles(count) {
  return Array.from({ length: count }, (_, i) => ({
    par: 4,
    turbo: false,
    turboAllowed: i === 8 || i === 17, // หลุม 9 และ 18
  }));
}
function emptyHandicap() {
  return { 3: 0, 4: 0, 5: 0 };
}
let _pid = 1;
function makePlayer(name = "") {
  return { id: `p${_pid++}`, name, handicap: emptyHandicap() };
}

/* ============================================================
   UI
   ============================================================ */
export default function GolfTeamMode() {
  const [stage, setStage] = useState("setup"); // setup | hcp | play | result
  const [holeCount, setHoleCount] = useState(18);
  const [teams, setTeams] = useState(() => [
    { id: "t1", name: "Team A", players: [makePlayer(""), makePlayer("")] },
    { id: "t2", name: "Team B", players: [makePlayer(""), makePlayer("")] },
  ]);
  const [holes, setHoles] = useState(() => makeHoles(18));
  const [scores, setScores] = useState({}); // scores[playerId][holeIdx] = strokes
  const [curHole, setCurHole] = useState(0);

  const allPlayers = useMemo(() => teams.flatMap((t) => t.players), [teams]);

  /* ----- setup handlers ----- */
  const setHoleCnt = (n) => {
    setHoleCount(n);
    setHoles(makeHoles(n));
  };
  const addTeam = () => {
    if (teams.length >= 6) return;
    const idx = teams.length;
    setTeams([...teams, {
      id: `t${idx + 1}`,
      name: `Team ${String.fromCharCode(65 + idx)}`,
      players: [makePlayer(""), makePlayer("")],
    }]);
  };
  const removeTeam = (tid) =>
    teams.length > 2 && setTeams(teams.filter((t) => t.id !== tid));
  const setTeamName = (tid, name) =>
    setTeams(teams.map((t) => (t.id === tid ? { ...t, name } : t)));
  const setTeamSize = (tid, size) =>
    setTeams(teams.map((t) => {
      if (t.id !== tid) return t;
      const players = [...t.players];
      while (players.length < size) players.push(makePlayer(""));
      while (players.length > size) players.pop();
      return { ...t, players };
    }));
  const setPlayerName = (tid, pid, name) =>
    setTeams(teams.map((t) =>
      t.id !== tid ? t : {
        ...t,
        players: t.players.map((p) => (p.id === pid ? { ...p, name } : p)),
      }));
  const setHcp = (pid, par, val) =>
    setTeams(teams.map((t) => ({
      ...t,
      players: t.players.map((p) =>
        p.id === pid ? { ...p, handicap: { ...p.handicap, [par]: val === "" ? 0 : Number(val) } } : p),
    })));

  const setPar = (hIdx, par) =>
    setHoles(holes.map((h, i) => (i === hIdx ? { ...h, par } : h)));
  const toggleTurbo = (hIdx) =>
    setHoles(holes.map((h, i) => (i === hIdx && h.turboAllowed ? { ...h, turbo: !h.turbo } : h)));
  const setScore = (pid, hIdx, val) =>
    setScores((s) => ({
      ...s,
      [pid]: { ...(s[pid] || {}), [hIdx]: val === "" ? "" : Number(val) },
    }));

  const results = useMemo(
    () => computeResults(teams, holes, scores),
    [teams, holes, scores]
  );

  const teamColor = (tid) => COLORS[teams.findIndex((t) => t.id === tid) % COLORS.length];
  const validSetup = teams.every((t) => t.players.every((p) => p.name.trim()));

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div style={S.app}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div style={S.logo}>
          <span style={S.logoMark}>⛳</span>
          <div>
            <div style={S.logoTitle}>นับแต้มกอล์ฟ</div>
            <div style={S.logoSub}>TEAM MODE · Best 1 / Best 2</div>
          </div>
        </div>
        <Stepper stage={stage} />
      </header>

      <main style={S.main}>
        {/* ---------------- SETUP ---------------- */}
        {stage === "setup" && (
          <div style={S.card}>
            <SectionTitle n="01" title="ตั้งค่าเกม" sub="จำนวนหลุม · ทีม · ผู้เล่น" />

            <div style={S.row}>
              <label style={S.lbl}>จำนวนหลุม</label>
              <div style={S.segGroup}>
                {[9, 18].map((n) => (
                  <button key={n}
                    className={`seg ${holeCount === n ? "on" : ""}`}
                    onClick={() => setHoleCnt(n)}>{n} หลุม</button>
                ))}
              </div>
            </div>

            <div style={S.teamGrid}>
              {teams.map((t, i) => (
                <div key={t.id} style={{ ...S.teamCard, borderColor: teamColor(t.id) }}>
                  <div style={S.teamHead}>
                    <span style={{ ...S.dot, background: teamColor(t.id) }} />
                    <input style={S.teamInput} value={t.name}
                      onChange={(e) => setTeamName(t.id, e.target.value)} />
                    {teams.length > 2 && (
                      <button style={S.xBtn} onClick={() => removeTeam(t.id)}>×</button>
                    )}
                  </div>
                  <div style={S.sizeRow}>
                    <span style={S.sizeLbl}>ผู้เล่น</span>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n}
                        className={`sizePill ${t.players.length === n ? "on" : ""}`}
                        onClick={() => setTeamSize(t.id, n)}>{n}</button>
                    ))}
                  </div>
                  {t.players.map((p, pi) => (
                    <input key={p.id} style={S.pInput}
                      placeholder={`ชื่อผู้เล่น ${pi + 1}`}
                      value={p.name}
                      onChange={(e) => setPlayerName(t.id, p.id, e.target.value)} />
                  ))}
                </div>
              ))}
              {teams.length < 6 && (
                <button style={S.addTeam} onClick={addTeam}>+ เพิ่มทีม</button>
              )}
            </div>

            <div style={S.footRow}>
              <button style={S.primary} disabled={!validSetup}
                onClick={() => setStage("hcp")}>
                ตั้งค่าแต้มต่อ →
              </button>
              {!validSetup && <span style={S.hint}>กรอกชื่อผู้เล่นให้ครบก่อน</span>}
            </div>
          </div>
        )}

        {/* ---------------- HANDICAP ---------------- */}
        {stage === "hcp" && (
          <div style={S.card}>
            <SectionTitle n="02" title="แต้มต่อ (Handicap)"
              sub="แต้มต่อสัมบูรณ์ต่อคน · net = สกอร์จริง + แต้มต่อ ตาม par" />

            <div style={S.hcpNote}>
              ระบุว่าแต่ละคน <b>ต่อ</b> เท่าไหร่ในแต่ละ par (ใส่ทศนิยมได้ เช่น 0.5)
            </div>

            <div style={S.hcpTableWrap}>
              <table style={S.hcpTable}>
                <thead>
                  <tr>
                    <th style={S.thL}>ผู้เล่น</th>
                    {PARS.map((par) => (
                      <th key={par} style={S.th}>Par {par}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr>
                        <td colSpan={4} style={{ ...S.teamSep, color: teamColor(t.id) }}>
                          ● {t.name}
                        </td>
                      </tr>
                      {t.players.map((p) => (
                        <tr key={p.id}>
                          <td style={S.tdName}>{p.name}</td>
                          {PARS.map((par) => (
                            <td key={par} style={S.td}>
                              <input type="number" step="0.5" style={S.hcpInput}
                                value={p.handicap[par] === 0 ? "" : p.handicap[par]}
                                placeholder="0"
                                onChange={(e) => setHcp(p.id, par, e.target.value)} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={S.footRow}>
              <button style={S.ghost} onClick={() => setStage("setup")}>← กลับ</button>
              <button style={S.primary} onClick={() => { setCurHole(0); setStage("play"); }}>
                เริ่มเล่น →
              </button>
            </div>
          </div>
        )}

        {/* ---------------- PLAY ---------------- */}
        {stage === "play" && (
          <PlayView
            teams={teams} holes={holes} scores={scores} curHole={curHole}
            setCurHole={setCurHole} setScore={setScore} setPar={setPar}
            toggleTurbo={toggleTurbo} teamColor={teamColor} results={results}
            onFinish={() => setStage("result")} />
        )}

        {/* ---------------- RESULT ---------------- */}
        {stage === "result" && (
          <ResultView
            teams={teams} results={results} teamColor={teamColor}
            onBack={() => setStage("play")} />
        )}
      </main>
    </div>
  );
}

/* ---------- PLAY VIEW ---------- */
function PlayView({ teams, holes, scores, curHole, setCurHole, setScore, setPar, toggleTurbo, teamColor, results, onFinish }) {
  const hole = holes[curHole];
  const isLast = curHole === holes.length - 1;
  const liveTotals = results.totals;

  return (
    <div style={S.card}>
      <div style={S.playHead}>
        <button style={S.navBtn} disabled={curHole === 0}
          onClick={() => setCurHole(curHole - 1)}>‹</button>
        <div style={S.holeBadge}>
          <div style={S.holeNum}>หลุม {curHole + 1}</div>
          <div style={S.parRow}>
            {[3, 4, 5].map((p) => (
              <button key={p} className={`parPill ${hole.par === p ? "on" : ""}`}
                onClick={() => setPar(curHole, p)}>Par {p}</button>
            ))}
          </div>
          {hole.turboAllowed && (
            <button className={`turbo ${hole.turbo ? "on" : ""}`}
              onClick={() => toggleTurbo(curHole)}>
              ⚡ TURBO ×2 {hole.turbo ? "เปิด" : "ปิด"}
            </button>
          )}
        </div>
        <button style={S.navBtn} disabled={isLast}
          onClick={() => setCurHole(curHole + 1)}>›</button>
      </div>

      <div style={S.scoreList}>
        {teams.map((t) => (
          <div key={t.id} style={{ ...S.scoreTeam, borderColor: teamColor(t.id) }}>
            <div style={{ ...S.scoreTeamName, color: teamColor(t.id) }}>{t.name}</div>
            {t.players.map((p) => {
              const s = scores?.[p.id]?.[curHole];
              const hcp = p.handicap[hole.par] || 0;
              const net = s !== "" && s != null ? Number(s) + hcp : null;
              return (
                <div key={p.id} style={S.scoreRow}>
                  <span style={S.scoreName}>{p.name}</span>
                  <input type="number" inputMode="numeric" style={S.scoreInput}
                    value={s ?? ""} placeholder="–"
                    onChange={(e) => setScore(p.id, curHole, e.target.value)} />
                  <span style={S.netTag}>
                    {hcp ? `+${hcp}` : ""} {net != null && <b>net {net}</b>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={S.liveBar}>
        {teams.map((t) => (
          <div key={t.id} style={S.liveItem}>
            <span style={{ ...S.dotSm, background: teamColor(t.id) }} />
            <span style={S.liveName}>{t.name}</span>
            <span style={{ ...S.liveVal, color: liveTotals[t.id] >= 0 ? "#1B5E20" : "#C62828" }}>
              {liveTotals[t.id] > 0 ? "+" : ""}{liveTotals[t.id]}
            </span>
          </div>
        ))}
      </div>

      <div style={S.bdSection}>
        <div style={S.bdSectionTitle}>วิธีคิดหลุมนี้</div>
        <div style={S.bonusRule}>Birdie ×2 · Eagle ×3 (ดูจากลูกที่ตีจริงของผู้ชนะ) · คูณซ้อนกับ Turbo</div>
        <HoleBreakdown detail={results.holeLog[curHole]} teams={teams}
          teamColor={teamColor} compact />
      </div>

      <div style={S.footRow}>
        {isLast
          ? <button style={S.primary} onClick={onFinish}>ดูผลรวม →</button>
          : <button style={S.primary} onClick={() => setCurHole(curHole + 1)}>หลุมถัดไป →</button>}
      </div>
    </div>
  );
}

/* ---------- RESULT VIEW ---------- */
function ResultView({ teams, results, teamColor, onBack }) {
  const { matrix, totals, holeLog } = results;
  const ranked = [...teams].sort((a, b) => totals[b.id] - totals[a.id]);
  const [openHole, setOpenHole] = useState(null);

  // แต้มรวมที่เกิดในแต่ละหลุม (ผลรวม pts ของทุกเกม) ใช้โชว์ข้างหัวข้อ
  const holePts = (d) => d.games.reduce((s, g) => s + g.pts, 0);

  return (
    <div style={S.card}>
      <SectionTitle n="03" title="ผลรวม" sub="แต้มสุทธิ + ใครจ่ายใครเท่าไหร่" />

      <div style={S.podium}>
        {ranked.map((t, i) => (
          <div key={t.id} style={{ ...S.podItem, borderColor: teamColor(t.id) }}>
            <div style={S.podRank}>#{i + 1}</div>
            <div style={{ ...S.podName, color: teamColor(t.id) }}>{t.name}</div>
            <div style={{ ...S.podVal, color: totals[t.id] >= 0 ? "#1B5E20" : "#C62828" }}>
              {totals[t.id] > 0 ? "+" : ""}{totals[t.id]}
            </div>
            <div style={S.podUnit}>point</div>
          </div>
        ))}
      </div>

      <div style={S.matTitle}>ตารางการจ่าย (แถว → คอลัมน์ = จ่ายให้)</div>
      <div style={S.matWrap}>
        <table style={S.matTable}>
          <thead>
            <tr>
              <th style={S.matCorner}></th>
              {teams.map((t) => (
                <th key={t.id} style={{ ...S.matTh, color: teamColor(t.id) }}>{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((from) => (
              <tr key={from.id}>
                <td style={{ ...S.matRowH, color: teamColor(from.id) }}>{from.name}</td>
                {teams.map((to) => (
                  <td key={to.id} style={S.matCell}>
                    {from.id === to.id ? <span style={S.matDash}>—</span>
                      : matrix[from.id][to.id] > 0
                        ? <span style={S.matPay}>{matrix[from.id][to.id]}</span>
                        : <span style={S.matZero}>0</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={S.matTitle} >วิธีคิดรายหลุม (แตะเพื่อกางดู)</div>
      <div style={S.holeListWrap}>
        {holeLog.map((d, i) => {
          const pts = holePts(d);
          const open = openHole === i;
          return (
            <div key={i} style={S.holeRow}>
              <button style={S.holeToggle} onClick={() => setOpenHole(open ? null : i)}>
                <span style={S.holeTogLeft}>
                  <span style={S.holeTogNum}>หลุม {d.hole}</span>
                  <span style={S.holeTogPar}>Par {d.par}</span>
                  {d.turbo && <span style={S.holeTogTurbo}>⚡×2</span>}
                </span>
                <span style={S.holeTogRight}>
                  <span style={S.holeTogPts}>{pts} pt</span>
                  <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</span>
                </span>
              </button>
              {open && (
                <HoleBreakdown detail={d} teams={teams} teamColor={teamColor} />
              )}
            </div>
          );
        })}
      </div>

      <div style={S.footRow}>
        <button style={S.ghost} onClick={onBack}>← แก้สกอร์</button>
      </div>
    </div>
  );
}

/* ---------- HOLE BREAKDOWN (ใช้ทั้งหน้าเล่นและหน้าผล) ---------- */
function HoleBreakdown({ detail, teams, teamColor, compact }) {
  const teamName = (id) => teams.find((t) => t.id === id)?.name ?? id;
  const best1 = detail.games.filter((g) => g.best === 1);
  const best2 = detail.games.filter((g) => g.best === 2);

  const renderGame = (g, idx) => {
    const aWin = g.winner === g.a;
    const bWin = g.winner === g.b;
    const fmt = (n) => (n == null ? "–" : n);
    const side = (name, sub, net, gross, win, color) => (
      <span style={{ ...S.bdSide, fontWeight: win ? 800 : 500, color: win ? color : "#6b7569" }}>
        {name}{sub ? ` (${sub})` : ""} <b>net {fmt(net)}</b>
        {gross != null && <span style={S.bdGross}> · ตี {gross}</span>}
      </span>
    );
    return (
      <div key={idx} style={S.bdGame}>
        {side(teamName(g.a), g.aName, g.aNet, g.aGross, aWin, teamColor(g.a))}
        <span style={S.bdVs}>
          {g.winner == null
            ? (g.tie ? "เสมอ" : "—")
            : aWin ? "ชนะ ›" : "‹ ชนะ"}
        </span>
        <span style={{ textAlign: "right" }}>
          {side(teamName(g.b), g.bName, g.bNet, g.bGross, bWin, teamColor(g.b))}
        </span>
        {g.pts > 0 && (
          <span style={S.bdPts}>
            {g.bonusLabel && <span style={S.bdBonus}>{g.bonusLabel} ×{g.bonus} </span>}
            {teamName(g.winner === g.a ? g.b : g.a)} จ่าย {g.pts}
          </span>
        )}
      </div>
    );
  };

  // รวม point ต่อทีมจากชุดเกม (best1 หรือ best2)
  const sumByTeam = (games) => {
    const acc = {};
    teams.forEach((t) => (acc[t.id] = 0));
    games.forEach((g) => {
      if (g.winner == null) return;
      const loser = g.winner === g.a ? g.b : g.a;
      acc[g.winner] += g.pts;
      acc[loser] -= g.pts;
    });
    return acc;
  };
  const renderSum = (games, label) => {
    const acc = sumByTeam(games);
    const active = teams.filter((t) => acc[t.id] !== 0);
    return (
      <div style={S.bdSum}>
        <span style={S.bdSumLabel}>รวม {label}</span>
        <span style={S.bdSumVals}>
          {active.length === 0
            ? <span style={S.bdSumZero}>ไม่มีการจ่าย</span>
            : active.map((t) => (
                <span key={t.id} style={S.bdSumItem}>
                  <span style={{ color: teamColor(t.id), fontWeight: 700 }}>{t.name}</span>
                  <b style={{ color: acc[t.id] > 0 ? "#1B5E20" : "#C62828" }}>
                    {acc[t.id] > 0 ? "+" : ""}{acc[t.id]}
                  </b>
                </span>
              ))}
        </span>
      </div>
    );
  };

  return (
    <div style={compact ? S.bdWrapCompact : S.bdWrap}>
      <div style={S.bdGroup}>
        <div style={S.bdLabel}>BEST 1 <span style={S.bdLabelSub}>· คนสกอต่ำสุดแต่ละทีม</span></div>
        {best1.length ? best1.map(renderGame) : <div style={S.bdEmpty}>ยังไม่มีข้อมูล</div>}
        {best1.length > 0 && renderSum(best1, "Best 1")}
      </div>
      <div style={S.bdGroup}>
        <div style={S.bdLabel}>BEST 2 <span style={S.bdLabelSub}>· คนสกอต่ำอันดับ 2</span></div>
        {best2.length ? best2.map(renderGame) : <div style={S.bdEmpty}>ไม่มีคู่เทียบ (ทีมมีคนไม่พอ)</div>}
        {best2.length > 0 && renderSum(best2, "Best 2")}
      </div>
      {detail.turbo && <div style={S.bdTurbo}>⚡ TURBO ×2 — point หลุมนี้คูณสอง</div>}
      {renderSum([...best1, ...best2], "หลุมนี้ทั้งหมด")}
    </div>
  );
}

/* ---------- SMALL COMPONENTS ---------- */
function SectionTitle({ n, title, sub }) {
  return (
    <div style={S.secTitle}>
      <span style={S.secNum}>{n}</span>
      <div>
        <div style={S.secMain}>{title}</div>
        <div style={S.secSub}>{sub}</div>
      </div>
    </div>
  );
}
function Stepper({ stage }) {
  const steps = [["setup", "ตั้งค่า"], ["hcp", "แต้มต่อ"], ["play", "เล่น"], ["result", "ผล"]];
  const idx = steps.findIndex((s) => s[0] === stage);
  return (
    <div style={S.stepper}>
      {steps.map((s, i) => (
        <div key={s[0]} style={S.stepItem}>
          <span style={{ ...S.stepDot, ...(i <= idx ? S.stepDotOn : {}) }}>{i + 1}</span>
          <span style={{ ...S.stepLbl, ...(i === idx ? S.stepLblOn : {}) }}>{s[1]}</span>
          {i < steps.length - 1 && <span style={S.stepLine} />}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
const green = "#1B5E20", gold = "#C9A227", paper = "#F7F5EF", ink = "#16241A";

const S = {
  app: { minHeight: "100vh", background: paper, color: ink,
    fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 40 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 16, padding: "18px 22px", background: green, color: "#fff" },
  logo: { display: "flex", alignItems: "center", gap: 12 },
  logoMark: { fontSize: 30 },
  logoTitle: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" },
  logoSub: { fontSize: 11, opacity: 0.8, letterSpacing: "0.14em", fontWeight: 600 },
  stepper: { display: "flex", alignItems: "center", gap: 4 },
  stepItem: { display: "flex", alignItems: "center", gap: 6 },
  stepDot: { width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center",
    fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.2)", color: "#fff" },
  stepDotOn: { background: gold, color: green },
  stepLbl: { fontSize: 11, opacity: 0.7, fontWeight: 600 },
  stepLblOn: { opacity: 1 },
  stepLine: { width: 14, height: 2, background: "rgba(255,255,255,0.25)", margin: "0 2px" },

  main: { maxWidth: 760, margin: "0 auto", padding: "22px 16px" },
  card: { background: "#fff", borderRadius: 18, padding: 22,
    boxShadow: "0 2px 20px rgba(20,36,26,0.07)", border: "1px solid #ece8dd" },

  secTitle: { display: "flex", gap: 12, alignItems: "center", marginBottom: 18 },
  secNum: { fontSize: 26, fontWeight: 800, color: gold, fontVariantNumeric: "tabular-nums" },
  secMain: { fontSize: 18, fontWeight: 800 },
  secSub: { fontSize: 12.5, color: "#6b7569" },

  row: { display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  lbl: { fontSize: 13, fontWeight: 700, color: "#3a4a3d" },
  segGroup: { display: "flex", gap: 8 },

  teamGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 },
  teamCard: { border: "2px solid", borderRadius: 14, padding: 14, background: "#fcfbf7" },
  teamHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  teamInput: { flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 800,
    color: ink, outline: "none", borderBottom: "1px dashed #d8d2c2", padding: "2px 0" },
  xBtn: { border: "none", background: "#f0ede4", borderRadius: 6, width: 22, height: 22,
    cursor: "pointer", color: "#999", fontSize: 16, lineHeight: 1 },
  sizeRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 10 },
  sizeLbl: { fontSize: 11.5, color: "#8a9285", fontWeight: 600, marginRight: 2 },
  pInput: { width: "100%", boxSizing: "border-box", border: "1px solid #e2ddcf", borderRadius: 9,
    padding: "9px 11px", fontSize: 13.5, marginBottom: 7, background: "#fff", outline: "none" },
  addTeam: { border: "2px dashed #cfc9b8", borderRadius: 14, background: "transparent",
    color: "#8a9285", fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 90 },

  hcpNote: { fontSize: 13, color: "#5a6459", background: "#f5f3ea", padding: "10px 13px",
    borderRadius: 10, marginBottom: 16, lineHeight: 1.5 },
  hcpTableWrap: { overflowX: "auto" },
  hcpTable: { width: "100%", borderCollapse: "collapse" },
  thL: { textAlign: "left", fontSize: 12, color: "#6b7569", padding: "6px 8px", fontWeight: 700 },
  th: { fontSize: 12, color: "#6b7569", padding: "6px 8px", fontWeight: 700, width: 90 },
  teamSep: { fontSize: 13, fontWeight: 800, padding: "12px 8px 5px" },
  tdName: { fontSize: 13.5, fontWeight: 600, padding: "5px 8px" },
  td: { padding: "4px 6px", textAlign: "center" },
  hcpInput: { width: 64, border: "1px solid #e2ddcf", borderRadius: 8, padding: "8px",
    fontSize: 14, textAlign: "center", outline: "none", boxSizing: "border-box" },

  playHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    marginBottom: 18 },
  navBtn: { width: 44, height: 44, borderRadius: 12, border: "1px solid #e2ddcf",
    background: "#fcfbf7", fontSize: 24, color: green, cursor: "pointer", flexShrink: 0 },
  holeBadge: { textAlign: "center", flex: 1 },
  holeNum: { fontSize: 22, fontWeight: 800, color: green, marginBottom: 8 },
  parRow: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 },

  scoreList: { display: "flex", flexDirection: "column", gap: 12 },
  scoreTeam: { border: "1.5px solid", borderRadius: 13, padding: "12px 14px", background: "#fcfbf7" },
  scoreTeamName: { fontSize: 14, fontWeight: 800, marginBottom: 8 },
  scoreRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 7 },
  scoreName: { flex: 1, fontSize: 14, fontWeight: 600 },
  scoreInput: { width: 70, border: "1px solid #d8d2c2", borderRadius: 10, padding: "10px",
    fontSize: 18, textAlign: "center", fontWeight: 700, outline: "none", boxSizing: "border-box" },
  netTag: { fontSize: 12, color: "#7a8479", minWidth: 78, textAlign: "right" },

  liveBar: { display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center",
    padding: "14px", background: "#f5f3ea", borderRadius: 12, marginTop: 16 },
  liveItem: { display: "flex", alignItems: "center", gap: 6 },
  dotSm: { width: 9, height: 9, borderRadius: "50%" },
  liveName: { fontSize: 12.5, fontWeight: 600, color: "#3a4a3d" },
  liveVal: { fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" },

  podium: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 },
  podItem: { flex: "1 1 120px", border: "2px solid", borderRadius: 14, padding: "16px 12px",
    textAlign: "center", background: "#fcfbf7" },
  podRank: { fontSize: 12, fontWeight: 700, color: "#8a9285", letterSpacing: "0.1em" },
  podName: { fontSize: 16, fontWeight: 800, margin: "4px 0" },
  podVal: { fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  podUnit: { fontSize: 11, color: "#8a9285", letterSpacing: "0.1em" },

  matTitle: { fontSize: 13, fontWeight: 700, color: "#3a4a3d", marginBottom: 10 },
  matWrap: { overflowX: "auto" },
  matTable: { width: "100%", borderCollapse: "collapse", minWidth: 320 },
  matCorner: { width: 70 },
  matTh: { fontSize: 12.5, fontWeight: 800, padding: "8px 6px" },
  matRowH: { fontSize: 12.5, fontWeight: 800, padding: "8px 8px", textAlign: "left" },
  matCell: { textAlign: "center", padding: "8px 6px", borderTop: "1px solid #f0ede4" },
  matPay: { display: "inline-block", minWidth: 26, padding: "3px 0", background: "#fdecea",
    color: "#C62828", borderRadius: 7, fontWeight: 800, fontSize: 14 },
  matZero: { color: "#c4cabc", fontSize: 13 },
  matDash: { color: "#dcd8cb" },

  footRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 22, flexWrap: "wrap" },
  primary: { background: green, color: "#fff", border: "none", borderRadius: 11,
    padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  ghost: { background: "transparent", color: "#5a6459", border: "1px solid #d8d2c2",
    borderRadius: 11, padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  hint: { fontSize: 12.5, color: "#C62828" },

  // breakdown
  bdSection: { marginTop: 16, padding: "14px", background: "#fbfaf4",
    border: "1px solid #ece8dd", borderRadius: 12 },
  bdSectionTitle: { fontSize: 12.5, fontWeight: 800, color: "#3a4a3d",
    letterSpacing: "0.04em", marginBottom: 10 },
  bonusRule: { fontSize: 11, color: "#8a9285", marginBottom: 10, lineHeight: 1.5 },
  bdWrap: { display: "flex", flexDirection: "column", gap: 12, padding: "12px 4px 4px" },
  bdWrapCompact: { display: "flex", flexDirection: "column", gap: 10 },
  bdGroup: {},
  bdLabel: { fontSize: 11.5, fontWeight: 800, color: green, letterSpacing: "0.06em",
    marginBottom: 6 },
  bdLabelSub: { fontWeight: 500, color: "#9aa192", letterSpacing: 0 },
  bdGame: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
    gap: 8, padding: "7px 10px", background: "#fff", borderRadius: 9,
    border: "1px solid #eee9dc", marginBottom: 6, fontSize: 13 },
  bdSide: { fontSize: 12.5, lineHeight: 1.3 },
  bdGross: { fontSize: 11, color: "#a8ad9f", fontWeight: 500 },
  bdBonus: { color: gold, fontWeight: 800 },
  bdVs: { fontSize: 11, fontWeight: 700, color: "#8a9285", whiteSpace: "nowrap" },
  bdPts: { gridColumn: "1 / -1", fontSize: 11.5, color: "#C62828", fontWeight: 700,
    textAlign: "center", marginTop: 2 },
  bdEmpty: { fontSize: 12, color: "#a8ad9f", padding: "6px 10px", fontStyle: "italic" },
  bdSum: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    padding: "8px 12px", marginTop: 2, background: "#f0f3ee", borderRadius: 9,
    border: "1px dashed #cdd6c8" },
  bdSumLabel: { fontSize: 11.5, fontWeight: 800, color: "#3a4a3d", letterSpacing: "0.03em" },
  bdSumVals: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" },
  bdSumItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 13,
    fontVariantNumeric: "tabular-nums" },
  bdSumZero: { fontSize: 12, color: "#a8ad9f" },
  bdTurbo: { fontSize: 11.5, fontWeight: 700, color: gold, textAlign: "center",
    padding: "6px", background: "#fdf7e3", borderRadius: 8 },

  // per-hole list (result)
  holeListWrap: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 },
  holeRow: { border: "1px solid #ece8dd", borderRadius: 11, overflow: "hidden" },
  holeToggle: { width: "100%", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "12px 14px", background: "#fcfbf7",
    border: "none", cursor: "pointer", fontFamily: "inherit" },
  holeTogLeft: { display: "flex", alignItems: "center", gap: 10 },
  holeTogNum: { fontSize: 14, fontWeight: 800, color: ink },
  holeTogPar: { fontSize: 11.5, color: "#8a9285", fontWeight: 600 },
  holeTogTurbo: { fontSize: 11, fontWeight: 800, color: gold },
  holeTogRight: { display: "flex", alignItems: "center", gap: 10 },
  holeTogPts: { fontSize: 12.5, fontWeight: 700, color: "#5a6459" },
};

const CSS = `
  * { -webkit-tap-highlight-color: transparent; }
  input:focus { border-color: ${green} !important; box-shadow: 0 0 0 3px rgba(27,94,32,0.1); }
  button { font-family: inherit; }
  .seg { padding: 11px 20px; border-radius: 10px; border: 1px solid #d8d2c2;
    background: #fcfbf7; font-size: 14px; font-weight: 700; cursor: pointer; color: #5a6459; }
  .seg.on { background: ${green}; color: #fff; border-color: ${green}; }
  .sizePill { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #d8d2c2;
    background: #fff; font-size: 13px; font-weight: 700; cursor: pointer; color: #5a6459; }
  .sizePill.on { background: ${gold}; color: #fff; border-color: ${gold}; }
  .parPill { padding: 7px 13px; border-radius: 9px; border: 1px solid #d8d2c2;
    background: #fcfbf7; font-size: 12.5px; font-weight: 700; cursor: pointer; color: #5a6459; }
  .parPill.on { background: ${green}; color: #fff; border-color: ${green}; }
  .turbo { margin-top: 4px; padding: 8px 16px; border-radius: 20px; border: 1.5px solid ${gold};
    background: #fff; color: ${gold}; font-size: 12.5px; font-weight: 800; cursor: pointer; }
  .turbo.on { background: ${gold}; color: #fff; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  @media (prefers-reduced-motion: no-preference) {
    .seg, .parPill, .turbo, .primary { transition: all 0.15s ease; }
  }
`;
