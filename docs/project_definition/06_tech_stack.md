# Tech Stack Definition

This document outlines the specific technologies and architectural choices for building the application, ensuring a scalable, secure, and highly performant product.

## 1. Core Languages

- **JavaScript (ES6+)**: The primary programming language for all logic across both the front-end components and back-end serverless functions.
- **HTML5**: Utilizing semantic tags to ensure an accessible and well-structured application, which is important for SEO and screen readers.
- **CSS3 / PostCSS**: Modern CSS architecture, working behind the scenes with Tailwind to manage custom animations (like the swipe/check-off micro-animations) and specific `backdrop-filter` effects for our glassmorphic surfaces.

## 2. Front-End Framework

- **React (via Next.js)**
  - **Why Next.js?** Since deployment is targeting **Vercel**, Next.js is the absolute best React framework to use. It provides out-of-the-box routing, Server-Side Rendering (SSR) for blazing-fast load times, and API routes that will be necessary for executing our background nutrition algorithms.
  - **Component Architecture**: We will build reusable highly-styled UI components (Glass Cards, Swipeable Onboarding forms, Radial Progress Bars).

## 3. Styling & User Interface

- **Tailwind CSS**
  - We will use Tailwind as our utility-first CSS framework. It speeds up UI development massively.
  - **Custom Theme Configuration**: The `tailwind.config.js` will be heavily customized to include our specific brand colors: _Deep Charcoal Backgrounds_, _Electric Cyan_, _Vibrant Mint Green_, and _Coral Orange_.
  - We will build Tailwind utility classes specifically for our Glassmorphism effects (e.g., combining bg-opacity, blur filters, and thin borders).

## 4. Backend, Database & Authentication

- **Supabase**
  - **Database (PostgreSQL)**: To store complex relational data: User Profiles, Biometrics, Dynamic Shopping Lists, and the master database of scraped Supermarket foods and their nutritional values.
  - **Authentication**: Managing User Sign-ups and Logins simply and securely.
  - **Row Level Security (RLS)**: Ensuring users can only access their own biometrics and their own weekly shopping lists.

## 5. Web Scraping & AI Automation Concept

- **Scraping Layer (Node.js via Next.js API Routes / Background Workers)**:
  - Using libraries like **Puppeteer** or **Cheerio** built into Vercel Serverless/Edge functions to scrape prices and nutritional data from Carrefour, Coto, Jumbo, and Dia.
- **External AI Integrations (The Nutritional Engine)**:
  - We can integrate an AI LLM API (like OpenAI or Gemini) securely in the Next.js backend to perform the complex, science-backed mapping of User goals -> Macro targets, before running our own internal algorithm to match those targets to the scraped food database.

## 6. Hosting & Deployment

- **Vercel**
  - **Hosting**: seamless, zero-config deployment heavily optimized for Next.js.
  - **CI/CD**: Automatic deployments with every Git push. Whenever we merge a feature, it automatically deploys to a live testing environment.
  - **Serverless Functions**: Vercel handles the API routes gracefully, meaning we don't have to manage a heavy standalone Node server. It scales automatically.
