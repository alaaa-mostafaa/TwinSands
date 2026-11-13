import { useState } from 'react';
import { FIELD_PAIRS } from '../content';
import { usePhotos } from '../data';

const FAYOUM_MEDIA = [
  { src: 'photos/fayoum/im1.jpeg', name: 'im1', type: 'image' },
  { src: 'photos/fayoum/im2.jpeg', name: 'im2', type: 'image' },
  { src: 'photos/fayoum/im3.jpeg', name: 'im3', type: 'image' },
  { src: 'photos/fayoum/im4.mp4', name: 'im4', type: 'video' },
  { src: 'photos/fayoum/im5.jpeg', name: 'im5', type: 'image' },
] as const;

const DAHAB_MEDIA = [
  { src: 'photos/dahab/PHOTO-2026-11-11-21-20-26.jpg', name: 'Photo 1', type: 'image' },
  { src: 'photos/dahab/PHOTO-2026-11-11-21-20-26 2.jpg', name: 'Photo 2', type: 'image' },
  { src: 'photos/dahab/VIDEO-2026-11-11-21-20-25.mp4', name: 'Video', type: 'video' },
] as const;

const MADINA_MEDIA = [
  { src: 'photos/madina/im1.jpeg', name: 'Photo 1', type: 'image' },
  { src: 'photos/madina/im1.jpg', name: 'Photo 2', type: 'image' },
  { src: 'photos/madina/im2.jpeg', name: 'Photo 3', type: 'image' },
  { src: 'photos/madina/im4.mp4', name: 'im4', type: 'video' },
] as const;

const DESERTS_MEDIA = [
  { src: 'photos/deserts/im3.png', name: 'Photo 1', type: 'image' },
  { src: 'photos/deserts/im2.jpg', name: 'Photo 2', type: 'image' },
  { src: 'photos/deserts/im4.jpg', name: 'Photo 3', type: 'image' },
  { src: 'photos/deserts/im5.jpg', name: 'Photo 4', type: 'image' },
] as const;

const WHITE_DESERT_MEDIA = [
  { src: 'photos/white-desert/im1.png', name: 'Photo 1', type: 'image' },
  { src: 'photos/white-desert/im2.jpeg', name: 'Photo 2', type: 'image' },
  { src: 'photos/white-desert/im3.jpg', name: 'Photo 3', type: 'image' },
  { src: 'photos/white-desert/wind.jpg', name: 'Wind-carved cliff', type: 'image' },
] as const;

function FieldAlbum({ location, country = 'Egypt', items }: {
  location: string;
  country?: string;
  items: readonly { src: string; name: string; type: 'image' | 'video' }[];
}) {
  const [active, setActive] = useState(0);
  const media = items[active];
  const move = (offset: number) => setActive((index) => (index + offset + items.length) % items.length);

  return (
    <div className="field__img field__album">
      {media.type === 'video' ? (
        <video key={media.src} src={media.src} controls playsInline preload="metadata" aria-label={`${location} album video ${media.name}`} />
      ) : (
        <img src={media.src} alt={`${location} album photo ${media.name}`} />
      )}
      <button className="field__arrow field__arrow--prev" onClick={() => move(-1)} aria-label={`Previous ${location} photo or video`}>‹</button>
      <button className="field__arrow field__arrow--next" onClick={() => move(1)} aria-label={`Next ${location} photo or video`}>›</button>
      <span className="field__tag">{country} · {location} · {active + 1} / {items.length} · {media.name}</span>
    </div>
  );
}

/** Non-album field slots load a saved photo or show a drop zone for a local preview. */
function FieldSlot({ slot, prompt }: { slot: string; prompt: string }) {
  const [missing, setMissing] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const take = (f?: File) => f && f.type.startsWith('image/') && setLocal(URL.createObjectURL(f));
  if (slot === 'fayoum') return <FieldAlbum location="Fayoum, Egypt" items={FAYOUM_MEDIA} />;
  if (slot === 'pavement') return <FieldAlbum location="Dahab, Egypt" items={DAHAB_MEDIA} />;
  if (slot === 'dustdevil') return <FieldAlbum location="Al Madinah Al Munawwarah" country="Saudi Arabia" items={MADINA_MEDIA} />;
  if (slot === 'deserts') return <FieldAlbum location="Egyptian deserts" items={DESERTS_MEDIA} />;
  if (slot === 'wind') return <FieldAlbum location="White Desert, Egypt" items={WHITE_DESERT_MEDIA} />;
  if (!missing || local) {
    return (
      <div className="field__img">
        <img src={local ?? `field/${slot}.jpg`} alt={prompt} onError={() => setMissing(true)} />
        <span className="field__tag">Egypt · our photo{local ? ' (preview)' : ''}</span>
      </div>
    );
  }
  return (
    <label className="field__drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files[0]); }}>
      <input type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
      <span className="field__plus">+</span>
      <span>{prompt}</span>
      <em>Drop a photo to preview. To keep it, save it as public/field/{slot}.jpg</em>
    </label>
  );
}

export function Boots() {
  const photos = usePhotos();
  return (
    <section className="boots" id="boots">
      <header className="chapter-head">
        <h2>We Had to See It for Ourselves</h2>
        <p>Our own photos from Fayoum, Dahab, the White Desert, and Al Madinah Al Munawwarah in Saudi Arabia, alongside places and features from other worlds.</p>
      </header>
      <div className="boots__grid">
        {FIELD_PAIRS.map((p) => (
          <div className="field" key={p.slot}>
            <FieldSlot slot={p.slot} prompt={p.prompt} />
            {p.slot === 'fayoum' ? (
              <div className="field__mars-card">
                <div className="field__img field__img--panorama">
                  <img
                    src="photos/fayoum-curiosity-panorama-user.png"
                    alt="Curiosity panorama of hill Bolívar and sand ridges on Mars"
                    loading="lazy"
                  />
                </div>
                <p className="field__description">
                  Curiosity captured hill Bolívar and adjacent sand ridges on Aug. 23, 2022, as it made its way toward Mount Sharp’s sulfate-bearing region.{' '}
                  <a href="https://phys.org/news/2022-10-nasa-curiosity-mars-rover-long-awaited.html" target="_blank" rel="noreferrer">
                    Image: NASA/JPL-Caltech/MSSS · Source
                  </a>
                </p>
              </div>
            ) : (
              <div className="field__img">
                <img src={`photos/${p.rover}.webp`} alt={p.caption} loading="lazy" />
                <span className="field__tag field__tag--mars">
                  {p.caption}{photos?.[p.rover] ? ` · ${photos[p.rover].date?.slice(0, 4)}` : ''}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="foot" id="sources">
      <div className="foot__top">
        <div>
          <div className="brand brand--big"><img className="brand__logo" src="logo.svg" alt="" /><span>Twin<br />Sands</span></div>
          <p className="foot__team">Team Phobos &amp; Deimos · NASA Space Apps Cairo 2026</p>
          <p className="foot__note">A similarity score is a ranking aid, not a probability, and nothing here identifies a safe landing or habitat site. Earth twin coordinates are approximate unless they come from our measured windows. Independent student project; not affiliated with or endorsed by NASA, ESA or USGS.</p>
        </div>
      </div>
    </footer>
  );
}
