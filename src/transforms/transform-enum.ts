/*
 * @Author: lishuo06
 * @LastEditors: lishuo06
 * @Date: 2021-03-01 11:32:51
 * @LastEditTime: 2021-03-01 11:41:10
 * @Description: file content
 * 
 * @FilePath: /retidy/src/transforms/transform-enum.ts
 */

import VisitorWrapper from "../utils/visitor-wrapper"
import { NumericLiteral, isNumericLiteral, identifier } from "@babel/types"


export const transformEnum = VisitorWrapper({
    FunctionExpression() { }
})

export default transformEnum
