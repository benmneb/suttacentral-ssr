/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** The interface language: ?lang= if it has translations, else Accept-Language */
    userLanguage: string
  }
}
