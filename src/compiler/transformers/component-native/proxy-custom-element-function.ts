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
      const newStatements: ts.Statement[] = [];

      // i think we need to decouple this - the problem is that we add this CR-API, but that doesn't get added as an
      // mport for a long time.
      // idk if its removed if we reorder this, but at the end of the day, we need proxyCustomElement to be added before
      // we add the call to pCE with an anonymous class.
      // the problem, is that the anonymous class exists properly after this transformer is called. so what we really
      // need is
      // 1. add the API
      // 2. Generate the anonymous class
      // 3. Use that anon class in the pCE call
      // 4. call add imports
      // 5. build out the recursive calls

      let statmentIdx = -1;
      if (moduleFile.cmps.length) {
        const principalComponent = moduleFile.cmps[0];

        ////

        let myStatement = undefined;
        for (let i = 0; i < tsSourceFile.statements.length; i++) {
          let statement = tsSourceFile.statements[i];
          if (ts.isVariableStatement(statement)) {
            for (let declaration of statement.declarationList.declarations) {
                // TODO: should we be using escapedText?
                if (declaration.name.getText() === principalComponent.componentClassName) {
                  // ok we think we've found it
                  myStatement = declaration.initializer;
                  statmentIdx = i;
                  break;
                }
              }
            if (myStatement) {
              break;
            }
          // TODO: HACKY BREAK BREAK NEEDED
        }}

        if (!myStatement) {
          // we couldn't find it, so we're done
          return tsSourceFile;
        }
        // const classExpression: any = null; // TODO: Find me //ts.createClassExpression(classModifiers, undefined, classNode.typeParameters, heritageClauses, members);
        const proxyCreationCall = xyzRenameCreateComponentMetadataProxy(principalComponent, myStatement as any);

        ts.addSyntheticLeadingComment(proxyCreationCall, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);

        // TODO: This needs to get sliced in correctly. Ugh
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
        // newStatements.push(_ryanUseThisBelow)
        let contents = [...tsSourceFile.statements.slice(0, statmentIdx), _ryanUseThisBelow, ...tsSourceFile.statements.slice(statmentIdx+1)];
        tsSourceFile = ts.factory.updateSourceFile(tsSourceFile, [...contents, ...newStatements]);
      }


      return tsSourceFile;
    };
  };
};
