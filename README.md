# wsbaser-plugins

A marketplace of plugins for [Claude Code](https://claude.com/claude-code) by [wsbaser](https://github.com/wsbaser).

## Plugins

| Plugin | Description |
|--------|-------------|
| [wsbaser](./plugins/wsbaser/) | Development workflow toolkit: multi-agent spec implementation, architecture/clean-code review, code simplification, requirements interview, and more |
| [quality-bootstrap](./plugins/quality-bootstrap/) | Vetted, pinned, enforced agent toolchain + deterministic quality gates for any repo |
| [ask-jenny](./plugins/ask-jenny/) | Ask Jenny workflow setup for a project (run after quality-bootstrap) |

## Installation

Add this marketplace and install the plugin:

```
/plugin marketplace add github.com/wsbaser/claude-plugins
/plugin install wsbaser@wsbaser-plugins
/plugin install quality-bootstrap@wsbaser-plugins
/plugin install ask-jenny@wsbaser-plugins
```

## License

MIT
