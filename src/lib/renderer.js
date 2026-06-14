import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '../../templates');

export function renderTemplate(config, pricingData) {
  const templateSrc = fs.readFileSync(path.join(templatesDir, 'portal.template.html'), 'utf8');
  const template = Handlebars.compile(templateSrc);

  // Register partials
  const partialsDir = path.join(templatesDir, 'sections');
  fs.readdirSync(partialsDir).forEach(file => {
    if (!file.endsWith('.partial.html')) return;
    const name = file.replace('.partial.html', '');
    const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
    Handlebars.registerPartial(name, content);
  });

  // Register theme tokens as partial
  const tokensCss = fs.readFileSync(path.join(templatesDir, 'theme/tokens.css'), 'utf8');
  Handlebars.registerPartial('theme/tokens.css', tokensCss);

  const html = template({
    ...config,
    pricingData: JSON.stringify(pricingData),
    generatedAt: new Date().toISOString()
  });

  return html;
}
