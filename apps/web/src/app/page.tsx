import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1B5E20] to-[#0a1f0c] text-white">
        <div className="container flex flex-col items-center justify-center gap-6 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            YorDor <span className="text-[hsl(120,60%,70%)]">⛳</span>
          </h1>
          <p className="text-lg text-white/70">Foundation ready (P0)</p>
        </div>
      </main>
    </HydrateClient>
  );
}
