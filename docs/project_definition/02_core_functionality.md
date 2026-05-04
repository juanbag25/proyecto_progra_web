# Core Functionality & Features

## 1. Comprehensive User Profiling
The app captures a detailed physiological and behavioral profile of the user to generate highly accurate nutritional baselines:
- **Biometrics & Necessities:** Age, weight, height, gender, BMR (Basal Metabolic Rate).
- **Activity Profile:** Daily exercise levels, type of exercise, overall lifestyle active/sedentary context.
- **Dietary Preferences & Restrictions:** Preferred foods, allergies, intolerances (vegan, gluten-free, etc.).
- **Fitness Goals:** Gain muscle mass, lose body fat, body recomposition, gain strength, maintenance.
- **Budget Constraint:** Maximum weekly or monthly expenditure allowed for groceries.
- **Geographic Location:** Country and specific region to target accurate supermarket chains.

## 2. AI Expert Nutrition Engine
- Acts as a science-backed nutritionist.
- Takes the user profile and calculates precise **Macro-nutrients** (Proteins, Carbs, Fats) and **Micro-nutrients** (Vitamins, Minerals, Fiber) necessary for the time period (e.g., a week).
- Ensures the generated dietary foundation is perfectly healthy and aligned with the latest scientific literature in sports nutrition and general health.

## 3. Web Scraping & Grocery Search Engine
- Scrapes online stores based on the user's location (e.g., Argentina: Carrefour, Coto, Jumbo, Dia).
- Extracts critical data points for available food items:
  - Product Name and Brand
  - Price
  - Weight/Volume
  - Nutritional Information (Calories, Macros, Micros per 100g/serving).

## 4. Optimization Algorithm (The "Shopping List Builder")
- This is the crux of the app. It cross-references the AI Nutritional baseline, the user's budget, and the scraped supermarket data.
- Solves a multi-variable optimization problem: *How to fulfill 100% of the macros and micros for the week, using the user's preferred foods, without exceeding the budget limitation?*
- Outputs a definitive, easy-to-read Shopping List.

## 5. Result Delivery & Export
- Presents the final Shopping List as a plain text list or simple UI checklist.
- Includes total calculated weekly calories, total macros, and total price to provide transparency, reassuring the user that budget and macros are fully respected.
