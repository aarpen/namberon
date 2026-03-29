// lib/services.js
// Single source of truth for all services
// Change prices/durations here and it reflects everywhere

export const SERVICES = {
  haircut:       { label: 'Haircut',         price: 80,  duration: 20 },
  shave:         { label: 'Shave',           price: 50,  duration: 15 },
  beard_trim:    { label: 'Beard trim',      price: 60,  duration: 15 },
  haircut_shave: { label: 'Haircut + Shave', price: 120, duration: 30 },
  champi:        { label: 'Champi',          price: 80,  duration: 20 },
  facial:        { label: 'Facial',          price: 150, duration: 40 },
  hair_color:    { label: 'Hair color',      price: 200, duration: 45 },
}
