---
name: hallmark
description: Anti-slop craft audit and discipline skill for TeacherAI. Use for auditing UI craft, study of design hierarchy, contrast checks, and preventing generic AI slop. Enforces Astryx design system and teacheraiTheme tokens.
---

# Hallmark — TeacherAI Craft & Anti-Slop Discipline

## Core Purpose
Hallmark is an audit and discipline skill for TeacherAI / Lycero. It ensures that every UI surface meets world-class craft standards while remaining strictly bound to the **Astryx Design System** (`@teacherai/design-system-core`) and **TeacherAI Theme Tokens** (`apps/web/src/theme/teacheraiTheme.ts`).

## Invariant Rules
1. **Audit & Study Only:** Use Hallmark to audit spacing, contrast, typographic hierarchy, and responsiveness.
2. **Astryx Source of Truth:** Never replace the Astryx app shell or components with arbitrary HTML or foreign Tailwind components.
3. **Product Theme:** Theme is locked to `teacheraiTheme` (Stitch light / Claude-warm dark).
4. **Ponytail Ladder:** Never add third-party styling or widget libraries if Astryx or native HTML5 elements already cover the need.
