# Leszák Károly, *Kardvívás* ("Sabre Fencing"), 2nd edition, 1906 — English source

An English translation of the opening chapters of a Hungarian sabre-fencing textbook, kept here as source material. The plan is to build postures and exercises for Moulinet from it later; this folder is only the source: the translation, a glossary and the figures.

## The book

| | |
|---|---|
| Title | *Kardvívás* ("Sabre Fencing") |
| Author | Leszák Károly (Károly Leszák; Hungarian name order), Royal Hungarian Honvéd fencing master, 1st class, teacher at the Ludovika Academy |
| Edition | 2nd edition, Budapest, 1906, "Molnárok Lapja" press; property of the author |
| Standing | Textbook adopted for the Ludovika Academy and the Honvéd cadet schools by Ministry of Defence Decree No. 5791/21 of 30 January 1906 |
| Language | Hungarian |
| Source file | [`17152.pdf`](../../17152.pdf) in the repository root: 146 pages, 300 dpi scan with an OCR text layer (ABBYY FineReader 12, 2017) |

The scanned pages carry a faint "OSZK" watermark and library stamps (Országos Széchényi Könyvtár, the Hungarian National Széchényi Library). The file name `17152` may be a catalogue number; I have not checked.

The book has three parts: individual training (Part One), school fencing in pairs, with cuts, parries, feints, ripostes and time (Part Two, Chapters III–XII), and guidance for real bouts (Part Three, Chapter XIII). The full table of contents is translated in [`en/00-front-matter.md`](en/00-front-matter.md).

## What is translated

Foreword, Introduction and **Part One** (Chapters I–II): everything up to the end of §16, book p. 19. This is where the book describes the grip, the basic and fencing stances, the six sabre attitudes, the nine sabre positions, the swings, the parry swings, the footwork and the air-cut drills, with 17 figures.

| File | Contents | Book pages | PDF pages |
|---|---|---|---|
| [`en/00-front-matter.md`](en/00-front-matter.md) | Cover, title page, full table of contents (§§17–65 provisional) | cover, I, III–V | 1, 5, 7–9 |
| [`en/01-foreword.md`](en/01-foreword.md) | Foreword (*Előszó*) | VII–VIII | 11–12 |
| [`en/02-introduction.md`](en/02-introduction.md) | §§1–4: concept, aim, parts of the sabre, grip | 1–2 | 13–14 |
| [`en/03-chapter-1-basic-stance.md`](en/03-chapter-1-basic-stance.md) | Chapter I, §§5–12: basic stance, sabre attitudes, fencing line, openings, swings, starting positions, parry swings | 3–13 | 15–25 |
| [`en/04-chapter-2-fencing-stance.md`](en/04-chapter-2-fencing-stance.md) | Chapter II, §§13–16: fencing stance, foot and body movements, air cuts, parry swings with cuts | 14–19 | 26–31 |
| [`glossary.md`](glossary.md) | Hungarian ↔ English terms, the nine sabre positions at a glance, commands | — | — |
| [`figures/`](figures/) | Figures 1–17 cropped from the scan, and `manifest.json` | — | — |

**Not yet translated:** Chapter III onwards (book p. 20 on). Chapter III starts Part Two with the master–pupil method, fencing distance, the salute, invitations, thrusts and the cuts proper (§§17–26). The foreword says Chapter III is where the master–pupil method is applied.

## Conventions

- **Sections** are cited as §N, using the book's own numbered items (*pontok*, §1–65). Figures keep the book's numbers (Fig. 1–17).
- **Pages.** `[p. 5]` in the text marks where the printed page changes. For the arabic-numbered pages, PDF page = book page + 12 (book p. 1 = PDF p. 13). Front matter uses roman numerals (title page I = PDF p. 5, foreword VII–VIII = PDF pp. 11–12).
- **Hungarian terms** appear in italics in brackets where they matter. Italian, French and German words that the book itself prints in brackets are kept as printed.
- **Commands** are in quotes, with the executive word in italics as in the print: "Tierce – *one!*".
- **Translator's notes** are blockquotes labelled "Translator's note". They flag ambiguities, misprints in the original and forward references. Anything that is my reading of the text rather than the text itself is worded as such.
- **Sabre, not sword.** *Kard* is "sabre" throughout (see the glossary for this and the other choices).
- **Pronouns.** The Hungarian is gender-neutral, so the English avoids gendered pronouns for the fencer, pupil, master and opponent.

## Method and checking

The PDF's text layer is good for running prose but unreliable for the things that matter most here: it drops words printed letter-spaced (the command words), cannot read the diagram labels or the bracketed tables, and merges figure captions into the text. Every page in scope was therefore read from its page image against the text layer, and doubtful spots were checked in 300 dpi crops. Examples of what this caught: the lunge description lost the words *gyors előre* ("quickly forward") in the text layer; the commands of §12–§16 were garbled; the labels of Fig. 3 and the brace groupings of the air-cut lists exist only in the image.

The translation was made by Claude, an AI model, working from the page images. It has not been reviewed by a Hungarian speaker or a fencing historian, so a few terms may not be the ones a specialist would choose. Doubtful points are flagged in the translator's notes. Treat it as a careful working translation, not a certified one.

## Known problems in the original

As printed; none is changed silently in the translation.

1. **§11 IV, quinte (book p. 9).** The text says the point must be so high "that the inner face is *not* covered" (*fedezve ne legyen*). That contradicts the position's purpose (§12: after the quinte the head is protected). Translated as "not left uncovered", with a note.
2. **§12 B (book p. 13).** The counter-parry list is numbered 1, 3, 3, 4, 5. Renumbered 1–5.
3. **§15 I (book p. 17).** The tierce list is numbered 1, 2, 3, 4, 5, 5, 7, 8, 9. The sixth item is numbered 6 here.
4. **§16 A (book p. 18).** The bracketed list of cuts omits the inner-face cut, which B), C) and the example on p. 19 include.
5. **Headings.** The headings of §1 (p. 1) and §11 (p. 8) print the numerals as "I." and "II."; the contents give 1 and 11.
6. **§15, head cut.** The brace puts the head cut with the inner swing, but the example command for tierce uses the outer swing. See the note in Chapter II.

## Rights

The book dates from 1906, but I have not confirmed the author's dates or the reuse terms of the book, of the OSZK scan or of the figures cropped from it. Check this before the translation or the figures are published anywhere (for example on the project's GitHub Pages site). Nothing here is published by the site as it stands: the Pages workflow deploys only `site/`.

## Figures

[`figures/manifest.json`](figures/manifest.json) lists each figure with its file, section, book and PDF page, printed caption (Hungarian) and English caption, and the crop box. Each figure is cut from the single embedded 300 dpi JPEG of its PDF page. To re-create one (for example Fig. 1, on PDF p. 14):

```bash
pdfimages -j -f 14 -l 14 17152.pdf pdf14
# crop_px [x0, y0, x1, y1] from the manifest -> ImageMagick geometry WxH+X+Y
convert pdf14-000.jpg -crop 666x921+421+385 +repage fig-01.jpg
```

The captions of the figures are printed in the book as "(N. ábra)"; Hungarian captions are in the manifest exactly as printed.

## Suggested next steps

- Translate Chapter III (§§17–26, book pp. 20–29): distance, salute, invitations (which §12 depends on), thrusts, cuts, the bind, and the first exercises in pairs.
- Then Chapters IV–V (blade attacks, the parries proper), which §12 B points to (§33, counter-parry).
- Derive postures and exercises from the translation by citing sections and figures, for example "Leszák, *Kardvívás* (1906), §11 IV, Fig. 10".
