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
  imageFit: z.enum(["cover", "contain"]).optional(),
  stage: z.string(),
  links: z.object({
    official: z.string(),
    instagram: z.string()
  }),
  sortOrder: z.number(),
  pickup: z.boolean()
});

export const AboutMessageSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  imageWidth: z.number(),
  imageHeight: z.number(),
  paragraphs: z.array(z.string()),
  signature: z.array(z.string()),
  sortOrder: z.number()
});

export const ApplicationEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  label: z.string(),
  dateTimeText: z.string(),
  venue: z.string(),
  postalCode: z.string(),
  address: z.string(),
  description: z.string(),
  receptionPeriod: z.string(),
  formUrl: z.string().url().or(z.literal("")),
  buttonLabel: z.string(),
  status: z.enum(["open", "closed", "preparing"]),
  sortOrder: z.number()
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
  order: z.number().optional(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().optional(),
  stage: z.string(),
  title: z.string(),
  category: z.string().optional(),
  progress: z.string().optional(),
  artistId: z.string(),
  note: z.string()
});

export const EventScheduleSessionSchema = z.object({
  label: z.string(),
  timeText: z.string(),
  participationText: z.string(),
  note: z.string().optional()
});

export const EventScheduleItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
  timeText: z.string(),
  participationText: z.string(),
  feeText: z.string(),
  applicationId: z.string(),
  formUrl: z.string().url().or(z.literal("")),
  status: z.enum(["scheduled", "adjusting", "open", "closed"]),
  sortOrder: z.number(),
  sessions: z.array(EventScheduleSessionSchema)
});

export const EventScheduleVenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  address: z.string(),
  description: z.string(),
  note: z.string(),
  sortOrder: z.number(),
  events: z.array(EventScheduleItemSchema)
});

const sponsorPartnerAmounts = [300000, 200000, 100000, 50000] as const;

export const SponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["特別協賛", "名義協賛", "名義後援"]),
  amount: z.number().optional(),
  logo: z.string(),
  url: z.string(),
  message: z.string(),
  sortOrder: z.number()
}).superRefine((sponsor, ctx) => {
  if (sponsor.category === "特別協賛") {
    if (typeof sponsor.amount !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "特別協賛にはPARTNERランク判定用のamountが必要です。",
        path: ["amount"]
      });
      return;
    }

    if (!sponsorPartnerAmounts.includes(sponsor.amount as typeof sponsorPartnerAmounts[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "特別協賛のamountは定義済みのPARTNERランク金額にしてください。",
        path: ["amount"]
      });
    }
  }

  if (sponsor.category !== "特別協賛" && typeof sponsor.amount === "number") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "名義協賛・名義後援にはPARTNERランク判定用のamountを設定しないでください。",
      path: ["amount"]
    });
  }
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

export const VenueFloorMarkerSchema = z.object({
  id: z.string(),
  markerLabel: z.string(),
  title: z.string(),
  room: z.string(),
  scheduleEventId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  sortOrder: z.number()
});

export const VenueFloorMapSchema = z.object({
  id: z.string(),
  label: z.string(),
  title: z.string(),
  mapImage: z.string(),
  mapAlt: z.string(),
  sourceUrl: z.string().url().optional(),
  width: z.number(),
  height: z.number(),
  sortOrder: z.number(),
  showMarkers: z.boolean().optional(),
  markers: z.array(VenueFloorMarkerSchema)
});

export const VenueEventMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  eyebrow: z.string().optional(),
  description: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string().url().optional(),
  sortOrder: z.number(),
  floors: z.array(VenueFloorMapSchema)
});

export const VenueSchema = z.object({
  name: z.string(),
  address: z.string(),
  mapImage: z.string(),
  mapImageAlt: z.string().optional(),
  mapImageWidth: z.number().optional(),
  mapImageHeight: z.number().optional(),
  googleMapUrl: z.string(),
  accessNotes: z.array(z.string()),
  facilities: z.array(
    z.object({
      name: z.string(),
      description: z.string()
    })
  ),
  locations: z.array(VenueLocationSchema),
  eventMaps: z.array(VenueEventMapSchema)
});

export type Site = z.infer<typeof SiteSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type AboutMessage = z.infer<typeof AboutMessageSchema>;
export type ApplicationEvent = z.infer<typeof ApplicationEventSchema>;
export type Mascot = z.infer<typeof MascotSchema>;
export type TimetableItem = z.infer<typeof TimetableItemSchema>;
export type EventScheduleSession = z.infer<typeof EventScheduleSessionSchema>;
export type EventScheduleItem = z.infer<typeof EventScheduleItemSchema>;
export type EventScheduleVenue = z.infer<typeof EventScheduleVenueSchema>;
export type Sponsor = z.infer<typeof SponsorSchema>;
export type NewsItem = z.infer<typeof NewsSchema>;
export type GalleryItem = z.infer<typeof GalleryItemSchema>;
export type Venue = z.infer<typeof VenueSchema>;
export type VenueLocation = z.infer<typeof VenueLocationSchema>;
export type VenueEventMap = z.infer<typeof VenueEventMapSchema>;
export type VenueFloorMap = z.infer<typeof VenueFloorMapSchema>;
export type VenueFloorMarker = z.infer<typeof VenueFloorMarkerSchema>;
