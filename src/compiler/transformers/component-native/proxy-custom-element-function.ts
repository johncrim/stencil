import type * as d from '../../../declarations';
import { xyzRenameCreateComponentMetadataProxy } from '../add-component-meta-proxy';
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

      const extracted = (principalComponent: d.ComponentCompilerMeta) => {
        let statementIdx = -1;
        let myStatement = undefined;
        for (let i = 0; i < tsSourceFile.statements.length; i++) {
          let statement = tsSourceFile.statements[i];
          if (ts.isVariableStatement(statement)) {
            for (let declaration of statement.declarationList.declarations) {
              // TODO: should we be using escapedText?
              if (declaration.name.getText() === principalComponent.componentClassName) {
                // ok we think we've found it
                return {
                  myStatement: declaration.initializer,
                  statementIdx: i,
                }
              }
            }
          }
        }
        return { statementIdx, myStatement };
      }

      if (moduleFile.cmps.length) {
        const principalComponent = moduleFile.cmps[0];
        let { statementIdx, myStatement } = extracted(principalComponent);

        if (!myStatement) {
          // we couldn't find it, so we're done
          return tsSourceFile;
        }
        // const classExpression: any = null; // TODO: Find me //ts.createClassExpression(classModifiers, undefined, classNode.typeParameters, heritageClauses, members);
        const proxyCreationCall = xyzRenameCreateComponentMetadataProxy(principalComponent, myStatement);
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
            ts.NodeFlags.Let
          )
        );

        let contents = [...tsSourceFile.statements.slice(0, statementIdx), _ryanUseThisBelow, ...tsSourceFile.statements.slice(statementIdx+1)];
        tsSourceFile = ts.factory.updateSourceFile(tsSourceFile, [...contents]);
      }


      return tsSourceFile;
    };
  };
};
