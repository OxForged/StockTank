/**
 * Placeholder structure for the legal pages (README §48).
 * Every body is an outline of what the section WILL cover; none of it is final legal language.
 */

export interface LegalDoc {
  title: string;
  summary: string;
  sections: ReadonlyArray<{ heading: string; body: string }>;
}

const WILL = 'This section will describe';

export const LEGAL_DOCS = {
  terms: {
    title: 'Terms of Service',
    summary: 'The agreement between you and StockTank for using the website, apps and services.',
    sections: [
      { heading: 'Who we are', body: `${WILL} the operating entity behind StockTank and how to contact it. StockTank is a media company; it is not a broker, exchange, investment adviser or financial advisor.` },
      { heading: 'Accounts', body: `${WILL} eligibility, account security, and your responsibilities for activity under your account.` },
      { heading: 'Content and conduct', body: `${WILL} acceptable use, community rules, and what happens when they are broken.` },
      { heading: 'Intellectual property', body: `${WILL} ownership of StockTank content and the licence you receive to use it, plus the licence you grant for content you submit.` },
      { heading: 'Disclaimers and limitation of liability', body: `${WILL} the "as is" basis of the service and the limits on StockTank's liability, to the extent permitted by law.` },
      { heading: 'Changes and termination', body: `${WILL} how these terms may change and how either party may end the relationship.` },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'What personal data StockTank collects, why, and the choices you have.',
    sections: [
      { heading: 'Data we collect', body: `${WILL} account data (email, display name), usage data, device data and any optional wallet addresses you choose to link.` },
      { heading: 'How we use it', body: `${WILL} the purposes: providing the service, personalisation, analytics, security and communications.` },
      { heading: 'Sharing', body: `${WILL} the categories of processors and partners (hosting, analytics, media delivery, advertising) and the safeguards applied.` },
      { heading: 'Your rights', body: `${WILL} access, correction, deletion, portability and objection rights, and how to exercise them.` },
      { heading: 'Retention and security', body: `${WILL} how long data is kept and the technical and organisational measures protecting it.` },
      { heading: 'Contact', body: `${WILL} how to reach the privacy contact and, where applicable, a supervisory authority.` },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    summary: 'How StockTank uses cookies and similar technologies.',
    sections: [
      { heading: 'Strictly necessary', body: 'st_session: keeps you signed in. It is httpOnly, is only set when you sign in or create an account, and lasts up to 14 days.' },
      { heading: 'Advertising measurement', body: 'st_vid: a random first-party identifier set when an ad slot loads. It is used only to count impressions, apply frequency caps and prevent double counting; it is stored hashed, never shared with advertisers, and expires after 12 months.' },
      { heading: 'Preferences on your device', body: 'Your theme choice and watchlist are stored in your browser’s local storage. Marketing attribution (the campaign link you arrived from) is kept in session storage for the current tab only.' },
      { heading: 'Managing cookies', body: `${WILL} how to control cookies in your browser and via any consent controls StockTank provides.` },
    ],
  },
  copyright: {
    title: 'Copyright',
    summary: 'Ownership of StockTank content and how to use it.',
    sections: [
      { heading: 'Ownership', body: `${WILL} the ownership of shows, episodes, clips, articles, artwork and the StockTank brand.` },
      { heading: 'Permitted use', body: `${WILL} what you may do with StockTank content (for example, sharing links and embeds) and what requires a licence.` },
      { heading: 'Creator content', body: `${WILL} the rights creators keep in the content they publish through StockTank and the licence they grant to the network.` },
    ],
  },
  dmca: {
    title: 'DMCA & takedown process',
    summary: 'How to report content you believe infringes your rights, and how counter-notices work.',
    sections: [
      { heading: 'Filing a notice', body: `${WILL} the information a valid notice must contain and where to send it.` },
      { heading: 'Counter-notices', body: `${WILL} how a user whose content was removed can respond.` },
      { heading: 'Repeat infringers', body: `${WILL} the policy for accounts that repeatedly infringe.` },
      { heading: 'Contact', body: `${WILL} the designated agent's contact details once appointed.` },
    ],
  },
  'ai-disclosure': {
    title: 'AI disclosure',
    summary: 'Where StockTank uses artificial intelligence and how it is supervised.',
    sections: [
      { heading: 'AI-assisted content', body: `${WILL} which content may be produced with AI assistance (for example transcripts, summaries, clip selection, draft articles) and how it is labelled.` },
      { heading: 'AI personalities', body: `${WILL} any AI hosts or personalities, that they are clearly identified as AI, and that they do not give financial advice.` },
      { heading: 'Human review', body: `${WILL} the editorial review that AI-assisted content goes through before publication and how to report a problem.` },
      { heading: 'Your data and AI', body: `${WILL} whether and how your data is used with AI systems.` },
    ],
  },
  'advertising-disclosure': {
    title: 'Advertising disclosure',
    summary: 'How sponsorships, ads and paid placements are identified and reviewed on StockTank.',
    sections: [
      { heading: 'Labels', body: 'Every paid placement carries a visible label: Sponsored, Paid partnership, Presented by or Advertisement. StockTank promoting its own products is labelled StockTank. Host-read sponsorships are disclosed on air.' },
      { heading: 'Review before publication', body: 'Sales staff can create campaigns but cannot publish them. An editor must approve the advertiser, each creative and the campaign before anything is shown, and staff cannot approve campaigns they created. Every decision is recorded in an audit log.' },
      { heading: 'Prohibited claims', body: 'StockTank does not run advertising that promises returns, describes investments as risk-free, predicts prices, uses pressure tactics or implies a StockTank endorsement. Ad copy is automatically scanned for such language and any flag must be checked by a reviewer.' },
      { heading: 'Editorial independence', body: 'Advertisers and sponsors do not influence editorial coverage, interview questions or verdicts. A sponsorship of a show is credited, never written into its content.' },
      { heading: 'Measurement', body: 'StockTank measures ads with first-party tracking only: an impression is counted when at least half of an ad is visible for one second, and clicks pass through a StockTank link before reaching the advertiser. No third-party ad trackers are used.' },
      { heading: 'Draft status', body: `${WILL} contact details for questions about specific placements and how to report an ad.` },
    ],
  },
  'financial-disclaimer': {
    title: 'Financial content disclaimer',
    summary: 'StockTank content is information and entertainment, not financial advice.',
    sections: [
      { heading: 'Not advice', body: 'StockTank is a media company. Content, including anything said by hosts, guests, creators or AI personalities, is for information and entertainment only and is not financial, investment, legal or tax advice.' },
      { heading: 'No offers or recommendations', body: `${WILL} that nothing on StockTank is an offer, solicitation or recommendation to buy or sell any security, token or other asset, and that StockTank is not a broker, exchange or adviser.` },
      { heading: 'Risk', body: `${WILL} that digital assets and securities carry risk, including total loss, and that past performance is not indicative of future results.` },
      { heading: 'Positions and conflicts', body: `${WILL} how hosts, guests and the company disclose holdings or relationships relevant to coverage.` },
      { heading: 'Do your own research', body: `${WILL} that viewers should consult a licensed professional before making financial decisions.` },
    ],
  },
} as const satisfies Record<string, LegalDoc>;

export type LegalSlug = keyof typeof LEGAL_DOCS;
