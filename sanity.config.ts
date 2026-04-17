import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './src/sanity/schemaTypes';

export default defineConfig({
  name: 'ai-govsecure',
  title: 'GovSecure CMS',

  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Site Settings')
              .child(
                S.document()
                  .schemaType('siteSettings')
                  .documentId('siteSettings')
              ),
            S.divider(),
            S.documentTypeListItem('playbook').title('Playbooks'),
            S.documentTypeListItem('category').title('Categories'),
            S.documentTypeListItem('topic').title('Topics'),
            S.documentTypeListItem('learnLevel').title('Learn Levels'),
            S.divider(),
            S.documentTypeListItem('audienceCard').title('Audience Cards'),
            S.documentTypeListItem('valueProp').title('Value Propositions'),
            S.documentTypeListItem('visualGuide').title('Visual Guides'),
            S.documentTypeListItem('template').title('Templates'),
            S.documentTypeListItem('trustBadge').title('Trust Badges'),
          ]),
    }),
    visionTool(),
  ],

  schema: { types: schemaTypes },
});
