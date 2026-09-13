// 追加依存なしでモデルを再生成する。既存のTypeScriptを一時的に変換して実行する。
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/lib/ground-guide/model.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { groundModel, modelGltf } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/models/nagata-ground.gltf", import.meta.url), modelGltf(groundModel("opening")));
console.log("public/models/nagata-ground.gltf を生成しました（概略モデル）");
