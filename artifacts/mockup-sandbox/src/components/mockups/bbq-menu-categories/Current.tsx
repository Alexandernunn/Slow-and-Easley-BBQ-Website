import './_group.css';

const categories = ['Entrées', 'Sandwiches', 'Sides', 'Add-Ons', 'Desserts', 'BBQ Sauces', 'Beverages'];

export function Current() {
  return <div className="bbq-preview">
    <header>S&amp;E BBQ</header>
    <div className="order-layout">
      <nav className="category-nav" aria-label="Menu categories">
        {categories.map((name, i) => <a key={name} href={`#category-${i}`} aria-current={i === 0 ? 'location' : undefined}>{name}</a>)}
      </nav>
      <section className="menu-section" id="category-0"><span>01 / The menu</span><h2>Entrées</h2></section>
    </div>
  </div>;
}