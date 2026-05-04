# User Workflow & Journey

## Phase 1: Onboarding & Data Collection
1. **Sign Up / Login:** User creates an account.
2. **Profile Questionnaire (The Interview):**
   - User inputs biometrics (weight, height, age, gender).
   - User inputs fitness goals (e.g., gain muscle, lose weight).
   - User defines lifestyle and exercise frequency (active, sedentary, athlete).
   - User inputs dietary preferences (e.g., "I love chicken and rice, hate fish") and restrictions (e.g., "lactose intolerant", "vegan").
3. **Logistics Input:**
   - User specifies their location (e.g., Buenos Aires, Argentina).
   - User defines their weekly grocery budget limit (e.g., $50,000 ARS).

## Phase 2: AI Nutritional Calculation (Background Process)
1. The **AI Nutrition Engine** kicks in.
2. It calculates the total weekly TDEE (Total Daily Energy Expenditure * 7), creating the appropriate deficit or surplus based on the user's goals.
3. Defines exact weekly targets for Proteins, Carbohydrates, Fats, and essential Micronutrients.
4. The system validates these targets against established scientific dietary guidelines.

## Phase 3: Market Scraping & Optimization (Background Process)
1. The app identifies the available supermarkets in the user's defined region (e.g., Coto, Jumbo, Carrefour, Dia).
2. The **Web Scraper** queries these stores online for foods matching the user's preferences and general healthy staples.
3. The **Optimizer Algorithm** takes the scraped database (combining prices + nutritional value per gram) and builds a combination of products that:
   - Hit or closely match the exact weekly nutritional targets.
   - Stay under the defined budget cap.
   - Respect all user food preferences and allergies.

## Phase 4: Delivery & Execution
1. **The Reveal:** The app presents the finalized Shopping List to the user in a clean, simple text/checklist format.
2. **Summary Dashboard:** User sees a quick rundown:
   - "Your Total Weekly Cost: $48,500 ARS. 100% within Budget."
   - "Total Weekly Macros Provided: 1000g Protein, 2000g Carbs, 500g Fats."
   - "Micros Checked: Your vitamin / fiber needs are met."
3. **Action:** User goes to the supermarket (or orders online) and buys exactly what is on the list.
4. **Consumption (Frictionless Tracking):** User eats the food throughout the week however they want. By the end of the week, if all the food is gone, the user has precisely hit their nutritional goals without needing to track a single meal in a diary app!

## Phase 5: Weekly Feedback Loop
1. At the end of the week, the app asks a short prompt: "Did you finish the food? Did you stay on budget? How is your weight progressing?"
2. The user inputs their current weight and any adjustments to their budget or preferences.
3. The system recalibrates the baseline metrics and pulls fresh supermarket prices to generate the next week's updated list.
