---
name: wsbaser:xcss-selectors
description: Generate XCSS selectors for web page elements. Use this skill whenever you need to write element selectors for the Union.Playwright.NUnit framework, convert XPath or CSS selectors to XCSS syntax, create [UnionInit] attribute values, or identify UI elements optimally using XCSS. XCSS is the native selector language used by [UnionInit] in this project — always prefer it over raw CSS or XPath strings. Trigger even for simple tasks like "give me a selector for this button" or "how do I select this element".
context: fork
argument-hint: "[HTML/DOM source and elements to select]"
allowed-tools: Read
---

# XCSS Selector Generator

XCSS is a CSS-like selector syntax that compiles to XPath. It is the selector format used in `[UnionInit("selector")]` attributes in the Union.Playwright.NUnit framework.

```
XCSS.Parse("div.classname['text']")
→ //div[contains(@class,'classname')][text()[normalize-space(.)='text']]
```

## Your Task

You have been given input to work with:

$ARGUMENTS

**Detect the mode from the input:**

- **HTML mode** — input contains `<` tags (HTML/DOM markup): analyze the markup and generate XCSS selectors for the requested elements.
- **XPath conversion mode** — input contains XPath patterns (`//`, `[@`, `descendant::`, `contains(@`, `following-sibling::`, etc.): convert each XPath expression to XCSS.
- **CSS conversion mode** — input contains CSS selectors (no `<` tags, no XPath axes): convert each CSS selector to XCSS.

If the input is a mix (e.g. some CSS and some XPath), handle each one under its own mode.

**Output format** — one line per element:
```
ElementName: xcss-selector
```

Use PascalCase names that reflect each element's role. After the list:
- For HTML mode: note elements where aria attributes would enable stronger selectors; report elements absent from the markup.
- For conversion modes: note any parts that had no direct XCSS equivalent and required a raw XPath passthrough.

---

## CSS → XCSS Conversion

Most valid CSS is also valid XCSS — the conversion is usually minimal. Focus on:

| CSS | XCSS | Reason |
|---|---|---|
| `*.cls` or `*[attr]` | `.cls` / `[attr]` | Strip the `*` prefix — it is always redundant |
| `[attr^='prefix']` | `[starts-with(@attr,'prefix')]` | `^=` not implemented; use raw XPath |
| `[attr$='suffix']` | `[substring(@attr,string-length(@attr)-N+1)='suffix']` | `$=` not implemented; use raw XPath |
| `:not(.cls)` | `[not(contains(@class,'cls'))]` | `:not()` not implemented; use raw XPath |
| `:nth-child(n)` | `[position()=n]` | pseudo-class not implemented; use raw XPath index |
| `:first-child` | `[1]` | use numeric index |
| `:last-child` | `[last()]` | use raw XPath `last()` |
| Pseudo-states `:hover`, `:focus`, etc. | *(remove)* | Playwright uses `locator.hover()` — not a selector concern |

Everything else (tag, `.class`, `#id`, `[attr='val']`, `[attr*='val']`, `>`, space, `+`, `~`, `,`) maps 1:1 to XCSS.

---

## XPath → XCSS Conversion

Work through the XPath left-to-right, replacing each pattern. Compound selectors (multiple predicates, axes) convert piece by piece.

### Step-by-step algorithm
1. Replace the leading `//` or `//*` with the appropriate tag or omit (defaults to `*`)
2. Convert attribute predicates → XCSS attribute syntax
3. Convert axes → XCSS combinators
4. Convert text predicates → XCSS text match syntax
5. Leave complex XPath functions as raw XPath passthrough `[...]`

### Conversion table

| XPath | XCSS | Notes |
|---|---|---|
| `//tag` | `tag` | Drop `//` prefix |
| `//*` | *(start of chain, no tag)* | Drop — omitting tag defaults to `*` |
| `//tag[@id='val']` | `tag#val` | ID shorthand |
| `//*[contains(@class,'cls')]` | `.cls` | Class shorthand |
| `//tag[contains(@class,'cls')]` | `tag.cls` | Tag + class |
| `[contains(@class,'c1')][contains(@class,'c2')]` | `.c1.c2` | Multiple classes |
| `[@attr='val']` | `[attr='val']` | Drop `@` |
| `[@data-x='val']` | `[data-x='val']` | Data attributes — drop `@` |
| `[@aria-label='x']` | `[aria-label='x']` | ARIA attributes — drop `@` |
| `[contains(@attr,'val')]` | `[attr*='val']` | Contains shorthand (for non-class attrs) |
| `[text()[normalize-space(.)='text']]` | `['text']` | XCSS direct text match |
| `[text()[contains(normalize-space(.),'text')]]` | `[~'text']` | XCSS partial text match |
| `/descendant::tag` or `//tag` (mid-chain) | ` tag` (space) | Descendant combinator |
| `/tag` (direct child, mid-chain) | `>tag` | Child combinator |
| `/following-sibling::tag` | `+tag` | Adjacent sibling |
| `\|` (union) | `,` | Group selector |
| `[not(...)]` | `[not(...)]` | Pass through as-is |
| `[starts-with(@attr,'x')]` | `[starts-with(@attr,'x')]` | Pass through as-is |
| `[normalize-space(.)='text']` | `[normalize-space(.)='text']` | Pass through (full text incl. descendants) |
| `[position()=n]` | `[n]` (or `[position()=n]` passthrough) | Numeric index preferred |

**Example:**
```
XPath: //*[@id='sidebar']/descendant::nav[@aria-label='Primary']/ol[contains(@class,'nav-links')]
XCSS:  #sidebar nav[aria-label='Primary']>ol.nav-links
```

---

## Syntax Reference

### Element Selectors

| XCSS | XPath Output | Notes |
|---|---|---|
| `div` | `//div` | Tag selector |
| `*` | `//*` | Wildcard — only use alone; never as a prefix (`*.cls`, `*[attr]`, `*#id` are all wrong) |
| `.classname` | `//*[contains(@class,'classname')]` | Class only — tag omitted, defaults to `*` |
| `[attr='val']` | `//*[@attr='val']` | Attribute only — tag omitted, defaults to `*` |
| `#myid` | `//*[@id='myid']` | ID selector |
| `div#myid` | `//div[@id='myid']` | Tag + ID |
| `div.cls` | `//div[contains(@class,'cls')]` | Tag + class |
| `.c1.c2` | `//*[contains(@class,'c1')][contains(@class,'c2')]` | Multiple classes |
| `div.c1.c2` | `//div[contains(@class,'c1')][contains(@class,'c2')]` | Tag + multiple classes |

### Combinators

| XCSS | XPath Axis | Example → XPath |
|---|---|---|
| ` ` (space) | `descendant::` | `div span` → `//div/descendant::span` |
| `>` | child `/` | `ul>li` → `//ul/li` |
| `+` | `following-sibling::` | `input+span` → `//input/following-sibling::span` |
| `~` | `following-sibling::` | `input~.err` → `//input/following-sibling::*[contains(@class,'err')]` |

Multiple elements chain with their combinator:
```
#sidebar nav[aria-label='Primary']>ol.nav-links
→ //*[@id='sidebar']/descendant::nav[@aria-label='Primary']/ol[contains(@class,'nav-links')]
```

A leading `>` applies the child combinator to the first element:
```
>div.panel  →  //child::div[contains(@class,'panel')]
```

### Attribute Conditions

| XCSS | XPath | Notes |
|---|---|---|
| `[attr]` | `[@attr]` | Attribute presence check |
| `[attr='val']` | `[@attr='val']` | Exact match |
| `[attr*='val']` | `[contains(@attr,'val')]` | Contains |
| `[attr~='val']` | `[contains(@attr,'val')]` | Contains (alternate syntax) |
| `[data-x='val']` | `[@data-x='val']` | Data attributes work natively |
| `[aria-label='x']` | `[@aria-label='x']` | ARIA attributes work natively |
| `[role='button']` | `[@role='button']` | Any attribute works |

Multiple conditions are implicitly **AND**ed:
```
a.nav-links--link[href='/'][aria-current='page']
→ //a[contains(@class,'nav-links--link')][@href='/'][@aria-current='page']
```

---

## XCSS Extensions (Beyond Standard CSS)

### Text Match
Match an element's direct text content:

```
['exact text']   →  [text()[normalize-space(.)='exact text']]
[~'partial']     →  [text()[contains(normalize-space(.),'partial')]]
```

Examples:
```
li.nav-item['Home']    →  //li[contains(@class,'nav-item')][text()[normalize-space(.)='Home']]
button[~'Submit']      →  //button[text()[contains(normalize-space(.),'Submit')]]
```

> **Important:** `['text']` matches **direct text nodes only**, not the concatenated text of descendants.
> For full element text (including child elements), use raw XPath: `[normalize-space(.)='text']`

### Sub-Element Predicate `[selector]` / `[>selector]`

A selector inside `[...]` becomes an XPath existence predicate, not document traversal. The leading combinator controls the axis:

| XCSS | XPath predicate | Meaning |
|---|---|---|
| `li[>a]` | `[a]` | has direct child `<a>` (`child::`) |
| `li[a]` | `[descendant::a]` | has any descendant `<a>` (equiv. to `.//a`) |
| `li[>a[@disabled]]` | `[a[@disabled]]` | direct child `<a>` with attribute |
| `li[a[href*='tab=hot']]` | `[descendant::a[contains(@href,'tab=hot')]]` | descendant `<a>` matching href |
| `li[>h5>strong>a['txt']]` | `[h5/strong/a[text()[...]]]` | deep child path as predicate |
| `button[>.icon.email]` | `[descendant::*[...class...]]` | child class element exists |

Use `[selector]` (no `>`) to replace `.//selector` raw XPath patterns inside predicates.

### Raw XPath Passthrough

Any bracket content that isn't a quoted string, attribute, integer index, or `>selector` passes through as-is:

```
[not(contains(@class,'foo'))]            →  [not(contains(@class,'foo'))]
[normalize-space(.)='Products']          →  [normalize-space(.)='Products']
[starts-with(@href,'/users')]            →  [starts-with(@href,'/users')]
[translate(@type,'B','b')='button']      →  [translate(@type,'B','b')='button']
[position() mod 2 = 1 and position() > 1]  →  [position() mod 2 = 1 and position() > 1]
[last()]                                 →  [last()]
```

### Element Index
```
tr[1]       →  //tr[1]        (first <tr>)
li[last()]  →  //li[last()]   (raw XPath passthrough)
td[3]       →  //td[3]
```

### Group Selectors (Union)
Comma-separated selectors compile to XPath `|`:
```
#id, .classname    →  //*[@id='id']|//*[contains(@class,'classname')]
```

---

## Handling Complex Conditions

### Implicit AND — chain conditions
```
a.nav-links--link[href='/'][aria-current='page']
→ //a[contains(@class,'nav-links--link')][@href='/'][@aria-current='page']
```

### OR — use comma-separated group selectors
```
.badge.badge__advice, .badge.badge__tooling, .badge.badge__bestpractice
```
Or raw XPath inside a predicate when context requires it:
```
.badge[contains(@class,'badge__advice') or contains(@class,'badge__tooling')]
```

### NOT — raw XPath passthrough
```
.s-pagination[not(contains(@class,'page-sizer'))]
→ //*[contains(@class,'s-pagination')][not(contains(@class,'page-sizer'))]
```

### Full element text (includes children) — raw XPath
`['text']` only checks direct text nodes. For `normalize-space(.)` over all content:
```
button.nav-item[normalize-space(.)='Products']
→ //button[contains(@class,'nav-item')][normalize-space(.)='Products']
```

### starts-with / other XPath string functions — raw XPath
```
div.section-header[starts-with(normalize-space(.),'Collectives')]
```

### href/src contains — use `*=`
```
a[href*='stackoverflow.blog']    →  //a[contains(@href,'stackoverflow.blog')]
img[src*='avatar']               →  //img[contains(@src,'avatar')]
```

---

## Optimization Rules

When writing XCSS selectors, apply these in priority order:

1. **ID first** — `#myid` is the strongest, most unique anchor
2. **Semantic attributes** — `[aria-label='...']`, `[data-testid='...']`, `[role='...']` before class
3. **Class over raw `contains(@class,`** — `.nav-link` is cleaner than `[class*='nav-link']`
4. **Never write `*` as a tag prefix** — omitting the tag already implies `*`; it is always redundant whether before a class (`.cls`), attribute (`[attr='val']`), or ID (`#id`)
5. **`['text']` over raw XPath text** — unless you need `normalize-space(.)` over descendants
6. **`[attr*='val']` for URL fragments** — cleaner than `[contains(@href,'val')]`
7. **`>` when the child relationship is direct** — don't use space combinator where `>` is accurate
8. **Ancestor anchor for ambiguous elements** — prefix with `#sidebar` or a landmark ID
9. **Comma/union for OR** — `sel1, sel2` reads better than complex XPath `or` predicates
10. **Sub-element predicate for existence checks** — `li[a.active]` instead of raw `.//a` XPath

**Order within an element selector**: tag → id → classes → attributes → text/raw XPath → sub-element

---

## Known Limitations

| Feature | Status | Use instead |
|---|---|---|
| `[attr^='prefix']` | NOT implemented — throws | `[starts-with(@attr,'prefix')]` raw XPath |
| `[attr$='suffix']` | NOT implemented — throws | raw XPath `[substring(...)]` |
| `:not()` pseudo-class | NOT implemented — throws | `[not(...)]` raw XPath passthrough |
| `\|=` DashMatch | Not handled — throws | `[attr='val']` or `[attr*='val']` |
| `:first-child`, `:nth-child` | Parsed but silently ignored | `[1]`, `[position()=N]` raw XPath |
| CSS output | Not implemented | XPath output only |

---

## Selector Generation Checklist

1. **Identify the strongest anchor**: `id` > `data-testid`/`aria-label` > class > text
2. **Add ancestor context** if the element isn't unique on its own
3. **Apply XCSS syntax**: `.cls`, `#id`, `['text']`, `[attr*='val']` instead of raw XPath equivalents
4. **Use `>` for direct children**, space for descendants
5. **Fall back to raw XPath** for `not()`, `starts-with()`, `normalize-space(.)`, `or`, `and`
6. **Verify uniqueness**: the selector should match exactly one element on the target page
