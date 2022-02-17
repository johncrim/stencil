import type * as d from '../../../declarations';
import { getModuleFromSourceFile } from '../transform-utils';
import ts from 'typescript';
import { addCoreRuntimeApi, RUNTIME_APIS } from '../core-runtime-apis';

/**
 * Import and define components along with any component dependents within the `dist-custom-elements` output.
 * Adds `defineCustomElement()` function for all components.
 * @param compilerCtx - current compiler context
 * @param components - all current components within the stencil buildCtx
 * @param outputTarget - the output target being compiled
 * @returns a TS AST transformer factory function
 */
export const addDefineCustomElementFunctionsInit = (
  compilerCtx: d.CompilerCtx,
  _components: d.ComponentCompilerMeta[],
  _outputTarget: d.OutputTargetDistCustomElements
): ts.TransformerFactory<ts.SourceFile> => {
  return () => {
    return (tsSourceFile: ts.SourceFile): ts.SourceFile => {
      const moduleFile = getModuleFromSourceFile(compilerCtx, tsSourceFile);
      // const newStatements: ts.Statement[] = [];
      // const caseStatements: ts.CaseClause[] = [];
      // const tagNames: string[] = [];
// i think we need to decouple this - the problem is that we add this CR-API, but that doesn't get added as an import for a long time.
// idk if its removed if we reorder this, but at the end of the day, we need proxyCustomElement to be added before we add the call to pCE with an anonymous class.
// the problem, is that the anonymous class exists properly after this transformer is called. so what we really need is
// 1. add the API
// 2. Generate the anonymous class
// 3. Use that anon class in the pCE call
// 4. call add imports
// 5. build out the recusive calls

      // this is soooo gross - one big side effect
      addCoreRuntimeApi(moduleFile, RUNTIME_APIS.proxyCustomElement);
      return tsSourceFile;
    };
  };
};
