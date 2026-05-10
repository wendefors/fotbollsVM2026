---
Datum: 2026-05-08
tags:
  - AI
  - vibeCoding
---
# Prompt Template (Hybrid: English + Swedish Context)

<!--
Detta är en generell mall för att skriva instruktioner till en AI i markdown.
Struktur och instruktioner är på engelska.
Kontext skrivs på svenska där det är naturligt.
Optimerad för att bygga webbapplikationer.
-->
## Goal
<!--
Beskriv tydligt vad som ska uppnås.
Fokusera på slutresultatet ("definition of done").
-->
En webapp med möjlighet för multipla användare att skicka in sina resultat för tippning för fotbolls-VM. Det ska även finnas en resultatsida där användarna kan följa resultaten och sin placering i tävlingen. Det ska gå att se allas inskickade tippningar, inte bara sin egen. Det innebär att vi inte behöver ha någon inloggningsmöjlighet.
## Context
<!--
Beskriv relevant bakgrund.
Här kan du skriva på svenska.
Inkludera system, tech stack, begränsningar och vad som redan finns.
-->
Herrarnas fotbolls-VM 2026 i USA. Tippningstävlingen är ett återkommande event och brukar ha ett 50-tal deltagare. Det är ingen professionell tippning utan enbart ett kompisgäng som tävlar mot varandra. Fokus brukar vara att tippa Sveriges matcher, samtliga ettor och tvåor i alla grupper och topp 3 i slutresultatet.
## Role
You are a senior fullstack engineer with strong experience in modern web development.
You prioritize clean architecture, maintainability, and pragmatic solutions.
You write clear, production-ready code and avoid unnecessary complexity.
## Design
The design should be clean, modern, and minimal.
Prioritize usability, clarity, and consistency across the interface.
Use generous whitespace and clear visual hierarchy.
### Design Principles
- Keep UI simple and intuitive
- Use consistent spacing, typography, and component patterns
- Avoid unnecessary visual noise
- Prefer accessibility and readability over aesthetics
### Color Palette

### Typography
- Primary: DM Sans (Regular, Medium, Bold)
- Fallback: Arial
- Use bold for headings and regular for body text
### UI Guidelines
- Use a light background with subtle contrast between surface and background
- Prefer calm, desaturated tones for larger surfaces
- Use subtle shadows and borders for separation
- Ensure responsive design (mobile-first)
- Maintain a warm but professional and technical feel
## Instructions
<!--
Lista konkreta steg modellen ska utföra.
Börja varje punkt med ett verb.
Var specifik.
-->
### General
1. Clarify assumptions if needed
2. Design the overall architecture
3. Define the main components and structure
4. Suggest data models and state management
5. Define API endpoints or data flow (if applicable)
6. Provide example implementation
7. Explain key technical decisions briefly
### Functions
1. Sida för att skicka in sin tippning inklusive kontaktuppgifter (förnamn, efternamn, telefonnummer, e-post). Sidan ska vara öppen till och med turneringen startar, sedan ska den stängas. Informationen ska sparas i två tabeller i Supabase
2. Sida för att se samtligas inskickade tippningar (namnges med initialer pga GDPR). Enbart läsläge.
3. Sida för att följa resultaten och poängligan. Även här enbart med initialer.
4. Eventuellt en admin-sida där enbart jag kan gå in och lägga in resultaten för matcherna och gruppspelsplaceringarna. Detta är lägsta prio något vi eventuellt utvecklare senare.
## Output Format
- Comunicate in swedish
- Use markdown
- Structure the response with clear headings
- Include code blocks for all code
- Separate explanation and implementation clearly
- Keep explanations concise and focused on decisions
## Constraints
- Do not overengineer the solution
- Prefer simple and maintainable approaches
- Use common and well-supported patterns
- Avoid unnecessary dependencies
- Assume a modern web stack unless specified otherwise
## Quality Criteria
- Clean and readable code
- Logical and scalable structure
- Production-ready (not just examples)
- Minimal but sufficient explanation
- Consistent naming and patterns
## Avoid
- Overly abstract or theoretical solutions
- Unnecessary complexity
- Long generic explanations
- Mixing multiple architectural styles without reason
- Placeholder or incomplete code
## Meta
If something is unclear or missing, ask clarifying questions before providing a full solution.
## Input
<!--
Om du skickar med dynamisk input (t.ex. JSON, kod, data), placera det här.
Separera tydligt från instruktionerna.
-->

```json
{
  
}