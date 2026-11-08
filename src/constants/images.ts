import { SC_IMG } from './urls'

// /editions
export const editionsStack = `${SC_IMG}/publication-pages/editions-kn-wet.jpg`

// /edition/[book]
export const editionCover = (uid: string) =>
  `${SC_IMG}/publication-pages/${uid}-book.jpg`
export const editionAuthorPhoto = (uid: string) =>
  `${SC_IMG}/publication-pages/${uid}.jpg`
export const editionLicense = `${SC_IMG}/publication-pages/cc-zero.svg`

// /introduction
export const introductionManuscriptAvif = `${SC_IMG}/static-pages/Life_of_Buddha_Burmese_Manuscript_22_Volume_1_Wellcom.avif`
export const introductionManuscriptJpg = `${SC_IMG}/static-pages/Life_of_Buddha_Burmese_Manuscript_22_Volume_1_Wellcom.jpg`
export const introductionBirchbarkAvif = `${SC_IMG}/static-pages/birchbark_w400.avif`
export const introductionBirchbarkJpg = `${SC_IMG}/static-pages/birchbark_w400.jpg`
export const introductionDn20Avif = `${SC_IMG}/static-pages/dn20.avif`
export const introductionDn20Jpg = `${SC_IMG}/static-pages/dn20.jpg`

// /map
export const mapPosterAvif = `${SC_IMG}/static-pages/jambudipa_map.avif`
export const mapPosterJpg = `${SC_IMG}/static-pages/jambudipa_map.jpg`

// /pirivena-project
export const pirivenaProjectPhotoAvif = `${SC_IMG}/static-pages/pirivena-monks-walking.avif`
export const pirivenaProjectPhotoJpg = `${SC_IMG}/static-pages/pirivena-monks-walking.jpg`

// The donation success message...
export const donationSuccessPhotoAvif = `${SC_IMG}/static-pages/novice_reading.avif`
export const donationSuccessPhotoJpg = `${SC_IMG}/static-pages/novice_reading.jpg`

// Illustrations on a text page, ie /mn123
export const optimizedIllustration = (filename: string) =>
  `${SC_IMG}/optimized-illustrations/${filename}.avif`
