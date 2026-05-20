const Lookup = {
    SUGGSTIONS: [
        {
            label: 'Restaurant Website',
            prompt: 'Create a cinematic restaurant website for "Saffron & Smoke" with an editorial food-photography hero, chef story, signature menu, private dining, reservations, gallery, testimonials, and a contact page with a visible map.'
        },
        {
            label: 'Portfolio Website',
            prompt: 'Build a premium photographer portfolio for "Northlight Studio" with a full-bleed landscape hero, curated gallery collections, services, process, client stories, booking CTA, and a contact section with a map. Use an elegant layout, not a bento grid.'
        },
        {
            label: 'SaaS Landing Page',
            prompt: 'Create a polished SaaS website for "OrbitIQ", an AI operations platform, with a sharp product hero, feature deep-dives, workflow steps, integrations, security proof, customer outcomes, pricing, FAQ, and contact/demo booking.'
        },
        {
            label: 'Real Estate Website',
            prompt: 'Develop a multi-page real estate website for "Harbor & Key" with neighborhood-focused property listings, featured homes, agent profiles, buying/selling guides, market stats, testimonials, and a contact page with map.'
        },
        {
            label: 'E-commerce Store',
            prompt: 'Create a premium e-commerce website for a modern skincare brand with a sensory hero, best sellers, product benefits, ingredient story, bundles, reviews, editorial lifestyle images, FAQ, and contact/support.'
        },
        {
            label: 'Corporate Site',
            prompt: 'Build a refined corporate website for "Aster Strategy Group" with a confident hero, services, industries, case studies, leadership team, process, FAQ, contact page with map, and a polished multi-column footer.'
        },
        {
            label: 'Fitness Studio Website',
            prompt: 'Design an energetic fitness studio website for "Pulse Forge" with a powerful training hero, programs, trainer profiles, class schedule, transformations, membership pricing, testimonials, and a contact/location map.'
        },
        {
            label: 'Travel Planner',
            prompt: 'Create an immersive travel planning website for "Wayline Trips" with destination storytelling, itinerary builder sections, curated packages, traveler reviews, seasonal picks, image-rich guides, newsletter, and contact/map.'
        },
        {
            label: 'Marketing Agency Website',
            prompt: 'Build a bold marketing agency website for "Signal House" with a memorable hero, campaign services, case-study snapshots, creative process, client logos, measurable results, lead-capture form, and contact page with map.'
        },
        {
            label: 'Event Website',
            prompt: 'Create a vibrant conference website for "FutureStack Summit" with a striking event hero, speaker lineup, agenda, workshops, sponsor strip, ticket tiers, venue details, FAQ, and contact/map.'
        }
    ],

    DEFAULT_FILE: {
        '/index.html':
        {
            code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Website</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />
    <script>
      window.tailwind = window.tailwind || {};
      window.tailwind.config = {
        theme: {
          extend: {
            colors: {
              background: "var(--background)",
              foreground: "var(--foreground)",
              card: "var(--card)",
              "card-foreground": "var(--card-foreground)",
              primary: "var(--primary)",
              "primary-foreground": "var(--primary-foreground)",
              muted: "var(--muted)",
              "muted-foreground": "var(--muted-foreground)",
              border: "var(--border)",
              input: "var(--input)"
            }
          }
        }
      };
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.jsx"></script>
  </body>
</html>`
        },
        '/index.jsx': {
            code: `import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
        },
        '/App.jsx': {
            code: `import React from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center p-10">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Welcome to Your AI Website
        </h1>
        <p className="mt-4 text-gray-500">
          Your generated code will appear here.
        </p>
      </div>
    </div>
  );
}
`
        },
        '/styles.css': {
            code: `:root {
  color-scheme: light;
}

html, body {
  height: 100%;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
    "Segoe UI Emoji";
}
`
        },
        '/vite.config.js': {
            code: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: "**/*.{js,jsx,ts,tsx}"
    })
  ]
});
`
        },
    },
    DEPENDENCIES: {
        "vite": "latest",
        "@vitejs/plugin-react": "latest",
        "framer-motion": "latest",
        "lucide-react": "latest",
        "react-router-dom": "latest",
        "tailwind-merge": "latest",
        "tailwindcss-animate": "latest",
        "clsx": "latest",
        "react": "^19.2.4",
        "react-dom": "^19.2.4",
        "esbuild-wasm": "0.15.18"
    }
};

export default Lookup;
