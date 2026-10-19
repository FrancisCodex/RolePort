/**
 * Free fallback for CV import when no AI key is set: spot well-known skills in
 * the CV text. Covers the roles most common in Philippine job postings (tech,
 * BPO/customer support, finance, marketing, healthcare, admin, design).
 */
const SKILLS = [
  // Software & data
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Node.js", "Python", "Django", "Flask",
  "Java", "Spring", "Kotlin", "Swift", "Flutter", "React Native", "C#", ".NET", "PHP", "Laravel", "Go",
  "Ruby", "Rails", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST", "HTML", "CSS",
  "Tailwind", "Git", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "CI/CD", "Terraform",
  "Power BI", "Tableau", "Excel", "Google Sheets", "Data Analysis", "Machine Learning", "Pandas",
  "QA Testing", "Selenium", "Cypress", "Jira", "Agile", "Scrum", "Salesforce", "SAP", "ServiceNow",
  // Design & marketing
  "Figma", "Adobe Photoshop", "Adobe Illustrator", "Canva", "UI Design", "UX Research", "Video Editing",
  "SEO", "SEM", "Google Ads", "Facebook Ads", "Social Media Marketing", "Content Writing", "Copywriting",
  "Email Marketing", "HubSpot", "Google Analytics", "WordPress", "Shopify",
  // Customer support & operations
  "Customer Service", "Technical Support", "Chat Support", "Email Support", "Inbound Calls", "Outbound Calls",
  "Zendesk", "Freshdesk", "CRM", "Quality Assurance", "Team Leadership", "Coaching", "Workforce Management",
  "Project Management", "Virtual Assistance", "Data Entry", "Bookkeeping", "Scheduling",
  // Finance, HR, admin
  "Accounting", "QuickBooks", "Xero", "Payroll", "Accounts Payable", "Accounts Receivable", "Auditing",
  "Taxation", "Financial Analysis", "Budgeting", "Recruitment", "Onboarding", "HR Administration",
  "Procurement", "Inventory Management", "Logistics", "Sales", "Business Development", "Negotiation",
  // Healthcare
  "Medical Coding", "Medical Billing", "Nursing", "Patient Care", "Pharmacy",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MATCHERS = SKILLS.map((name) => ({
  name,
  // Word-ish boundaries that also work for names like "C#" or ".NET".
  pattern: new RegExp(`(^|[^a-z0-9])${escapeRegExp(name.toLowerCase())}($|[^a-z0-9])`, "i"),
}));

export function detectSkills(text: string): string[] {
  const haystack = text.toLowerCase();
  return MATCHERS.filter((m) => m.pattern.test(haystack)).map((m) => m.name);
}
