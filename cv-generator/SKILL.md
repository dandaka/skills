# CV Generator Skill

Generate professional PDF CVs/resumes from markdown using `md-to-pdf`.

## Usage

```bash
npx md-to-pdf cv.md
```

This generates `cv.pdf` in the same directory.

## Markdown Template

Use YAML frontmatter for PDF options and CSS styling:

```markdown
---
pdf_options:
  format: Letter
  margin: 20mm
css: |
  @font-face {
    font-family: 'Libertinus Serif';
    src: local('Libertinus Serif'), local('LibertinusSerif-Regular');
  }
  @font-face {
    font-family: 'Libertinus Serif';
    src: local('Libertinus Serif Bold'), local('LibertinusSerif-Bold');
    font-weight: bold;
  }
  @font-face {
    font-family: 'Libertinus Serif';
    src: local('Libertinus Serif Italic'), local('LibertinusSerif-Italic');
    font-style: italic;
  }
  body {
    font-family: 'Libertinus Serif', 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.35;
  }
  h1 {
    font-size: 20pt;
    text-align: center;
    margin-bottom: 0.1em;
    font-weight: bold;
  }
  .subtitle {
    text-align: center;
    font-size: 12pt;
    margin-bottom: 0.2em;
  }
  .contact {
    text-align: center;
    font-size: 10pt;
    margin-bottom: 1em;
  }
  .summary {
    font-style: italic;
    margin-bottom: 1em;
    padding: 0 1em;
  }
  h2 {
    font-size: 12pt;
    margin-top: 0.8em;
    margin-bottom: 0.3em;
    border-bottom: 1px solid #333;
    padding-bottom: 0.15em;
    text-transform: uppercase;
  }
  h3 {
    font-size: 10.5pt;
    margin-top: 0.6em;
    margin-bottom: 0.15em;
  }
  ul {
    margin-top: 0.2em;
    margin-bottom: 0.4em;
  }
  li {
    margin-bottom: 0.1em;
  }
  p {
    margin-bottom: 0.4em;
  }
---

# Name

<div class="subtitle">Title</div>
<div class="contact">email · phone · location · linkedin</div>

<div class="summary">
Professional summary in italic...
</div>

## Experience

### Company — Role, Years

- Bullet points

## Technical Background

### Category

- Skills

## Core Competencies

- **Competency** — Description

## Education

**University** — Degree, Years

## Languages

Language (Proficiency) · Language (Native)
```

## PDF Options

Available `pdf_options`:
- `format`: Letter, A4, Legal, etc.
- `margin`: e.g., "20mm" or { top, right, bottom, left }
- `printBackground`: true/false
- `landscape`: true/false

## Tips

- Use `<div class="...">` for custom styled sections
- Libertinus Serif gives an academic/professional look
- Keep font size 10-11pt for readability on Letter/A4
- Line height 1.3-1.4 works well for CVs
