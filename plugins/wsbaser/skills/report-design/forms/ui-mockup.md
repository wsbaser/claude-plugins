---
when: the issue or an option changes what a screen looks like; show the current screen, then each option as a rendered mockup with real values at the same scale
---

# UI mockup

## When it fits

Use it when an issue or an option changes what a user sees: a field's format, a new badge, where a control sits, an empty or error state. The owner judges a screen by looking at it, so each option is a rendered screen to pick from, not a paragraph describing one. Do not use it for a change the user cannot see, or as decoration: a mockup must show the part of the screen the choice is about.

## How to build it

Block: `{ "form": "ui-mockup", "screen": "Clients", "source": "src/Admin/Clients/ClientsTable.tsx:40", "html": "...", "pins": [ { "n": 1, "text": "Version cell gets a '1 behind' chip" } ] }`. The current screen is a block in the issue's explanation; each option's mockup is a block in that option's `blocks`.

- Mockups are HTML and CSS inside the page. No images, no screenshots, no external frames.
- Build them from the product's real field names, labels, column order and values, found in the code (`source` gives the `file:line` you read). Use realistic data of the real length: real version numbers, real customer-like names, real dates. Never "Lorem" or "Item 1".
- The current screen comes first, in the explanation, before any option. It has no pins.
- Each option's mockup shows the same part of the screen, at the same scale and with the same data as the current one, so only the change differs.
- Mark every difference from the current screen with a numbered pin on the mockup and explain each number in a legend under it (`pins`). This is the pattern of the owner's Unauthorized Page Decision page.
- When the project has a design system (a project override of this file, or its tokens in the code), use its look. Otherwise build from the house tokens: frame `--surface`, borders `--line`, text `--fg`, secondary text `--muted`.

On the page: a frame (`.mock`: border 1px `--line-strong`, radius 8px, background `--surface`, `overflow-x: auto`) with a slim title bar naming the screen. Pins are small circles (18px, background `--warn`, white `--font-mono` number, `aria-hidden`), placed inline next to the element they mark. The legend is an ordered list under the frame, `--fs-sm`, each item starting with the same pin.

## On the page

The current screen sits in the issue body, full column width, captioned "Today". Each option's mockup sits inside its radio option (inside the option's `<label>`, below its title and description, above its attribute rows), so clicking the mockup selects the option and the recommended one is preselected with it. All mockups of one issue use the same width and font sizes. A mockup scrolls inside its frame on a narrow screen. Never folded.
