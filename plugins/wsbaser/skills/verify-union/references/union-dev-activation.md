# Union-Dev Activation Message Template

```
IMPLEMENTATION ASSIGNMENT — Track [N]

Test Project: [TEST_PROJECT_PATH]
Team: [TEAM_NAME]

Your assigned Gherkin scenarios:

[Insert track-specific Gherkin scenarios here]

File ownership — you are responsible for:
- Test classes for the scenarios above
- Page objects and components needed by your scenarios
- IMPORTANT: Extend existing page objects rather than creating duplicates. Check Pages/ directory first.

After implementation, run your filtered tests:
  dotnet test [TEST_PROJECT_PATH] --filter "FullyQualifiedName~[YourTestClassName]"

Self-fix protocol:
- If tests fail, analyze the output and fix the issue
- Re-run after each fix
- Maximum 3 self-fix retries
- If still failing after 3 retries, report the failure with full diagnostics to team lead

Report completion to team lead when done, including:
- List of files created/modified
- Test run result (pass/fail)
- Number of self-fix retries used
- Any unresolved issues
```
