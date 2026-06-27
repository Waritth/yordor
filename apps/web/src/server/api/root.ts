import { cardRouter } from "~/server/api/routers/card";
import { holeRouter } from "~/server/api/routers/hole";
import { playerRouter } from "~/server/api/routers/player";
import { resultRouter } from "~/server/api/routers/result";
import { roundRouter } from "~/server/api/routers/round";
import { scoreRouter } from "~/server/api/routers/score";
import { teamRouter } from "~/server/api/routers/team";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Primary tRPC router. P2 = Team mode end-to-end.
 * (bet.* generic CRUD + realtime round.live arrive in P3/P4.)
 */
export const appRouter = createTRPCRouter({
  round: roundRouter,
  player: playerRouter,
  hole: holeRouter,
  score: scoreRouter,
  team: teamRouter,
  result: resultRouter,
  card: cardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 */
export const createCaller = createCallerFactory(appRouter);
