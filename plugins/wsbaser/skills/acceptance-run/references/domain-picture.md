# The "Why it exists" picture

The tab opens with one picture. It answers the question the tester has before they start: **what does this story change for the user, and why does that matter?** Someone who has never seen the ticket should be able to explain the feature to a colleague from the picture alone.

A picture fails when the reader has to decode it. Charts with axes, stacked bars, cost-layer columns, a timeline of eight events, dashed shapes whose meaning lives in a legend: all of these show data, not the change. Don't draw them on this tab. The answer sheet and How it works tabs are the place for mechanics.

## The default: a Before / Now storyboard

Draw one concrete situation twice, as two lanes.

- **Before.** How the user handles the situation without this story. Usually that's a workaround typed by hand, a gap they can't close, or a wrong number they don't notice.
- **Now.** The same situation with the story built.

Each lane reads left to right:
1. **The records the user works with, as the app shows them.** Use the app's own words: "J1 · General journal", status "Posted", the line "Addition · AT-REV1  +10 @ 120 kr", the strip "Reversed by #R1". The tester will recognise these on screen during the run.
2. **The action between them.** In the Now lane, this is the new button or field, drawn as a button ("Reverse"), with a one-line label ("one click"). In the Before lane, it's the manual step ("user types a correction").
3. **The result, in business terms,** as ✓ / ✕ lines, for example:
   - stock, value, money, VAT;
   - time spent, or what an auditor or customer sees.

   Use numbers wherever they exist: "Value 600 kr, should be 500" says more than "value drifts".

Under the lanes, add the **guard rails**: the two or three rules that keep the feature safe, in plain words ("Only once: Reverse disappears after use").

If there was no Before (a brand-new capability), the Before lane shows what the user could not do and what that cost them. If the story only adds a check (BE validation), the Before lane lets the bad input through and shows the damage downstream. The Now lane shows it stopped, with the message the user sees.

## Choose the example that shows the problem

Pick numbers where the Before lane visibly goes wrong. For the journal reversal, an item that already held older stock at a different price makes the hand-made correction take the wrong units, so the value is off by a real amount. With a fresh item it looks harmless.

The run's own test data often can't show the harm. That's fine: the picture's example can differ from the run. Say "Example:" in the first line so nobody looks for these numbers in the app.

## Build it with the script

```bash
python <skill-dir>/scripts/storyboard.py <workdir>/picture.json <workdir>/figure.json
```

The spec format is in the script's docstring:
- the lanes, each with cards, arrows (optionally with a button) and a result;
- an optional two-way link between two cards;
- the guard rails;
- the caption and the `aria` text.

The script does the layout and refuses a lane that is too wide. Put the output object into `domain.figures`. Hand-draw SVG only when the change truly isn't a before/after of one situation. Even then, keep to records, actions and results.

## Check before shipping

- **Ten seconds.** Cover the caption. Can someone say what changed and why it matters after ten seconds of looking? If not, cut items until they can. Don't add labels.
- **Recognisable.** Will the tester meet these record names, statuses and buttons in the app during the run?
- **A domain expert nods.** An accountant, warehouse lead or sales manager would agree with the Before lane's ✕ lines. They are real consequences, not invented ones.
- **One claim.** The caption states it, and the `aria` text says the same thing in plain words.

## Mechanics (hand-drawn SVG only)

- Use inline SVG inside `<figure class="fig"><div class="fig-scroll"><svg class="dg dg-run" style="width:1040px" …>`.
- Colour only through the template classes, so both themes work:
  - shapes: `box`, `acc-box` (the new thing), `q` (results), `pill`, `btn`, `ln`, `dash`, `grid`;
  - text: `h`, `sm`, `mono`, `big`, `acc`, `lane`, `ok`, `no`, `warn`, `btn-t`.
- Live values use `<tspan data-t="KEY">`. A `{KEY}` placeholder does not work inside SVG, and `build.py` rejects it there.
