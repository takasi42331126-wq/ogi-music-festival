import siteRaw from "@data/site.json";
import configRaw from "@data/config.json";
import themeRaw from "@data/theme.json";
import currentRaw from "@data/current.json";
import eventRaw from "@data/years/2026/event.json";
import artistsRaw from "@data/years/2026/artists.json";
import timetableRaw from "@data/years/2026/timetable.json";
import sponsorsRaw from "@data/years/2026/sponsors.json";
import newsRaw from "@data/years/2026/news.json";
import galleryRaw from "@data/years/2026/gallery.json";
import venueRaw from "@data/years/2026/venue.json";
import {
  ArtistSchema,
  ConfigSchema,
  CurrentSchema,
  EventSchema,
  GalleryItemSchema,
  NewsSchema,
  SiteSchema,
  SponsorSchema,
  ThemeSchema,
  TimetableItemSchema,
  VenueSchema
} from "./schema";

const bySortOrder = <T extends { sortOrder: number }>(items: T[]) =>
  [...items].sort((a, b) => a.sortOrder - b.sortOrder);

const byDateDesc = <T extends { publishedAt: string }>(items: T[]) =>
  [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export const site = SiteSchema.parse(siteRaw);
export const config = ConfigSchema.parse(configRaw);
export const theme = ThemeSchema.parse(themeRaw);
export const current = CurrentSchema.parse(currentRaw);
export const event = EventSchema.parse(eventRaw);
export const artists = bySortOrder(ArtistSchema.array().parse(artistsRaw));
export const timetable = TimetableItemSchema.array().parse(timetableRaw);
export const sponsors = bySortOrder(SponsorSchema.array().parse(sponsorsRaw));
export const news = byDateDesc(NewsSchema.array().parse(newsRaw).filter((item) => item.visible));
export const gallery = bySortOrder(GalleryItemSchema.array().parse(galleryRaw));
export const venue = VenueSchema.parse(venueRaw);

export const pickupArtists = artists.filter((artist) => artist.pickup);
export const stages = Array.from(new Set(timetable.map((item) => item.stage)));

export const getArtistById = (id: string) =>
  artists.find((artist) => artist.id === id);

export const getNewsBySlug = (slug: string) =>
  news.find((item) => item.slug === slug);

export const getTimetableByStage = (stage: string) =>
  timetable
    .filter((item) => item.stage === stage)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

export const getSponsorsByCategory = (category: string) =>
  sponsors.filter((sponsor) => sponsor.category === category);
