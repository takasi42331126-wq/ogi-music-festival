import { config, site } from "./content/repository";

export const buildTitle = (title?: string) =>
  title ? `${title} | ${site.siteName}` : site.siteName;

export const absoluteUrl = (path: string) => {
  try {
    return new URL(path, config.site.baseUrl).toString();
  } catch {
    return config.site.baseUrl;
  }
};
