import type * as d from '../../../declarations';
// import { getModuleFromSourceFile } from '../transform-utils';
import ts from 'typescript';
// import { addCoreRuntimeApi, RUNTIME_APIS } from '../core-runtime-apis';

/**
 * Import and define components along with any component dependents within the `dist-custom-elements` output.
 * Adds `defineCustomElement()` function for all components.
 * @param compilerCtx - current compiler context
 * @returns a TS AST transformer factory function
 */
export const addDefineCustomElementFunctionsInit = (_compilerCtx: d.CompilerCtx): ts.TransformerFactory<ts.SourceFile> => {
  return () => {
    return (tsSourceFile: ts.SourceFile): ts.SourceFile => {
      // const moduleFile = getModuleFromSourceFile(compilerCtx, tsSourceFile);
      // this is soooo gross - one big side effect
      // addCoreRuntimeApi(moduleFile, RUNTIME_APIS.proxyCustomElement);
      return tsSourceFile;
    };
  };
};
