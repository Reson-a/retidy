/*
 * @Author: lishuo06
 * @LastEditors: lishuo06
 * @Date: 2021-03-01 11:32:51
 * @LastEditTime: 2021-03-02 20:10:16
 * @Description: file content
 *
 * @FilePath: /retidy/src/transforms/transform-enum.ts
 */

import VisitorWrapper from "../utils/visitor-wrapper";
import {
  NumericLiteral,
  isNumericLiteral,
  identifier,
  Identifier,
  isFunctionExpression,
  tsEnumDeclaration,
  isAssignmentExpression,
  ExpressionStatement,
  isExpressionStatement,
  tsEnumMember,
  isMemberExpression,
  isStringLiteral,
  Expression,
  expressionStatement,
  assignmentExpression,
  memberExpression,
  isIdentifier,
  AssignmentExpression,
  Statement,
  MemberExpression,
  isLogicalExpression,
} from "@babel/types";
import { Node } from "@babel/traverse";
import { isValidIdentifier } from "../utils/is-valid-identifier";

export const transformEnum = VisitorWrapper({
  CallExpression(path) {
    let { node } = path;
    let { callee, arguments: args } = node;
    if (isFunctionExpression(callee)) {
      let id = callee.params[0] as Identifier;
      if (!id) return;
      let enumDeclaration = tsEnumDeclaration(id, []);
      let lastValue = -1;
      callee.body.body.forEach((item) => {
        if (!enumDeclaration) return;
        if (
          isExpressionStatement(item) &&
          isAssignmentExpression(item.expression)
        ) {
          let { left, right } = item.expression;
          let init;
          if (isMemberExpression(left) && isStringLiteral(right)) {
            if (
              isIdentifier(left.object, { name: id.name }) &&
              isAssignmentExpression(left.property)
            ) {
              init = left.property.right;
              if (init.value == lastValue + 1) {
                lastValue = init.value;
                init = undefined;
              } else lastValue = init.value;
            }
            let name = isValidIdentifier(right.value)
              ? identifier(right.value)
              : right;
            enumDeclaration.members.push(tsEnumMember(name, init));
          } else enumDeclaration = null;
        } else enumDeclaration = null;
      });

      if (enumDeclaration) {
        path.scope.getBinding(id.name)?.path.remove();
        let exps: Node[] = [enumDeclaration];
        let [arg0] = args;
        if (
          isAssignmentExpression(arg0) &&
          isIdentifier(arg0.left) &&
          isLogicalExpression(arg0.right)
        ) {
          exps.push(
            expressionStatement(
              assignmentExpression(
                "=",
                arg0.right.left as MemberExpression,
                arg0.left
              )
            )
          );
        }
        path.replaceWithMultiple(exps);
      }
    }
  },
});

export default transformEnum;
