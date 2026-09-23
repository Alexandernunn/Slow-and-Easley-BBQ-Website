// Centralized Site Configuration
export const siteConfig = {
  // IMPORTANT: Replace this with your actual live domain once launched (e.g., https://slowandeasley.com)
  canonicalUrl: "https://example.com"
};

export const restaurant = {
  name: "Slow & Easley BBQ & Soul Food",
  description: "Tennessee BBQ & Fried Fish",
  tagline: "BBQ & Soul Food",
  address: {
    street: "123 Main St [PLACEHOLDER]",
    city: "[CITY]",
    region: "TN",
    postalCode: "[ZIP]",
    country: "US"
  },
  phone: "+1-555-019-8273",
  displayPhone: "(555) 019-8273 [PLACEHOLDER]",
  hours: "Mo-Su 11:00-20:00 [PLACEHOLDER]",
  // Add actual schedules here when hours are confirmed; do not publish invented opening hours.
  openingHours: [],
  geo: {
    latitude: null,
    longitude: null
  },
  social: {
    facebook: "https://facebook.com/placeholder",
    instagram: "https://instagram.com/placeholder"
  }
};

export const menu = [
  {
    category: "Entrées",
    note: "All come with 2 sides, additional sides $5 each",
    items: [
      { name: "Fried Whitefish (Cajun or Regular)", price: 12, description: "Crispy fried whitefish with white onions, pickles, bread, hot sauce & mustard on the side. Add cheese +$1" },
      { name: "Pulled Pork Sandwich", price: 12, description: "Slow-cooked pulled pork on a soft bun with onions, jalapeños & pickles" },
      { name: "Smoked Chicken Wings, 4 whole", price: 20, description: "Served with ranch and a roll" },
      { name: "Smoked Chicken Wings, 6 whole", price: 25, description: "Served with ranch and a roll" },
      { name: "Spaghetti", price: 12, description: "Made with seasoned ground beef" },
      { name: "Smoked Chicken Leg Quarters (2)", price: 15, description: "Seasoned and slow-cooked to perfection" },
      { name: "Fish + Spaghetti", price: 20, description: "Fried whitefish (Cajun or regular) with a generous portion of spaghetti, white onions, pickles, bread, hot sauce & mustard on the side. Add cheese to fish +$1" }
    ]
  },
  {
    category: "Sandwiches",
    note: "Served on a soft bun with pickles, red onions & jalapeños",
    items: [
      { name: "Fried Whitefish Sandwich", price: 12 },
      { name: "Pulled Pork Sandwich", price: 12 },
      { name: "Chicken Sandwich", price: 12 },
      { name: "Polish Sausage Sandwich", price: 10 }
    ]
  },
  {
    category: "Sides",
    note: "$5 each",
    items: [
      { name: "Spicy Cabbage", price: 5 },
      { name: "Green Beans", price: 5 },
      { name: "Baked Beans", price: 5 },
      { name: "Cole Slaw", price: 5 },
      { name: "Potato Salad", price: 5 },
      { name: "Fries", price: 5 }
    ]
  },
  {
    category: "Add-Ons",
    items: [
      { name: "Extra Roll", price: 0.75 },
      { name: "Wings", price: 3 },
      { name: "Fish", price: 5 }
    ]
  },
  {
    category: "Desserts",
    items: [
      { name: "Chess Pie", price: 4 }
    ]
  },
  {
    category: "BBQ Sauces",
    note: "Regular or Spicy. Half Slab (6 bones) comes with 1 sauce, Whole Slab (12 bones) comes with 2 sauces.",
    items: [
      { name: "Additional Sauce", price: 1 }
    ]
  }
];
