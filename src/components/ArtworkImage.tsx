"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type ArtworkImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  /** Use when the track title is already exposed next to the image (avoids duplicate SR output). */
  "aria-hidden"?: boolean | undefined;
};

/** Blob/data URLs skip Next optimization; HTTPS uses the default pipeline (see `remotePatterns`). */
function needsUnoptimized(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:");
}

function isMissingArtwork(src: string) {
  return !src?.trim();
}

/** Album/track artwork: `next/image` for remote HTTPS; unoptimized for blob/data URLs. */
export function ArtworkImage({
  src,
  alt,
  width,
  height,
  className,
  priority,
  "aria-hidden": ariaHidden,
}: ArtworkImageProps) {
  if (isMissingArtwork(src)) {
    return (
      <div
        role={ariaHidden ? undefined : "img"}
        aria-hidden={ariaHidden}
        aria-label={ariaHidden ? undefined : alt || "Artwork"}
        className={cn("bg-muted shrink-0", className)}
        style={{ width, height }}
      />
    );
  }

  const unoptimized = needsUnoptimized(src);
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn(className)}
      priority={priority}
      unoptimized={unoptimized}
      aria-hidden={ariaHidden}
    />
  );
}

type ArtworkFillProps = {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
};

/**
 * Full-bleed cover (e.g. blurred background).
 * Parent must be `position: relative` with a defined size (or aspect ratio).
 */
export function ArtworkImageFill({ src, alt, className, sizes, priority }: ArtworkFillProps) {
  if (isMissingArtwork(src)) {
    return (
      <div
        role="img"
        aria-label={alt || "Artwork"}
        className={cn("absolute inset-0 bg-muted", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={cn(className)}
      priority={priority}
      unoptimized={needsUnoptimized(src)}
    />
  );
}
