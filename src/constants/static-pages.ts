import { icon } from '~/constants/heroicons'
import { SC_ORIGIN } from '~/constants/urls'

/** A static page's path and the translation key of its link text */
export interface StaticPage {
  href: string
  label: string
}

/** The static pages in .net's nav groups, plus /start */
export const staticPages = {
  guides: [
    { href: '/general-guide-sujato', label: 'interface:general' },
    { href: '/dn-guide-sujato', label: 'interface:long' },
    { href: '/mn-guide-sujato', label: 'interface:middle' },
    { href: '/sn-guide-sujato', label: 'interface:linked' },
    { href: '/an-guide-sujato', label: 'interface:numbered' },
  ],
  essays: [
    { href: '/discourses-guide-sujato', label: 'interface:discourses' },
    { href: '/vinaya-guide-brahmali', label: 'interface:vinaya' },
    { href: '/abhidhamma-guide-sujato', label: 'interface:abhidhamma' },
  ],
  misc: [
    { href: '/introduction', label: 'interface:introduction' },
    { href: '/start', label: 'interface:start' },
    {
      href: `${SC_ORIGIN}/donations`,
      label: 'interface:donations',
    },
    { href: '/map', label: 'interface:map' },
    { href: '/offline', label: 'interface:offline' },
  ],
  meta: [
    { href: '/acknowledgments', label: 'interface:acknowledgments' },
    { href: '/licensing', label: 'interface:licensing' },
    { href: '/about', label: 'interface:about' },
  ],
  tech: [
    { href: '/languages', label: 'interface:languages' },
    { href: '/numbering', label: 'interface:numbering' },
    { href: '/abbreviations', label: 'interface:abbreviations' },
    { href: '/methodology', label: 'interface:methodology' },
    { href: '/define', label: 'interface:defineHeading' },
  ],
  indexes: [
    { href: '/subjects', label: 'interface:subjects' },
    { href: '/similes', label: 'interface:similes' },
    { href: '/names', label: 'interface:names' },
    { href: '/terminology', label: 'interface:terminology' },
    { href: '/pali-tipitaka', label: 'interface:canonOverview' },
  ],
} satisfies Record<string, StaticPage[]>

/** The site map groups in the header menu */
export const siteMap: { label: string; pages: StaticPage[] }[] = [
  {
    label: 'interface:pagesExplore',
    pages: [
      ...staticPages.misc,
      { href: '/editions', label: 'publication:editionsToolbarTitle' },
    ],
  },
  { label: 'interface:pagesGuides', pages: staticPages.guides },
  { label: 'interface:pagesEssays', pages: staticPages.essays },
  { label: 'interface:pagesIndexes', pages: staticPages.indexes },
  { label: 'interface:pagesReference', pages: staticPages.tech },
  { label: 'interface:pagesAbout', pages: staticPages.meta },
]

/**
 * Each pitaka page's guides, as translation key prefixes of their title
 * (`:1`) and byline (`:2`)
 */
export const pitakaGuides: Record<string, StaticPage[]> = {
  sutta: [
    { href: '/general-guide-sujato', label: 'general-guide-sujato' },
    { href: '/discourses-guide-sujato', label: 'discourses' },
  ],
  vinaya: [{ href: '/vinaya-guide-brahmali', label: 'vinaya' }],
  abhidhamma: [{ href: '/abhidhamma-guide-sujato', label: 'abhidhamma' }],
  dn: [{ href: '/dn-guide-sujato', label: 'dn-guide-sujato' }],
  mn: [{ href: '/mn-guide-sujato', label: 'mn-guide-sujato' }],
  sn: [{ href: '/sn-guide-sujato', label: 'sn-guide-sujato' }],
  an: [
    { href: '/an-guide-sujato', label: 'an-guide-sujato' },
    { href: '/an-introduction-bodhi', label: 'an-introduction-bodhi' },
  ],
}

/** Each page's icon by its path, as in .net's more menu, for any link to it */
export const pageIcons: Record<string, string> = {
  '/introduction': icon('lightBulb'),
  '/start': icon('flag'),
  [`${SC_ORIGIN}/donations`]: icon('heart'),
  '/map': icon('map'),
  '/offline': icon('bolt'),
  '/editions': icon('bookOpen'),
  '/general-guide-sujato': icon('academicCap'),
  '/dn-guide-sujato': icon('academicCap'),
  '/mn-guide-sujato': icon('academicCap'),
  '/sn-guide-sujato': icon('academicCap'),
  '/an-guide-sujato': icon('academicCap'),
  '/an-introduction-bodhi': icon('academicCap'),
  '/discourses-guide-sujato': icon('documentText'),
  '/vinaya-guide-brahmali': icon('documentText'),
  '/abhidhamma-guide-sujato': icon('documentText'),
  '/pali-tipitaka': icon('rectangleStack'),
  '/subjects': icon('tag'),
  '/similes': icon('sparkles'),
  '/names': icon('identification'),
  '/terminology': icon('chatBubbleBottomCenterText'),
  '/languages': icon('language'),
  '/numbering': icon('numberedList'),
  '/abbreviations': icon('scissors'),
  '/methodology': icon('beaker'),
  '/define': icon('bookOpen'),
  '/acknowledgments': icon('users'),
  '/licensing': icon('scale'),
  '/about': icon('informationCircle'),
}
