# Security

## Sabre Motion Lab is a static page

Moulinet publishes a single page of HTML, CSS and JavaScript. It has no server
side, no accounts and no storage: a phrase you edit or paste stays in the
page, and is gone when you close it. The page loads nothing but its own files,
so nothing you type is sent anywhere.

Two guards back that up, and the tests check both:

- **Text stays text.** Phrase data is read with `JSON.parse`, and labels and
  pose names reach the page as text (`textContent`). No script builds HTML
  from strings, so a pasted phrase cannot add markup or run code.
- **Content Security Policy.** The page allows scripts, styles, fonts and
  images from its own address only, and no inline scripts or styles, so
  nothing from elsewhere can be loaded or run in it.

## Reporting a vulnerability

Please report privately rather than in a public issue: use **Report a
vulnerability** on the repository's Security tab (GitHub private vulnerability
reporting). Include what an attacker needs, what they get, and a minimal
reproduction.
