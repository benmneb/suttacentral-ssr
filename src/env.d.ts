/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * The interface language: ?lang= if it has translations, else Accept-Language.
     * Set once per request by the middleware, so read this, not getPreferredLanguage
     */
    userLanguage: string
    /** Set by the text page when it shows its Chinese in simplified characters */
    hans?: boolean
  }
}
