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

      for (let i = 0; i < tsSourceFile.statements.length; i++) {
        const statement = tsSourceFile.statements[i];
        if (ts.isVariableStatement(statement)) {
          for (let j = 0; j < statement.declarationList.declarations.length; j++) {
            const declaration = statement.declarationList.declarations[j];
            if (declaration.name.getText() === principalComponent.componentClassName) {
                // get the initializer from the Stencil component's class declaration
                const proxyCreationCall = createAnonymousClassMetadataProxy(principalComponent, declaration.initializer);
                ts.addSyntheticLeadingComment(proxyCreationCall, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);

                const proxiedComponentDeclaration = ts.factory.updateVariableDeclaration(declaration, declaration.name,  declaration.exclamationToken,declaration.type, proxyCreationCall);
                const proxiedComponentVariableStatement = ts.factory.updateVariableStatement(
                  statement,
                  [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
                  ts.factory.updateVariableDeclarationList(statement.declarationList, [
                    ...statement.declarationList.declarations.slice(0, j),
                    proxiedComponentDeclaration,
                    ...statement.declarationList.declarations.slice(j+1),
                  ])
                );
                ///

                tsSourceFile = ts.factory.updateSourceFile(tsSourceFile, [
                  ...tsSourceFile.statements.slice(0, i),
                  proxiedComponentVariableStatement,
                  ...tsSourceFile.statements.slice(i + 1),
                ]);
              // TODO: There's a side effect related to moving this down....find it
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
      }
        return tsSourceFile;
      }
  };
};
