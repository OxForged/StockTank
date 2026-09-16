import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[720px] bg-cream px-6 py-12">
      <h1 className="font-serif text-4xl leading-10 text-[#111]">Privacy Policy</h1>
      <p className="mt-3 font-inter text-sm text-[#666]">Last updated: March 4, 2026</p>

      <section className="mt-8 space-y-4 font-inter text-sm leading-6 text-[#222]">
        <p>
          This page explains what data Your Podcast collects and how it is used to provide
          authentication, onboarding preferences, and playback features.
        </p>
        <p>
          OAuth account information (name, email, avatar) is used for account identity. Selected
          interests are stored to personalize content recommendations.
        </p>
        <p>
          Session cookies are used only to keep you signed in. You can log out anytime from the
          profile page.
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
