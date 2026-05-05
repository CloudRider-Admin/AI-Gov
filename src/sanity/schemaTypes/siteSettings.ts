import { defineField, defineType } from 'sanity';

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({ name: 'heroHeadline', title: 'Hero Headline', type: 'string' }),
    defineField({ name: 'heroSubheadline', title: 'Hero Subheadline', type: 'text', rows: 3 }),
    defineField({ name: 'heroPrimaryCta', title: 'Primary CTA Text', type: 'string' }),
    defineField({ name: 'heroSecondaryCta', title: 'Secondary CTA Text', type: 'string' }),
    defineField({ name: 'heroSupportText', title: 'Hero Support Text', type: 'text', rows: 3 }),
  ],
  preview: { select: { title: 'heroHeadline' } },
});