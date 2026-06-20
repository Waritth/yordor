import { api, HydrateClient } from "~/trpc/server";

import { RoundFlow } from "./round-flow";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  void api.round.get.prefetch({ token });
  void api.result.get.prefetch({ token });
  return (
    <HydrateClient>
      <RoundFlow token={token} />
    </HydrateClient>
  );
}
