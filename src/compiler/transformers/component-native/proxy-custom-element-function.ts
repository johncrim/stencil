import type * as d from '../../../declarations';
import { createAnonymousClassMetadataProxy } from '../add-component-meta-proxy';
import { getModuleFromSourceFile } from '../transform-utils';
import ts from 'typescript';
import { RUNTIME_APIS } from '../core-runtime-apis';
import { addImports } from '../add-imports';

/**
 * Import and define components along with any component dependents within the `dist-custom-elements` output.
 * Adds `defineCustomElement()` function for all components.
 * @param compilerCtx current compiler context
 * @param transformOpts transpilation options for the current build
 * @returns a TS AST transformer factory function
 */
export const proxyCustomElement = (
  compilerCtx: d.CompilerCtx,
  transformOpts: d.TransformOptions
): ts.TransformerFactory<ts.SourceFile> => {
  return () => {
    return (tsSourceFile: ts.SourceFile): ts.SourceFile => {
      const moduleFile = getModuleFromSourceFile(compilerCtx, tsSourceFile);
      if (!moduleFile.cmps.length) {
        return tsSourceFile;
      }
      const principalComponent = moduleFile.cmps[0];

      for (let [stmtIndex, stmt] of tsSourceFile.statements.entries()) {
        if (ts.isVariableStatement(stmt)) {
          for (let [declarationIndex, declaration] of stmt.declarationList.declarations.entries()) {
            if (declaration.name.getText() !== principalComponent.componentClassName) {
              continue;
            }

            // get the initializer from the Stencil component's class declaration, wrap it in a component proxy
            const proxyCreationCall = createAnonymousClassMetadataProxy(principalComponent, declaration.initializer);
            ts.addSyntheticLeadingComment(proxyCreationCall, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);

            // update the variable declaration to use the new initializer
            const proxiedComponentDeclaration = ts.factory.updateVariableDeclaration(
              declaration,
              declaration.name,
              declaration.exclamationToken,
              declaration.type,
              proxyCreationCall
            );

            // update the declaration list that contains the updated variable declaration
            const updatedDeclarationList = ts.factory.updateVariableDeclarationList(stmt.declarationList, [
              ...stmt.declarationList.declarations.slice(0, declarationIndex),
              proxiedComponentDeclaration,
              ...stmt.declarationList.declarations.slice(declarationIndex + 1),
            ]);

            // update the variable statement containing the updated declaration list
            const updatedVariableStatement = ts.factory.updateVariableStatement(
              stmt,
              [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
              updatedDeclarationList
            );

            // update the source file's statements to use the new variable statement
            tsSourceFile = ts.factory.updateSourceFile(tsSourceFile, [
              ...tsSourceFile.statements.slice(0, stmtIndex),
              updatedVariableStatement,
              ...tsSourceFile.statements.slice(stmtIndex + 1),
            ]);

            // finally, ensure that the proxyCustomElement function is imported
            tsSourceFile = addImports(
              transformOpts,
              tsSourceFile,
              [RUNTIME_APIS.proxyCustomElement],
              transformOpts.coreImportPath
            );
            return tsSourceFile;
          }
        }
      }
      return tsSourceFile;
    };
  };
};
