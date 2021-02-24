/*
 * @Author: lishuo06
 * @LastEditors: lishuo06
 * @Date: 2021-02-08 18:50:46
 * @LastEditTime: 2021-02-23 16:32:04
 * @Description: file content
 * @FilePath: /retidy/src/extractor/webpack/webpack-extractor.ts
 */

import { Extractor } from "../extractor-utils"
import { extractModules } from "./extract-modules"
import { getModuleFunctionParamsTransformer } from "./transformer"

export const webpackExtractor: Extractor = (ast, options) => {
    const extractResult = extractModules(ast, options)

    if (options.replaceModuleFunctionParams) {
        // add webpack specific transformer
        if (!options.extraTransformers || !Array.isArray(options.extraTransformers)) {
            options.extraTransformers = []
        }
        // Transform variables defined in ModuleFunction params to their real values
        const { entry } = extractResult
        const transformer = getModuleFunctionParamsTransformer(entry, options)
        options.extraTransformers.push(transformer)
    }

    return extractResult
}

export default webpackExtractor
