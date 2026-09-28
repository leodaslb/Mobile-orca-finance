module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [function tablerIndividualImports({ types: t }) {
      return {
        name: 'tabler-individual-imports',
        visitor: {
          ImportDeclaration(path) {
            const node = path.node;
            if (node.source.value !== '@tabler/icons-react-native' || node.importKind === 'type') return;

            const remaining = [];
            const individual = [];
            for (const specifier of node.specifiers) {
              if (t.isImportSpecifier(specifier) && specifier.importKind !== 'type' && /^Icon[A-Z]/.test(specifier.imported.name)) {
                individual.push(t.importDeclaration(
                  [t.importDefaultSpecifier(t.cloneNode(specifier.local))],
                  t.stringLiteral(`@tabler/icons-react-native/${specifier.imported.name}`),
                ));
              } else {
                remaining.push(specifier);
              }
            }
            if (!individual.length) return;
            if (remaining.length) {
              node.specifiers = remaining;
              path.replaceWithMultiple([node, ...individual]);
            } else {
              path.replaceWithMultiple(individual);
            }
          },
        },
      };
    }],
  };
};
