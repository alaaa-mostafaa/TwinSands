import { useState } from 'react';
import { FIELD_PAIRS } from '../content';
import { usePhotos } from '../data';

/** One field slot: loads public/field/<slot>.jpg if the team has added it; otherwise a drop zone (local preview only). */
function FieldSlot({ slot, prompt }: { slot: string; prompt: string }) {
  const [missing, setMissing] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const take = (f?: File) => f && f.type.startsWith('image/') && setLocal(URL.createObjectURL(f));
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
        <h2>Boots on the Ground</h2>
        <p>Our own photos from Egypt’s Western Desert and Fayoum, each next to the rover picture it echoes. Same question, two worlds.</p>
      </header>
      <div className="boots__grid">
        {FIELD_PAIRS.map((p) => (
          <div className="field" key={p.slot}>
            <FieldSlot slot={p.slot} prompt={p.prompt} />
            <div className="field__img">
              <img src={`photos/${p.rover}.webp`} alt={p.caption} loading="lazy" />
              <span className="field__tag field__tag--mars">{p.caption}{photos?.[p.rover] ? ` · ${photos[p.rover].date?.slice(0, 4)}` : ''}</span>
            </div>
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
          <div className="brand brand--big"><span className="brand__dot" /><span>Twin<br />Sands</span></div>
          <p className="foot__team">Team Phobos &amp; Deimos · NASA Space Apps Cairo 2026</p>
          <p className="foot__note">A similarity score is a ranking aid, not a probability, and nothing here identifies a safe landing or habitat site. Earth twin coordinates are approximate unless they come from our measured windows. Independent student project; not affiliated with or endorsed by NASA, ESA or USGS.</p>
        </div>
      </div>
    </footer>
  );
}
