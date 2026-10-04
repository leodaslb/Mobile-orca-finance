const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Executa os services TypeScript reais nos testes Node, sem incluir React Native.
module.exports = function createLoader(stubs = {}) {
  const root = path.resolve(__dirname, '..');
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: absolute,
    }).outputText;
    const localRequire = specifier => {
      if (Object.prototype.hasOwnProperty.call(stubs, specifier)) return stubs[specifier];
      if (!specifier.startsWith('@/') && !specifier.startsWith('.')) return require(specifier);
      const target = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2))
        : path.resolve(path.dirname(absolute), specifier);
      return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : fs.existsSync(`${target}.tsx`) ? `${target}.tsx` : path.join(target, 'index.ts'));
    };
    vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename: absolute })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
};
