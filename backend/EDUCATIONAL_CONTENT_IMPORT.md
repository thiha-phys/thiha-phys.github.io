# Import Grade 10–12 learning content into Neon

Run these in the Neon SQL Editor, in this order:

1. `migrations/005_educational_content_categories.sql`
2. `seeds/003_educational_content_g10.sql`
3. `seeds/003_educational_content_g11.sql`
4. `seeds/003_educational_content_g12.sql`

Each seed is a one-time import. Do not run a seed again after administrators have edited the records, because it would add duplicate rows. The import includes 4,722 records: Grade 10 (1,182), Grade 11 (1,379), and Grade 12 (2,161). Grade 12 includes 13 old-question chapter summaries and 23 paper/sample entries.

The customer app reads educational content through the authenticated API. The admin app provides the Learning Content page for adding, editing, hiding, and deleting records. The calculation cards and Grade 12 old-question papers retain their original HTML layout when imported.


The original source files used to prepare this import are stored in the repository-level `import-source/educational` folder. That folder is outside the Vercel customer, admin, and backend project roots. Raw SQL seeds and migration files are excluded from the backend deployment.
