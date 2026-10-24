/** Made-up jobs for the landing page demos. Nothing here comes from a real source. */

export type DemoSetup = "Remote" | "Hybrid" | "Onsite";

export type DemoJob = {
  id: string;
  title: string;
  company: string;
  place: string;
  setup: DemoSetup;
  pay: string;
  posted: string;
  score: number;
  skills: string[];
  breakdown: { label: string; score: number }[];
  strengths: string[];
  gaps: string[];
};

export const DEMO_JOBS: DemoJob[] = [
  {
    id: "kalye",
    title: "Frontend Developer",
    company: "Kalye Labs",
    place: "Makati, PH",
    setup: "Hybrid",
    pay: "₱90k–₱130k / mo",
    posted: "2d ago",
    score: 94,
    skills: ["React", "TypeScript", "Next.js", "Tailwind"],
    breakdown: [
      { label: "Technical skills", score: 96 },
      { label: "Experience", score: 92 },
      { label: "Culture fit", score: 90 },
      { label: "Career alignment", score: 95 },
    ],
    strengths: ["4 years of React and TypeScript in production", "Shipped a design system used by 3 teams"],
    gaps: ["No GraphQL yet, listed as a plus"],
  },
  {
    id: "northwind",
    title: "Full Stack Developer",
    company: "Northwind Digital",
    place: "Anywhere in APAC",
    setup: "Remote",
    pay: "$2.8k–$4k / mo",
    posted: "5h ago",
    score: 88,
    skills: ["Node.js", "React", "PostgreSQL", "AWS"],
    breakdown: [
      { label: "Technical skills", score: 90 },
      { label: "Experience", score: 86 },
      { label: "Culture fit", score: 88 },
      { label: "Career alignment", score: 87 },
    ],
    strengths: ["Node.js APIs and Postgres match the stack", "Remote work across time zones before"],
    gaps: ["AWS certification preferred"],
  },
  {
    id: "tala",
    title: "React Native Developer",
    company: "Tala Health",
    place: "Worldwide",
    setup: "Remote",
    pay: "$3k–$4.5k / mo",
    posted: "1d ago",
    score: 82,
    skills: ["React Native", "TypeScript", "Expo"],
    breakdown: [
      { label: "Technical skills", score: 80 },
      { label: "Experience", score: 84 },
      { label: "Culture fit", score: 85 },
      { label: "Career alignment", score: 79 },
    ],
    strengths: ["Strong React fundamentals carry over", "Health-tech side project"],
    gaps: ["Only one app published to the stores"],
  },
  {
    id: "harbour",
    title: "Backend Engineer",
    company: "Harbour Bank",
    place: "Singapore",
    setup: "Onsite",
    pay: "S$6k–S$8k / mo",
    posted: "3d ago",
    score: 76,
    skills: ["Java", "Kafka", "PostgreSQL"],
    breakdown: [
      { label: "Technical skills", score: 70 },
      { label: "Experience", score: 78 },
      { label: "Culture fit", score: 80 },
      { label: "Career alignment", score: 77 },
    ],
    strengths: ["Payments domain experience", "Open to relocating to Singapore"],
    gaps: ["Java is secondary for you", "Needs an employment pass"],
  },
  {
    id: "bayani",
    title: "Product Designer",
    company: "Bayani Studio",
    place: "BGC, Taguig",
    setup: "Hybrid",
    pay: "₱70k–₱95k / mo",
    posted: "1w ago",
    score: 71,
    skills: ["Figma", "Design systems", "Prototyping"],
    breakdown: [
      { label: "Technical skills", score: 66 },
      { label: "Experience", score: 70 },
      { label: "Culture fit", score: 82 },
      { label: "Career alignment", score: 68 },
    ],
    strengths: ["Design-system work overlaps", "Comfortable in Figma"],
    gaps: ["No formal UX research", "Portfolio is engineering-heavy"],
  },
  {
    id: "lumen",
    title: "Data Analyst",
    company: "Lumen Retail",
    place: "Cebu City, PH",
    setup: "Onsite",
    pay: "₱45k–₱60k / mo",
    posted: "4d ago",
    score: 58,
    skills: ["SQL", "Power BI", "Excel"],
    breakdown: [
      { label: "Technical skills", score: 55 },
      { label: "Experience", score: 52 },
      { label: "Culture fit", score: 70 },
      { label: "Career alignment", score: 54 },
    ],
    strengths: ["Solid SQL from backend work"],
    gaps: ["No BI tooling", "Career move away from engineering"],
  },
];

export const fitLabel = (score: number) => (score >= 85 ? "Strong fit" : score >= 70 ? "Good fit" : score >= 55 ? "Worth a look" : "Long shot");
