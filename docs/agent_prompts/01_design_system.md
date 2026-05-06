# Fase 1 — Design System & Brand Layer

**Estado: 🟡 MOSTLY DONE.** El theme Tailwind, los estilos globales, las fuentes y la mayor parte de la biblioteca de componentes ya están en el repo (heredados del scaffold + commits P0.A–C). Lo que queda es un cierre quirúrgico de gaps + algunos componentes que faltan.

| Sub-fase | Estado                    | Resumen                                                                                               |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| P1.A     | ✅ DONE (con 1 micro-gap) | Theme Tailwind con naming semántico + globals.css + fuentes Outfit/Inter                              |
| P1.A.1   | ⏳ PROMPT NUEVO           | Cierre de gap: `scroll-behavior: smooth` + QA visual de `/design-system`                              |
| P1.B     | 🟡 PARCIAL                | 9 de los 14 componentes ya existen. Faltan: `Modal`, `Sheet`, `Toast`, `SwipeableCard`, `NumberInput` |

> **Importante para futuros agentes:** el naming de tokens y las convenciones del codebase difieren del spec literal que escribí originalmente. La fuente de verdad es `CLAUDE.md` + `tailwind.config.js`. Ver también la sección "Convenciones del codebase" en [`README.md`](./README.md).

---

## P1.A — Theme Tailwind + estilos globales + fuentes [DONE con 1 gap]

**Qué se hizo:**

- `tailwind.config.js` con `darkMode: 'class'` y theme extendido completo:
  - **Colores:** `canvas.{base, raised, elevated}` (no charcoal/midnight planos), `accent.{cyan, mint}`, `warn.{coral, orange}`, `hairline`, `glass`.
  - **Tipografía:** `font-display` (Outfit) y `font-sans` (Inter) — separados intencionalmente, NO encadenados.
  - **Letter-spacing:** `tracking-tightest`, `tracking-tighter2`.
  - **Backdrop blur:** `backdrop-blur-glass`.
  - **Sombras de glow:** `shadow-glow-cyan`, `shadow-glow-mint`, `shadow-glow-coral`, `shadow-inset-hairline` (cada una con su tinte propio, no una "glow" genérica).
  - **Easing:** `ease-premium` = `cubic-bezier(0.16, 1, 0.3, 1)`.
  - **Background images:** `bg-mesh-hero` (radial gradient), `bg-accent-gradient`, `bg-warn-gradient`.
  - **Animaciones:** `animate-fade-up` para entrance reveals.
- `app/layout.tsx`: carga Outfit + Inter via `next/font/google`, fuerza `dark` class en `<html>`, body con `bg-canvas-base font-sans text-white antialiased`.
- `app/globals.css`: `:root { color-scheme: dark }`, selección de texto en cyan @ 25%, `.glass` y `.glass-strong` como component classes, `.tabular` opt-in para datos numéricos, scrollbar custom, slider custom (`.fitlist-slider`), select custom (`.fitlist-select`).
- `app/page.tsx` y `app/design-system/page.tsx` ya consumen los tokens correctamente.

**Único gap real:** falta `html { scroll-behavior: smooth }` en `globals.css`. Se cierra en P1.A.1.

---

## P1.A.1 — Cierre de gap: scroll suave + QA visual

````prompt
🎯 TAREA: Cerrar el único gap pendiente de P1.A — scroll suave + QA visual del design system.

📚 CONTEXTO OBLIGATORIO A LEER:
- CLAUDE.md (sección "Brand & visual system — non-negotiable")
- docs/project_definition/05_aesthetics.md
- app/globals.css (estado actual)
- app/design-system/page.tsx (showcase existente)

🛠️ SKILLS / MCPs A USAR:
- (ninguna)

📋 INSTRUCCIONES:
1. Editar `app/globals.css`: en el bloque `@layer base { html, body { ... } }`, agregar a la regla de `html` (o crear una entrada separada) la propiedad `scroll-behavior: smooth`. **Importante:** respetar `prefers-reduced-motion` envolviendo en `@media (prefers-reduced-motion: no-preference)` para no romper accesibilidad.

   Resultado esperado:
   ```css
   @media (prefers-reduced-motion: no-preference) {
     html {
       scroll-behavior: smooth;
     }
   }
   ```

2. Levantar `npm run dev` y abrir http://localhost:3000/design-system. Verificar visualmente:
   - Fondo `bg-mesh-hero` se ve sutil sobre `bg-canvas-base`.
   - Glassmorphism nítido en Chrome y Safari (probar ambos si es posible).
   - Fuente Outfit (display) e Inter (body) cargadas sin FOUT — DevTools → Network → filtrar por "font".
   - Todos los componentes existentes (`GlassCard`, `Button`, `Input`, `Select`, `RadialProgress`, `Slider`, `Typography`, `ColorSwatch`, `GroceryCard`) renderizan bien.
   - Selección de texto en cyan @ 25%.
   - Anchor links del showcase (si los hay) hacen scroll suave.

3. Si encontrás divergencias visuales con el doc de aesthetics, documentá la lista en un comentario al usuario antes de tocar nada — NO arregles unilateralmente.

🙋 ACCIÓN HUMANA REQUERIDA: Al final, pedile al usuario que vea `/design-system` y dé visto bueno antes de pasar a P1.B.

✅ CRITERIOS DE ACEPTACIÓN:
- `globals.css` tiene `scroll-behavior: smooth` con guard de `prefers-reduced-motion`.
- `/design-system` se ve consistente con el doc de aesthetics.
- `npm run typecheck` y `npm run lint` siguen limpios.

📁 ARCHIVOS A MODIFICAR:
- app/globals.css
````

---

## P1.B — Componentes UI faltantes + extensión del showcase

```prompt
🎯 TAREA: 1.3 (parcial) — Agregar los 5 componentes UI que faltan + sumarlos al showcase de `/design-system`.

📚 CONTEXTO OBLIGATORIO A LEER:
- CLAUDE.md (sección "UI component pattern" — el patrón a respetar)
- docs/project_definition/05_aesthetics.md (sección "Key Interactive Elements")
- components/ui/Button.tsx (referencia del patrón `base + variants/sizes records`)
- components/ui/GlassCard.tsx (referencia de ref-forwarding)
- app/design-system/page.tsx (showcase a extender)

🛠️ SKILLS / MCPs A USAR:
- simplify (al final, para revisar duplicación entre los nuevos componentes)

📋 INSTRUCCIONES:

PARTE 1 — Componentes existentes (NO tocar)
Estos ya están en `components/ui/` y siguen el patrón correcto:
`GlassCard.tsx`, `Button.tsx`, `Input.tsx`, `Select.tsx`, `RadialProgress.tsx`, `Slider.tsx`, `Typography.tsx`, `ColorSwatch.tsx`, `GroceryCard.tsx`.
Si necesitás extenderlos (ej: agregar una variant), avisá al usuario antes — son load-bearing.

PARTE 2 — Componentes a crear
Para cada uno: archivo en `components/ui/<Nombre>.tsx`, tipos TS estrictos, props bien documentadas, **mismo patrón que `Button.tsx`** (`base` string + `variants`/`sizes` records keyed por union types, composición via template literals; ref-forwarding cuando aplique). Usar SOLO tokens del theme: `bg-canvas-*`, `accent-cyan`, `accent-mint`, `warn-coral`, `warn-orange`, `border-hairline`, `bg-glass`, `shadow-glow-*`, `ease-premium`, etc.

1. **`NumberInput.tsx`** — variante de `Input.tsx` con steppers + validación min/max.
   - Props: `value`, `onChange`, `min`, `max`, `step`, `unit?` (ej: "kg", "cm", "$").
   - Steppers `+`/`−` a la derecha, con hover state cyan glow.
   - Aplicar clase `tabular` (definida en `globals.css`) al display del valor.
   - Validación: si valor fuera de rango, agregar ring `warn-coral`.

2. **`Modal.tsx`** — diálogo modal full-screen con backdrop blur.
   - Implementarlo nativo con `<dialog>` + `dialog.showModal()` y manejo de ESC + click fuera, **antes** de proponer instalar Radix. Si el comportamiento es insuficiente, justificar y pedir aprobación al usuario para `@radix-ui/react-dialog`.
   - Animación de entrada: scale 0.95 → 1 + opacity 0 → 1 en 200ms `ease-premium`.
   - Backdrop: `bg-canvas-base/80` + `backdrop-blur-glass`.
   - Contenido envuelto en `.glass-strong`.

3. **`Sheet.tsx`** — variante de Modal que entra desde abajo (mobile-friendly).
   - Mismo patrón que Modal pero translateY(100%) → translateY(0).
   - Útil para forms y filtros en mobile.
   - Drag-to-dismiss optional para v2 — no implementar ahora.

4. **`Toast.tsx`** — notificación efímera no bloqueante.
   - Provider + hook `useToast()` que devuelve `{ show, dismiss }`.
   - Stack abajo-derecha en desktop, abajo-centro en mobile.
   - Variants: `success` (mint), `error` (coral), `info` (cyan).
   - Auto-dismiss en 4s con barra de progreso visible.
   - Empezar con implementación propia (es un patrón conocido). Si crece complejidad, evaluar `sonner` con aprobación del usuario.

5. **`SwipeableCard.tsx`** — card con gesture handlers para left/right swipe.
   - Props: `onSwipeLeft`, `onSwipeRight`, `threshold` (px, default 80), children.
   - Pointer events nativos (no `framer-motion`) — `onPointerDown`/Move/Up + `transform: translateX()`.
   - Respeta `prefers-reduced-motion`: si está activo, deshabilitar drag visual y solo tomar tap.
   - Si la implementación nativa queda fea o complicada, pedir aprobación para `framer-motion`.

PARTE 3 — Extender el showcase
Editar `app/design-system/page.tsx` agregando una sección por cada componente nuevo (con título tipo `<h2 className="font-display ...">`):

- **NumberInput** — variantes con/sin unit, con error state.
- **Modal** — botón que abre un modal de ejemplo con título + body + acción.
- **Sheet** — botón que abre un sheet desde abajo con form simple.
- **Toast** — botones para disparar success/error/info.
- **SwipeableCard** — un card de demo con feedback visual al swipe (texto que dice "← swipe para descartar / aprobar →").

PARTE 4 — Reglas inviolables (recordatorio)
- **Tokens, no hex.** Nunca uses `#00F0FF` directo — usá `accent-cyan` o `text-accent-cyan`.
- **Tipografía:** títulos con `font-display`, body con `font-sans`. NUNCA importar `next/font` fuera de `app/layout.tsx`.
- **Glassmorphism:** usar `.glass`/`.glass-strong` o `<GlassCard>`. NO inline.
- **Easing:** todas las transiciones con `ease-premium`.
- **Datos numéricos:** clase `.tabular` para que alineen perfecto.

PARTE 5 — Cierre
- Correr `npm run typecheck` y `npm run lint`.
- Correr `npm run build` para verificar que no haya errores de bundling.
- Invocar la skill `simplify` para detectar duplicación entre los 5 componentes nuevos.

🙋 ACCIÓN HUMANA REQUERIDA:
- Aprobación SI proponés instalar `@radix-ui/react-dialog`, `sonner`, o `framer-motion`. Por defecto, intentá vanilla primero.
- Al final, demo visual de `/design-system` y visto bueno antes de pasar a Fase 2.

✅ CRITERIOS DE ACEPTACIÓN:
- Los 5 componentes nuevos viven en `components/ui/` y siguen el patrón de `Button.tsx`.
- `/design-system` muestra cada uno funcionando.
- Hover states con transición `ease-premium`.
- Modal y Sheet se cierran con ESC y click fuera.
- Toast aparece, auto-dismiss funciona, stack acumula correctamente.
- SwipeableCard responde a touch + mouse drag, threshold respetado.
- `prefers-reduced-motion` desactiva animaciones agresivas.
- `npm run build` pasa sin errores ni warnings nuevos.
- `npm run typecheck` y `npm run lint` limpios.

📁 ARCHIVOS A CREAR / MODIFICAR:
- components/ui/NumberInput.tsx (nuevo)
- components/ui/Modal.tsx (nuevo)
- components/ui/Sheet.tsx (nuevo)
- components/ui/Toast.tsx (nuevo)
- components/ui/SwipeableCard.tsx (nuevo)
- app/design-system/page.tsx (extender, NO reescribir)
- package.json (solo si el usuario aprueba alguna dep nueva)
```

---

## Cierre de fase

Al terminar P1.A.1 + P1.B, `/design-system` debería mostrar las 14 piezas del kit de UI funcionando. Pedile al usuario una sesión visual conjunta antes de pasar a Fase 2 (Authentication). La calidad visual de esta fase determina toda la sensación de la app — vale la pena la pausa.
