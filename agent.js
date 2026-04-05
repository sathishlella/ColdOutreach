/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         ColdOutreach AI — Production Agent Code             ║
 * ║         Day 4 of 100 | 100 Days 100 AI Agents              ║
 * ║         Built by: Sathish Lella                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ColdOutreach AI researches prospects, identifies pain signals,
 * and writes hyper-personalized cold emails with A/B variants,
 * subject lines, and a complete follow-up sequence.
 *
 * SETUP:
 *   npm init -y
 *   npm install anthropic dotenv
 *
 * USAGE:
 *   node agent.js
 *
 * ENV (.env file):
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

config();

// ═══════════════════════════════════════════════════════════════
//  DATA MODELS
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Prospect
 * @property {string} name
 * @property {string} title
 * @property {string} company
 * @property {string} industry
 * @property {string} companySize
 * @property {string} [linkedinUrl]
 * @property {string} [knownIntel] - Pain points, recent news, signals
 */

/**
 * @typedef {Object} Offer
 * @property {string} product
 * @property {string} valueProp
 * @property {string} tone - friendly-expert | direct-ceo | curious-consultant | peer-builder
 * @property {string} ctaStyle - soft-meeting | value-first | social-proof | no-ask
 */

/**
 * @typedef {Object} SubjectLine
 * @property {string} text
 * @property {string} strategy - What makes this subject line work
 * @property {number} estimatedOpenRate
 */

/**
 * @typedef {Object} EmailVariant
 * @property {string} label
 * @property {string} body
 * @property {number} wordCount
 * @property {string} personalizationLevel - high | medium | low
 * @property {string} strategy - Why this variant works
 */

/**
 * @typedef {Object} FollowUp
 * @property {string} day
 * @property {string} type - bump | value-add | breakup | case-study
 * @property {string} subject
 * @property {string} body
 */

/**
 * @typedef {Object} ProspectResearch
 * @property {string} summary
 * @property {string[]} painPoints
 * @property {string[]} triggers - Buying signals
 * @property {string[]} personalizationHooks
 * @property {string[]} objections - Likely objections and how to handle
 */

/**
 * @typedef {Object} OutreachSequence
 * @property {Prospect} prospect
 * @property {ProspectResearch} research
 * @property {SubjectLine[]} subjectLines
 * @property {EmailVariant[]} emailVariants
 * @property {FollowUp[]} followUps
 * @property {string} generatedAt
 */

// ═══════════════════════════════════════════════════════════════
//  COLD OUTREACH AGENT
// ═══════════════════════════════════════════════════════════════

class ColdOutreachAgent {
  /**
   * @param {Object} options
   * @param {string} [options.model]
   */
  constructor(options = {}) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = options.model || "claude-sonnet-4-6";
    this.systemPrompt = this._buildSystemPrompt();
  }

  _buildSystemPrompt() {
    return `You are ColdOutreach AI — the world's most effective cold email writer.

You combine deep prospect research with behavioral psychology to craft emails
that get opened, read, and replied to.

Your rules:
1. PERSONALIZATION IS EVERYTHING — reference specific details about the prospect
2. The subject line is 80% of the battle — make it impossible to ignore
3. First line must NOT be about you — it must be about THEM
4. Keep emails under 120 words (nobody reads walls of text)
5. One clear CTA — never give multiple choices
6. Sound like a human, not a robot. No corporate jargon.
7. Create genuine curiosity, not clickbait
8. Every sentence must earn its place — ruthlessly cut filler

Your cold emails consistently achieve 40%+ open rates and 8%+ reply rates.

Always output valid JSON matching the exact schema provided.`;
  }

  /**
   * Send a prompt to Claude and return the response text.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async _callClaude(prompt) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: this.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content[0].text;
  }

  /**
   * Extract JSON from a Claude response that may have surrounding text.
   * @param {string} text
   * @returns {string}
   */
  _extractJSON(text) {
    text = text.trim();
    for (const [start, end] of [
      ["{", "}"],
      ["[", "]"],
    ]) {
      const s = text.indexOf(start);
      const e = text.lastIndexOf(end);
      if (s !== -1 && e !== -1 && e > s) return text.slice(s, e + 1);
    }
    return text;
  }

  // ── STEP 1: PROSPECT RESEARCH ──────────────────────────────

  /**
   * Research the prospect and identify personalization hooks.
   * @param {Prospect} prospect
   * @returns {Promise<ProspectResearch>}
   */
  async researchProspect(prospect) {
    const prompt = `
Research this prospect and identify personalization opportunities:

NAME: ${prospect.name}
TITLE: ${prospect.title}
COMPANY: ${prospect.company}
INDUSTRY: ${prospect.industry}
COMPANY SIZE: ${prospect.companySize}
${prospect.linkedinUrl ? `LINKEDIN: ${prospect.linkedinUrl}` : ""}
KNOWN INTEL: ${prospect.knownIntel || "None provided"}

Return JSON:
{
  "summary": "2-3 sentence overview of this prospect's likely priorities and challenges",
  "painPoints": ["3-5 specific pain points someone in this role/company/industry faces"],
  "triggers": ["3-4 buying signals or reasons they might need a solution NOW"],
  "personalizationHooks": ["4-5 specific things to reference in the email to show you did research"],
  "objections": ["3-4 likely objections with how to handle each — format: 'Objection: [X] → Handle: [Y]'"]
}

Be SPECIFIC to this person, company, and industry. No generic filler.
Return ONLY valid JSON.`;

    const raw = await this._callClaude(prompt);
    try {
      return JSON.parse(this._extractJSON(raw));
    } catch (e) {
      console.error("⚠️  Could not parse research:", e.message);
      return {
        summary: "Research unavailable",
        painPoints: [],
        triggers: [],
        personalizationHooks: [],
        objections: [],
      };
    }
  }

  // ── STEP 2: SUBJECT LINES ─────────────────────────────────

  /**
   * Generate A/B testable subject lines.
   * @param {Prospect} prospect
   * @param {ProspectResearch} research
   * @param {Offer} offer
   * @returns {Promise<SubjectLine[]>}
   */
  async generateSubjectLines(prospect, research, offer) {
    const prompt = `
Generate 5 cold email subject lines for this prospect:

PROSPECT: ${prospect.name}, ${prospect.title} at ${prospect.company}
INDUSTRY: ${prospect.industry}
RESEARCH: ${JSON.stringify(research.personalizationHooks)}
PRODUCT: ${offer.product}
VALUE PROP: ${offer.valueProp}

Rules:
- Under 50 characters each (critical for mobile)
- No spam triggers (FREE, ACT NOW, etc.)
- At least one that references something personal/specific
- Mix of curiosity, value, and social proof approaches
- Lowercase is fine — it feels more human

Return JSON array:
[
  {
    "text": "subject line here",
    "strategy": "Why this works in one sentence",
    "estimatedOpenRate": 38
  }
]

Return ONLY valid JSON array, sorted by estimated open rate descending.`;

    const raw = await this._callClaude(prompt);
    try {
      return JSON.parse(this._extractJSON(raw));
    } catch (e) {
      console.error("⚠️  Could not parse subject lines:", e.message);
      return [];
    }
  }

  // ── STEP 3: EMAIL VARIANTS ─────────────────────────────────

  /**
   * Generate 3 email variants with different approaches.
   * @param {Prospect} prospect
   * @param {ProspectResearch} research
   * @param {Offer} offer
   * @returns {Promise<EmailVariant[]>}
   */
  async generateEmails(prospect, research, offer) {
    const toneDescriptions = {
      "friendly-expert":
        "Warm, knowledgeable, approachable — like a smart friend giving advice",
      "direct-ceo":
        "Crisp, no-fluff, executive-level — respects their time",
      "curious-consultant":
        "Asks smart questions, shows genuine interest in their challenges",
      "peer-builder":
        "Builder-to-builder, peer-level, shares common struggles",
    };

    const ctaDescriptions = {
      "soft-meeting": "Suggest a quick 15-min call, easy to say yes to",
      "value-first":
        "Offer something free (audit, report, benchmark) — no commitment",
      "social-proof":
        "Reference similar companies who benefited, then ask",
      "no-ask":
        "Pure value email, no direct ask — build trust first",
    };

    const prompt = `
Write 3 cold email variants for this prospect:

PROSPECT: ${prospect.name} (goes by ${prospect.name.split(" ")[0]})
TITLE: ${prospect.title}
COMPANY: ${prospect.company} (${prospect.companySize} employees)
INDUSTRY: ${prospect.industry}

RESEARCH:
- Pain Points: ${JSON.stringify(research.painPoints)}
- Personalization Hooks: ${JSON.stringify(research.personalizationHooks)}
- Buying Triggers: ${JSON.stringify(research.triggers)}

YOUR OFFER:
- Product: ${offer.product}
- Value: ${offer.valueProp}
- Tone: ${toneDescriptions[offer.tone]}
- CTA: ${ctaDescriptions[offer.ctaStyle]}

Sign off as "Sathish" (that's the sender's name).

VARIANT A — Storytelling: Open with a relatable observation, build narrative, close with CTA
VARIANT B — Direct & Short: Under 80 words, problem→solution→proof→CTA
VARIANT C — Question Hook: Lead with a thought-provoking question that highlights their pain

Rules for ALL variants:
- First line is about THEM, not you
- Under 120 words each
- One CTA only
- Reference at least 2 personalization hooks
- Sound human — read it out loud and it should flow naturally

Return JSON array:
[
  {
    "label": "Variant A — Storytelling",
    "body": "Full email text here",
    "wordCount": 95,
    "personalizationLevel": "high",
    "strategy": "Why this variant works"
  }
]

Return ONLY valid JSON array.`;

    const raw = await this._callClaude(prompt);
    try {
      return JSON.parse(this._extractJSON(raw));
    } catch (e) {
      console.error("⚠️  Could not parse emails:", e.message);
      return [];
    }
  }

  // ── STEP 4: FOLLOW-UP SEQUENCE ─────────────────────────────

  /**
   * Generate a 3-touch follow-up sequence.
   * @param {Prospect} prospect
   * @param {ProspectResearch} research
   * @param {Offer} offer
   * @returns {Promise<FollowUp[]>}
   */
  async generateFollowUps(prospect, research, offer) {
    const firstName = prospect.name.split(" ")[0];
    const prompt = `
Write a 3-email follow-up sequence for ${firstName} at ${prospect.company}
who didn't reply to the initial cold email about ${offer.product}.

CONTEXT:
- Prospect: ${prospect.title} at ${prospect.company}
- Product: ${offer.product} — ${offer.valueProp}
- Research: ${JSON.stringify(research.painPoints.slice(0, 2))}

Sign off as "Sathish".

Sequence:
1. Day 3 — Gentle bump (reference the first email, add one new angle)
2. Day 7 — Value add (share something useful with zero ask — article, benchmark, insight)
3. Day 14 — Breakup email (lighthearted, leave door open, no guilt-tripping)

Rules:
- Each under 60 words
- Different approach each time — never just "bumping this up"
- The breakup email should be memorable (humor, self-awareness, warmth)

Return JSON array:
[
  {
    "day": "Day 3",
    "type": "bump",
    "subject": "Re: [original subject]",
    "body": "Email text"
  }
]

Return ONLY valid JSON array.`;

    const raw = await this._callClaude(prompt);
    try {
      return JSON.parse(this._extractJSON(raw));
    } catch (e) {
      console.error("⚠️  Could not parse follow-ups:", e.message);
      return [];
    }
  }

  // ── MAIN: GENERATE FULL OUTREACH SEQUENCE ──────────────────

  /**
   * Run the full outreach generation pipeline.
   * @param {Prospect} prospect
   * @param {Offer} offer
   * @returns {Promise<OutreachSequence>}
   */
  async generateSequence(prospect, offer) {
    console.log("\n🎯 ColdOutreach AI — Generating your sequence...");
    console.log(`👤 Prospect: ${prospect.name} (${prospect.title} at ${prospect.company})`);
    console.log("━".repeat(55));

    console.log("🔍 [1/4] Researching prospect...");
    const research = await this.researchProspect(prospect);

    console.log("📬 [2/4] Crafting subject lines...");
    const subjectLines = await this.generateSubjectLines(prospect, research, offer);

    console.log("✉️  [3/4] Writing email variants...");
    const emailVariants = await this.generateEmails(prospect, research, offer);

    console.log("📅 [4/4] Building follow-up sequence...");
    const followUps = await this.generateFollowUps(prospect, research, offer);

    console.log(`\n✅ Sequence complete! ${subjectLines.length} subjects, ${emailVariants.length} variants, ${followUps.length} follow-ups\n`);

    return {
      prospect,
      research,
      subjectLines,
      emailVariants,
      followUps,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── EXPORT ─────────────────────────────────────────────────

  /**
   * Export sequence as Markdown.
   * @param {OutreachSequence} seq
   * @returns {string}
   */
  exportToMarkdown(seq) {
    const lines = [];
    const p = seq.prospect;

    lines.push(`# 🎯 ColdOutreach AI — Sequence for ${p.name}`);
    lines.push(`**${p.title} at ${p.company}** · ${p.industry} · ${p.companySize} employees`);
    lines.push(`**Generated:** ${seq.generatedAt.slice(0, 19).replace("T", " ")}\n`);

    lines.push(`## 🔍 Research Summary`);
    lines.push(seq.research.summary);
    lines.push(`\n**Pain Points:**`);
    seq.research.painPoints.forEach((p) => lines.push(`- ${p}`));
    lines.push(`\n**Buying Triggers:**`);
    seq.research.triggers.forEach((t) => lines.push(`- ${t}`));
    lines.push(`\n**Personalization Hooks:**`);
    seq.research.personalizationHooks.forEach((h) => lines.push(`- ${h}`));

    lines.push(`\n## 📬 Subject Lines\n`);
    seq.subjectLines.forEach((s, i) => {
      lines.push(`${i + 1}. **"${s.text}"** — ~${s.estimatedOpenRate}% open rate`);
      lines.push(`   _${s.strategy}_\n`);
    });

    lines.push(`## ✉️ Email Variants\n`);
    seq.emailVariants.forEach((e) => {
      lines.push(`### ${e.label}`);
      lines.push(`*${e.personalizationLevel} personalization · ${e.wordCount} words*\n`);
      lines.push("```");
      lines.push(e.body);
      lines.push("```\n");
      lines.push(`> **Strategy:** ${e.strategy}\n`);
    });

    lines.push(`## 📅 Follow-Up Sequence\n`);
    seq.followUps.forEach((f) => {
      lines.push(`### ${f.day} — ${f.type}`);
      lines.push(`**Subject:** ${f.subject}\n`);
      lines.push("```");
      lines.push(f.body);
      lines.push("```\n");
    });

    lines.push(`## ⚡ Likely Objections\n`);
    seq.research.objections.forEach((o) => lines.push(`- ${o}`));

    return lines.join("\n");
  }

  /**
   * Export as JSON.
   * @param {OutreachSequence} seq
   * @returns {string}
   */
  exportToJSON(seq) {
    return JSON.stringify(seq, null, 2);
  }

  /**
   * Save all outputs to a directory.
   * @param {OutreachSequence} seq
   * @param {string} [dir]
   */
  saveOutputs(seq, dir = "output") {
    mkdirSync(dir, { recursive: true });

    const mdPath = join(dir, "outreach-sequence.md");
    writeFileSync(mdPath, this.exportToMarkdown(seq));
    console.log(`📄 ${mdPath}`);

    const jsonPath = join(dir, "outreach-sequence.json");
    writeFileSync(jsonPath, this.exportToJSON(seq));
    console.log(`📊 ${jsonPath}`);

    // Individual email files for easy copy-paste
    seq.emailVariants.forEach((e, i) => {
      const filePath = join(dir, `email-variant-${String.fromCharCode(65 + i)}.txt`);
      writeFileSync(filePath, e.body);
      console.log(`✉️  ${filePath}`);
    });

    seq.followUps.forEach((f) => {
      const filePath = join(dir, `followup-${f.day.toLowerCase().replace(/\s+/g, "-")}.txt`);
      writeFileSync(filePath, `Subject: ${f.subject}\n\n${f.body}`);
      console.log(`📅 ${filePath}`);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  CLI DEMO
// ═══════════════════════════════════════════════════════════════

async function main() {
  const prospect = {
    name: "Sarah Chen",
    title: "VP of Engineering",
    company: "Stripe",
    industry: "Fintech",
    companySize: "5,000+",
    linkedinUrl: "https://linkedin.com/in/sarahchen",
    knownIntel:
      "Recently tweeted about deployment bottlenecks. Hiring 3 DevOps engineers. Their status page shows 2 incidents last month. Spoke at DevOps Days about CI/CD challenges.",
  };

  const offer = {
    product: "DeployFast — AI-powered CI/CD platform",
    valueProp:
      "Cut deployment time by 80%, zero-downtime releases, 10-minute setup, works with existing stack",
    tone: "friendly-expert",
    ctaStyle: "soft-meeting",
  };

  const agent = new ColdOutreachAgent();
  const sequence = await agent.generateSequence(prospect, offer);

  // Print markdown
  const md = agent.exportToMarkdown(sequence);
  console.log(md);

  // Save files
  agent.saveOutputs(sequence);
  console.log("\n✅ All files saved to output/");
}

main().catch(console.error);
