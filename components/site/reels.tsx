"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { InstagramIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { instagramEmbedUrl } from "@/lib/instagram";
import type { InstagramPost } from "@/server/content";

/**
 * Instagram reels/posts behind a facade (DESIGN.md §11.3 (5), AGENTS.md §10): our own thumbnail
 * until tapped, then Instagram's embed in a modal. Nothing from Instagram loads before the tap.
 */

export function ReelCard({ post, onOpen }: { post: InstagramPost; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-canvas text-left outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
      aria-label={`Play ${post.kind === "reel" ? "reel" : "post"}${post.caption ? `: ${post.caption}` : ""}`}
    >
      {post.thumbnailPath ? (
        <Image src={post.thumbnailPath} alt="" fill sizes="(min-width: 1024px) 260px, 62vw" className="object-cover" />
      ) : (
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,var(--accent-soft),var(--subtle)_55%,var(--hover))]" />
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
        <InstagramIcon aria-hidden className="size-4" />
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-ink shadow-[var(--shadow-layer)] transition-transform duration-200 [@media(hover:hover)]:group-hover:scale-105">
          <Play aria-hidden className="ml-0.5 size-6 fill-current" />
        </span>
      </span>
      {post.caption && <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-[14px] font-medium text-white">{post.caption}</span>}
    </button>
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
