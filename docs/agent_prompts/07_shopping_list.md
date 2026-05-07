# Fase 7 — Shopping List UI & Dashboard

> **Nota arquitectural (post Fase 5)**: la nutrición vive en `foods`, no en `products`. Cualquier query que necesite calorías/macros de un item debe hacer `LEFT JOIN foods ON products.food_id = foods.id`. Items con `food_id IS NULL` se cuentan para budget pero no aportan a las rings de macros — son productos sin match canónico (no debería pasar después del INNER JOIN del optimizer en Fase 6, pero el tipo permite el caso por defensividad).

3 prompts. La cara visible de la app: donde el usuario "compra" su semana.

---

## P7.A — Layout principal + item card

```prompt
🎯 TAREA: 7.1, 7.2 — Layout de /app/list + componente ItemCard

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/05_aesthetics.md (sección "The Shopping List Interaction" + "Imagery & Assets")
- docs/project_definition/04_brand_identity.md (tono motivador)
- docs/implementation_plan.md (Fase 7)
- components/ui/* (de Fase 1)

🛠️ SKILLS / MCPs A USAR:
- (ninguna especial)

📋 INSTRUCCIONES:
1. Crear `app/app/list/page.tsx` (server component):
   - Leer la última lista del user: `shopping_lists` + `shopping_list_items` joineados a `products`, y `products` joineados (LEFT JOIN) a `foods` para nutrición. En Supabase JS: `.select('*, items:shopping_list_items(*, product:products(*, food:foods(*)))')`.
   - Si no hay lista, mostrar empty state con CTA "Generar mi lista" → llama a `/api/shopping-list/generate`.
   - Si hay lista, renderizar el layout completo.

2. Layout del page:
   - **Header sticky superior** con:
     - Título "Tu Semana" + fecha de generación.
     - Subtítulo motivador (ej: "Comprá esto y tu semana queda lista 🔥" — usar emoji solo si el usuario aprueba; sino texto puro).
     - Botón "Regenerar" (ghost) que vuelve a llamar al API.
   - **Dashboard sticky** justo debajo del header (ver P7.B): será una banda con los radial charts.
   - **Lista de items** debajo, scrolleable.
   - **Footer fijo en mobile** con "Marcar todo" / "Compartir lista".

3. Crear `components/list/ItemCard.tsx`:
   - GlassCard con layout horizontal.
   - Izquierda: imagen del producto (PNG con bg removido si está disponible, sino fallback genérico). Background con un soft glow del color del producto.
   - Centro: nombre (bold), marca (subtle), categoría como chip pequeño.
   - Derecha-arriba: precio formateado en ARS con tabular-nums.
   - Derecha-abajo: cantidad ("500g" o "2 unidades") + logo SVG monocromo del super.
   - Estado checked: dim al 40%, tachado animado, ring opaco.
   - Click en cualquier parte del card toggle el `checked`.

4. Crear `lib/format.ts` con helpers:
   - `formatARS(value)`: ARS con separador de miles + símbolo `$`.
   - `formatGrams(g)`: "500g" o "1.5kg" según magnitud.
   - `formatDate(date, locale='es-AR')`.

5. La lista debe agruparse visualmente por categoría: "Proteínas", "Carbohidratos", "Grasas", "Vegetales", "Lácteos", etc. La categoría se lee de `food.category` (foods.category enum). Items sin food_id van a un grupo "Otros".

6. Agregar `app/api/shopping-list/items/[id]/check/route.ts` (PATCH):
   - Toggle del campo `checked` del item con id dado.
   - Verificar ownership.
   - Devolver el item actualizado.

🙋 ACCIÓN HUMANA REQUERIDA: Aprobación del uso de emojis si los proponés.

✅ CRITERIOS DE ACEPTACIÓN:
- /app/list muestra la lista del user con todos los items agrupados por categoría.
- Click en un item llama al API y persiste el estado `checked`.
- Empty state aparece si no hay lista.
- Layout responsive (mobile-first).

📁 ARCHIVOS A CREAR:
- app/app/list/page.tsx
- components/list/ItemCard.tsx
- components/list/CategoryGroup.tsx
- lib/format.ts
- app/api/shopping-list/items/[id]/check/route.ts
- public/supermarket_logos/{carrefour,coto,jumbo,dia}.svg (placeholder SVGs si no existen)
```

---

## P7.B — Animaciones + radial charts en tiempo real

```prompt
🎯 TAREA: 7.3, 7.4, 7.5, 7.6 — Animación check-off, radial charts macros + budget, header sticky

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/05_aesthetics.md (sección "Data Visualizations" + "Key Interactive Elements")
- components/ui/RadialProgress.tsx (de Fase 1)
- components/list/ItemCard.tsx (de P7.A)

🛠️ SKILLS / MCPs A USAR:
- simplify (al final)

📋 INSTRUCCIONES:

PARTE 1 — Animación de check-off
1. En `components/list/ItemCard.tsx`, implementar la animación de tachado:
   - On check: animar un `<line>` SVG cruzando el card de izquierda a derecha en 400ms ease-out.
   - Simultáneamente, transition del opacity del card a 0.4 en 300ms.
   - Optional: pequeño scale bounce (1 → 0.97 → 1) en 200ms para feedback haptic-like visual.
2. On uncheck: animación inversa.

PARTE 2 — Estado de macros / budget en tiempo real
3. Crear `lib/list/derive-progress.ts` con función pura `computeProgress(items, targets, budget) → ProgressState`:
   - Cada item incluye `qty_g`, `cost`, `checked`, y el `food` joineado (via LEFT JOIN). Macros aportadas = `(qty_g / 100) × food.protein_per_100g`, idem para carbs y fats.
   - Calcula sumas: cost de items checked, macros aportadas por items checked.
   - Items sin `food` se ignoran para macros (sólo cuentan para budget).
   - Devuelve %s relativos a targets.
4. Crear hook `useListProgress(listId)`:
   - Suscripción opt-in con Supabase Realtime al canal `shopping_list_items` (por list_id).
   - Cuando un item cambia (`checked`), recalcula el progreso localmente.
   - Devuelve `{ macros: { protein, carbs, fats }, budget, items_total, items_checked }`.

PARTE 3 — Dashboard component
5. Crear `components/dashboard/MacrosRing.tsx`:
   - Tres RadialProgress concéntricos (proteína cyan, carbos mint, grasas coral) o tres por separado side-by-side.
   - Animación cuando el valor cambia.
   - Label central: "X% / Y%" donde X es macros secured (de items checked) y Y es macros target (de items totales en lista).
6. Crear `components/dashboard/BudgetRing.tsx`:
   - RadialProgress con color que transiciona verde (mint) → naranja (coral-warm) → rojo (coral) según el % de budget consumido.
   - Center label: "$X / $Y".
7. Crear `components/dashboard/SummaryHeader.tsx` que compone:
   - SummaryHeader → "Tu costo: $X / Presupuesto $Y" + "Items: 3/24 ✓".
   - Reúne los rings + el header en una banda sticky.

PARTE 4 — Integración en /app/list
8. Modificar `app/app/list/page.tsx`:
   - Agregar el SummaryHeader sticky.
   - Pasar `useListProgress` a través de un client component wrapper.
9. Probar manualmente: chequear/deschequear items y verificar que los rings animen en tiempo real.

PARTE 5 — Performance
10. Asegurar 60fps: usar `transform` y `opacity` (no width/height) en animaciones, requestAnimationFrame para updates de SVG.
11. Lazy-load images con `next/image` y placeholder blur.

🙋 ACCIÓN HUMANA REQUERIDA: Al terminar, demo en mobile + desktop. El "feel" tiene que recordar a Apple Health.

✅ CRITERIOS DE ACEPTACIÓN:
- Tachar un item dispara animación suave + dim + actualización inmediata de los rings.
- BudgetRing cambia de color al pasar 75% / 90%.
- 60fps en mobile (verificar con Chrome DevTools Performance).
- Realtime: si abrís la app en dos pestañas y chequeás en una, la otra refleja el cambio.

📁 ARCHIVOS A CREAR / MODIFICAR:
- components/list/ItemCard.tsx (modificar — animación)
- lib/list/derive-progress.ts
- lib/list/use-list-progress.ts
- components/dashboard/MacrosRing.tsx
- components/dashboard/BudgetRing.tsx
- components/dashboard/SummaryHeader.tsx
- app/app/list/page.tsx (modificar)
```

---

## P7.C — Estados, exports, historial

```prompt
🎯 TAREA: 7.7, 7.8, 7.9 — Empty/loading/error states, share/export, vista de historial

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/04_brand_identity.md (tono de los empty/error states)
- app/app/list/* (de P7.A y P7.B)

🛠️ SKILLS / MCPs A USAR:
- simplify (al final)

📋 INSTRUCCIONES:
1. Estados:
   - **Empty state** (no hay lista todavía): GlassCard centrado con "Falta el primer paso. Generá tu lista de la semana." + botón primary "Generar".
   - **Loading state** (esperando generate API): skeleton de los items + un radial pulsando + texto "Buscando los mejores precios para vos…" (rota cada 3s entre 4 frases motivadoras).
   - **Error state** (generate falló): GlassCard rojo coral con mensaje claro + botón "Reintentar" + link "Reportar un problema".
   - **Infeasibility state** (lista parcial con feasible=false): banner naranja arriba con el `feasibility_message` del backend + botones de acción ("Subir presupuesto a $X", "Ajustar mi goal").

2. Exports:
   - `components/list/ShareMenu.tsx` con opciones:
     - **Compartir**: Web Share API (mobile native), fallback a copiar al clipboard.
     - **Copiar como texto**: arma un string plano "Pollo 1.5kg - $4500\n…" y lo copia.
     - **Imprimir**: window.print() con un CSS print stylesheet que oculta el header/dashboard y deja sólo la lista limpia.
   - `app/app/list/print.css` con reglas `@media print`.

3. Historial:
   - Crear `app/app/history/page.tsx`:
     - Lista de listas pasadas, ordenadas desc por `week_start`.
     - Cada row: fecha, costo total, % macros logrados (counted con items checked), botón "Ver detalle".
     - Detalle abre `/app/list/[id]` (read-only de listas pasadas).
   - Modificar `app/app/list/[id]/page.tsx` para soportar tanto "current" como "by id".

4. Mensajes motivadores rotativos en loading:
   - "Buscando los mejores precios para vos…"
   - "Comparando 4 supermercados…"
   - "Ajustando tu lista para tu objetivo…"
   - "Casi listo. Una decisión menos en tu semana."

5. Ejecutar `simplify` al final.

🙋 ACCIÓN HUMANA REQUERIDA: Aprobar los textos de los estados (revisar tono).

✅ CRITERIOS DE ACEPTACIÓN:
- Cada estado se ve bien en mobile + desktop.
- Compartir + copiar + imprimir funcionan.
- Historial muestra al menos 2 listas pasadas (genrarlas manualmente con queries SQL si hace falta para testear).
- Tono de los copys es consistente con la marca.

📁 ARCHIVOS A CREAR / MODIFICAR:
- components/list/EmptyState.tsx, LoadingState.tsx, ErrorState.tsx, InfeasibilityBanner.tsx
- components/list/ShareMenu.tsx
- app/app/list/print.css
- app/app/history/page.tsx
- app/app/list/[id]/page.tsx
- app/app/list/page.tsx (modificar para integrar estados)
```

---

## Cierre de fase

Esta es **la** fase que hace o rompe la sensación premium. Pedirle al usuario una sesión visual conjunta antes de pasar a Fase 8.
