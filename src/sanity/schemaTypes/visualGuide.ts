import { defineField, defineType } from 'sanity';

export const visualGuide = defineType({
  name: 'visualGuide',
  title: 'Visual Guide',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Infographic', value: 'infographic' },
          { title: 'Template', value: 'template' },
          { title: 'Diagram', value: 'diagram' },
        ],
        layout: 'radio',
      },
    }),
    defineField({ name: 'image', title: 'Image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'orderRank', title: 'Order', type: 'number' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'type', media: 'image' },
  },
});