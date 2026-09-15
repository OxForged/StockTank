import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[720px] bg-cream px-6 py-12">
      <h1 className="font-serif text-4xl leading-10 text-[#111]">Terms of Service</h1>
      <p className="mt-3 font-inter text-sm text-[#666]">Last updated: March 4, 2026</p>

      <section className="mt-8 space-y-4 font-inter text-sm leading-6 text-[#222]">
        <p>
          Your Podcast provides AI-generated podcast content for personal listening. Availability
          and generated content quality may vary.
        </p>
        <p>
          You are responsible for your account access. Do not misuse the service or attempt to
          disrupt platform operations.
        </p>
        <p>
          External source links in episodes belong to their original publishers and are governed by
          their own terms.
        </p>
      </section>

      <div className="mt-10">
        <Link href="/login" className="font-inter text-sm text-[#111] underline underline-offset-4">
          Back to login
        </Link>
      </div>
    </main>
  );
}
