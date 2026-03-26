'use client';

import { useState } from 'react';

export default function ProductImageGallery({ images, mainImage, name }) {
  const allImages = [];

  if (mainImage) allImages.push(mainImage);
  if (Array.isArray(images)) {
    images.forEach((img) => {
      if (img && img !== mainImage) allImages.push(img);
    });
  }

  if (allImages.length === 0) {
    allImages.push('https://placehold.co/800x800?text=Product');
  }

  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i === 0 ? allImages.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === allImages.length - 1 ? 0 : i + 1));

  return (
    <div className="panel-surface overflow-hidden rounded-[2rem] border border-palette-light/80 shadow-panel">
      {/* Main image with arrows */}
      <div className="relative bg-white p-6">
        <img
          src={allImages[index]}
          alt={`${name} ${index + 1}`}
          className="h-full min-h-80 w-full rounded-[1.5rem] object-cover"
        />

        {allImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-8 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md border border-palette-light hover:bg-white transition"
            >
              <svg className="h-5 w-5 text-palette-dark" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-8 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md border border-palette-light hover:bg-white transition"
            >
              <svg className="h-5 w-5 text-palette-dark" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2 w-2 rounded-full transition ${i === index ? 'bg-palette-primary w-4' : 'bg-palette-dark/30'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto px-6 pb-5">
          {allImages.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === index
                  ? 'border-palette-primary'
                  : 'border-palette-light hover:border-palette-primary/50'
              }`}
            >
              <img src={img} alt={`${name} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
