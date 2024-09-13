import {readFile, writeFile, mkdir, rm, readdir} from 'node:fs/promises';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import dedent from 'dedent';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const modReplacementsPath = path.resolve(dirname, '../module-replacements');
const manifestsDirPath = path.join(modReplacementsPath, 'manifests');
const pagesPath = path.join(fileURLToPath(import.meta.url), '../../src/pages');

const manifestFiles = await readdir(manifestsDirPath);
const allReplacements = new Set();

const allTypeNames = new Set();

for await (const name of manifestFiles) {
  if (!name.endsWith('.json')) {
    continue;
  }

  const manifest = JSON.parse(await readFile(path.join(manifestsDirPath, name), 'utf8'));

  for (const replacement of manifest.moduleReplacements) {
    allTypeNames.add(replacement.type);

    allReplacements.add(replacement);
  }
}

for (const typeName of allTypeNames) {
  const typeDir = path.join(pagesPath, `./${typeName}`);
  await rm(typeDir, {recursive: true, force: true});
  await mkdir(typeDir, {recursive: true});
}

async function getDocumentedPage(docPath, replacements) {
  const docFullPath = path.join(modReplacementsPath, 'docs/modules/', `${docPath}.md`);
  const docContents = await readFile(docFullPath, 'utf8');
  const replacementsArr = [...replacements];
  const replacementsSlice = replacementsArr.slice(0, 3);
  const replacementsString = replacementsSlice.map((repl) => repl.moduleName).join(', ')
    + (replacementsSlice.length === replacementsArr.length ? '' : ' and more');

  return dedent`---
  layout: '../../layouts/Layout.astro'
  title: Replacements for ${replacementsString}
  ---
  ${docContents}
  `;
}

const groupedByDocPath = new Map();

for (const replacement of allReplacements) {
  switch (replacement.type) {
    case 'documented':
      const group = groupedByDocPath.get(replacement.docPath) ?? new Set();
      group.add(replacement);
      groupedByDocPath.set(replacement.docPath, group);
      break;
  }
}

for (const [docPath, replacements] of groupedByDocPath.entries()) {
  const replacement = replacements.values().next().value;
  const typeDir = path.join(pagesPath, `./${replacement.type}`);
  const pageName = replacement.moduleName.replace(/[@\/]/g, '-');
  const pagePath = path.join(typeDir, `./${pageName}.md`);

  await writeFile(pagePath, await getDocumentedPage(docPath, replacements));
}
