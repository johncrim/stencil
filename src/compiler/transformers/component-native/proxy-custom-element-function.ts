import type * as d from '../../../declarations';
import { createAnonymousClassMetadataProxy } from '../add-component-meta-proxy';
import { getModuleFromSourceFile } from '../transform-utils';
import ts from 'typescript';

/**
 * Import and define components along with any component dependents within the `dist-custom-elements` output.
 * Adds `defineCustomElement()` function for all components.
 * @param compilerCtx - current compiler context
 * @returns a TS AST transformer factory function
 */
export const proxyCustomElement = (
  compilerCtx: d.CompilerCtx,
): ts.TransformerFactory<ts.SourceFile> => {
  return () => {
    return (tsSourceFile: ts.SourceFile): ts.SourceFile => {
      const moduleFile = getModuleFromSourceFile(compilerCtx, tsSourceFile);

      const extracted = (principalComponent: d.ComponentCompilerMeta): {myStatement: ts.Expression | null, statementIdx: number | null } => {
        let statementIdx = null;
        let myStatement = null;

        for (let i = 0; i < tsSourceFile.statements.length; i++) {
          const statement = tsSourceFile.statements[i];
          if (ts.isVariableStatement(statement)) {
            const classDeclaration = statement.declarationList.declarations.find((declaration: ts.VariableDeclaration) => declaration.name.getText() === principalComponent.componentClassName);
            if (classDeclaration) {
              return {
                myStatement: classDeclaration.initializer,
                statementIdx: i,
              }
            }
          }
        }
        return { statementIdx, myStatement };
      }

      if (moduleFile.cmps.length) {
        const principalComponent = moduleFile.cmps[0];
        let { statementIdx, myStatement } = extracted(principalComponent);

        if (myStatement === null || statementIdx === null) {
          return tsSourceFile;

        }
        const proxyCreationCall = createAnonymousClassMetadataProxy(principalComponent, myStatement);
        ts.addSyntheticLeadingComment(proxyCreationCall, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);

        const _ryanUseThisBelow = ts.factory.createVariableStatement(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createVariableDeclarationList(
            [
              ts.createVariableDeclaration(
                principalComponent.componentClassName,
                undefined,
                proxyCreationCall
              ),
            ],
            ts.NodeFlags.Const
          )
        );

        let contents = [...tsSourceFile.statements.slice(0, statementIdx), _ryanUseThisBelow, ...tsSourceFile.statements.slice(statementIdx+1)];
        tsSourceFile = ts.factory.updateSourceFile(tsSourceFile, [...contents]);
      }


      return tsSourceFile;
    };
  };
};
