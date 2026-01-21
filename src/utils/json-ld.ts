import { siteMetaData } from '~/constants/meta-data'

interface Breadcrumb {
  url: string
  title: string
}

function getPublisherSchema() {
  return {
    '@type': 'Organization',
    '@id': '/#organization',
    name: 'SuttaCentral',
    url: '/',
    description: 'Early Buddhist texts, translations, and parallels',
    foundingDate: '2012',
    sameAs: ['https://suttacentral.net', 'https://github.com/suttacentral'],
  }
}

function buildBreadcrumbList(breadcrumbs: Breadcrumb[], currentPath: string) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: '/',
    },
  ]

  breadcrumbs?.forEach((crumb, index) => {
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: crumb.title,
      item: crumb.url,
    })
  })

  return {
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

function formatName(rootName?: string, translatedName?: string): string {
  if (rootName && translatedName) {
    return `${rootName}—${translatedName}`
  }
  return rootName || translatedName || ''
}

export function generateIndexJsonLd(tipitaka: any[], origin: string) {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': '/#website',
      name: siteMetaData.title,
      alternateName: 'SCX',
      description: `${siteMetaData.description} - Early Buddhist texts, translations, and parallels. The largest collection of Buddhist suttas available in translation.`,
      url: '/',
      sameAs: ['https://suttacentral.net', 'https://suttacentral.express'],
      inLanguage: 'en',
      keywords: [
        'Buddhism',
        'Buddhist texts',
        'Pali Canon',
        'Tipitaka',
        'suttas',
        'dharma',
        'ancient texts',
        'translations',
      ],
      about: {
        '@type': 'Thing',
        name: 'Buddhist Canon',
        description:
          'The Tipitaka (Three Baskets) - the traditional term for the Buddhist canon',
      },
      mainEntity: {
        '@type': 'CollectionPage',
        name: 'Tipitaka—the Three Baskets of the Buddhist canon',
        description:
          'Collection of the three main divisions of the Buddhist canon: Vinaya Pitaka, Sutta Pitaka, and Abhidhamma Pitaka',
        hasPart: tipitaka.map(item => ({
          '@type': 'Collection',
          '@id': `/pitaka/${item.uid}`,
          name: formatName(item.root_name, item.translated_name),
          description: item.blurb,
          url: `${origin}/pitaka/${item.uid}`,
          sameAs: [
            `https://suttacentral.net/pitaka/${item.uid}`,
            `https://suttacentral.express/pitaka/${item.uid}`,
          ],
          identifier: item.uid,
          isPartOf: {
            '@id': '/#website',
          },
        })),
      },
      publisher: getPublisherSchema(),
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: '/',
          },
        ],
      },
    },
    null,
    2
  )
}

export function generateChapterJsonLd(
  suttaplexData: any[],
  chapter: string,
  breadcrumbs: Breadcrumb[],
  origin: string
) {
  const entry = suttaplexData[0]
  const currentPath = `/${chapter}`

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': currentPath,
      name: formatName(
        entry.original_title || entry.root_name,
        entry.translated_title || entry.translated_name
      ),
      description:
        entry.blurb || 'Collection of Buddhist texts and translations',
      url: `${origin}${currentPath}`,
      sameAs: [
        `https://suttacentral.net${currentPath}`,
        `https://suttacentral.express${currentPath}`,
      ],
      identifier: entry.uid,
      inLanguage: [
        {
          '@type': 'Language',
          name: 'English',
          alternateName: 'en',
        },
        ...(entry.root_lang
          ? [
              {
                '@type': 'Language',
                name: entry.root_lang,
                alternateName: entry.root_lang,
              },
            ]
          : []),
      ],
      about: {
        '@type': 'Thing',
        name: 'Buddhist Literature',
        description: 'Ancient Buddhist texts, suttas, and modern translations',
      },
      isPartOf: {
        '@type': 'WebSite',
        '@id': '/#website',
        name: 'SuttaCentral',
      },
      ...(suttaplexData.length > 1 && {
        hasPart: suttaplexData.slice(1).map(child => ({
          '@type': 'CreativeWork',
          '@id': `/${child.uid}`,
          name: formatName(
            child.original_title || child.root_name,
            child.translated_title || child.translated_name
          ),
          description: child.blurb,
          identifier: child.uid,
          sameAs: [
            `https://suttacentral.net/${child.uid}`,
            `https://suttacentral.express/${child.uid}`,
          ],
          ...(child.acronym && {
            alternateName: child.acronym,
          }),
          about: {
            '@type': 'Thing',
            name: 'Buddhist Teaching',
            description: 'Ancient Buddhist discourse or text',
          },
          ...(child.translations?.length && {
            workTranslation: child.translations.map((translation: any) => ({
              '@type': 'CreativeWork',
              name: `${child.original_title || child.root_name} - ${translation.author || translation.author_uid}`,
              inLanguage: translation.lang,
              translator: {
                '@type': 'Person',
                name: translation.author || translation.author_uid,
              },
              ...(translation.publication_date && {
                datePublished: translation.publication_date,
              }),
              url: `${origin}/${child.uid}/${translation.lang}/${translation.author_uid}`,
              sameAs: [
                `https://suttacentral.net/${child.uid}/${translation.lang}/${translation.author_uid}`,
                `https://suttacentral.express/${child.uid}/${translation.lang}/${translation.author_uid}`,
              ],
            })),
          }),
          isPartOf: {
            '@id': currentPath,
          },
        })),
      }),
      breadcrumb: buildBreadcrumbList(breadcrumbs, currentPath),
      publisher: getPublisherSchema(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': currentPath,
      },
    },
    null,
    2
  )
}

export function generateTextMetaJsonLd(
  entry: any,
  breadcrumbs: Breadcrumb[],
  origin: string
) {
  const currentPath = `/${entry.uid}`

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': currentPath,
      name: formatName(
        entry.original_title || entry.root_name,
        entry.translated_title || entry.translated_name
      ),
      description:
        entry.blurb ||
        'Information about available translations and editions of this Buddhist text',
      url: `${origin}${currentPath}`,
      sameAs: [
        `https://suttacentral.net${currentPath}`,
        `https://suttacentral.express${currentPath}`,
      ],
      identifier: entry.uid,
      inLanguage: 'en',
      about: {
        '@type': 'CreativeWork',
        '@id': `/${entry.uid}/#work`,
        name: entry.original_title || entry.root_name,
        alternateName: [
          entry.translated_title || entry.translated_name,
          entry.acronym,
        ].filter(Boolean),
        description: entry.blurb,
        identifier: entry.uid,
        ...(entry.translations?.length && {
          workTranslation: entry.translations.map((translation: any) => ({
            '@type': 'CreativeWork',
            '@id': `/${entry.uid}/${translation.lang}/${translation.author_uid}`,
            name: `${entry.original_title || entry.root_name} - ${translation.author || translation.author_uid}`,
            inLanguage: {
              '@type': 'Language',
              name: translation.lang_name || translation.lang,
              alternateName: translation.lang,
            },
            url: `${origin}/${entry.uid}/${translation.lang}/${translation.author_uid}`,
            sameAs: [
              `https://suttacentral.net/${entry.uid}/${translation.lang}/${translation.author_uid}`,
              `https://suttacentral.express/${entry.uid}/${translation.lang}/${translation.author_uid}`,
            ],
            genre: translation.is_root ? 'Root Text' : 'Translation',
            ...(translation.author && {
              [translation.is_root ? 'editor' : 'translator']: {
                '@type': 'Person',
                name: translation.author
                  .replace(/&nbsp;|&#160;|\u00A0/g, ' ')
                  .trim(),
                identifier: translation.author_uid,
              },
            }),
            ...(translation.publication_date && {
              datePublished: translation.publication_date,
            }),
            translationOfWork: {
              '@id': `/${entry.uid}/#work`,
            },
          })),
        }),
        about: {
          '@type': 'Thing',
          name: 'Buddhist Teaching',
          description: 'Ancient Buddhist discourse or text from the Pali Canon',
        },
      },
      isPartOf: {
        '@type': 'WebSite',
        '@id': '/#website',
        name: 'SuttaCentral',
      },
      breadcrumb: buildBreadcrumbList(breadcrumbs, currentPath),
      publisher: getPublisherSchema(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': currentPath,
      },
    },
    null,
    2
  )
}

export function generatePitakaJsonLd(
  data: any,
  breadcrumbs: Breadcrumb[],
  origin: string
) {
  const currentPath =
    breadcrumbs[breadcrumbs.length - 1]?.url || `/pitaka/${data.uid}`

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': currentPath,
      name: formatName(
        data.original_title || data.root_name,
        data.translated_title || data.translated_name
      ),
      description: data.blurb,
      url: `${origin}${currentPath}`,
      sameAs: [
        `https://suttacentral.net${currentPath}`,
        `https://suttacentral.express${currentPath}`,
      ],
      identifier: data.uid,
      inLanguage: [
        {
          '@type': 'Language',
          name: 'English',
          alternateName: 'en',
        },
        ...(data.root_lang
          ? [
              {
                '@type': 'Language',
                name: data.root_lang,
                alternateName: data.root_lang,
              },
            ]
          : []),
      ],
      about: {
        '@type': 'Thing',
        name: 'Buddhist Literature',
        description: 'Ancient Buddhist texts and modern translations',
      },
      isPartOf: {
        '@type': 'WebSite',
        '@id': '/#website',
        name: 'SuttaCentral',
      },
      ...(data.children?.length && {
        hasPart: data.children.map((child: any) => {
          const childHasDirectLink = !!child._scx_href
          const childPath = childHasDirectLink
            ? child._scx_href
            : `${currentPath}/${child.uid}`

          return {
            '@type': 'Collection',
            '@id': childPath,
            name: formatName(
              child.original_title || child.root_name,
              child.translated_title || child.translated_name
            ),
            description: child.blurb,
            url: `${origin}${childPath}`,
            sameAs: childHasDirectLink
              ? [
                  `https://suttacentral.net${child._scx_href}`,
                  `https://suttacentral.express${child._scx_href}`,
                ]
              : [
                  `https://suttacentral.net${currentPath}/${child.uid}`,
                  `https://suttacentral.express${currentPath}/${child.uid}`,
                ],
            identifier: child.uid,
            isPartOf: {
              '@id': currentPath,
            },
          }
        }),
      }),
      breadcrumb: buildBreadcrumbList(breadcrumbs, currentPath),
      publisher: getPublisherSchema(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': currentPath,
      },
    },
    null,
    2
  )
}

export function generateTextJsonLd(
  suttasData: any,
  suttaplexData: any[],
  breadcrumbs: Breadcrumb[],
  origin: string
) {
  const entry = suttaplexData[0]
  const translation = suttasData.translation
  const isRootText = translation?.lang === entry?.root_lang
  const currentPath = `/${entry.uid}/${translation?.lang}/${translation?.author_uid}`

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      '@id': currentPath,
      name: entry.original_title || entry.root_name,
      alternateName: [
        entry.acronym,
        entry.translated_title || entry.translated_name,
      ].filter(Boolean),
      description:
        entry.blurb || 'Buddhist text from the Pali Canon with translation',
      url: `${origin}${currentPath}`,
      sameAs: [
        `https://suttacentral.net${currentPath}`,
        `https://suttacentral.express${currentPath}`,
      ],
      identifier: entry.uid,
      inLanguage: {
        '@type': 'Language',
        name: translation?.lang_name || translation?.lang,
        alternateName: translation?.lang,
      },
      genre: isRootText ? 'Root Text' : 'Translation',
      ...(translation?.author && {
        [isRootText ? 'editor' : 'translator']: {
          '@type': 'Person',
          name: translation.author.replace(/&nbsp;|&#160;|\u00A0/g, ' ').trim(),
          identifier: translation.author_uid,
        },
      }),
      ...(translation?.publication_date && {
        datePublished: translation.publication_date,
      }),
      ...(!isRootText && {
        translationOfWork: {
          '@type': 'CreativeWork',
          name: entry.root_name || entry.original_title,
          inLanguage: entry.root_lang,
          about: {
            '@type': 'Thing',
            name: 'Buddhist Teaching',
            description: 'Ancient Buddhist discourse or text',
          },
        },
      }),
      about: [
        {
          '@type': 'Thing',
          name: 'Buddhism',
          description: 'Buddhist philosophy and teachings',
        },
        {
          '@type': 'Thing',
          name: 'Buddhist Literature',
          description: 'Ancient Buddhist texts and modern translations',
        },
        ...(suttasData.segmented
          ? [
              {
                '@type': 'Thing',
                name: 'Segmented Text',
                description:
                  'Text divided into numbered segments for reference',
              },
            ]
          : []),
      ],
      isPartOf: {
        '@type': 'WebSite',
        '@id': '/#website',
        name: 'SuttaCentral',
      },
      breadcrumb: buildBreadcrumbList(breadcrumbs, currentPath),
      publisher: getPublisherSchema(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': currentPath,
      },
      ...(translation?.previous?.uid && {
        hasPreviousItem: {
          '@type': 'CreativeWork',
          name: translation.previous.name,
          url: `${origin}/${translation.previous.uid}/${translation.previous.lang}/${translation.previous.author_uid}`,
          sameAs: [
            `https://suttacentral.net/${translation.previous.uid}/${translation.previous.lang}/${translation.previous.author_uid}`,
            `https://suttacentral.express/${translation.previous.uid}/${translation.previous.lang}/${translation.previous.author_uid}`,
          ],
        },
      }),
      ...(translation?.next?.uid && {
        hasNextItem: {
          '@type': 'CreativeWork',
          name: translation.next.name,
          url: `${origin}/${translation.next.uid}/${translation.next.lang}/${translation.next.author_uid}`,
          sameAs: [
            `https://suttacentral.net/${translation.next.uid}/${translation.next.lang}/${translation.next.author_uid}`,
            `https://suttacentral.express/${translation.next.uid}/${translation.next.lang}/${translation.next.author_uid}`,
          ],
        },
      }),
      license: {
        '@type': 'CreativeWork',
        name: 'Public Domain',
        description: 'This work is in the public domain',
      },
    },
    null,
    2
  )
}
