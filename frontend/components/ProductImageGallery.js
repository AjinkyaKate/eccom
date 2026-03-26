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

  const [selected, setSelected] = useState(allImages[0]);

  return (
    <div className="panel-surface overflow-hidden rounded-[2rem] border border-palette-light/80 shadow-panel">
      <div className="relative bg-white p-6">
        <img
          src={selected}
          alt={name}
          className="h-full min-h-80 w-full rounded-[1.5rem] object-cover"
        />
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto px-6 pb-5">
          {allImages.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(img)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                selected === img
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
