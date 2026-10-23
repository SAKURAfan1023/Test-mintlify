# TextIn Resources

TextIn customer stories and journal, built with Mintlify.

## Local preview

Use Node.js 24 LTS:

```sh
npx --yes mint@4.2.1096 dev --port 3001 --no-open
```

Open [localhost:3001](http://localhost:3001).

## Content maintenance

- `index.mdx`: resources homepage.
- `cases/list.mdx` and `news/list.mdx`: list cards and default filters.
- `cases/ID.mdx` and `news/ID.mdx`: article content, editable as MDX in the Mintlify console.
- `docs.json`: navigation, logos, footer links and site settings.
- `style.css` and `cases.js`: shared appearance and interactions.
- `images/` and `fonts/`: website assets.

Keep list cards and article titles, descriptions, dates and images synchronized. List filters read card attributes: `data-category`, `data-product`, `data-date` and, for customer stories, `data-scenarios`. Separate multiple scenarios with `|`, for example `Finance automation|Trade documentation`.

When adding an article, add its list card and navigation entry in `docs.json`, then update related reading links.

## Validation

```sh
npx --yes mint@4.2.1096 validate
npx --yes mint@4.2.1096 broken-links
node --check cases.js
```
