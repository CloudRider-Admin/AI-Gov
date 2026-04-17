import { defineField, defineType } from 'sanity';

export const learnLevel = defineType({
  name: 'learnLevel',
  title: 'Learn Level',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' }, validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'playbooks',
      title: 'Playbooks',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'playbook' }] }],
    }),
    defineField({
      name: 'topics',
      title: 'Topics',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'topic' }] }],
    }),
    defineField({ name: 'orderRank', title: 'Order', type: 'number' }),
  ],
  preview: { select: { title: 'title', subtitle: 'description' } },
});
