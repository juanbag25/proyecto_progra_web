# App Aesthetics & UI/UX Guidelines

## Overall Vibe
**Premium, Trustworthy, Modern, and Dynamic.**
The app must not feel like a dry Excel sheet or a generic medical app. It needs to feel like a high-end, premium fitness tool (think Nike Run Club mixed with Apple Health) that wows the user immediately upon opening. 

## 1. Color Palette
We want to move away from overly generic "health greens". We will utilize a sleek, ultra-modern palette heavily favoring a **Dark Mode aesthetic**:
- **Backgrounds (The Canvas):** Deep, rich darks. (e.g., *Rich Charcoal* `#121212` to *Midnight Blue* `#0A0F1A`). Dark backgrounds make the products, food, and data visualizations pop.
- **Primary Accents (The Tech/Health Vibe):** *Electric Cyan* (`#00F0FF`) and *Vibrant Mint Green* (`#00E676`). These represent the tech innovation and biological health aspects.
- **Secondary Accents (Action/Energy):** *Coral / Action Orange* (`#FF6B6B` or `#FF8E53`) used sparingly for critical call-to-actions, warnings, or hitting fitness milestones.
- **Surfaces:** Use slightly elevated dark grays (`#1E1E24`) for cards with subtle white borders at 5% opacity to create depth.

## 2. Typography
- **Primary Font:** **Outfit** or **Inter** (Google Fonts). Uncompromisingly modern, highly legible sans-serif fonts.
- **Headers:** High contrast, pure white (`#FFFFFF`) with tracking (letter-spacing) pulled slightly tight for a premium, heavy look. 
- **Data Numbers:** Use tabular numbers so budget digits and macro grams align perfectly in lists and tables. Large, bold, accent-colored fonts for key metrics (like Total Budget spent).

## 3. UI Treatment: Glassmorphism & Depth
- **Cards and Containers:** Employ "Glassmorphism" for key components (like the User Profile summary or the Weekly Budget limits). Semi-transparent backgrounds with a heavy background blur (`backdrop-filter: blur(16px)`).
- **Gradients:** Subtle, shifting mesh gradients in the background for the onboarding phase to make it feel alive and fluid.

## 4. Key Interactive Elements & Micro-animations
An interface that feels alive encourages user interaction and softens the "data heavy" nature of the app.
- **Onboarding (The Interview):** Present questions as smooth, large, swipable cards. No long, boring scrolling forms. 
- **The "Shopping List" Interaction:** When the user checks an item off their list, cross it out with a satisfying swoop animation, slightly dim the item, and subtly update the "Macros Secured" ring chart at the top of the screen in real-time.
- **Data Visualizations:** Use sleek radial progress bars for Budget Tracking (e.g., a green ring that turns orange if you get close to the limit) and Macro targets.

## 5. Imagery & Assets
- **Food Representation:** High-quality, vibrant images of food with backgrounds removed (PNGs with transparency). Floating above the dark glassmorphic cards. No cheap stock photos.
- **Supermarket Integration:** Clean, monochrome SVGs of the supermarket logos (Carrefour, Coto) mixed into the UI when listing scraping results.

## Summary Checklist for Developers
- [ ] Ensure a flawless Dark Mode foundation.
- [ ] Apply **Outfit / Inter** typography.
- [ ] Use CSS variables for the Cyan/Mint/Coral accent colors.
- [ ] Integrate Glassmorphism on overlay elements and modals.
- [ ] Add smooth CSS `transition` timings (e.g., `300ms ease-in-out`) to all buttons, hovers, and list-checks.
