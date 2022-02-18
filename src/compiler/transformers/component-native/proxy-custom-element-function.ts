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
      const extracted = (
        principalComponent: d.ComponentCompilerMeta
      ): { varDec: ts.VariableDeclaration; statementIdx: number } | null => {
        for (let i = 0; i < tsSourceFile.statements.length; i++) {
          const statement = tsSourceFile.statements[i];
          if (ts.isVariableStatement(statement)) {
            const classDeclaration = statement.declarationList.declarations.find(
              (declaration: ts.VariableDeclaration) =>
                declaration.name.getText() === principalComponent.componentClassName
            );
            if (classDeclaration) {
              return {
                varDec: classDeclaration,
                statementIdx: i,
              };
            }
          }
        }
        return null;
      };

      if (moduleFile.cmps.length) {
        // TODO: There's a side effect related to moving this down....find it
        tsSourceFile = addImports(
          transformOpts,
          tsSourceFile,
          [RUNTIME_APIS.proxyCustomElement],
          transformOpts.coreImportPath
        );

        const principalComponent = moduleFile.cmps[0];
        const result = extracted(principalComponent);
        if (result === null) {
          return tsSourceFile;
        }

        let { statementIdx, varDec } = result;

        // get the initializer from the Stencil component's class declaration
        const proxyCreationCall = createAnonymousClassMetadataProxy(principalComponent, varDec.initializer);
        ts.addSyntheticLeadingComment(proxyCreationCall, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);

        const proxiedComponentDeclaration = ts.factory.updateVariableDeclaration(varDec, varDec.name,  undefined,undefined, proxyCreationCall);

        ////
        const proxiedComponentVariableStatement = ts.factory.createVariableStatement(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createVariableDeclarationList(
            [proxiedComponentDeclaration],
            ts.NodeFlags.Const
          )
        );
        ///


        tsSourceFile = ts.factory.updateSourceFile(tsSourceFile, [
          ...tsSourceFile.statements.slice(0, statementIdx),
          proxiedComponentVariableStatement,
          ...tsSourceFile.statements.slice(statementIdx + 1),
        ]);
      }

      return tsSourceFile;
    };
  };
};
