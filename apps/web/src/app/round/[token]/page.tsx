import { api, HydrateClient } from "~/trpc/server";

import { RoundFlow } from "./round-flow";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // await: SSR must render with the round, or hydration mismatches the "loading" markup
  await api.round.get.prefetch({ token });
  void api.result.get.prefetch({ token });
  return (
    <HydrateClient>
      <RoundFlow token={token} />
    </HydrateClient>
  );
}
