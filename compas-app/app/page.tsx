import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-3xl text-ink">Compás</h1>
      <p className="max-w-md text-ink/70">
        Coparenting logistics — calendar, activities, and notes, kept in
        one place for James and Alejandra.
      </p>
      <Link
        href="/schedule"
        className="rounded-full bg-james px-6 py-3 text-white hover:opacity-90"
      >
        Open the schedule
      </Link>
    </main>
  );
}
