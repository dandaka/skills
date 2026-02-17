---
name: interview
description: Conduct a structured interview about an implementation plan to clarify requirements, explore tradeoffs, and identify gaps. Use when the user says "interview me", "question the plan", "validate the plan", or wants critical review of a plan before implementation. Works with plans from files OR plans discussed in the current conversation.
---

## Plan Source

Determine where the plan is:
1. **File path provided** → Read the file
2. **Plan discussed in conversation** → Use conversation context
3. **Neither** → Ask user: "Where is the plan? Provide a file path or describe it here."

## Interview Process

Use AskUserQuestion tool to explore these areas systematically:

### 1. Technical Implementation (2-3 questions)
- Edge cases and error handling not addressed
- Performance implications and scalability
- Integration points with existing code
- Data flow and state management

### 2. UI/UX (2-3 questions, if applicable)
- User flows not covered in the plan
- Accessibility considerations
- Loading, error, and empty states
- Mobile/responsive behavior

### 3. Tradeoffs & Alternatives (2-3 questions)
- Why this approach over alternatives?
- What was explicitly rejected and why?
- Reversibility of decisions

### 4. Risks & Concerns (1-2 questions)
- What could go wrong?
- Dependencies or blockers?
- Security implications?

## Question Guidelines

- Skip questions the plan already clearly answers
- Focus on gaps, ambiguities, and implicit assumptions
- Ask "what if...", "why not...", and "have you considered..." questions
- Probe deeper on vague answers
- Challenge assumptions politely

## Completion Criteria

After 8-12 questions total (or when all relevant areas are thoroughly covered), write a refined spec.

Output location:
- If user specified path → write there
- Otherwise → ask where to save

The spec should include:
- Summary of the plan
- Refined requirements based on interview answers
- Key decisions made during the interview
- Open questions (if any remain unresolved)
