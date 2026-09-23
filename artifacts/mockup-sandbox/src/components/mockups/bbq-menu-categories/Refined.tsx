import './_group.css';
import './refined.css';
import { useState, type CSSProperties } from 'react';

const categories = [
  { name: 'Entrées', mobile: <>Entrées</> },
  { name: 'Sandwiches', mobile: <>Sand-<br />wiches</> },
  { name: 'Sides', mobile: <>Sides</> },
  { name: 'Add-Ons', mobile: <>Add-<br />Ons</> },
  { name: 'Desserts', mobile: <>Desserts</> },
  { name: 'BBQ Sauces', mobile: <>BBQ<br />Sauces</> },
  { name: 'Beverages', mobile: <>Bever-<br />ages</> },
];

export function Refined() {
  const [active, setActive] = useState(0);
  return <div className="bbq-preview refined">
    <header>S&amp;E BBQ</header>
    <div className="order-layout">
      <nav className="category-nav" aria-label="Menu categories" style={{ '--active-offset': `${active * 100}%` } as CSSProperties}>
        {categories.map(({ name, mobile }, i) => <a key={name} href={`#category-${i}`} onClick={event => { event.preventDefault(); setActive(i); }} aria-label={name} aria-current={i === active ? 'location' : undefined}><span className="category-label-full">{name}</span><span className="category-label-mobile" aria-hidden="true">{mobile}</span></a>)}
      </nav>
      <section className="menu-section" id="category-0"><span>01 / The menu</span><h2>Entrées</h2></section>
    </div>
  </div>;
}