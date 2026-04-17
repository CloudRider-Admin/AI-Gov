import { defineField, defineType } from 'sanity';

export const audienceCard = defineType({
  name: 'audienceCard',
  title: 'Audience Card',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({ name: 'icon', title: 'Icon (emoji)', type: 'string' }),
    defineField({ name: 'orderRank', title: 'Order', type: 'number' }),
  ],
  preview: { select: { title: 'title', subtitle: 'icon' } },
});
