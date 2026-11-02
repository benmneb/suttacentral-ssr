# Accessibility

SuttaCentral.now aims to be usable by everyone, including people who use screen readers, keyboards, magnifiers, high contrast or other assistive technology.

## Standard

The site targets [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. This is a goal the site is built and tested against, not a formal claim of conformance.

## How it's checked

Pages are checked by hand with a keyboard, a screen reader, at a phone's width, in light and dark mode, with more contrast and with forced colours. Any page can be checked for valid HTML with the [Nu validator](https://validator.w3.org/nu/) that W3C runs.

The site also:

- Shows every text and core feature without JavaScript
- Follows the system's light or dark mode, contrast setting and forced colours
- Has a skip link on every page

## Known limits

- Hand checks only cover a sample, so not every page has been tested against every criterion
- The texts, notes, dictionary entries and site pages come from [SuttaCentral](https://suttacentral.net)'s data as each page is requested, and there are too many to review each by hand

## Feedback

If anything on the site is hard to use, please let me know in the [issue tracker](https://todo.sr.ht/~benmneb/suttacentral-ssr) (you can submit via email)
