# Vetting a third-party skill, plugin or MCP server

Do this for every non-built-in item before it is installed. Skills are instructions the agent will follow with your permissions; a malicious one does not need code to do harm.

1. **Publisher.** Prefer Anthropic, the vendor of the technology itself (Microsoft, Stripe, Supabase, Vercel, shadcn), a known security firm (Trail of Bits) or an author with a long public track record. Never install from ClawHub; SkillsMP and similar indexes are discovery only.
2. **Registry signals.** Check `skills.sh/audits` (Gen, Socket, Snyk verdicts) and the Tessl registry (quality, impact eval, security score) when listed. Any "High risk" or malware alert → read the finding; drop unless it is clearly a false positive you can explain.
3. **Read every file** — SKILL.md, frontmatter description, references, scripts, hooks, agent definitions — through a subagent that reports: instructions to fetch remote content, network calls, credential access, file writes outside the project, obfuscated code, prompt-injection phrasing ("ignore previous", hidden HTML comments, zero-width characters).
4. **No runtime fetching.** Reject items that download instructions or code at run time (`curl | sh`, "fetch the latest rules from …"): what you vetted is not what will run.
5. **Third-party content.** Note skills that pull web pages, issues or emails into context; they open an indirect prompt-injection path. Acceptable only with a clear need.
6. **Version fit.** Check the skill targets the versions in this repo (framework majors, Node, OS). Version-mismatched templates measurably hurt results.
7. **Pin.** Record the exact plugin version or the git commit SHA you read. Vendored skills are copied at that SHA; plugins are pinned through the marketplace ref where supported. No auto-update.
8. **Optional scan.** If available: `uvx snyk-agent-scan@latest <path>` or `skill-scanner scan-all <dir> --fail-on-findings` — unless the repo policy excludes that vendor.
9. **Record** the result per item in `docs/quality/toolchain.md`: publisher, version/SHA, signals checked, findings, verdict.
