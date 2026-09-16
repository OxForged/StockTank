import Link from 'next/link';

export default function HelpPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[720px] bg-cream px-6 py-12">
      <h1 className="font-serif text-4xl leading-10 text-[#111]">Help & FAQ</h1>
      <p className="mt-3 font-inter text-sm text-[#666]">Everything you need to know</p>

      <section className="mt-8 space-y-6 font-inter text-sm leading-6 text-[#222]">
        <div>
          <h2 className="font-serif text-lg text-[#111] mb-2">What is Your Podcast?</h2>
          <p>
            Your Podcast is a daily tech podcast automatically generated from the latest news.
            We gather stories from hundreds of RSS feeds, filter the most interesting ones using AI,
            and turn them into a natural conversation between two hosts.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-lg text-[#111] mb-2">How do interests work?</h2>
          <p>
            When you first sign in, you can pick up to 10 interest categories. These help us
            prioritize which stories to include in your daily episodes. You can change your
            interests anytime from the Profile page.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-lg text-[#111] mb-2">How often are episodes published?</h2>
          <p>
            New episodes are generated daily. Check the Explore tab to discover the latest
            episodes, or visit My Shows for episodes personalized to your interests.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-lg text-[#111] mb-2">Can I listen offline?</h2>
          <p>
            Currently, episodes are streamed online. Offline playback is planned for a future update.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-lg text-[#111] mb-2">How do I log out?</h2>
          <p>
            Go to the Profile tab and tap &quot;Log Out&quot; at the bottom of the page.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Link
          href="/profile"
          className="font-inter text-sm text-[#666] hover:text-[#111] transition-colors"
        >
          &larr; Back to Profile
        </Link>
      </div>
    </main>
  );
}
