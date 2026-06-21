/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";

import { db } from "~/server/db";
import { roundEvents } from "~/server/events";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Round procedure — authz via accessToken (docs/04 §2).
 * Resolves `token` → the Round and injects it into ctx. No user session.
 */
export const roundProcedure = publicProcedure
  .input(z.object({ token: z.string().min(1) }))
  .use(async ({ ctx, input, next }) => {
    const round = await ctx.db.round.findUnique({
      where: { accessToken: input.token },
    });
    if (!round) throw new TRPCError({ code: "NOT_FOUND" });
    return next({ ctx: { ...ctx, round } });
  });

/**
 * Write variant — same as roundProcedure but blocks mutations on a FINISHED
 * round (docs/04 §8). Unlock via round.setStatus.
 */
export const roundWriteProcedure = roundProcedure.use(({ ctx, next }) => {
  if (ctx.round.status === "FINISHED") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "รอบนี้จบแล้ว (ปลดล็อกด้วยการเปลี่ยนสถานะก่อนแก้)",
    });
  }
  return next();
});

/** Bump Round.updatedAt + emit live event — invalidation signal (docs/04 §1, §6). */
export const touchRound = async (
  database: typeof db,
  roundId: string,
): Promise<void> => {
  const r = await database.round.update({
    where: { id: roundId },
    data: { updatedAt: new Date() },
    select: { updatedAt: true },
  });
  roundEvents.emit(roundId, r.updatedAt);
};
