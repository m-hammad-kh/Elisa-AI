const Lookup = {
    SUGGSTIONS: [
        {
            label: 'Restaurant Website',
            prompt: 'Create a modern restaurant website with a dark theme, gold gradients, and sections for Menu, Reservations, and Gallery.'
        },
        {
            label: 'Portfolio Website',
            prompt: 'Build a professional portfolio for a photographer with a minimalist bento grid layout and smooth scroll animations.'
        },
        {
            label: 'SaaS Landing Page',
            prompt: 'Create a high-end SaaS landing page for an AI tool with glassmorphism, mesh gradients, and a pricing section.'
        },
        {
            label: 'Real Estate Website',
            prompt: 'Develop a multi-page real estate website with interactive maps, property listings, and a contact form.'
        },
        {
            label: 'E-commerce Store',
            prompt: 'Create a colorful and vibrant e-commerce landing page for a premium brand with product grids and hover effects.'
        },
        {
            label: 'Corporate Site',
            prompt: 'Build a clean and professional corporate website with sections for Services, Team, FAQ, and a multi-column footer.'
        },
        {
            label: 'Fitness Studio Website',
            prompt: 'Design a bold fitness studio website with trainer profiles, pricing tiers, and a class schedule section.'
        },
        {
            label: 'Travel Planner',
            prompt: 'Create a travel planning website with destination cards, a map section, and a newsletter signup.'
        },
        {
            label: 'Marketing Agency Website',
            prompt: 'Build a modern marketing agency website with case studies, services, and a lead capture section.'
        },
        {
            label: 'Event Website',
            prompt: 'Create an event website with speaker lineup, schedule, ticket pricing, and venue details.'
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
