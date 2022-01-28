import type * as d from '../../declarations';
import type { BundleOptions } from './bundle-interface';
import { getModule } from '../transpile/transpiled-module';
import { isString, normalizeFsPath } from '@utils';
import type { LoadResult, Plugin, ResolveIdResult, TransformResult } from 'rollup';
import { tsResolveModuleName } from '../sys/typescript/typescript-resolve-module';
import { isAbsolute, basename } from 'path';
import ts from 'typescript';

/**
 *
 * @param compilerCtx
 * @param bundleOpts
 * @param config
 * @returns
 */
export const typescriptPlugin = (compilerCtx: d.CompilerCtx, bundleOpts: BundleOptions, config: d.Config): Plugin => {
  return {
    name: `${bundleOpts.id}TypescriptPlugin`,

    /**
     *
     * @param id
     * @returns
     */
    load(id: string): LoadResult {
      if (isAbsolute(id)) {
        const fsFilePath = normalizeFsPath(id);
        const module = getModule(compilerCtx, fsFilePath);

        if (module) {
          if (!module.sourceMapFileText) {
            return { code: module.staticSourceFileText, map: null };
          }

          const sourceMap: d.SourceMap = JSON.parse(module.sourceMapFileText);
          sourceMap.sources = sourceMap.sources.map((src) => basename(src));
          return { code: module.staticSourceFileText, map: sourceMap };
        }
      }
      return null;
    },
    /**
     *
     * @param _code
     * @param id
     * @returns
     */
    transform(_code: string, id: string): TransformResult {
      if (isAbsolute(id)) {
        const fsFilePath = normalizeFsPath(id);
        const mod = getModule(compilerCtx, fsFilePath);
        if (mod && mod.cmps.length > 0) {
          const tsResult = ts.transpileModule(mod.staticSourceFileText, {
            compilerOptions: config.tsCompilerOptions,
            fileName: mod.sourceFilePath,
            transformers: { before: bundleOpts.customTransformers },
          });
          const sourceMap: d.SourceMap = tsResult.sourceMapText ? JSON.parse(tsResult.sourceMapText) : null;
          return { code: tsResult.outputText, map: sourceMap };
        }
      }
      return null;
    },
  };
};

/**
 *
 * @param config
 * @param compilerCtx
 * @returns
 */
export const resolveIdWithTypeScript = (config: d.Config, compilerCtx: d.CompilerCtx): Plugin => {
  return {
    name: `resolveIdWithTypeScript`,

    /**
     *
     * @param importee
     * @param importer
     * @returns
     */
    async resolveId(importee, importer): Promise<ResolveIdResult> {
      if (/\0/.test(importee) || !isString(importer)) {
        return null;
      }

      const tsResolved = tsResolveModuleName(config, compilerCtx, importee, importer);
      if (tsResolved && tsResolved.resolvedModule) {
        // this is probably a .d.ts file for whatever reason in how TS resolves this
        // use this resolved file as the "importer"
        const tsResolvedPath = tsResolved.resolvedModule.resolvedFileName;
        if (isString(tsResolvedPath) && !tsResolvedPath.endsWith('.d.ts')) {
          return tsResolvedPath;
        }
      }

      return null;
    },
  };
};
