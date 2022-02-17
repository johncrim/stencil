import type * as d from '../../declarations';
import ts from 'typescript';
import { DIST_CUSTOM_ELEMENTS } from '../output-targets/output-utils';
import { xyzRenameCreateComponentMetadataProxy } from './add-component-meta-proxy';

export const updateComponentClass = (
  transformOpts: d.TransformOptions,
  classNode: ts.ClassDeclaration,
  heritageClauses: ts.HeritageClause[] | ts.NodeArray<ts.HeritageClause>,
  members: ts.ClassElement[],
  outputTarget?: d.OutputTarget,
) => {
  let classModifiers = Array.isArray(classNode.modifiers) ? classNode.modifiers.slice() : [];

  if (transformOpts.module === 'cjs') {
    // CommonJS, leave component class as is

    if (transformOpts.componentExport === 'customelement') {
      // remove export from class
      classModifiers = classModifiers.filter((m) => {
        return m.kind !== ts.SyntaxKind.ExportKeyword;
      });
    }
    return ts.updateClassDeclaration(
      classNode,
      classNode.decorators,
      classModifiers,
      classNode.name,
      classNode.typeParameters,
      heritageClauses,
      members
    );
  }

  // ESM with export
  return createConstClass(transformOpts, classNode, heritageClauses, members, outputTarget);
};

// TODO: May need to consider how CJS is generated?
// TODO: May need to consider how else this may be called?
const createConstClass = (
  transformOpts: d.TransformOptions,
  classNode: ts.ClassDeclaration,
  heritageClauses: ts.HeritageClause[] | ts.NodeArray<ts.HeritageClause>,
  members: ts.ClassElement[],
  outputTarget?: d.OutputTarget,
) => {
  const className = classNode.name;

  const classModifiers = (Array.isArray(classNode.modifiers) ? classNode.modifiers : []).filter((m) => {
    // remove the export
    return m.kind !== ts.SyntaxKind.ExportKeyword;
  });

  const constModifiers: ts.Modifier[] = [];

  if (transformOpts.componentExport !== 'customelement') {
    constModifiers.push(ts.createModifier(ts.SyntaxKind.ExportKeyword));
  }

  if (outputTarget?.type === DIST_CUSTOM_ELEMENTS) {
    // this is the class declaration
    const proxyCreationCall = xyzRenameCreateComponentMetadataProxy(principalComponent);
    ts.addSyntheticLeadingComment(proxyCreationCall, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);

    const metaExpression = ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createIdentifier(principalComponent.componentClassName),
        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
        proxyCreationCall
      )
    );
    newStatements.push(metaExpression);
  }
  // this is the class declaration
  return ts.createVariableStatement(
    constModifiers,
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          className,
          undefined,
          ts.createClassExpression(classModifiers, undefined, classNode.typeParameters, heritageClauses, members)
        ),
      ],
      ts.NodeFlags.Let
    )
  );
};
