# Laundry Shop OS — specification

Sections are pasted here as they are agreed, and are binding on the
implementation. Where a section conflicts with existing code, the section
wins and the code is changed to match.

---

# Theming and design tokens

## 1. The rule

No component, screen, icon, or stylesheet may contain a literal color value. Not a hex code, not `rgb()`, not a named color like `white`. Every color comes from a CSS custom property defined in exactly one place: the theme file.

If Claude Code writes `background: #00798C` anywhere outside `themes.css`, that is a bug to fix immediately, not later.

---

## 2. Token contract

Every theme must define **all** of these. A theme missing one token is invalid and must not ship. Adding a token means adding it to every theme in the same commit.

### Neutrals

| Token | Purpose |
|---|---|
| `--bg` | Page background |
| `--surface` | Card and panel background, sits on `--bg` |
| `--line` | All 1px borders, dividers, table rules |
| `--text` | Primary text and headings |
| `--text-muted` | Secondary text, labels, timestamps |
| `--text-disabled` | Inactive stage icons, disabled controls |

### Semantic

| Token | Purpose |
|---|---|
| `--primary` | Primary buttons, active status nodes, selected states |
| `--primary-deep` | Primary-colored **text** on light backgrounds |
| `--primary-soft` | Tinted pill and badge backgrounds |
| `--on-primary` | Text and icons sitting on top of `--primary` |
| `--positive` | Done, paid, ready — status meanings only |
| `--positive-deep` | Positive-colored text |
| `--positive-soft` | Positive pill backgrounds |
| `--attention` | Overdue, unpaid, low stock, destructive actions |
| `--attention-deep` | Attention-colored text |
| `--attention-soft` | Attention pill backgrounds |

---

## 3. Theme definitions

```css
:root,
[data-theme="coldwash"] {
  --bg:              #F5F9FA;
  --surface:         #FFFFFF;
  --line:            #DCE6E9;
  --text:            #13252C;
  --text-muted:      #5F757E;
  --text-disabled:   #A9BCC2;

  --primary:         #00798C;
  --primary-deep:    #005263;
  --primary-soft:    #D7EDF1;
  --on-primary:      #FFFFFF;

  --positive:        #0E9A72;
  --positive-deep:   #04624A;
  --positive-soft:   #D8F1E8;

  --attention:       #E8850C;
  --attention-deep:  #8A4E00;
  --attention-soft:  #FBEBD6;
}

[data-theme="bubblegum"] {
  --bg:              #FFF6F8;
  --surface:         #FFFFFF;
  --line:            #EBDCE2;
  --text:            #241520;
  --text-muted:      #8A7480;
  --text-disabled:   #C3ADB6;

  --primary:         #E0246B;
  --primary-deep:    #A61150;
  --primary-soft:    #FCE3EC;
  --on-primary:      #FFFFFF;

  --positive:        #00BF8F;
  --positive-deep:   #00614A;
  --positive-soft:   #D9F6EE;

  --attention:       #D97706;
  --attention-deep:  #8A4E00;
  --attention-soft:  #FBEBD6;
}
```

`coldwash` is the default. It ships selected unless the shop changes it.

---

## 4. Contrast rules — non-negotiable

These are not style preferences. They come from the actual measured contrast of the values above.

| Rule | Reason |
|---|---|
| `--on-primary` on `--primary` is the **only** approved white-on-color combination | Both themes' primaries clear 4.5:1; the other accents do not |
| `--positive` and `--attention` are **never** used as a filled button background with white text | Both land near 3.2–3.5:1 against white — below AA for body text |
| Positive and attention meanings are expressed as `-soft` background + `-deep` text | This pairing clears 4.5:1 in both themes |
| Colored text on `--bg` always uses the `-deep` variant, never the base | `#E0246B` as text on `#FFF6F8` measures 4.37:1 — just under standard |
| If a destructive action needs a filled button, it uses `--attention-deep` as the fill | `#8A4E00` with white text clears 6.5:1 |

---

## 5. SVG assets

The icon and logo set is already locked. To make it themeable:

- All strokes and fills in app icons must be `stroke="currentColor"` or `fill="currentColor"`. Never a baked hex.
- Icons inherit color from their parent's `color` property, which is set from a token.
- Multi-color brand illustrations (splash, empty states) are the one exception — they may carry their own fixed palette, but must be checked against **every** theme's `--bg` for legibility.
- Do not maintain per-theme copies of any icon. If an asset needs duplicating per theme, it's built wrong.

---

## 6. Applying and persisting the theme

- The active theme is stored as a single setting: `theme`, value `coldwash` or `bubblegum`.
- It is applied by setting `data-theme` on the `<html>` element.
- **Apply it in a blocking inline script in `<head>`, before first paint.** If it's applied after mount, the shop sees a flash of the wrong theme on every launch, which looks broken.
- The setting is per install, not per user. This is a single-device shop app.
- Changing the theme takes effect instantly with no reload and no restart.

```html
<script>
  // in <head>, before any stylesheet-dependent render
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem('theme') || 'coldwash';
  } catch (e) {
    document.documentElement.dataset.theme = 'coldwash';
  }
</script>
```

---

## 7. Where the shop picks a theme

**Settings → Itsura only.** There is no theme step in onboarding. A new install launches in Cold Wash and stays there until someone deliberately goes looking for the setting.

The screen shows one card per theme — a live sample order row rendered in that theme's actual tokens, not a static screenshot. Tapping a card applies it instantly. The selected card carries a check mark and a `--primary` border.

Hard constraints:

- **No hex input, no color picker, no hue slider, no "custom" option.** The owner selects from the defined themes and nothing else.
- No per-element color overrides. The owner cannot recolor buttons, pills, or the logo independently.
- Adding a theme means adding it to `themes.css` and shipping an update — never a runtime-authored theme.

Rationale for both: an owner-chosen color will eventually produce an unreadable combination, and the contrast guarantees in section 4 only hold for hand-tuned values. Every unreadable screen becomes a support call, and the app gets blamed for the choice.

Rationale for settings-only: onboarding should ask about the shop, not about taste. A theme question on first launch spends the owner's patience on the least important decision in the app, and Cold Wash is safe for anyone who never touches it.

---

## 8. Adding a third theme later

Checklist. All items required before it ships:

- [ ] Defines every token in section 2 — no omissions, no fallbacks to another theme
- [ ] `--on-primary` on `--primary` measures at least 4.5:1
- [ ] Each `-deep` on its matching `-soft` measures at least 4.5:1
- [ ] Each `-deep` on `--bg` measures at least 4.5:1
- [ ] `--text` on `--bg` measures at least 7:1
- [ ] `--line` is visible against both `--bg` and `--surface` on a low-end LCD, checked on real hardware
- [ ] Status rail, order list, and payment screens reviewed in the new theme before merge

---

## 9. Dark mode

Out of scope for v1. Note it here only so the architecture doesn't preclude it: dark mode is a **separate theme entry**, not a filter or an inversion applied to a light theme. Inverting a light palette produces muddy, low-contrast results and would break every rule in section 4.

If it's added later, it's `[data-theme="coldwash-dark"]` with its own twelve hand-picked values, and it goes through the section 8 checklist like any other theme.

---

## 10. Anti-patterns

| Don't | Why |
|---|---|
| `color: #13252C` in a component | Breaks theming silently; the component just stops following the theme |
| `opacity: 0.5` to make muted text | Produces unpredictable contrast on different backgrounds; use `--text-muted` |
| A `isDark` or `isPink` boolean in component logic | Components must not know which theme is active |
| Generating tints at runtime from the base hex | The `-soft` and `-deep` values above are hand-tuned for contrast; computed ones won't be |
| Theme-conditional layout or spacing | Themes change color only. Nothing else. |

---

## Implementation notes

Recorded where the codebase had to resolve something the section leaves open:

- **Five order stages, three semantic families.** The status rail draws only
  from the contract: received `--text-disabled` (§2 names inactive stage
  icons as its purpose), washing `--primary`, drying `--attention`, ready
  `--positive`, claimed `--text`.
- **Derived values** (`--status-*`, `--pay-*`, `--shadow-card`, `--scrim`,
  `--tap-tint`) live in `themes.css` below the theme blocks and are composed
  from contract tokens only — no literals, so they follow the active theme.
- **Receipt paper** (`--paper`, `--paper-ink`) is fixed black-on-white in
  both themes: a thermal print does not follow a screen theme. It is defined
  in `themes.css` so that "one file holds every literal colour" stays true.
- **Auto dark mode was removed.** The app previously flipped its palette from
  `prefers-color-scheme`. That is the inversion §9 rules out and it bypasses
  the stored `theme` setting of §6. Re-adding it means a `coldwash-dark`
  entry through the §8 checklist.
- **Unpaid and partial** both land on `--attention-deep`; they are told apart
  by their label and by pill (`-soft` background) versus plain text.
- **`src/styles/themes.test.ts`** scans the tree and fails if a literal
  colour appears outside `themes.css`, so §1 is enforced by the build rather
  than by memory.
- **The section is called Itsura in Taglish and Appearance in English.** §7
  names it "Settings → Itsura", but the app's own rule is that every string
  has a form in each locale, and an English build showing a Taglish heading
  reads as an untranslated string rather than a deliberate one.
