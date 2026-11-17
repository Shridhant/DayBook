"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { InstagramIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { instagramEmbedUrl } from "@/lib/instagram";
import { cn } from "@/lib/utils";
import type { InstagramPost } from "@/server/content";

/**
 * Instagram reels/posts as cards; a tap opens Instagram's embed in a modal. The card shows, in
 * order: the salon's uploaded clip (muted, played on desktop hover), their uploaded thumbnail, or
 * else Instagram's own embed as a cropped, non-interactive preview, loaded only when the card
 * nears the viewport (native iframe lazy loading) so the page stays light on 4G (AGENTS.md §10).
 */

export function ReelCard({ post, onOpen }: { post: InstagramPost; onOpen: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  // Mouse only: on touch screens a tap opens the reel instead.
  const canHoverPlay = () => !reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const startPreview = () => {
    if (video.current && canHoverPlay()) video.current.play().catch(() => {});
  };
  const stopPreview = () => {
    if (!video.current) return;
    video.current.pause();
    video.current.currentTime = 0.1;
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={post.videoPath ? startPreview : undefined}
      onMouseLeave={post.videoPath ? stopPreview : undefined}
      className="group relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-canvas text-left outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
      aria-label={`Play ${post.kind === "reel" ? "reel" : "post"}${post.caption ? `: ${post.caption}` : ""}`}
    >
      {post.videoPath ? (
        <video
          ref={video}
          // #t skips to the first real frame so it shows as the cover without a thumbnail.
          src={`${post.videoPath}#t=0.1`}
          poster={post.thumbnailPath ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : post.thumbnailPath ? (
        <Image src={post.thumbnailPath} alt="" fill sizes="(min-width: 1024px) 260px, 62vw" className="object-cover" />
      ) : (
        <InstagramPreview url={post.url} />
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
        <InstagramIcon aria-hidden className="size-4" />
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          playing && "opacity-0",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-ink shadow-[var(--shadow-layer)] transition-transform duration-200 [@media(hover:hover)]:group-hover:scale-105">
          <Play aria-hidden className="ml-0.5 size-6 fill-current" />
        </span>
      </span>
      {post.caption && <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-[14px] font-medium text-white">{post.caption}</span>}
    </button>
  );
}

/** Instagram's embed renders at a fixed width; we scale it to the card and hide its profile header. */
const EMBED_WIDTH = 326;
const EMBED_HEADER = 56;

/**
 * Instagram's own post as the card's cover when the salon uploaded nothing. Instagram offers no
 * public thumbnail URL, so this is the embed itself, scaled to fit, cropped to the photo and inert
 * (no pointer events, hidden from assistive tech): the card's button opens the real embed.
 */
function InstagramPreview({ url }: { url: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / EMBED_WIDTH));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={box} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[linear-gradient(160deg,var(--accent-soft),var(--subtle)_55%,var(--hover))]">
      {scale !== null && (
        <iframe
          src={instagramEmbedUrl(url)}
          title="Instagram preview"
          tabIndex={-1}
          loading="lazy"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin"
          className="absolute top-0 left-0 origin-top-left border-0 bg-transparent"
          style={{
            width: EMBED_WIDTH,
            // Cards are 9:16: tall enough to cover one once the header is pulled up out of view.
            height: (EMBED_WIDTH * 16) / 9 + EMBED_HEADER,
            transform: `scale(${scale}) translateY(-${EMBED_HEADER}px)`,
          }}
        />
      )}
    </span>
  );
}

/** Holds which post is open and renders the embed modal. */
export function useReelPlayer() {
  const [open, setOpen] = useState<InstagramPost | null>(null);
  const player = (
    <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
      {open && (
        <DialogContent title={open.kind === "reel" ? "Instagram reel" : "Instagram post"} hideTitle surface="public" size="sm" className="max-w-[420px]">
          <div className="-mx-5 -my-4">
            <iframe
              src={instagramEmbedUrl(open.url)}
              title={open.caption ?? "Instagram post"}
              className="block h-[min(78dvh,720px)] w-full border-0 bg-canvas"
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
  return { open: setOpen, player };
}

export function ReelsCarousel({ posts, instagramUrl }: { posts: InstagramPost[]; instagramUrl: string }) {
  const { open, player } = useReelPlayer();
  return (
    <>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0" aria-label="Instagram reels">
        {posts.map((post) => (
          <li key={post.id} className="w-[62vw] max-w-[260px] shrink-0 snap-start">
            <ReelCard post={post} onOpen={() => open(post)} />
          </li>
        ))}
      </ul>
      {instagramUrl && (
        <Button asChild size="pub-md" className="mt-6">
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <InstagramIcon /> Follow us on Instagram
          </a>
        </Button>
      )}
      {player}
    </>
  );
}
