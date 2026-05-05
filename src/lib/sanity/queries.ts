import { groq } from "next-sanity";

// Hero content query
export const heroQuery = groq`
  *[_type == "siteSettings"][0] {
    heroHeadline,
    heroSubheadline,
    heroPrimaryCta,
    heroSecondaryCta,
    heroSupportText
  }
`;

// All playbooks query
export const playbooksQuery = groq`
  *[_type == "playbook"] | order(orderRank) {
    _id,
    title,
    slug,
    description,
    level,
    excerpt,
    "estimatedReadTime": estimatedReadTime,
    publishedAt
  }
`;

// Single playbook by slug
export const playbookBySlugQuery = groq`
  *[_type == "playbook" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    description,
    level,
    excerpt,
    content,
    estimatedReadTime,
    publishedAt,
    "relatedPlaybooks": relatedPlaybooks[]-> {
      _id,
      title,
      slug,
      level,
      description
    }
  }
`;

// All categories with topics
export const categoriesQuery = groq`
  *[_type == "category"] | order(orderRank) {
    _id,
    name,
    slug,
    description,
    icon,
    "topics": *[_type == "topic" && references(^._id)] | order(orderRank) {
      _id,
      title,
      slug,
      description
    }
  }
`;

// Single category by slug
export const categoryBySlugQuery = groq`
  *[_type == "category" && slug.current == $slug][0] {
    _id,
    name,
    slug,
    description,
    icon,
    "topics": *[_type == "topic" && references(^._id)] | order(orderRank) {
      _id,
      title,
      slug,
      description,
      content
    }
  }
`;

// Single topic by slug
export const topicBySlugQuery = groq`
  *[_type == "topic" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    description,
    content,
    "category": category-> {
      _id,
      name,
      slug
    },
    "relatedTopics": relatedTopics[]-> {
      _id,
      title,
      slug,
      description
    }
  }
`;

// Templates query
export const templatesQuery = groq`
  *[_type == "template"] | order(orderRank) {
    _id,
    title,
    description,
    category,
    "fileUrl": file.asset->url
  }
`;

// Visual guides query
export const visualGuidesQuery = groq`
  *[_type == "visualGuide"] | order(orderRank) {
    _id,
    title,
    description,
    type,
    "imageUrl": image.asset->url
  }
`;

// Audience cards query
export const audienceCardsQuery = groq`
  *[_type == "audienceCard"] | order(orderRank) {
    _id,
    title,
    description,
    icon
  }
`;

// Value propositions query
export const valuePropsQuery = groq`
  *[_type == "valueProp"] | order(orderRank) {
    _id,
    title,
    description,
    highlights,
    icon
  }
`;

// Trust badges query
export const trustBadgesQuery = groq`
  *[_type == "trustBadge"] | order(orderRank) {
    _id,
    name,
    description
  }
`;

// Learn levels query
export const learnLevelsQuery = groq`
  *[_type == "learnLevel"] | order(orderRank) {
    _id,
    title,
    slug,
    description,
    "playbooks": playbooks[]-> {
      _id,
      title,
      slug,
      level,
      description
    },
    "topics": topics[]-> {
      _id,
      title,
      slug,
      description
    }
  }
`;

// Single learn level by slug
export const learnLevelBySlugQuery = groq`
  *[_type == "learnLevel" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    description,
    content,
    "playbooks": playbooks[]-> {
      _id,
      title,
      slug,
      level,
      description,
      excerpt
    },
    "topics": topics[]-> {
      _id,
      title,
      slug,
      description
    }
  }
`;
