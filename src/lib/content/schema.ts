import { z } from "zod";

export const SiteSchema = z.object({
  siteName: z.string(),
  shortName: z.string(),
  description: z.string(),
  organization: z.string(),
  contact: z.object({
    email: z.string(),
    tel: z.string(),
    hours: z.string()
  }),
  social: z.object({
    instagram: z.string(),
    x: z.string(),
    facebook: z.string()
  })
});

export const ConfigSchema = z.object({
  site: z.object({
    baseUrl: z.string().url(),
    futureCustomDomain: z.string(),
    language: z.string(),
    timezone: z.string(),
    organization: z.string(),
    repository: z.string()
  }),
  deployment: z.object({
    provider: z.string(),
    productionBranch: z.string(),
    buildCommand: z.string(),
    outputDirectory: z.string(),
    previewDeployments: z.boolean()
  }),
  content: z.object({
    currentYear: z.number(),
    yearDirectoryPattern: z.string(),
    assetsDirectoryPattern: z.string(),
    documentsDirectory: z.string()
  }),
  features: z.record(z.boolean()),
  futureServices: z.record(z.string())
});

export const ThemeSchema = z.object({
  name: z.string(),
  colors: z.record(z.string()),
  typography: z.object({
    body: z.string(),
    display: z.string(),
    baseSize: z.string()
  }),
  layout: z.object({
    maxWidth: z.string(),
    sectionPadding: z.string(),
    mobileSectionPadding: z.string()
  }),
  radii: z.object({
    card: z.string(),
    pill: z.string()
  })
});

export const CurrentSchema = z.object({
  year: z.number()
});

export const EventSchema = z.object({
  year: z.number(),
  title: z.string(),
  dateText: z.string(),
  dateStart: z.string(),
  dateEnd: z.string(),
  venueName: z.string(),
  venueAddress: z.string(),
  heroImage: z.string(),
  heroImages: z
    .array(
      z.object({
        src: z.string(),
        mobileSrc: z.string(),
        alt: z.string()
      })
    )
    .optional(),
  catchcopy: z.string(),
  lead: z.string(),
  status: z.string(),
  cta: z.object({
    primaryLabel: z.string(),
    primaryHref: z.string(),
    secondaryLabel: z.string(),
    secondaryHref: z.string()
  })
});

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  genre: z.string(),
  profile: z.string(),
  image: z.string(),
  stage: z.string(),
  links: z.object({
    official: z.string(),
    instagram: z.string()
  }),
  sortOrder: z.number(),
  pickup: z.boolean()
});

export const MascotSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  profile: z.string(),
  image: z.string(),
  alt: z.string(),
  sortOrder: z.number()
});

export const TimetableItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  stage: z.string(),
  title: z.string(),
  artistId: z.string(),
  note: z.string()
});

export const SponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["特別協賛", "後援"]),
  logo: z.string(),
  url: z.string(),
  message: z.string(),
  sortOrder: z.number()
});

export const NewsSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  publishedAt: z.string(),
  excerpt: z.string(),
  body: z.string(),
  visible: z.boolean(),
  aiVisible: z.boolean()
});

export const GalleryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  image: z.string(),
  year: z.number(),
  category: z.string(),
  alt: z.string(),
  sortOrder: z.number()
});

export const VenueLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  postalCode: z.string(),
  address: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  mapZoom: z.number(),
  sortOrder: z.number()
});

export const VenueSchema = z.object({
  name: z.string(),
  address: z.string(),
  mapImage: z.string(),
  googleMapUrl: z.string(),
  accessNotes: z.array(z.string()),
  facilities: z.array(
    z.object({
      name: z.string(),
      description: z.string()
    })
  ),
  locations: z.array(VenueLocationSchema)
});

export type Site = z.infer<typeof SiteSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type Mascot = z.infer<typeof MascotSchema>;
export type TimetableItem = z.infer<typeof TimetableItemSchema>;
export type Sponsor = z.infer<typeof SponsorSchema>;
export type NewsItem = z.infer<typeof NewsSchema>;
export type GalleryItem = z.infer<typeof GalleryItemSchema>;
export type Venue = z.infer<typeof VenueSchema>;
export type VenueLocation = z.infer<typeof VenueLocationSchema>;
