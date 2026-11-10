# Accessibility

SuttaCentral.now aims to be usable by everyone, including people who use screen readers, keyboards, magnifiers, high contrast or other assistive technology.

## Standard

The site targets [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. This is a goal the site is built and tested against, not a formal claim of conformance.

## How it's checked

Pages are checked by hand with a keyboard, at a phone's width, in light and dark mode, with more contrast and with forced colours. A screen reader has only been tried on a few of them.

`pnpm test` also checks a sample of every kind of page, in English and another language:

- It's valid HTML, with no errors or warnings from the [Nu validator](https://validator.w3.org/nu/) that W3C runs, bar text SuttaCentral's data has in an unusual Unicode form
- It has no problems [axe-core](https://github.com/dequelabs/axe-core) can find, by WCAG 2.2 AA and axe's best practices, in light and dark mode and at a phone's width, and none of AAA contrast with more contrast set

The site also:

- Shows every text and core feature without JavaScript
- Follows the system's light or dark mode, contrast setting and forced colours
- Has a skip link on every page
- Keeps motion to scrolling and panning, and leaves it out when reduced motion is set

## Known limits

- The checks only cover a sample, so not every page has been tested against every criterion
- Little of the site has been tried with a screen reader, so its markup and labels are checked by axe-core more than by use. Reports from screen reader users are especially welcome
- The texts, notes, dictionary entries and site pages come from [SuttaCentral](https://suttacentral.net)'s data as each page is requested, and there are too many to review each by hand

## Feedback

If anything on the site is hard to use, please let me know via email: [accessibility@suttacentral.now](mailto:accessibility@suttacentral.now)
