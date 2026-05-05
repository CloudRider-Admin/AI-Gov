import { defineField, defineType } from 'sanity';

export const trustBadge = defineType({
  name: 'trustBadge',
  title: 'Trust Badge',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 2 }),
    defineField({ name: 'orderRank', title: 'Order', type: 'number' }),
  ],
  preview: { select: { title: 'name', subtitle: 'description' } },
});