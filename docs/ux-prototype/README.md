# UX Prototype

Static, interactive prototype of the proposals documented in
[`../UX_AUDIT.md`](../UX_AUDIT.md).

## Open it

From the repository root, start a simple HTTP server and open:

```text
http://127.0.0.1:8000/docs/ux-prototype/
```

The prototype does not persist data or connect to the database. It demonstrates:

- a continuity-focused home page;
- on-demand content import;
- a library with search and filters;
- a reader with a contextual side panel/bottom sheet;
- the global vocabulary area recovered from LWT PHP;
- review with context, shortcuts, and intervals;
- settings organized by section;
- a light GNOME/libadwaita-inspired application shell;
- responsive behavior.

## Interactions

- Use the headerbar view switcher to change the four frequent screens. At
  narrow widths it becomes a bottom navigation bar.
- Use the primary menu for backup, tag, statistics, and preference tasks.
  Language, Add text, Archive, and the four main destinations each keep a
  single visible access point outside the menu.
- “Home” shows continuity and up to 3 recent texts; “Library” is a separate,
  scalable collection screen.
- “Preview first use” switches Home to an inline first-language form.
- “Save language and add your first text” advances directly to the import flow.
- “Add content” opens the import flow.
- “Continue reading” opens the reader.
- Select a highlighted word to update the term panel.
- “Finish lesson” marks only unclicked words as `Well Known`; clicked terms
  remain in Vocabulary with their learning status. The toast provides `Undo`.
- In the reader, `Ctrl+Enter` simulates saving a term.
- During review, `Space` reveals the answer and `1`–`4` rate it.
