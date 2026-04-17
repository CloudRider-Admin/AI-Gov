import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import { sanityConfig, isSanityConfigured } from "./config";

// Create Sanity client
export const sanityClient = createClient({
  ...sanityConfig,
  useCdn: true,
});

// Create client for preview/draft content
export const previewClient = createClient({
  ...sanityConfig,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

// Helper to get the right client
export const getClient = (preview = false) => {
  return preview ? previewClient : sanityClient;
};

// Image URL builder
const builder = createImageUrlBuilder(sanityClient);

type ImageSource = Parameters<(typeof builder)["image"]>[0];

export const urlFor = (source: ImageSource) => {
  return builder.image(source);
};

// Check if we should use local data (fallback when Sanity not configured)
export const shouldUseLocalData = () => !isSanityConfigured();
