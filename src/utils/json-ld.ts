import { siteMetaData } from '~/constants/meta-data'
import { staticPages } from '~/constants/static-pages'
import { t } from '~/i18n'
import { getLanguageName, langTag } from '~/utils/language'
import {
  languageName as siteLanguageName,
  rangeSuttaTitle,
  uidToAcronym,
} from '~/utils/strings'

const SC_ORIGIN = 'https://suttacentral.net'

interface Breadcrumb {
  url?: string
  title: string
}

/** What a page gives `Layout` for its meta description, Open Graph tags and JSON-LD */
export interface PageMetadata {
  title: string
  description: string
  jsonLd: string
}

/** A path on this site as a full URL, encoded as the browser has it */
export function absoluteUrl(path: string) {
  return new URL(`/${path.replace(/^\/+/, '')}`, siteMetaData.origin).href
}

/** The same page on .net */
function scUrl(path: string) {
  return new URL(`/${path.replace(/^\/+/, '')}`, SC_ORIGIN).href
}

export function textFromHtml(html?: string | null) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;| /gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerpt(text: string, length = 160) {
  if (text.length <= length) return text
  const shortened = text.slice(0, length - 1)
  const boundary = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, boundary > 0 ? boundary : shortened.length)}…`
}

/** "Mūlapariyāyasutta (The Root of All Things)", or just the one where there's no other */
function withTranslatedTitle(original?: string, translated?: string) {
  const name = textFromHtml(original)
  const translation = textFromHtml(translated)
  if (!name) return translation
  return translation && translation !== name ? `${name} (${translation})` : name
}

/** A text or collection's title as its page has it, eg "Mūlapariyāyavagga—The Root of All Things", or its acronym if untitled */
function menuTitle(node: any) {
  const name = textFromHtml(node.original_title || node.root_name)
  const translated = textFromHtml(node.translated_title || node.translated_name)
  return (
    [name, translated].filter(Boolean).join('—') || textFromHtml(node.acronym)
  )
}

/** The site, as every page's `isPartOf` */
export function website() {
  return {
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: siteMetaData.title,
    url: absoluteUrl('/'),
  }
}

export const SUTTACENTRAL = {
  '@type': 'Organization',
  name: 'SuttaCentral',
  url: SC_ORIGIN,
}

// Wikipedia articles, as `sameAs`, so search engines can tell who each translator is
const TRANSLATOR_PAGES: Record<string, string> = {
  analayo: 'https://en.wikipedia.org/wiki/Bhikkhu_Analayo',
  beal: 'https://en.wikipedia.org/wiki/Samuel_Beal',
  bodhi: 'https://en.wikipedia.org/wiki/Bhikkhu_Bodhi',
  buddharakkhita: 'https://en.wikipedia.org/wiki/Acharya_Buddharakkhita',
  chalmers: 'https://en.wikipedia.org/wiki/Robert_Chalmers,_1st_Baron_Chalmers',
  horner: 'https://en.wikipedia.org/wiki/Isaline_Blew_Horner',
  narada: 'https://en.wikipedia.org/wiki/Narada_Maha_Thera',
  nyanamoli: 'https://en.wikipedia.org/wiki/Ñāṇamoli_Bhikkhu',
  rockhill: 'https://en.wikipedia.org/wiki/William_Woodville_Rockhill',
  rouse: 'https://en.wikipedia.org/wiki/W._H._D._Rouse',
  sujato: 'https://en.wikipedia.org/wiki/Bhante_Sujato',
  thanissaro: 'https://en.wikipedia.org/wiki/Ṭhānissaro_Bhikkhu',
  tw_rhysdavids: 'https://en.wikipedia.org/wiki/Thomas_William_Rhys_Davids',
  woodward: 'https://en.wikipedia.org/wiki/F._L._Woodward',
}

/** A translator, linked to their Wikipedia article if they have one */
function person(name: string, uid: string) {
  return {
    '@type': 'Person',
    name: textFromHtml(name),
    identifier: uid,
    ...(TRANSLATOR_PAGES[uid] && { sameAs: TRANSLATOR_PAGES[uid] }),
  }
}

/** The edition a root text comes from, which SuttaCentral lists where a translation has its translator */
function edition(name: string, uid: string) {
  return { '@type': 'CreativeWork', name: textFromHtml(name), identifier: uid }
}

/** The work a text is an edition or translation of, as its suttaplex page describes it */
function workId(uid: string) {
  return `${absoluteUrl(uid)}#work`
}

/** A text, as distinct from the page it's on */
function textId(path: string) {
  return `${absoluteUrl(path)}#text`
}

/** The page's crumbs from Home, the last being the page itself. A crumb with no page is left out, as each needs an `item` */
export function breadcrumbList(
  locale: string,
  crumbs: Breadcrumb[],
  path: string
) {
  const items = [
    { title: t(locale, 'interface:home'), url: '/' },
    ...crumbs.map((crumb, i) => ({
      title: crumb.title,
      url: i === crumbs.length - 1 ? path : crumb.url,
    })),
  ].filter(crumb => crumb.url)
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: textFromHtml(crumb.title),
      item: absoluteUrl(crumb.url!),
    })),
  }
}

export function jsonLd(data: Record<string, any>) {
  return (
    JSON.stringify({ '@context': 'https://schema.org', ...data })
      // A "</script>" in any text would end the script element early
      .replace(/</g, '\\u003c')
  )
}

/** A language's name: SuttaCentral's own for the root languages, as Intl doesnt know them all */
function languageName(lang: string, locale: string) {
  const key = `interface:${lang}`
  const name = t(locale, key)
  return name === key
    ? getLanguageName(langTag(lang), locale)
    : siteLanguageName(name)
}

export function homeMetadata(locale: string, tipitaka: any[]): PageMetadata {
  const title = textFromHtml(t(locale, 'home:1'))
  const description = `${siteMetaData.description}. ${t(locale, 'meta:homeDescription')}`
  const { maintainer, mirrors, source } = siteMetaData
  const home = absoluteUrl('/')
  return {
    title,
    description,
    jsonLd: jsonLd({
      '@graph': [
        {
          ...website(),
          alternateName: 'SCX',
          sameAs: [source, ...mirrors],
          description,
          inLanguage: langTag(locale),
          isBasedOn: {
            '@type': 'WebSite',
            name: 'SuttaCentral',
            url: SC_ORIGIN,
          },
          maintainer: { '@type': 'Person', ...maintainer },
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${absoluteUrl('/search')}?query={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'CollectionPage',
          '@id': home,
          name: title,
          description,
          url: home,
          sameAs: SC_ORIGIN,
          inLanguage: langTag(locale),
          isPartOf: { '@id': website()['@id'] },
          about: {
            '@type': 'Thing',
            name: 'Tipiṭaka',
            description: 'The three baskets of the Buddhist canon',
          },
          hasPart: tipitaka.map(item => ({
            '@type': 'Collection',
            '@id': absoluteUrl(`/pitaka/${item.uid}`),
            name: menuTitle(item),
            ...(item.blurb && { description: textFromHtml(item.blurb) }),
            url: absoluteUrl(`/pitaka/${item.uid}`),
            sameAs: scUrl(`/pitaka/${item.uid}`),
          })),
        },
      ],
    }),
  }
}

/** A collection's description: its blurb, or else which collection it is */
function collectionDescription(locale: string, node: any) {
  return (
    textFromHtml(node.blurb) ||
    t(locale, 'meta:collection', {
      name: withTranslatedTitle(
        node.original_title || node.root_name,
        node.translated_title || node.translated_name
      ),
    })
  )
}

/** A /pitaka page, which lists the collections under it */
export function pitakaMetadata(
  locale: string,
  menuData: any,
  path: string,
  crumbs: Breadcrumb[]
): PageMetadata {
  const url = absoluteUrl(path)
  const title = menuTitle(menuData)
  const description = collectionDescription(locale, menuData)
  return {
    title,
    description,
    jsonLd: jsonLd({
      '@type': 'CollectionPage',
      '@id': url,
      name: title,
      description,
      url,
      sameAs: scUrl(path),
      identifier: menuData.uid,
      inLanguage: langTag(locale),
      isPartOf: website(),
      publisher: SUTTACENTRAL,
      about: { '@type': 'Thing', name: 'Buddhism' },
      breadcrumb: breadcrumbList(locale, crumbs, path),
      ...(menuData.children?.length && {
        hasPart: menuData.children.map((child: any) => {
          const childUrl = absoluteUrl(
            child._scx_href ?? `${path}/${child.uid}`
          )
          return {
            '@type': 'Collection',
            '@id': childUrl,
            name: menuTitle(child),
            url: childUrl,
          }
        }),
      }),
    }),
  }
}

/** A chapter's page, which lists its texts */
export function chapterMetadata(
  locale: string,
  suttaplexData: any[],
  uid: string,
  crumbs: Breadcrumb[]
): PageMetadata {
  const [entry, ...children] = suttaplexData
  const path = `/${uid}`
  const url = absoluteUrl(path)
  const title = menuTitle(entry) || uid
  const description = collectionDescription(locale, entry)
  return {
    title,
    description,
    jsonLd: jsonLd({
      '@type': 'CollectionPage',
      '@id': url,
      name: title,
      description,
      url,
      sameAs: scUrl(path),
      identifier: entry.uid,
      inLanguage: langTag(locale),
      isPartOf: website(),
      publisher: SUTTACENTRAL,
      about: { '@type': 'Thing', name: 'Buddhism' },
      breadcrumb: breadcrumbList(locale, crumbs, path),
      ...(children.length && {
        hasPart: children.map(child => ({
          '@type': 'CreativeWork',
          '@id':
            child.type === 'leaf' ? workId(child.uid) : absoluteUrl(child.uid),
          name: menuTitle(child),
          ...(child.acronym && { alternateName: textFromHtml(child.acronym) }),
          url: absoluteUrl(child.uid),
        })),
      }),
    }),
  }
}

/**
 * A text's suttaplex page, which describes the work, with its root editions and translations
 * @param uid - The page's uid, which for a sutta of a range isn't the suttaplex's own
 */
export function suttaplexMetadata(
  locale: string,
  entry: any,
  uid: string,
  crumbs: Breadcrumb[],
  isIndividualRangeSutta: boolean
): PageMetadata {
  const path = `/${uid}`
  const url = absoluteUrl(path)
  const acronym = isIndividualRangeSutta
    ? uidToAcronym(uid)
    : textFromHtml(entry.acronym)
  const workName = textFromHtml(entry.original_title || entry.root_name)
  const translatedName = textFromHtml(
    entry.translated_title || entry.translated_name
  )
  const title = isIndividualRangeSutta
    ? rangeSuttaTitle(entry.title, uid)
    : menuTitle(entry) || uid
  const blurb = textFromHtml(entry.blurb)
  const description =
    blurb ||
    t(locale, 'meta:suttaplex', {
      name: isIndividualRangeSutta
        ? acronym
        : `${acronym} ${withTranslatedTitle(workName, translatedName)}`.trim(),
    })
  const translations: any[] = entry.translations ?? []

  const editionOf = (translation: any) => {
    const textUid =
      isIndividualRangeSutta && translation.segmented ? uid : entry.uid
    const textPath = `/${textUid}/${translation.lang}/${translation.author_uid}`
    const author = textFromHtml(translation.author || translation.author_uid)
    const work = isIndividualRangeSutta ? acronym : workName || acronym
    return {
      '@type': 'CreativeWork',
      '@id': textId(textPath),
      name: author ? `${work}—${author}` : work,
      url: absoluteUrl(textPath),
      sameAs: scUrl(textPath),
      inLanguage: langTag(translation.lang),
      ...(author &&
        (translation.is_root
          ? { isBasedOn: edition(author, translation.author_uid) }
          : { translator: person(author, translation.author_uid) })),
      ...(translation.publication_date && {
        datePublished: translation.publication_date,
      }),
    }
  }
  const roots = translations.filter(translation => translation.is_root)
  const others = translations.filter(translation => !translation.is_root)

  return {
    title,
    description,
    jsonLd: jsonLd({
      '@type': 'ItemPage',
      '@id': url,
      name: title,
      description,
      url,
      sameAs: scUrl(path),
      inLanguage: langTag(locale),
      isPartOf: website(),
      breadcrumb: breadcrumbList(locale, crumbs, path),
      mainEntity: {
        '@type': 'CreativeWork',
        '@id': workId(uid),
        name: isIndividualRangeSutta ? acronym : workName,
        ...(!isIndividualRangeSutta && {
          alternateName: [translatedName, acronym].filter(Boolean),
        }),
        ...(blurb && { description: blurb }),
        identifier: uid,
        url,
        sameAs: scUrl(path),
        ...(entry.root_lang && { inLanguage: langTag(entry.root_lang) }),
        publisher: SUTTACENTRAL,
        about: { '@type': 'Thing', name: 'Buddhism' },
        ...(roots.length && { workExample: roots.map(editionOf) }),
        ...(others.length && { workTranslation: others.map(editionOf) }),
      },
    }),
  }
}

/**
 * The licence the text's info popover gives: its publication's own, or else the one its legacy footer links to
 * @returns The licence's URL
 */
function licenseOf(publication: any, html?: string) {
  const own = publication?.license?.license_url
  if (own) return own.trim()
  const footer = html?.match(/<footer[\s\S]*<\/footer>/i)?.[0]
  if (!footer) return
  const links = [...footer.matchAll(/<a\b[^>]*>/gi)].map(([tag]) => ({
    href: tag.match(/\bhref=["']([^"']+)["']/i)?.[1],
    rel: tag.match(/\brel=["']([^"']+)["']/i)?.[1],
  }))
  const license =
    links.find(link => link.href && /\blicense\b/i.test(link.rel ?? '')) ??
    links.find(link =>
      /creativecommons\.org\/(?:licenses|publicdomain)\//i.test(link.href ?? '')
    )
  return license?.href
}

interface TextPage {
  suttasData: any
  suttaplexEntry: any
  publication: any
  crumbs: Breadcrumb[]
  /** The text's language and author, as in its path */
  lang: string
  authorUid: string
  /** The uid in its path */
  uid: string
  /** The suttaplex page of the work it's a text of */
  workUid: string
  /** The acronym the page shows, eg "AN 1.3" for a sutta of a range */
  acronym: string
  /** A sutta of a range, which has no name of its own, only the range's */
  isIndividualRangeSutta: boolean
}

/** A root text or translation's page, eg "MN 1: Mūlapariyāyasutta (The Root of All Things)—Bhikkhu Sujato" */
export function textMetadata(
  locale: string,
  {
    suttasData,
    suttaplexEntry: entry,
    publication,
    crumbs,
    lang,
    authorUid,
    uid,
    workUid,
    acronym: shownAcronym,
    isIndividualRangeSutta,
  }: TextPage
): PageMetadata {
  const acronym = textFromHtml(shownAcronym)
  const path = `/${uid}/${lang}/${authorUid}`
  const url = absoluteUrl(path)
  const text = suttasData.translation ?? suttasData.root_text
  const isRoot = lang === entry.root_lang
  const author = textFromHtml(text?.author)
  const translatedTitle = textFromHtml(
    isRoot ? entry.translated_title || entry.translated_name : text?.title
  )
  const titles = isRoot
    ? textFromHtml(entry.original_title) || translatedTitle
    : withTranslatedTitle(entry.original_title, translatedTitle)
  const title = `${acronym}${!isIndividualRangeSutta && titles ? `: ${titles}` : ''}${author ? `—${author}` : ''}`
  const name = isIndividualRangeSutta
    ? t(locale, 'meta:rangeSutta', { acronym, range: titles })
    : `${acronym} ${titles}`.trim()
  const language = languageName(lang, locale)
  const description =
    textFromHtml(entry.blurb) ||
    t(
      locale,
      `meta:${isRoot ? 'rootText' : 'translation'}${author ? 'By' : ''}`,
      { name, language, author }
    )
  const license = licenseOf(publication, text?.text)
  const publicationDate = entry.translations?.find(
    (translation: any) =>
      translation.lang === lang && translation.author_uid === authorUid
  )?.publication_date

  const work = {
    '@type': 'CreativeWork',
    '@id': workId(workUid),
    name: isIndividualRangeSutta
      ? acronym
      : textFromHtml(entry.root_name || entry.original_title),
    url: absoluteUrl(workUid),
    inLanguage: langTag(entry.root_lang),
  }
  // A WebPage around the text, as only a WebPage takes a breadcrumb
  return {
    title,
    description,
    jsonLd: jsonLd({
      '@type': 'WebPage',
      '@id': url,
      name: title,
      description,
      url,
      sameAs: scUrl(path),
      inLanguage: langTag(lang),
      isPartOf: website(),
      breadcrumb: breadcrumbList(locale, crumbs, path),
      mainEntity: {
        '@type': 'CreativeWork',
        '@id': textId(path),
        name: isIndividualRangeSutta
          ? acronym
          : textFromHtml(entry.original_title) || translatedTitle,
        ...(!isIndividualRangeSutta && {
          alternateName: [acronym, translatedTitle].filter(Boolean),
        }),
        url,
        sameAs: scUrl(path),
        identifier: uid,
        inLanguage: langTag(lang),
        ...(author &&
          (isRoot
            ? { isBasedOn: edition(author, authorUid) }
            : { translator: person(author, authorUid) })),
        ...(publicationDate && { datePublished: publicationDate }),
        publisher: SUTTACENTRAL,
        ...(license && { license }),
        about: { '@type': 'Thing', name: 'Buddhism' },
        ...(isRoot ? { exampleOfWork: work } : { translationOfWork: work }),
      },
    }),
  }
}

/** The site pages' schema.org types, other than WebPage */
const SITE_PAGE_TYPES: Record<string, string> = {
  '/about': 'AboutPage',
  '/abbreviations': 'CollectionPage',
  '/editions': 'CollectionPage',
  '/languages': 'CollectionPage',
  ...Object.fromEntries(
    staticPages.indexes.map(({ href }) => [href, 'CollectionPage'])
  ),
}

/** The guides and essays, as articles, by their byline's keys */
const SCHOLARLY_PAGES: Record<
  string,
  { bylineKeys: string[]; about: string[]; keywords: string[] }
> = {
  '/abhidhamma-guide-sujato': {
    bylineKeys: ['abhidhamma:2'],
    about: ['Abhidhamma', 'Buddhist philosophy'],
    keywords: [
      'Abhidhamma',
      'Systematic Treatise',
      'Buddhist philosophy',
      'Pāli Canon',
    ],
  },
  '/an-guide-sujato': {
    bylineKeys: ['an-guide-sujato:2'],
    about: ['Aṅguttara Nikāya', 'Buddhist discourses'],
    keywords: [
      'Aṅguttara Nikāya',
      'Numbered Discourses',
      'Buddhist discourses',
      'Pāli Canon',
    ],
  },
  '/an-introduction-bodhi': {
    bylineKeys: ['an-introduction-bodhi:2'],
    about: ['Aṅguttara Nikāya', 'Buddhist discourses'],
    keywords: [
      'Aṅguttara Nikāya',
      'Numerical Discourses',
      'Buddhist discourses',
      'Pāli Canon',
    ],
  },
  '/discourses-guide-sujato': {
    bylineKeys: ['discourses:2'],
    about: ['Early Buddhist texts', 'Buddhist discourses'],
    keywords: [
      'Early Buddhist texts',
      'Suttas',
      'Buddhist discourses',
      'Pāli Canon',
    ],
  },
  '/dn-guide-sujato': {
    bylineKeys: ['dn-guide-sujato:2'],
    about: ['Dīgha Nikāya', 'Buddhist discourses'],
    keywords: [
      'Dīgha Nikāya',
      'Long Discourses',
      'Buddhist discourses',
      'Pāli Canon',
    ],
  },
  '/general-guide-sujato': {
    bylineKeys: ['general-guide-sujato:2'],
    about: ['Early Buddhist texts', 'Pāli Canon'],
    keywords: ['Early Buddhist texts', 'Buddhist texts', 'Pāli Canon'],
  },
  '/mn-guide-sujato': {
    bylineKeys: ['mn-guide-sujato:2'],
    about: ['Majjhima Nikāya', 'Buddhist discourses'],
    keywords: [
      'Majjhima Nikāya',
      'Middle Discourses',
      'Buddhist discourses',
      'Pāli Canon',
    ],
  },
  '/methodology': {
    bylineKeys: ['methodology:16', 'methodology:33'],
    about: ['Textual studies', 'Early Buddhist texts'],
    keywords: ['Textual studies', 'Textual parallels', 'Early Buddhist texts'],
  },
  '/sn-guide-sujato': {
    bylineKeys: ['sn-guide-sujato:2'],
    about: ['Saṁyutta Nikāya', 'Buddhist discourses'],
    keywords: [
      'Saṁyutta Nikāya',
      'Linked Discourses',
      'Buddhist discourses',
      'Pāli Canon',
    ],
  },
  '/vinaya-guide-brahmali': {
    bylineKeys: ['vinaya:2'],
    about: ['Vinaya', 'Buddhist monastic discipline'],
    keywords: ['Vinaya', 'Buddhist monastic discipline', 'Pāli Canon'],
  },
}

/** A guide or essay's authors and year, from its English bylines, eg "Rod Bucknell, updated by Sujato" */
function scholarlyData(path: string) {
  const article = SCHOLARLY_PAGES[path]
  if (!article) return {}

  const authors = new Set<string>()
  let datePublished: string | undefined
  for (const key of article.bylineKeys) {
    const byline = textFromHtml(t('en', key))
    datePublished ??= byline.match(/\b(?:18|19|20)\d{2}\b/)?.[0]
    byline
      .replace(/,\s*(?:18|19|20)\d{2}\b/g, '')
      .replace(/,\s*updated by\s+/gi, ';')
      .split(/\s*;\s*/)
      .map(name => name.trim())
      .filter(Boolean)
      .forEach(name => authors.add(name))
  }

  return {
    '@type': 'ScholarlyArticle',
    author: [...authors].map(name => ({ '@type': 'Person', name })),
    ...(datePublished && { datePublished }),
    about: article.about.map(name => ({ '@type': 'Thing', name })),
    keywords: article.keywords,
    publisher: SUTTACENTRAL,
  }
}

interface SitePage {
  description?: string
  /** Its crumbs, as the page shows them, if it has more than its own */
  crumbs?: Breadcrumb[]
  /** Any more schema.org properties, which may override its `@type` */
  [property: string]: any
}

/**
 * A site page, eg /about, whose description is `meta:<its path>` unless it has one of its own
 * @param path - The page's path, eg "/about"
 */
export function sitePageMetadata(
  locale: string,
  path: string,
  title: string,
  { description, crumbs, ...properties }: SitePage = {}
): PageMetadata {
  const url = absoluteUrl(path)
  const pageTitle = textFromHtml(title)
  const pageDescription = textFromHtml(
    description ??
      t(locale, `meta:${path.slice(1)}`, { site: siteMetaData.title })
  )
  const data: Record<string, any> = {
    '@type': SITE_PAGE_TYPES[path] ?? 'WebPage',
    ...scholarlyData(path),
    ...properties,
  }
  return {
    title: pageTitle,
    description: pageDescription,
    jsonLd: jsonLd({
      '@type': data['@type'],
      '@id': url,
      ...([data['@type']].flat().includes('ScholarlyArticle')
        ? { headline: pageTitle }
        : { name: pageTitle }),
      description: pageDescription,
      url,
      sameAs: scUrl(path),
      inLanguage: langTag(locale),
      isPartOf: website(),
      breadcrumb: breadcrumbList(
        locale,
        crumbs ?? [{ title: pageTitle }],
        path
      ),
      ...data,
    }),
  }
}

/** A matter page's first paragraph of prose: not the title, byline or contents it may start with */
function firstParagraph(html: string) {
  const body = html
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(
      /<p\b[^>]*\bclass=['"][^'"]*\bbyline\b[^'"]*['"][^>]*>[\s\S]*?<\/p>/gi,
      ' '
    )
  const paragraph = body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]
  return excerpt(textFromHtml(paragraph ?? body))
}

interface Edition {
  path: string
  title: string
  publication: any
  crumbs: Breadcrumb[]
  /** Where the edition's text is read */
  readPath: string
  cover: string
  isbn: string[]
  dateModified?: string | null
}

/** An edition's page, as the book it is */
export function editionMetadata(
  locale: string,
  pageTitle: string,
  edition: Edition
): PageMetadata {
  const { publication } = edition
  const author = { '@type': 'Person', name: publication.creator_name }
  return sitePageMetadata(locale, edition.path, pageTitle, {
    description:
      textFromHtml(publication.text_description) ||
      t(locale, 'meta:edition', {
        title: edition.title,
        translator: publication.creator_name,
      }),
    crumbs: edition.crumbs,
    '@type': ['WebPage', 'Book'],
    name: [edition.title, publication.translation_subtitle]
      .filter(Boolean)
      .join('—'),
    author,
    ...(publication.translation_lang_iso !== 'pli' && { translator: author }),
    ...(publication.first_published && {
      datePublished: publication.first_published,
    }),
    ...(edition.dateModified && { dateModified: edition.dateModified }),
    inLanguage: langTag(publication.translation_lang_iso || 'en'),
    publisher: SUTTACENTRAL,
    ...(publication.license_url && { license: publication.license_url }),
    image: edition.cover,
    potentialAction: {
      '@type': 'ReadAction',
      target: absoluteUrl(edition.readPath),
    },
    ...(edition.isbn.length && {
      isbn: edition.isbn.length === 1 ? edition.isbn[0] : edition.isbn,
    }),
    isBasedOn: {
      '@type': 'Book',
      name: publication.root_title || publication.text_uid,
      inLanguage: 'pi',
    },
  })
}

/** A page of an edition's front matter, as a chapter of its book */
export function matterMetadata(
  locale: string,
  pageTitle: string,
  {
    path,
    bookPath,
    bookTitle,
    label,
    html,
    lang,
    crumbs,
  }: {
    path: string
    bookPath: string
    bookTitle: string
    label: string
    html: string
    lang: string
    crumbs: Breadcrumb[]
  }
): PageMetadata {
  const url = absoluteUrl(path)
  const book = {
    '@type': 'Book',
    '@id': absoluteUrl(bookPath),
    name: bookTitle,
  }
  return sitePageMetadata(locale, path, pageTitle, {
    description: firstParagraph(html),
    crumbs,
    isPartOf: book,
    hasPart: {
      '@type': 'Chapter',
      '@id': `${url}#chapter`,
      name: label,
      url,
      isPartOf: book,
      inLanguage: langTag(lang),
    },
  })
}

interface DictionaryEntry {
  dictname: string
  definition?: string | string[] | null
  text?: string | null
  xr?: string | string[] | null
}

/** A DPPN entry's other names for the word, in its dts */
function aliasesOf(entry: DictionaryEntry, word: string) {
  if (entry.dictname !== 'dppn' || !entry.text) return []
  const names = [...entry.text.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gi)].map(
    ([, html]) => textFromHtml(html)
  )
  return [...new Set(names)].filter(
    name => name && name.toLocaleLowerCase() !== word.toLocaleLowerCase()
  )
}

/** What a dictionary says of the word, as plain text, without the names and map a DPPN entry starts with */
function descriptionsOf(entry: DictionaryEntry) {
  return [
    ...[entry.definition ?? []].flat(),
    entry.text
      ?.replace(/<dt\b[\s\S]*?<\/dt>/gi, '')
      .replace(/<sc-map\b[^>]*><\/sc-map>,?/gi, ''),
    ...[entry.xr ?? []].flat(),
  ]
    .map(textFromHtml)
    .filter(Boolean)
}

/** A definition without the headword DPD starts each with, eg "dhamma 1.01: masc. nature" */
function withoutHeadword(entry: DictionaryEntry, definition: string) {
  if (entry.dictname !== 'dpd') return definition
  return definition.match(/^[^:]+:\s*(.+)$/s)?.[1] ?? definition
}

/** The first definition any dictionary gives the word */
function firstDefinition(entries: DictionaryEntry[]) {
  for (const entry of entries) {
    const [definition] = descriptionsOf(entry)
    if (definition) return excerpt(withoutHeadword(entry, definition))
  }
}

/** A /define page, around the word it defines, or the dictionary's own */
export function defineMetadata(
  locale: string,
  word: string | undefined,
  entries: DictionaryEntry[],
  titles: Record<string, string>
): PageMetadata {
  const define = { title: t(locale, 'dictionary:define'), url: '/define' }
  if (!word) {
    return sitePageMetadata(locale, '/define', define.title, {
      description: t(locale, 'dictionary:description'),
      '@type': 'CollectionPage',
    })
  }

  const path = `/define/${word}`
  const url = absoluteUrl(path)
  const description =
    firstDefinition(entries) ??
    `${t(locale, 'dictionary:dictionaryResultsText')} “${word}”`
  return sitePageMetadata(
    locale,
    path,
    `${t(locale, 'dictionary:definitionsFor')} ${word}`,
    {
      description,
      crumbs: [define, { title: word }],
      mainEntity: {
        '@type': 'DefinedTerm',
        '@id': `${url}#term`,
        name: word,
        description,
        url,
        sameAs: scUrl(path),
        inLanguage: 'pi',
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'SuttaCentral Pāli dictionaries',
          url: absoluteUrl('/define'),
          sameAs: scUrl('/define'),
        },
      },
      // As `about`, as `hasPart` only takes the parts of a CreativeWork, which a DefinedTerm isn't
      about: entries.flatMap(entry => {
        const descriptions = descriptionsOf(entry)
        if (!descriptions.length) return []
        const title = titles[entry.dictname] ?? entry.dictname
        const aliases = aliasesOf(entry, word)
        return {
          '@type': 'DefinedTerm',
          name: `${word} (${title})`,
          description: excerpt(descriptions.join(' ')),
          inDefinedTermSet: { '@type': 'DefinedTermSet', name: title },
          ...(aliases.length && { alternateName: aliases }),
        }
      }),
    }
  )
}

interface MapLayer {
  label: string
  ordered?: boolean
  places: { id: string; name: string; define?: string; route?: boolean }[]
}

/** /map, made of its poster, its interactive map and its index of places, each place by its /define page */
export function mapMetadata(
  locale: string,
  title: string,
  layers: MapLayer[],
  poster: { src: string; width: number; height: number }
): PageMetadata {
  const lists = layers.map(({ label, ordered, places }) => {
    const items = places
      .filter(place => !place.route)
      .map(place => ({
        '@type': 'Place',
        // Without the number a journey puts before each stop, as "1) Rājagaha"
        name: place.name.trim().replace(/^\d+\)\s*/, ''),
        ...(place.define && { url: absoluteUrl(`/define/${place.define}`) }),
        sameAs: absoluteUrl(`/map#${place.id}`),
      }))
    return {
      '@type': 'ItemList',
      name: textFromHtml(label),
      numberOfItems: items.length,
      ...(ordered && { itemListOrder: 'ItemListOrderAscending' }),
      // A journey's stops need a position, which only a ListItem gives
      itemListElement: ordered
        ? items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item,
          }))
        : items,
    }
  })
  return sitePageMetadata(locale, '/map', title, {
    hasPart: [
      {
        '@type': 'ImageObject',
        name: textFromHtml(t(locale, 'map:2')),
        description: textFromHtml(t(locale, 'map:3')),
        url: poster.src,
        encodingFormat: 'image/jpeg',
        width: poster.width,
        height: poster.height,
      },
      {
        '@type': 'InteractiveResource',
        name: textFromHtml(t(locale, 'map:4')),
        description: t(locale, 'meta:mapInteractive'),
        url: absoluteUrl('/map'),
        encodingFormat: 'image/svg+xml',
      },
      {
        '@type': 'Table',
        name: t(locale, 'meta:mapIndex'),
        // Lists, as `hasPart` only takes the parts of a CreativeWork, and places are Things
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: lists.reduce(
            (count, list) => count + list.numberOfItems,
            0
          ),
          itemListElement: lists,
        },
      },
    ],
    spatialCoverage: {
      '@type': 'Place',
      name: 'India',
      description: 'India during the time of the Buddha',
    },
    temporalCoverage: '6th–5th century BCE',
    about: [
      { '@type': 'Thing', name: 'Buddhism in Ancient India' },
      { '@type': 'Thing', name: 'Mahajanapadas' },
    ],
  })
}
