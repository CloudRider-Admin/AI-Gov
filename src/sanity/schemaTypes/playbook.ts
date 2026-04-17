import { defineField, defineType } from 'sanity';

export const playbook = defineType({
  name: 'playbook',
  title: 'Playbook',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' }, validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({
      name: 'level',
      title: 'Level',
      type: 'string',
      options: {
        list: [
          { title: 'Beginner', value: 'beginner' },
          { title: 'Intermediate', value: 'intermediate' },
          { title: 'Leadership', value: 'leadership' },
        ],
        layout: 'radio',
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'excerpt', title: 'Excerpt', type: 'text', rows: 2 }),
    defineField({ name: 'estimatedReadTime', title: 'Estimated Read Time (mins)', type: 'number' }),
    defineField({ name: 'publishedAt', title: 'Published At', type: 'datetime' }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image', options: { hotspot: true } }],
    }),
    defineField({
      name: 'relatedPlaybooks',
      title: 'Related Playbooks',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'playbook' }] }],
    }),
    defineField({ name: 'orderRank', title: 'Order', type: 'number' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'level' },
    prepare({ title, subtitle }) {
      const icons: Record<string, string> = { beginner: '🟢', intermediate: '🟡', leadership: '🔵' };
      return { title, subtitle: `${icons[subtitle] ?? ''} ${subtitle ?? ''}` };
    },
  },
});
