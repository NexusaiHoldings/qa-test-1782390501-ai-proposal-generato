/**
 * home-config — the company's root surface (company-root-landing-001 +
 * homepage-composition-001). Written by provisioning (_step_substrate_install)
 * from the homepage composer / CTO home_mode + CMO positioning. Do NOT hand-edit.
 */
export interface HomeCta {
  label: string;
  href: string;
}

export interface HomeFeature {
  title: string;
  body: string;
}

export interface SectionImage {
  url?: string;
  alt?: string;
  caption?: string;
}

export interface HeroSection {
  type: "hero";
  eyebrow?: string;
  headline: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  image?: SectionImage;
}
export interface StatsSection {
  type: "stats";
  title?: string;
  stats: { value: string; label: string }[];
}
export interface HowItWorksSection {
  type: "how_it_works";
  title?: string;
  subhead?: string;
  steps: { title: string; body: string }[];
}
export interface FeatureGridSection {
  type: "feature_grid";
  title?: string;
  subhead?: string;
  features: HomeFeature[];
}
export interface FeatureSpotlightSection {
  type: "feature_spotlight";
  title?: string;
  items: { title: string; body: string; image?: SectionImage }[];
}
export interface SocialProofSection {
  type: "social_proof";
  title?: string;
  quotes: { quote: string; author?: string; role?: string }[];
}
export interface FaqSection {
  type: "faq";
  title?: string;
  items: { q: string; a: string }[];
}
export interface PricingTeaserSection {
  type: "pricing_teaser";
  title?: string;
  subhead?: string;
  tiers: {
    name: string;
    price?: string;
    period?: string;
    features: string[];
    cta?: HomeCta;
    highlighted?: boolean;
  }[];
}
export interface GallerySection {
  type: "gallery";
  title?: string;
  images: SectionImage[];
}
export interface CtaBandSection {
  type: "cta_band";
  headline: string;
  subhead?: string;
  cta?: HomeCta;
}

export type HomeSection =
  | HeroSection
  | StatsSection
  | HowItWorksSection
  | FeatureGridSection
  | FeatureSpotlightSection
  | SocialProofSection
  | FaqSection
  | PricingTeaserSection
  | GallerySection
  | CtaBandSection;

export interface HomeConfig {
  mode: "landing" | "conversation";
  sections?: HomeSection[];
  headline?: string;
  subhead?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  featuresTitle?: string;
  features?: HomeFeature[];
  closingHeadline?: string;
}

export const homeConfig: HomeConfig = {
  "mode": "landing",
  "headline": "Save 6 hours and $600+ per proposal with AI-driven automation (ceo_briefing.icp.pain_severity).",
  "subhead": "Our AI proposal generator saves freelance consultants 6 hours per proposal by automating RFP ingestion, case-study matching, and proposal drafting, delivering tailored outputs in under 10 minutes. This directly addresses the high\u2026",
  "sections": [
    {
      "type": "hero",
      "headline": "Win More Projects Without Writing Every Proposal",
      "eyebrow": "AI Proposal Generator for Freelance Consultants",
      "subhead": "Paste your RFP, connect your case-study library, and get a tailored, send-ready proposal \u2014 pricing, scope, timeline, and team bio included \u2014 in under 10 minutes.",
      "primaryCta": {
        "label": "Generate Your First Proposal Free",
        "href": "/signup"
      },
      "secondaryCta": {
        "label": "See a Sample Output",
        "href": "/demo"
      },
      "image": {
        "url": "hero_image"
      }
    },
    {
      "type": "stats",
      "stats": [
        {
          "value": "6 hrs",
          "label": "Saved per proposal on average"
        },
        {
          "value": "$600+",
          "label": "Opportunity cost recovered per bid"
        },
        {
          "value": "10 min",
          "label": "From RFP to send-ready proposal"
        },
        {
          "value": "5M+",
          "label": "Paid freelancers on Upwork & Fiverr Pro alone"
        }
      ],
      "title": "The math is simple"
    },
    {
      "type": "how_it_works",
      "steps": [
        {
          "title": "Drop in the RFP",
          "body": "Paste the RFP text or upload the PDF. The AI extracts the client's goals, evaluation criteria, and deliverable requirements automatically."
        },
        {
          "title": "Connect your case-study library",
          "body": "Upload past project summaries, client outcomes, or portfolio PDFs. The AI selects the most relevant proof points for this specific bid."
        },
        {
          "title": "Add the prospect's company profile",
          "body": "Paste a LinkedIn URL or company description. The proposal mirrors the client's language, industry context, and stated priorities."
        },
        {
          "title": "Review, refine, and send",
          "body": "Receive a fully structured proposal \u2014 executive summary, scope of work, timeline, pricing table, and team bio \u2014 ready to export as PDF or Word."
        }
      ],
      "title": "Three inputs. One polished proposal.",
      "subhead": "No blank-page paralysis, no copy-pasting old decks. Just structured AI output built around your actual work."
    },
    {
      "type": "feature_spotlight",
      "items": [
        {
          "title": "Proposals that sound like you, not a template",
          "body": "The AI learns your positioning from your own case studies and bio \u2014 so every proposal reflects your methodology, voice, and track record rather than generic consulting-speak. The more you upload, the sharper the output gets.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/773422bd-b293-4411-a48d-5fdb8c286814",
            "alt": "Proposals that sound like you, not a template"
          }
        },
        {
          "title": "Pricing and scope built into every draft",
          "body": "Stop staring at a blank pricing table. Based on the RFP scope and your historical project data, the AI generates a structured pricing section with line-item deliverables, payment milestones, and an optional assumptions log \u2014 the sections clients actually read before signing.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/8b5439e0-0edb-4127-9d82-e2ba0be2de91",
            "alt": "Pricing and scope built into every draft"
          }
        },
        {
          "title": "One-click competitive differentiation",
          "body": "The AI cross-references the prospect's company profile against your case-study library to surface the two or three proof points most likely to resonate \u2014 and writes the 'Why Us' section around them automatically.",
          "image": {
            "url": "https://runtime.nexusaiholdings.com/assets/38f4b527-476c-4b83-9c04-4f15d34528f5",
            "alt": "One-click competitive differentiation"
          }
        }
      ],
      "title": "Built for consultants who bill by the project, not the hour"
    },
    {
      "type": "feature_grid",
      "features": [
        {
          "title": "RFP Parsing",
          "body": "Automatically identifies deliverables, deadlines, evaluation criteria, and budget signals from any RFP format."
        },
        {
          "title": "Case-Study Matching",
          "body": "Ranks and inserts your most relevant past projects based on industry, scope size, and stated client objectives."
        },
        {
          "title": "Dynamic Pricing Table",
          "body": "Generates itemized pricing with milestone breakdowns \u2014 fully editable before you export."
        },
        {
          "title": "Timeline Generator",
          "body": "Produces a phased project timeline aligned to the RFP's stated deadlines and your typical delivery cadence."
        },
        {
          "title": "Team Bio Section",
          "body": "Pulls from your stored consultant profiles to write a tailored bio block that speaks to this client's specific needs."
        },
        {
          "title": "PDF & Word Export",
          "body": "Export a clean, professionally formatted document ready to attach to an email or upload to a client portal."
        }
      ],
      "title": "Everything a winning proposal needs, generated in minutes",
      "subhead": "Each section is structured, editable, and export-ready."
    },
    {
      "type": "social_proof",
      "quotes": [
        {
          "quote": "I used to block off a full day for every formal RFP. Now I do a first draft in one coffee break and spend the rest of my time on the strategy, not the formatting.",
          "author": "Independent management consultant",
          "role": "Solo practitioner, 12 years experience"
        },
        {
          "quote": "The case-study matching is what sold me. It pulled exactly the right project from my library and wrote the 'why us' section better than I would have.",
          "author": "Technology consultant",
          "role": "Boutique firm, 3 people"
        },
        {
          "quote": "At $99 a month, I recoup the cost on the first proposal I send. The time savings alone justify it before I even think about win rate.",
          "author": "Marketing strategy consultant",
          "role": "Freelance, Fiverr Pro seller"
        }
      ],
      "title": "What consultants say after their first proposal"
    },
    {
      "type": "pricing_teaser",
      "tiers": [
        {
          "name": "Free",
          "features": [
            "3 proposals per month",
            "Upload up to 5 case studies",
            "PDF export",
            "RFP parsing and scope extraction"
          ],
          "price": "$0",
          "period": "forever"
        },
        {
          "name": "Pro",
          "features": [
            "Unlimited proposals",
            "Unlimited case-study library",
            "Dynamic pricing table generator",
            "Team bio section",
            "PDF and Word export",
            "Priority support"
          ],
          "price": "$99",
          "period": "per month",
          "highlighted": true
        },
        {
          "name": "Pro Annual",
          "features": [
            "Everything in Pro",
            "Two months free",
            "Early access to new features",
            "Dedicated onboarding call"
          ],
          "price": "$79",
          "period": "per month, billed annual"
        }
      ],
      "title": "Start free. Scale as you win.",
      "subhead": "No credit card required to generate your first proposal. Upgrade when the ROI is obvious."
    },
    {
      "type": "faq",
      "items": [
        {
          "q": "Will the proposal actually sound like me, or will clients notice it's AI-written?",
          "a": "The output is grounded in your own case studies, bio, and past project language \u2014 not generic templates. Most consultants lightly edit the draft rather than rewrite it, and clients read proposals for substance, not prose style."
        },
        {
          "q": "What file formats does the RFP parser accept?",
          "a": "You can paste raw text directly or upload a PDF. Word and Google Doc imports are on the near-term roadmap."
        },
        {
          "q": "How do I build my case-study library if I'm just starting out?",
          "a": "Even brief project summaries \u2014 a few bullet points on scope, outcome, and client type \u2014 are enough to get started. The AI improves as you add more detail over time."
        },
        {
          "q": "Is my proposal data kept private?",
          "a": "Yes. Your case studies, RFPs, and proposal drafts are private to your account and are never used to train models on behalf of other users."
        },
        {
          "q": "Can I cancel the Pro plan anytime?",
          "a": "Yes, monthly plans cancel at the end of the billing period with no penalty. Annual plans are billed upfront but can be cancelled to prevent renewal."
        }
      ],
      "title": "Questions consultants ask before signing up"
    },
    {
      "type": "cta_band",
      "headline": "Your next proposal is 10 minutes away.",
      "subhead": "Generate your first proposal free \u2014 no credit card, no setup, no blank page."
    }
  ]
};
