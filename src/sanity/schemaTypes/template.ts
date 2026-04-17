import { defineField, defineType } from 'sanity';

export const template = defineType({
  name: 'template',
  title: 'Template',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Policy', value: 'policy' },
          { title: 'Risk', value: 'risk' },
          { title: 'Compliance', value: 'compliance' },
          { title: 'Governance', value: 'governance' },
          { title: 'Training', value: 'training' },
        ],
      },
    }),
    defineField({ name: 'file', title: 'File', type: 'file' }),
    defineField({ name: 'orderRank', title: 'Order', type: 'number' }),
  ],
  preview: { select: { title: 'title', subtitle: 'category' } },
});
