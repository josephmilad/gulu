"use client";

import Image from "next/image";

/** Image box with a shimmer placeholder that fades the photo in once it has loaded. */
export default function Media({
  src,
  alt,
  sizes,
  priority,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`media ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        ref={(el) => {
          if (el?.complete && el.naturalWidth) el.parentElement?.classList.add("loaded");
        }}
        onLoad={(e) => e.currentTarget.parentElement?.classList.add("loaded")}
      />
    </div>
  );
}
