/*
 * @Author: lishuo06
 * @LastEditors: lishuo06
 * @Date: 2021-03-02 17:37:51
 * @LastEditTime: 2021-03-02 19:57:34
 * @Description: file content
 * @FilePath: /retidy/src/utils/is-valid-identifier.ts
 */

import { isValidIdentifier as isBabelValidIdentifier } from "@babel/types";

export function isValidIdentifier(name: string) {
  return isBabelValidIdentifier(name) && /^[a-zA-Z_]\w*$/.test(name);
}
