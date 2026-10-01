// 管理用スクリプトから既存Repositoryを呼び、DBアクセスの契約を共有する。
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    let candidate;
    if (specifier.startsWith("@/")) candidate = path.join(root, "src", specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      candidate = fileURLToPath(new URL(specifier, context.parentURL));
    }
    if (candidate) {
      for (const file of [candidate + ".ts", path.join(candidate, "index.ts")]) {
        if (existsSync(file)) return nextResolve(pathToFileURL(file).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts")) {
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
