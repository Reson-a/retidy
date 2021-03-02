/*
 * @Author: lishuo06
 * @LastEditors: lishuo06
 * @Date: 2021-03-01 11:32:51
 * @LastEditTime: 2021-03-02 11:28:27
 * @Description: file content
 *
 * @FilePath: /retidy/src/transforms/transform-class.ts
 */

import VisitorWrapper from "../utils/visitor-wrapper";
import {
  NumericLiteral,
  isNumericLiteral,
  identifier,
  Identifier,
  isFunctionExpression,
  isFunctionDeclaration,
  isIdentifier,
  isCallExpression,
  isExpressionStatement,
  isVariableDeclaration,
  callExpression,
  classDeclaration,
  classBody,
  classMethod,
  ClassDeclaration,
  isMemberExpression,
  expressionStatement,
  isAssignmentExpression,
  classProperty,
  isProgram,
  thisExpression,
  VariableDeclarator,
  restElement,
  spreadElement,
} from "@babel/types";
import { NodePath } from "@babel/traverse";

export const transformClass = VisitorWrapper({
  CallExpression(path) {
    let { node, key, parentPath } = path;
    let { callee, arguments: args } = node;
    if (key == "init" && parentPath.isVariableDeclarator()) {
      let clsName = (parentPath.node.id as Identifier).name;
      // 如果后面存在直接修改原型的操作，就不进行转换 class原型writable为false
      if (
        parentPath.parentPath.getAllNextSiblings().some((p) => {
          if (
            p.isExpressionStatement() &&
            isAssignmentExpression(p.node.expression)
          ) {
            let { left } = p.node.expression;
            if (
              isMemberExpression(left) &&
              isIdentifier(left.object, { name: clsName }) &&
              isIdentifier(left.property, { name: "prototype" })
            )
              return true;
          }
        })
      )
        return;
      let clsNode: ClassDeclaration;
      if (isFunctionExpression(callee)) {
        callee.body.body.forEach((exp) => {
          if (isFunctionDeclaration(exp)) {
            if (clsName.includes(exp.id.name)) {
              let clsBody = [];
              if (exp.body.body.length)
                clsBody.push(
                  classMethod(
                    "constructor",
                    identifier("constructor"),
                    exp.params,
                    exp.body
                  )
                );
              clsNode = classDeclaration(
                identifier(clsName),
                args[0] as Identifier,
                classBody(clsBody)
              );
            }
          }
          if (isExpressionStatement(exp) && clsNode) {
            if (isAssignmentExpression(exp.expression)) {
              let { left, right } = exp.expression;
              if (isMemberExpression(left)) {
                let { object, property } = left;
                let key = property;
                while (isMemberExpression(object)) {
                  property = object.property;
                  object = object.object;
                }
                if (isIdentifier(object, { name: clsName })) {
                  let isProto = isIdentifier(property, { name: "prototype" });
                  clsNode.body.body.push(
                    isFunctionExpression(right)
                      ? classMethod(
                          "method",
                          key,
                          right.params,
                          right.body,
                          false,
                          !isProto
                        )
                      : classProperty(
                          key,
                          right,
                          undefined,
                          undefined,
                          undefined,
                          !isProto
                        )
                  );
                }
              }
            }
          }
        });
      }
      if (clsNode) parentPath.parentPath.replaceWith(clsNode);
    }
    if (
      isMemberExpression(callee) &&
      isIdentifier(callee.object, { name: "_super" }) &&
      ["call", "apply"].includes(callee.property.name)
    ) {
      let stateParentPath = path.getStatementParent();
      if (stateParentPath.isVariableDeclaration()) {
        path.scope.rename(
          (stateParentPath.node.declarations[0].id as Identifier).name,
          "this"
        );
      }
      args = args.slice(1);
      if (isIdentifier(args[0], { name: "arguments" }))
        args[0] = spreadElement(identifier("arguments"));
      stateParentPath.replaceWith(
        expressionStatement(callExpression(identifier("super"), args))
      );
    }
  },
  VariableDeclarator(path) {
    if (isIdentifier(path.node.id, { name: "__extends" })) {
      path.parentPath.remove();
    }
  },
});

export default transformClass;
