export function getHtmlHead(title: string): string {
  return `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="Milo's personal website">
      <meta name="author" content="Milo Spirig">

      <title>${title}</title>
      
      <link rel="icon" type="image/x-icon" href="/favicon.ico">
      <link rel="stylesheet" href="/style.css">
      <script defer src="/_vercel/insights/script.js"></script>
    </head>
  `;
}
