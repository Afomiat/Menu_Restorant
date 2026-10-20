/**
 * Ask the image host for a photo no larger than it is shown, so menus load quickly on slow
 * connections. `width` is in CSS pixels; it is doubled for sharp results on phone screens.
 * URLs from other hosts are returned unchanged.
 */
export function sizedImageUrl(url: string | undefined, width: number): string {
  if (!url) return '';
  const pixels = Math.round(width * 2);

  try {
    const parsed = new URL(url, window.location.origin);

    if (parsed.hostname === 'images.unsplash.com') {
      parsed.searchParams.set('w', String(pixels));
      parsed.searchParams.set('q', '75');
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    // Cloudinary uploads: /<cloud>/image/upload/[transformations/]v123/file.jpg
    if (parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/image/upload/')) {
      const [before, after] = parsed.pathname.split('/image/upload/');
      const firstSegment = after.split('/')[0];
      const alreadyTransformed = /(^|,)(w|h|c|q|f)_/.test(firstSegment);
      if (!alreadyTransformed) {
        parsed.pathname = `${before}/image/upload/f_auto,q_auto,c_limit,w_${pixels}/${after}`;
        return parsed.toString();
      }
    }
  } catch {
    // Not a valid URL: use it as it is
  }
  return url;
}
