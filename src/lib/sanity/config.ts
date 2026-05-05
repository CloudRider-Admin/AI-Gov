/**
 * Sanity CMS Configuration
 * 
 * To use Sanity:
 * 1. Create a project at https://www.sanity.io/manage
 * 2. Get your project ID and dataset name
 * 3. Create a .env.local file with:
 *    NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
 *    NEXT_PUBLIC_SANITY_DATASET=production
 *    SANITY_API_TOKEN=your-token (for write operations)
 */

export const sanityConfig = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "your-project-id",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: process.env.NODE_ENV === "production",
};

// Check if Sanity is configured
export const isSanityConfigured = () => {
  return (
    sanityConfig.projectId !== "your-project-id" &&
    sanityConfig.projectId !== ""
  );
};
