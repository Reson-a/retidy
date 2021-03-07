
import { VisitorWrapper } from "../../utils/visitor-wrapper"
import { ModuleId } from "../module"
import { parseExpression } from "@babel/parser"
import { NodePath } from "@babel/traverse"
import {
    isVariableDeclaration,
    isIdentifier,
    isMemberExpression,
    isNumericLiteral,
    isStringLiteral,
    isNullLiteral,
    isFunctionExpression,
    identifier,
    callExpression,
    stringLiteral,
    memberExpression,
    objectExpression,
    objectProperty,
    booleanLiteral,
    Identifier,
    FunctionExpression,
    CallExpression,
    Statement,
    Program,
    toStatement,
    isAssignmentExpression,
} from "@babel/types"
import { isRelativeModulePath } from '../../utils/is-relative-module-path'
import { join as pathJoin } from 'path'
import { Options } from "../../options"

const transformErr = () => new Error("something goes wrong.")
const unknownRuntimeFnErr = () => new Error("unknown webpack runtime function")

const REQUIRE_CALLEE = identifier("require")
const DEFINEPROPERTY_CALLEE = memberExpression(identifier("Object"), identifier("defineProperty")) // Object.defineProperty

const WEBPACK_REQUIRE_N_CALLEE = identifier("__webpack_getDefaultExport")
const WEBPACK_REQUIRE_N = toStatement(parseExpression(`
/**
 * @template T
 * @argument {T} m
 * @returns {T extends { __esModule: true } ? () => T['default'] : () => T}
 */
function ${WEBPACK_REQUIRE_N_CALLEE.name}(m) {
    var getter = m && m.__esModule ?
        function getDefault() { return m["default"] } :
        function getModuleExports() { return m }
        Object.defineProperty(getter, "a", { enumerable: true, get: getter })
    return getter
}
`) as FunctionExpression)

const WEBPACK_REQUIRE_E_CALLEE = identifier("__webpack_loadChunk")
const WEBPACK_REQUIRE_E = toStatement(parseExpression(`
function ${WEBPACK_REQUIRE_E_CALLEE.name}(chunkId) {
    return Promise.resolve(void chunkId) // noop
}
`) as FunctionExpression)

const addGlobalStatement = (path: NodePath<CallExpression>, statement: Statement) => {
    const rootNode = path.scope.getProgramParent().path.node as Program
    if (!rootNode.body.includes(statement)) {
        rootNode.body.push(statement)
    }
}

const isWebpackRequire = (node: object): node is Identifier => {
    return isIdentifier(node, { name: "__webpack_require__" })
}

const transformWebpackRequire = (path: NodePath<CallExpression>, requireIdE: CallExpression["arguments"][0], entryId: ModuleId, options: Options) => {
    if (isAssignmentExpression(requireIdE)) {
        requireIdE = requireIdE.right
    }
    if (!isNumericLiteral(requireIdE) && !isStringLiteral(requireIdE)) {
        return console.error(transformErr, requireIdE)
        // throw transformErr()
    }


    const requireId = requireIdE.value.toString()
    const isEntryRequire = requireId == entryId
    // const requirePath = `./${isEntryRequire ? "entry_" : ""}${requireId}`
    let requirePath = isRelativeModulePath(requireId) ? pathJoin('/', (options.basePath + requireId).replace(/\.js$/, '.ts')) : requireId

    path.replaceWith(
        callExpression(REQUIRE_CALLEE, [stringLiteral(requirePath)])
    )
}

/**
 * Transform variables defined in ModuleFunction params to their real values
 * 
 * minified ModuleFunction: `function(e,t,n){`,  
 * unminified: `function(module, exports, __webpack_require__) {`.
 * 
 * replace `e` with `module`, `t` with `exports`, `n` -> `__webpack_require__` in extracted program body,  
 * and transform `__webpack_require__` to normal `require`
 */
export const getModuleFunctionParamsTransformer = (entryId: ModuleId, options: Options) => {
    return VisitorWrapper({

        Program(path) {
            const { node } = path

            const paramsTransE = node.body[0]
            if (!isVariableDeclaration(paramsTransE, { kind: "const" })) {
                throw transformErr()
            }

            paramsTransE.declarations.forEach((d) => {
                const { id, init } = d
                if (!isIdentifier(id) || !isIdentifier(init)) {
                    throw transformErr()
                }

                const paramName = id.name
                const realValue = init.name

                path.scope.rename(paramName, realValue)
            })

            // remove paramsTransE
            node.body.shift()
        },

        // transform `__webpack_require__`
        CallExpression(path) {
            const { node } = path
            const { callee, arguments: callArgs } = node

            // check __webpack_require__
            if (isWebpackRequire(callee)) {
                // transform `__webpack_require__` to normal `require`
                // `__webpack_require__(0)` -> `require("./0")`
                const { 0: requireIdE } = callArgs
                transformWebpackRequire(path, requireIdE, entryId, options)
                // } else if ( // __webpack_require__.fn(exports, …
                //     isMemberExpression(callee) &&
                //     isWebpackRequire(callee.object) &&
                //     isIdentifier(callee.property)
                // ) {
                //     const method = callee.property.name
                //     if (method == "d") {  // callArgs.length > 1
                //         // transform `__webpack_require__.d(exports, "…", function(){…})`
                //         // __webpack_require__.d: define getter function for harmony exports
                //         const [, exportName, exportGetter] = callArgs
                //         if (!isStringLiteral(exportName) && !isFunctionExpression(exportGetter)) {
                //             throw transformErr()
                //         }

                //         path.replaceWith(
                //             callExpression(DEFINEPROPERTY_CALLEE, [ // Object.defineProperty(exports, name, {…
                //                 identifier("exports"),
                //                 exportName,
                //                 objectExpression([ // { enumerable: true, get: exportGetter }
                //                     objectProperty(identifier("enumerable"), booleanLiteral(true)),
                //                     objectProperty(identifier("get"), exportGetter as FunctionExpression),
                //                 ])
                //             ])
                //         )
                //     } else if (method == "r") {
                //         // transform `__webpack_require__.r(exports)
                //         // __webpack_require__.r: define __esModule on exports
                //         //                        (useless for our "re-tidied" code)

                //         // path.replaceWithSourceString(
                //         //      `Object.defineProperty(exports, '__esModule', { value: true });`
                //         // )
                //         path.replaceWith(
                //             callExpression(DEFINEPROPERTY_CALLEE, [
                //                 identifier("exports"),
                //                 stringLiteral("__esModule"),
                //                 objectExpression([
                //                     objectProperty(identifier("value"), booleanLiteral(true)),
                //                 ])
                //             ])
                //         )
                //     } else if (method == "n") {
                //         // __webpack_require__.n(…)
                //         // __webpack_require__.n: getDefaultExport function for compatibility with non-harmony modules

                //         if (callArgs.length !== 1 || !isIdentifier(callArgs[0])) {
                //             throw transformErr()
                //         }

                //         path.replaceWith(
                //             callExpression(WEBPACK_REQUIRE_N_CALLEE, callArgs)
                //         )

                //         addGlobalStatement(path, WEBPACK_REQUIRE_N)
                //     } else if (method == "bind") {
                //         // __webpack_require__.bind(null, …)

                //         if (!isNullLiteral(callArgs[0])) {
                //             throw transformErr()
                //         }

                //         const requireIdE = callArgs[1]
                //         transformWebpackRequire(path, requireIdE, entryId)
                //     } else if (method == "e") {
                //         // __webpack_require__.e: load jsonp chunk

                //         const [chunkId] = callArgs
                //         if (callArgs.length !== 1) {
                //             throw transformErr()
                //         }
                //         if (!isNumericLiteral(chunkId) && !isStringLiteral(chunkId)) {
                //             throw transformErr()
                //         }

                //         // `Promise.resolve(/* webpack chunk: ${chunkId.value} */)`
                //         path.replaceWith(
                //             callExpression(WEBPACK_REQUIRE_E_CALLEE, callArgs)
                //         )

                //         addGlobalStatement(path, WEBPACK_REQUIRE_E)
                //     } else {
                //         console.error(unknownRuntimeFnErr())
                //     }
            }
        },

    })
}
